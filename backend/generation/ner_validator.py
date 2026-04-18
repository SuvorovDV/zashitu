"""NER-валидатор для слайдов — объективный check «каждая именованная сущность
из слайдов встречается в источнике».

Backstop для ситуаций, когда Claude silently дополняет контент своими знаниями
но не помечает «общее знание» (см. DECISIONS.md «Enhance-режим…»).

Подход:
- regex-экстрактор entities 4 типов: топонимы, аббревиатуры, числа с единицами, годы
- normalize_token: срезает окончания (грубый stemming под русскую морфологию)
- SYNONYMS: hand-curated dict частотных пар (Кузбасс ↔ Кемеровская обл.)
- validate_slides возвращает список entities из slides, не встретившихся в source
"""
from __future__ import annotations

import re
import unicodedata
from typing import Iterable

# Регексы для 4 типов NE. Non-greedy, неперекрывающиеся.
_PATTERNS = [
    # Топонимы: имя собственное с характерным корневым суффиксом в именительном падеже
    # на границе слова. Ловит: Прокопьевск, Осинники, Новосибирск, Магадан.
    # Склонённые формы («Прокопьевске») отлавливаются через стемминг в _entity_present_in_source
    # при наличии базовой формы в исходнике; изолированные склонения не ловим — false-positive
    # рост от «Географическая» и подобных прилагательных перевешивает.
    re.compile(r"\b[А-ЯЁ][а-яё]{3,}(?:ск|цк|ов|ин|ыш)\b"),
    # Географические уточнения: «Кемеровская область», «Красноярский край».
    re.compile(r"\b[А-ЯЁ][а-яё]{3,}(?:ая|ий|ое|ой|ей|ую|ого|их|ских?)\s+(?:область|области|край|края|округ|округа|республик[аи])\b"),
    # Аббревиатуры кириллические: СУЭК, ЕВРАЗ, ФНС, ВВП.
    re.compile(r"\b[А-ЯЁ]{2,}(?:-[А-ЯЁ0-9]+)?\b"),
    # Латинские аббревиатуры: IT, CRM, AI, HH, ВТБ→VTB латиница.
    re.compile(r"\b[A-Z]{2,}\b"),
    # Числа с единицами. Внутри числа — только digits/comma/period/non-breaking space
    # (U+00A0 = «1 287»), без обычных пробелов, чтобы не склеивались «2024 412,8».
    re.compile(r"\b\d[\d,.\u00a0]*\s*(?:%|руб\.?|₽|тыс\.?|млн\.?|млрд\.?|трлн\.?|чел\.?|дн[яей]?|мес[яца]*|секунд\w*)\b"),
    # Годы 19xx/20xx — 4 цифры с границей слова, чтобы не склеились с «412,8 млрд».
    re.compile(r"(?<![\d,.])(?:19|20)\d{2}(?!\s*(?:[,.]|тыс|млн|млрд|трлн|руб|₽|%|чел))"),
    # ФИО: 2 заглавных слова подряд (Имя + Фамилия).
    re.compile(r"\b[А-ЯЁ][а-яё]{2,}\s+[А-ЯЁ][а-яё]{3,}\b"),
]

# Слова-обманки в двусловной entity — если любой из токенов из этого списка,
# entity не считается ФИО/топонимом (структурная/меташная конструкция, не сущность).
_PHRASE_WORD_STOPLIST = {
    # Географические служебные
    "область", "области", "край", "края", "округ", "округа",
    "республика", "республики", "район", "районе",
    "федерации", "федерация",
    # Структурные (часть/раздел/глава)
    "часть", "части", "раздел", "раздела", "глава", "главы",
    "этап", "этапа", "блок", "блока", "фаза", "фазы",
    "город", "города", "году", "года", "годе",
    # Меташные (слайд о чём, а не факт)
    "доклад", "доклада", "доклады",
    "работа", "работы", "работе",
    "презентация", "презентации",
    "исследование", "исследования", "исследований",
    "анализ", "анализа", "анализу",
    "обзор", "обзора", "обзору",
    "выводы", "выводов", "вывод",
    "заключение", "заключения",
    "введение", "введения",
}

# Стоп-лист сущностей, которые всегда «общеупотребимы» и не считаются NE даже
# если попали в regex. Снижает false-positives.
_STOPLIST = {
    "Россия", "Российская Федерация", "РФ", "СССР", "Европа", "Азия", "Китай",
    "США", "Германия", "Франция", "Англия", "Великобритания", "Япония",
    "Москва", "Санкт-Петербург", "Петербург",  # слишком частые, матчатся практически всегда
    "Например", "Также", "Кроме", "Именно", "Тогда", "Здесь", "Однако",
    "ИИ", "AI",  # часть речи, не сущность
    "РЕЧИ", "РЕЧЬ",  # технические токены из промпта
    "НИУ",  # сокращение национальных исследовательских университетов — общепринятое
    "ООО", "ОАО", "ПАО", "ИП", "АО",  # правовые формы
    "ЖКХ", "ВВП", "ВРП",  # макро-экономические, общеупотребимые
}

# Ручной словарь синонимов. Если в slides встретилось «Кузбасс», а в source
# только «Кемеровская область» (или наоборот) — считаем совпадением.
_SYNONYMS: dict[str, set[str]] = {
    "кузбасс": {"кемеровская область", "кемеровск", "кузбасса", "кузбассе"},
    "т-банк": {"тинькофф", "tcs"},
    "мсп": {"малый и средний бизнес", "малое и среднее предпринимательство"},
    "рф": {"россия", "российская федерация", "российск"},
    "вшэ": {"высшая школа экономики", "ниу вшэ"},
    "вкр": {"выпускная квалификационная работа", "дипломная работа"},
}


def _stem(word: str) -> str:
    """Грубый стемминг: срезает типичные русские окончания падежей.
    Для слов длиннее 6 символов срезает 1-3 последних букв, для более коротких — меньше."""
    word = unicodedata.normalize("NFKC", word).strip().lower()
    if len(word) <= 3:
        return word
    # Типичные окончания: -ая/-ий/-ую/-ой/-ей/-ия/-ии/-ие/-ые/-ых/-ого/-ему/-ыми/-ость/-ости/-ского/-ской/-ская.
    # Срезаем до стабильной основы. Примеры:
    #   Московская → Московск, Московскую → Московск, Московской → Московск.
    #   Опоры → Опор, Опора → Опор, Опоре → Опор.
    #   Росстата → Росстат, Росстатом → Росстат.
    for suffix in (
        "ского", "ской", "скую", "ская", "ские", "ских", "ском",
        "ового", "овой", "овую", "овая", "овые", "овых",
        "ости", "остью", "ость",
        "ами", "ями", "ого", "ому", "ыми", "ими", "ему",
        "ая", "ий", "ое", "ой", "ей", "ую", "ыш",
        "ой", "ы", "и", "у", "ю", "е", "а", "я", "о",
    ):
        if len(word) > len(suffix) + 3 and word.endswith(suffix):
            return word[: -len(suffix)]
    # Одиночный мягкий/твёрдый знак в конце тоже убираем.
    if word[-1] in "ьъ":
        return word[:-1]
    return word


def _normalize(s: str) -> str:
    """Lowercase + NFKC + stem — для одного слова."""
    return _stem(s.strip())


def _normalize_phrase(s: str) -> str:
    """Применяет stem к каждому слову фразы, склеивает пробелом."""
    return " ".join(_stem(w) for w in re.split(r"\s+", s) if w)


def _split_tokens(entity: str) -> list[str]:
    """Многословная сущность → список нормализованных слов. Используется
    для частичного матча («СберБанк» в slide vs «СберБанка» в source)."""
    return [_normalize(p) for p in entity.split() if p]


def _expand_with_synonyms(entity: str) -> set[str]:
    """Возвращает set нормализованных форм + синонимы из словаря."""
    forms = {_normalize(entity)}
    for canonical, variants in _SYNONYMS.items():
        if _normalize(entity) in {canonical} | {_normalize(v) for v in variants}:
            forms.add(canonical)
            forms.update(_normalize(v) for v in variants)
    return forms


def extract_entities(text: str) -> set[str]:
    """Ищет все NE в тексте. Возвращает set оригинальных строк (для отображения)."""
    if not text:
        return set()
    ents: set[str] = set()
    for pat in _PATTERNS:
        for m in pat.finditer(text):
            s = m.group(0).strip()
            if s in _STOPLIST:
                continue
            if len(s) < 2:
                continue
            # Фильтр ложных фраз: если ЛЮБОЕ из слов — из обманок (часть, область, доклад, работа…).
            parts = s.split()
            if len(parts) >= 2 and any(p.lower() in _PHRASE_WORD_STOPLIST for p in parts):
                continue
            ents.add(s)
    return ents


def _entity_present_in_source(entity: str, source_normalized_phrase: str, source_normalized_raw: str) -> bool:
    """Проверяет, есть ли сущность в source.
    source_normalized_phrase — исходник, где КАЖДОЕ слово застеммлено.
    source_normalized_raw — исходник просто в lowercase NFKC (для чисел/аббревиатур).
    """
    # Числа/годы/проценты — ищем точно в raw-форме (без стемминга).
    if re.match(r"^\d", entity):
        return entity.strip() in source_normalized_raw
    # Двухсловные фразы (ФИО, «Московская область», «Опора России») —
    # стеммим и ищем в phrase-нормализованном source.
    normalized = _normalize_phrase(entity)
    if normalized in source_normalized_phrase:
        return True
    # Синонимы для известных пар (Кузбасс ↔ Кемеровская область).
    for form in _expand_with_synonyms(entity):
        if form in source_normalized_phrase:
            return True
    # Для аббревиатур и мультислов — ещё раз проверяем по отдельным токенам
    # (все токены entity должны встречаться в source, не обязательно подряд).
    tokens = [_stem(w) for w in re.split(r"\s+", entity) if w]
    if not tokens:
        return False
    if len(tokens) == 1:
        return tokens[0] in source_normalized_phrase
    return all(tok in source_normalized_phrase for tok in tokens)


def validate_slides(slide_contents: Iterable[dict], source_text: str) -> list[dict]:
    """
    Прогоняет сгенерированные slide-contents против source-текста.
    Возвращает список hallucinated entities: [{entity, slide_idx, layout}].

    slide_contents — list из SlideContent.model_dump() (поля bullets, callout,
    quote, intro, stats, columns и т.д.).
    source_text — конкатенация всего, что у нас есть от юзера (speech + optional PDF).
    """
    if not source_text:
        return []

    source_normalized_raw = unicodedata.normalize("NFKC", source_text).lower()
    source_normalized_phrase = _normalize_phrase(source_text.lower())

    hallucinated: list[dict] = []

    for idx, slide in enumerate(slide_contents):
        if not isinstance(slide, dict):
            continue
        layout = slide.get("layout", "default")

        # Собираем весь текст слайда.
        slide_text_parts: list[str] = []
        for key in ("title", "subtitle", "callout", "quote", "attribution", "intro"):
            v = slide.get(key)
            if isinstance(v, str):
                slide_text_parts.append(v)
        for key in ("bullets", "labels"):
            v = slide.get(key)
            if isinstance(v, list):
                slide_text_parts.extend(str(x) for x in v if x)
        if isinstance(slide.get("stats"), list):
            for st in slide["stats"]:
                if isinstance(st, dict):
                    if st.get("value"):
                        slide_text_parts.append(str(st["value"]))
                    if st.get("label"):
                        slide_text_parts.append(str(st["label"]))
        if isinstance(slide.get("columns"), list):
            for col in slide["columns"]:
                if isinstance(col, dict):
                    if col.get("heading"):
                        slide_text_parts.append(str(col["heading"]))
                    if isinstance(col.get("bullets"), list):
                        slide_text_parts.extend(str(x) for x in col["bullets"] if x)
        if isinstance(slide.get("headers"), list):
            slide_text_parts.extend(str(h) for h in slide["headers"] if h)
        if isinstance(slide.get("rows"), list):
            for row in slide["rows"]:
                if isinstance(row, list):
                    slide_text_parts.extend(str(c) for c in row if c)

        slide_text = " ".join(slide_text_parts)
        slide_entities = extract_entities(slide_text)

        for ent in slide_entities:
            if not _entity_present_in_source(ent, source_normalized_phrase, source_normalized_raw):
                hallucinated.append({
                    "entity": ent,
                    "slide_idx": idx,
                    "layout": layout,
                })

    return hallucinated


def summarize(hallucinated: list[dict]) -> str:
    """Человеко-читаемый summary для логов."""
    if not hallucinated:
        return "no hallucinated entities"
    by_slide: dict[int, list[str]] = {}
    for h in hallucinated:
        by_slide.setdefault(h["slide_idx"], []).append(h["entity"])
    lines = [f"{len(hallucinated)} hallucinated entities across {len(by_slide)} slides:"]
    for idx in sorted(by_slide):
        lines.append(f"  slide {idx + 1}: {', '.join(sorted(by_slide[idx])[:6])}")
    return "\n".join(lines)
