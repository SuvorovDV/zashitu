import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { paymentsApi } from '../api/index.js'
import { useAuth } from '../hooks/index.js'
import Spinner from '../components/ui/Spinner.jsx'

const STEPS = [
  {
    num: '01',
    title: 'Загрузите работу',
    desc: 'PDF или DOCX — диплом, курсовая, реферат. До 20 МБ.',
  },
  {
    num: '02',
    title: 'ИИ извлекает тезисы',
    desc: 'Читает текст, выделяет ключевые положения, фиксирует номер страницы для каждого.',
  },
  {
    num: '03',
    title: 'Скачайте .pptx',
    desc: 'Открывается в PowerPoint, Keynote, Google Slides. Редактируется как обычная презентация.',
  },
]

const FEATURES = [
  {
    title: 'Только ваш текст',
    desc: 'ИИ не придумывает фактов и цифр. Всё, что попадает на слайды, взято из вашего файла.',
  },
  {
    title: 'Ссылки на страницы',
    desc: 'Каждый тезис снабжён номером страницы — научрук сможет проверить источник за секунды.',
  },
  {
    title: '.pptx под редактирование',
    desc: 'Не картинка и не PDF. Открывайте в PowerPoint или Keynote, меняйте всё до защиты.',
  },
  {
    title: '1–2 минуты от загрузки',
    desc: 'Обработка и сборка — одним проходом, в фоне. Без очередей и «зайдите завтра».',
  },
]

const CheckIcon = ({ className = 'w-3.5 h-3.5' }) => (
  <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

function SectionKicker({ num, children }) {
  return (
    <p className="font-mono text-xs tracking-wider text-[#7A7362] mb-6 uppercase">
      {num} — {children}
    </p>
  )
}

export default function Landing() {
  const { user } = useAuth()

  const { data: tiers, isLoading: tiersLoading } = useQuery({
    queryKey: ['tiers'],
    queryFn: () => paymentsApi.getTiers().then((r) => r.data),
    staleTime: 60_000,
  })

  const ctaHref = user ? '/wizard' : '/register'

  return (
    <div className="flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="px-5 pt-24 pb-24 md:pt-32 md:pb-32 border-b border-[#2E2820]">
        <div className="max-w-5xl mx-auto">
          <p className="font-mono text-xs tracking-wider text-[#7A7362] mb-10 uppercase">
            Tezis — презентации для защиты
          </p>

          <h1
            className="font-serif text-5xl md:text-6xl lg:text-[5.25rem] font-normal tracking-tight mb-8 text-white leading-[1.04] max-w-4xl"
            style={{ textWrap: 'balance' }}
          >
            Презентация защиты —
            <br />
            <span className="text-[#B8AE97]">из вашей работы, не из воздуха.</span>
          </h1>

          <p
            className="text-[#B8AE97] text-lg md:text-xl leading-relaxed mb-12 max-w-2xl"
            style={{ textWrap: 'pretty' }}
          >
            Tezis превращает PDF или DOCX в .pptx. Каждый тезис — со ссылкой на страницу источника: научрук увидит, откуда взят каждый факт.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <Link
              to={ctaHref}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0E0B]"
            >
              Создать презентацию
              <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-2 px-1 py-3 text-[#B8AE97] hover:text-white font-medium text-base transition-colors duration-200 border-b border-[#4A402F] hover:border-[#F5F1E8] self-start sm:self-auto"
            >
              Как это работает
              <span aria-hidden="true">→</span>
            </a>
          </div>

          <p className="mt-12 text-[#7A7362] text-sm font-mono tracking-wide">
            PDF / DOCX&nbsp;&nbsp;·&nbsp;&nbsp;Скачивание .pptx&nbsp;&nbsp;·&nbsp;&nbsp;Редактируется в PowerPoint
          </p>
        </div>
      </section>

      {/* ── Два режима ───────────────────────────────────────────────────── */}
      <section id="modes" className="py-24 px-5 border-b border-[#2E2820]" style={{ backgroundColor: '#17140F' }}>
        <div className="max-w-5xl mx-auto">
          <SectionKicker num="01">Два режима</SectionKicker>
          <h2 className="font-serif text-3xl md:text-5xl font-normal text-white mb-5 max-w-3xl leading-[1.1]">
            Только презентация —<br className="hidden md:block" /> или с текстом выступления.
          </h2>
          <p className="text-[#B8AE97] text-[15px] md:text-base leading-relaxed mb-14 max-w-2xl">
            Нужны только слайды — соберём. Нужен ещё и готовый сценарий защиты на 5–15 минут — допишем и синхронизируем со слайдами.
          </p>

          <div className="grid md:grid-cols-2 gap-px bg-[#2E2820] border border-[#2E2820]">
            <div className="bg-[#0F0E0B] p-7 md:p-10 flex flex-col gap-5">
              <p className="font-mono text-[11px] tracking-wider text-[#7A7362] uppercase">Режим A</p>
              <h3 className="font-serif text-2xl text-white leading-tight">Только презентация</h3>
              <p className="text-[#B8AE97] text-sm leading-relaxed">
                Загружаете .pdf/.docx — получаете .pptx. 12–30 слайдов, 10 палитр, ссылки на страницы вашей работы.
              </p>
              <ul className="flex flex-col gap-2.5 text-sm text-[#B8AE97] mt-auto pt-6 border-t border-[#2E2820]">
                {['Готовые макеты под научную работу', 'Формат .pptx', 'Редактируется в PowerPoint / Keynote / Google Slides'].map((i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckIcon className="w-3.5 h-3.5 text-[#7A7362] flex-shrink-0 mt-[5px]" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[#0F0E0B] p-7 md:p-10 flex flex-col gap-5">
              <p className="font-mono text-[11px] tracking-wider text-brand-400 uppercase">Режим B · Новое</p>
              <h3 className="font-serif text-2xl text-white leading-tight">Презентация + текст выступления</h3>
              <p className="text-[#B8AE97] text-sm leading-relaxed">
                К слайдам добавим полный сценарий защиты на 5–15 минут: вступление, основная часть, заключение. В Markdown — удобно репетировать и править.
              </p>
              <ul className="flex flex-col gap-2.5 text-sm text-[#B8AE97] mt-auto pt-6 border-t border-[#2E2820]">
                {[
                  'Всё из Режима A',
                  'Markdown-текст на 5–15 минут',
                  'Структура «Вступление → Основная часть → Заключение»',
                  'Скачивание .md + копирование в буфер',
                ].map((i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <CheckIcon className="w-3.5 h-3.5 text-[#7A7362] flex-shrink-0 mt-[5px]" />
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Процесс ──────────────────────────────────────────────────────── */}
      <section id="how" className="py-24 px-5 border-b border-[#2E2820]" style={{ backgroundColor: '#0F0E0B' }}>
        <div className="max-w-5xl mx-auto">
          <SectionKicker num="02">Процесс</SectionKicker>
          <h2 className="font-serif text-3xl md:text-5xl font-normal text-white mb-14 max-w-3xl leading-[1.1]">
            Три шага — минуты, не часы.
          </h2>

          <div className="grid md:grid-cols-3 gap-px bg-[#2E2820] border border-[#2E2820]">
            {STEPS.map(({ num, title, desc }) => (
              <div key={num} className="bg-[#0F0E0B] p-7 md:p-10 flex flex-col gap-4">
                <span className="font-mono text-sm text-[#7A7362]">{num}</span>
                <h3 className="font-serif text-xl text-white leading-snug mt-2">{title}</h3>
                <p className="text-[#B8AE97] text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Источник ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-b border-[#2E2820]" style={{ backgroundColor: '#17140F' }}>
        <div className="max-w-5xl mx-auto">
          <SectionKicker num="03">Источник — ваша работа</SectionKicker>
          <h2 className="font-serif text-3xl md:text-5xl font-normal text-white mb-5 max-w-3xl leading-[1.1]">
            Не придумываем.<br className="hidden md:block" /> Берём из текста.
          </h2>
          <p className="text-[#B8AE97] text-[15px] leading-relaxed mb-14 max-w-2xl">
            Gamma и Tome придумывают содержание слайдов «в целом про тему». Tezis работает только с тем, что есть в вашем файле.
          </p>

          <div className="grid sm:grid-cols-2 gap-px bg-[#2E2820] border border-[#2E2820]">
            {FEATURES.map(({ title, desc }) => (
              <div key={title} className="bg-[#0F0E0B] p-7 md:p-9 flex flex-col gap-3">
                <h3 className="font-serif text-lg text-white leading-snug">{title}</h3>
                <p className="text-[#B8AE97] text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Тарифы ───────────────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-b border-[#2E2820]" style={{ backgroundColor: '#0F0E0B' }}>
        <div className="max-w-5xl mx-auto">
          <SectionKicker num="04">Тарифы</SectionKicker>
          <h2 className="font-serif text-3xl md:text-5xl font-normal text-white mb-5 max-w-3xl leading-[1.1]">
            Оплата за каждую презентацию.
          </h2>
          <p className="text-[#B8AE97] text-[15px] mb-14 max-w-2xl">
            Без подписок. Сгенерировал — заплатил. Попробовать можно с базового тарифа.
          </p>

          {tiersLoading ? (
            <div className="flex justify-center py-10" aria-label="Загрузка тарифов…">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-px bg-[#2E2820] border border-[#2E2820] items-stretch">
              {tiers && Object.values(tiers).map((tier) => {
                const isPopular = tier.id === 'standard'
                return (
                  <div
                    key={tier.id}
                    className="relative p-7 md:p-10 flex flex-col gap-6 bg-[#0F0E0B]"
                  >
                    {isPopular && (
                      <span className="absolute top-6 right-6 font-mono text-[10px] tracking-widest text-brand-400 uppercase">
                        · Выбор большинства
                      </span>
                    )}

                    <div>
                      <p className="font-mono text-xs tracking-wider text-[#7A7362] uppercase mb-4">{tier.label}</p>
                      <div
                        className={`flex items-baseline gap-1 ${isPopular ? 'text-brand-400' : 'text-white'}`}
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        <span className="font-serif text-5xl font-normal">
                          {new Intl.NumberFormat('ru-RU').format(tier.price_rub)}
                        </span>
                        <span className="text-2xl text-[#7A7362]">₽</span>
                      </div>
                    </div>

                    <ul className="flex flex-col gap-3 text-sm text-[#B8AE97]">
                      {[
                        `${tier.slides} слайдов`,
                        tier.id === 'premium' ? 'Premium-модель Claude' : 'Стандартная модель Claude',
                        'Ссылки на страницы источника',
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-2.5">
                          <CheckIcon className="w-3.5 h-3.5 text-[#7A7362] flex-shrink-0 mt-[5px]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      to={ctaHref}
                      className={`mt-auto inline-flex items-center justify-between w-full text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                        isPopular
                          ? 'bg-brand-600 hover:bg-brand-500 text-white px-4 py-3'
                          : 'text-[#B8AE97] hover:text-white border-b border-[#4A402F] hover:border-[#F5F1E8] py-3'
                      }`}
                    >
                      Выбрать
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-28 px-5 border-b border-[#2E2820]" style={{ backgroundColor: '#17140F' }}>
        <div className="max-w-5xl mx-auto">
          <SectionKicker num="05">Начать</SectionKicker>
          <h2
            className="font-serif text-4xl md:text-6xl font-normal text-white mb-6 max-w-3xl leading-[1.05]"
            style={{ textWrap: 'balance' }}
          >
            Загрузите первую работу.
          </h2>
          <p className="text-[#B8AE97] text-lg mb-10 max-w-2xl">
            Регистрация — 30 секунд. Готовая .pptx — через пару минут.
          </p>
          <Link
            to={ctaHref}
            className="inline-flex items-center gap-2 px-8 py-4 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-base transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#17140F]"
          >
            Начать
            <svg aria-hidden="true" className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="py-10 px-5" style={{ backgroundColor: '#0F0E0B' }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-lg text-white">Tezis</span>
            <span className="text-[#7A7362] text-xs font-mono">v1</span>
          </div>
          <p className="text-[#7A7362] text-xs max-w-md">
            Презентации и тексты выступлений по академическим работам.
          </p>
        </div>
      </footer>
    </div>
  )
}
