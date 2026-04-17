/**
 * pptxgen.js — генератор .pptx через pptxgenjs.
 * Читает JSON-план из stdin (см. tasks.py::_assemble_plan), пишет .pptx по плановому пути.
 */

const pptxgen = require("pptxgenjs");
const fs = require("fs");

const chunks = [];
process.stdin.on("data", (chunk) => { chunks.push(chunk); });
process.stdin.on("end", () => {
  try {
    const raw = Buffer.concat(chunks).toString("utf8");
    const plan = JSON.parse(raw);
    generatePresentation(plan);
  } catch (e) {
    process.stderr.write("JSON parse error: " + e.message + "\n");
    process.exit(1);
  }
});

// Палитры: primary (шапка/тёмные слайды), accent (полоса), light (фон), text, white.
const PALETTES = {
  midnight_executive: { primary: "1E2761", accent: "CADCFC", light: "EEF3FB", text: "1E2761", white: "FFFFFF" },
  forest_moss:        { primary: "2C5F2D", accent: "97BC62", light: "F5F5F5", text: "1A3B1B", white: "FFFFFF" },
  coral_energy:       { primary: "F96167", accent: "2F3C7E", light: "FFF5F5", text: "2F3C7E", white: "FFFFFF" },
  warm_terracotta:    { primary: "B85042", accent: "A7BEAE", light: "F0EDE4", text: "5C2E22", white: "FFFFFF" },
  ocean_gradient:     { primary: "065A82", accent: "1C7293", light: "E8F4F8", text: "065A82", white: "FFFFFF" },
  charcoal_minimal:   { primary: "36454F", accent: "212121", light: "F2F2F2", text: "212121", white: "FFFFFF" },
  teal_trust:         { primary: "028090", accent: "02C39A", light: "E0F5F5", text: "015C66", white: "FFFFFF" },
  berry_cream:        { primary: "6D2E46", accent: "A26769", light: "F5EFE8", text: "6D2E46", white: "FFFFFF" },
  sage_calm:          { primary: "50808E", accent: "84B59F", light: "F0F7F4", text: "2C4F57", white: "FFFFFF" },
  cherry_bold:        { primary: "990011", accent: "2F3C7E", light: "FCF6F5", text: "2F3C7E", white: "FFFFFF" },
  blue:               { primary: "1A56DB", accent: "1E40AF", light: "EFF6FF", text: "1E3A5F", white: "FFFFFF" },
  green:              { primary: "057A55", accent: "065F46", light: "ECFDF5", text: "064E3B", white: "FFFFFF" },
  dark:               { primary: "111827", accent: "374151", light: "F9FAFB", text: "111827", white: "FFFFFF" },
  corporate:          { primary: "1F2937", accent: "374151", light: "F3F4F6", text: "111827", white: "FFFFFF" },
};

// fontFace специально null: pptxgenjs иначе проставляет charset="0" (Latin), что ломает кириллицу.
const FONT_TITLE = null;
const FONT_BODY  = null;
const LANG = "ru-RU";

function t(opts) {
  const o = Object.assign({ lang: LANG }, opts);
  delete o.fontFace;
  return o;
}

function imageExists(p) {
  try { return p && fs.statSync(p).isFile(); } catch { return false; }
}

function bulletItems(bullets) {
  return bullets.map((b, i) => ({
    text: b,
    options: { lang: LANG, bullet: true, breakLine: i < bullets.length - 1 },
  }));
}

// Единый spacing для всех длинных bullet-списков: межстрочный 1.3, воздух между пунктами.
const BULLET_SPACING = { lineSpacingMultiple: 1.3, paraSpaceBefore: 6 };

function generatePresentation(plan) {
  const prs = new pptxgen();
  prs.layout = "LAYOUT_16x9";

  const pal = PALETTES[plan.palette] || PALETTES.midnight_executive;

  // ── Титульный слайд ──────────────────────────────────────────────────────
  titleSlide(prs, plan, pal);

  // ── Контентные слайды ────────────────────────────────────────────────────
  plan.slides.forEach((s, idx) => {
    const ctx = { prs, plan, pal, idx, slideNum: idx + 2 };
    const layout = s.layout || "default";
    switch (layout) {
      case "section":    sectionSlide(ctx, s); break;
      case "callout":    calloutSlide(ctx, s); break;
      case "two_col":    twoColSlide(ctx, s); break;
      case "quote":      quoteSlide(ctx, s); break;
      case "stats":      statsSlide(ctx, s); break;
      case "image_full": imageFullSlide(ctx, s); break;
      case "image_side": imageSideSlide(ctx, s); break;
      case "table":      tableSlide(ctx, s); break;
      case "chart":      chartSlide(ctx, s); break;
      default:           defaultSlide(ctx, s);
    }
  });

  // ── Финальный слайд ──────────────────────────────────────────────────────
  finalSlide(prs, plan, pal);

  prs.writeFile({ fileName: plan.output_path })
    .then(() => {
      process.stdout.write(JSON.stringify({ ok: true, path: plan.output_path }) + "\n");
    })
    .catch((e) => {
      process.stderr.write("pptxgenjs write error: " + e.message + "\n");
      process.exit(1);
    });
}

// ── Заголовочная плашка, общая для большинства слайдов ───────────────────────
function headerBar(prs, slide, pal, title, counter) {
  slide.addShape(prs.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 1.0,
    fill: { color: pal.primary }, line: { color: pal.primary }
  });
  slide.addText(title, t({
    x: 0.4, y: 0, w: 8.6, h: 1.0,
    fontFace: FONT_TITLE, fontSize: 24, bold: true,
    color: pal.white, align: "left", valign: "middle", margin: 0,
  }));
  if (counter) {
    slide.addText(counter, t({
      x: 8.5, y: 0, w: 1.1, h: 1.0,
      fontFace: FONT_BODY, fontSize: 11,
      color: pal.accent, align: "right", valign: "middle", margin: 0,
    }));
  }
}

// ── Слайды ───────────────────────────────────────────────────────────────────

function titleSlide(prs, plan, pal) {
  const slide = prs.addSlide();
  slide.background = { color: pal.primary };
  slide.addShape(prs.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: 5.625,
    fill: { color: pal.accent }, line: { color: pal.accent }
  });
  slide.addText(plan.topic, t({
    x: 0.5, y: 1.4, w: 9, h: 1.6,
    fontFace: FONT_TITLE, fontSize: 36, bold: true,
    color: pal.white, align: "left", valign: "middle", margin: 0, wrap: true,
  }));
  const subtitle = [plan.work_type, plan.university].filter(Boolean).join("  •  ");
  if (subtitle) {
    slide.addText(subtitle, t({
      x: 0.5, y: 3.2, w: 9, h: 0.5,
      fontFace: FONT_BODY, fontSize: 16, color: pal.accent, align: "left", margin: 0,
    }));
  }
  slide.addText(`${plan.tier_label}  •  ${plan.total_slides} \u0441\u043b\u0430\u0439\u0434\u043e\u0432`, t({
    x: 0.5, y: 4.8, w: 9, h: 0.4,
    fontFace: FONT_BODY, fontSize: 12, color: "C7C7C7", align: "left", margin: 0,
  }));
}

function sectionSlide({ prs, pal }, s) {
  const slide = prs.addSlide();
  slide.background = { color: pal.primary };
  slide.addShape(prs.shapes.RECTANGLE, {
    x: 0.5, y: 2.5, w: 3.5, h: 0.06,
    fill: { color: pal.accent }, line: { color: pal.accent }
  });
  slide.addText(s.title, t({
    x: 0.5, y: 2.7, w: 9, h: 1.2,
    fontFace: FONT_TITLE, fontSize: 32, bold: true,
    color: pal.white, align: "left", margin: 0,
  }));
  if (s.subtitle) {
    slide.addText(s.subtitle, t({
      x: 0.5, y: 3.9, w: 8, h: 0.6,
      fontFace: FONT_BODY, fontSize: 16, color: "D1D5DB", align: "left", margin: 0,
    }));
  }
}

function calloutSlide({ prs, pal }, s) {
  const slide = prs.addSlide();
  slide.background = { color: pal.light };
  slide.addShape(prs.shapes.RECTANGLE, {
    x: 0.5, y: 0.35, w: 0.06, h: 0.7,
    fill: { color: pal.primary }, line: { color: pal.primary }
  });
  slide.addText(s.title, t({
    x: 0.7, y: 0.3, w: 8.8, h: 0.8,
    fontFace: FONT_TITLE, fontSize: 22, bold: true,
    color: pal.text, align: "left", margin: 0,
  }));
  slide.addText(s.callout || "", t({
    x: 0.5, y: 1.2, w: 9, h: 1.8,
    fontFace: FONT_TITLE, fontSize: 28, bold: true, italic: true,
    color: pal.primary, align: "center", valign: "middle", margin: 0, wrap: true,
  }));
  if (s.bullets && s.bullets.length) {
    slide.addText(bulletItems(s.bullets), t(Object.assign({
      x: 0.5, y: 3.15, w: 9, h: 2.1,
      fontFace: FONT_BODY, fontSize: 14, color: pal.text, align: "left",
    }, BULLET_SPACING)));
  }
  if (imageExists(s.image_path)) {
    // Мелкая иконка-акцент в правом верхнем углу под тайтлом.
    slide.addImage({ path: s.image_path, x: 8.0, y: 0.2, w: 1.6, h: 1.0, sizing: { type: "cover", w: 1.6, h: 1.0 } });
  }
}

function twoColSlide({ prs, pal }, s) {
  const slide = prs.addSlide();
  slide.background = { color: pal.light };
  headerBar(prs, slide, pal, s.title, null);
  const cols = s.columns || [[], []];
  [0, 1].forEach((ci) => {
    const col = cols[ci] || {};
    const x = ci === 0 ? 0.4 : 5.3;
    if (col.heading) {
      slide.addText(col.heading, t({
        x, y: 1.1, w: 4.2, h: 0.45,
        fontFace: FONT_TITLE, fontSize: 16, bold: true,
        color: pal.primary, align: "left", margin: 0,
      }));
    }
    if (col.bullets && col.bullets.length) {
      slide.addText(bulletItems(col.bullets), t(Object.assign({
        x, y: col.heading ? 1.65 : 1.1, w: 4.3, h: 3.6,
        fontFace: FONT_BODY, fontSize: 13, color: pal.text, align: "left",
      }, BULLET_SPACING)));
    }
  });
  slide.addShape(prs.shapes.LINE, {
    x: 5.1, y: 1.1, w: 0, h: 4.1,
    line: { color: "D1D5DB", width: 1 }
  });
}

function quoteSlide({ prs, pal }, s) {
  const slide = prs.addSlide();
  slide.background = { color: pal.light };
  // Большие кавычки слева.
  slide.addText("\u201C", t({
    x: 0.4, y: 0.8, w: 2, h: 2,
    fontFace: FONT_TITLE, fontSize: 160, bold: true,
    color: pal.accent, align: "left", valign: "top", margin: 0,
  }));
  slide.addText(s.quote || s.title || "", t({
    x: 1.2, y: 1.5, w: 7.6, h: 2.2,
    fontFace: FONT_TITLE, fontSize: 26, italic: true,
    color: pal.primary, align: "left", valign: "middle", margin: 0, wrap: true,
  }));
  if (s.attribution) {
    slide.addText("— " + s.attribution, t({
      x: 1.2, y: 3.9, w: 7.6, h: 0.5,
      fontFace: FONT_BODY, fontSize: 14,
      color: pal.text, align: "left", margin: 0,
    }));
  }
  // Акцентная полоса снизу.
  slide.addShape(prs.shapes.RECTANGLE, {
    x: 0, y: 5.4, w: 10, h: 0.08,
    fill: { color: pal.accent }, line: { color: pal.accent }
  });
}

function statsSlide({ prs, pal }, s) {
  const slide = prs.addSlide();
  slide.background = { color: pal.light };
  headerBar(prs, slide, pal, s.title, null);
  if (s.intro) {
    slide.addText(s.intro, t({
      x: 0.5, y: 1.1, w: 9, h: 0.5,
      fontFace: FONT_BODY, fontSize: 14, color: pal.text, align: "left", margin: 0,
    }));
  }
  const stats = (s.stats || []).slice(0, 4);
  const boxW = 2.15, boxH = 2.3, gap = 0.15;
  const totalW = stats.length * boxW + (stats.length - 1) * gap;
  const startX = (10 - totalW) / 2;
  const startY = s.intro ? 1.9 : 1.6;
  stats.forEach((st, i) => {
    const x = startX + i * (boxW + gap);
    slide.addShape(prs.shapes.ROUNDED_RECTANGLE, {
      x, y: startY, w: boxW, h: boxH,
      fill: { color: pal.white }, line: { color: pal.accent, width: 1 }, rectRadius: 0.08,
    });
    slide.addText(st.value || "", t({
      x, y: startY + 0.2, w: boxW, h: 1.3,
      fontFace: FONT_TITLE, fontSize: 48, bold: true,
      color: pal.primary, align: "center", valign: "middle", margin: 0,
    }));
    slide.addText(st.label || "", t({
      x: x + 0.1, y: startY + 1.5, w: boxW - 0.2, h: 0.7,
      fontFace: FONT_BODY, fontSize: 12,
      color: pal.text, align: "center", valign: "top", margin: 0, wrap: true,
    }));
  });
}

function imageFullSlide({ prs, pal }, s) {
  const slide = prs.addSlide();
  slide.background = { color: pal.primary };
  if (imageExists(s.image_path)) {
    // Картинка на всю площадь с лёгким тёмным оверлеем для читаемости тайтла.
    slide.addImage({ path: s.image_path, x: 0, y: 0, w: 10, h: 5.625, sizing: { type: "cover", w: 10, h: 5.625 } });
    slide.addShape(prs.shapes.RECTANGLE, {
      x: 0, y: 3.8, w: 10, h: 1.825,
      fill: { color: "000000", transparency: 45 }, line: { color: "000000", transparency: 45 },
    });
  } else {
    slide.addShape(prs.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 5.625,
      fill: { color: pal.primary }, line: { color: pal.primary }
    });
  }
  slide.addText(s.title, t({
    x: 0.5, y: 4.0, w: 9, h: 1.4,
    fontFace: FONT_TITLE, fontSize: 28, bold: true,
    color: pal.white, align: "left", valign: "middle", margin: 0, wrap: true,
  }));
}

function imageSideSlide({ prs, pal }, s) {
  const slide = prs.addSlide();
  slide.background = { color: pal.light };
  headerBar(prs, slide, pal, s.title, null);

  const imgSide = (s.side === "left") ? "left" : "right";
  const imgX = imgSide === "left" ? 0.4 : 5.3;
  const textX = imgSide === "left" ? 5.3 : 0.4;

  if (imageExists(s.image_path)) {
    slide.addImage({
      path: s.image_path, x: imgX, y: 1.25, w: 4.3, h: 3.9,
      sizing: { type: "cover", w: 4.3, h: 3.9 },
    });
  } else {
    // Плейсхолдер, если картинка не сгенерировалась.
    slide.addShape(prs.shapes.ROUNDED_RECTANGLE, {
      x: imgX, y: 1.25, w: 4.3, h: 3.9,
      fill: { color: pal.accent, transparency: 70 }, line: { color: pal.accent }, rectRadius: 0.1,
    });
    slide.addText("\u0418\u043b\u043b\u044e\u0441\u0442\u0440\u0430\u0446\u0438\u044f", t({
      x: imgX, y: 3.0, w: 4.3, h: 0.5,
      fontFace: FONT_BODY, fontSize: 14, italic: true,
      color: pal.text, align: "center", margin: 0,
    }));
  }

  if (s.bullets && s.bullets.length) {
    slide.addText(bulletItems(s.bullets), t(Object.assign({
      x: textX, y: 1.4, w: 4.3, h: 3.7,
      fontFace: FONT_BODY, fontSize: 14, color: pal.text, align: "left",
    }, BULLET_SPACING)));
  }
}

function defaultSlide({ prs, pal, slideNum, plan }, s) {
  const slide = prs.addSlide();
  slide.background = { color: pal.light };
  headerBar(prs, slide, pal, s.title, `${slideNum} / ${plan.total_slides}`);

  const hasImg = imageExists(s.image_path);
  const bulletsW = hasImg ? 5.3 : 9;
  const bulletsX = 0.5;

  if (s.bullets && s.bullets.length) {
    slide.addText(bulletItems(s.bullets), t(Object.assign({
      x: bulletsX, y: 1.2, w: bulletsW, h: 4.0,
      fontFace: FONT_BODY, fontSize: 15, color: pal.text, align: "left",
    }, BULLET_SPACING)));
  }
  if (hasImg) {
    slide.addImage({
      path: s.image_path, x: 6.0, y: 1.25, w: 3.6, h: 3.9,
      sizing: { type: "cover", w: 3.6, h: 3.9 },
    });
  }
  if (s.source_ref) {
    slide.addShape(prs.shapes.LINE, {
      x: 0.5, y: 5.2, w: 9, h: 0, line: { color: "D1D5DB", width: 0.5 }
    });
    slide.addText(s.source_ref, t({
      x: 0.5, y: 5.25, w: 9, h: 0.3,
      fontFace: FONT_BODY, fontSize: 10, italic: true,
      color: "9CA3AF", align: "left", margin: 0,
    }));
  }
}

function tableSlide({ prs, pal }, s) {
  const slide = prs.addSlide();
  slide.background = { color: pal.light };
  headerBar(prs, slide, pal, s.title, null);

  const headers = Array.isArray(s.headers) ? s.headers : [];
  const rows = Array.isArray(s.rows) ? s.rows : [];
  if (!rows.length) {
    // Защита: если данные пусты — покажем подсказку вместо пустоты.
    slide.addText("Нет данных для таблицы", t({
      x: 0.5, y: 2.4, w: 9, h: 0.8, fontSize: 16, italic: true,
      color: pal.text, align: "center",
    }));
    return;
  }

  if (s.intro) {
    slide.addText(s.intro, t({
      x: 0.5, y: 1.1, w: 9, h: 0.45,
      fontFace: FONT_BODY, fontSize: 13, color: pal.text, align: "left", margin: 0,
    }));
  }

  // Чередуем заливку строк. Заголовок — primary, с белым текстом.
  const headerRow = headers.map((h) => ({
    text: String(h ?? ""),
    options: { bold: true, color: pal.white, fill: { color: pal.primary }, align: "center", valign: "middle" },
  }));
  const bodyRows = rows.map((row, ri) => row.map((cell) => ({
    text: String(cell ?? ""),
    options: {
      color: pal.text,
      fill: { color: ri % 2 === 0 ? pal.white : pal.light },
      align: "left", valign: "middle",
    },
  })));
  const tableData = headers.length ? [headerRow, ...bodyRows] : bodyRows;

  // Размер подбираем по числу строк: меньше строк — крупнее.
  const rowCount = tableData.length;
  const fontSize = rowCount <= 6 ? 14 : rowCount <= 10 ? 12 : 10;
  const tableY = s.intro ? 1.7 : 1.25;
  const tableH = 5.3 - tableY;

  slide.addTable(tableData, {
    x: 0.4, y: tableY, w: 9.2, h: tableH,
    fontFace: FONT_BODY, fontSize, lang: LANG,
    border: { type: "solid", color: "D1D5DB", pt: 0.5 },
    colW: headers.length ? distributeColumns(headers.length, 9.2) : undefined,
    autoPage: false,
  });
}

function distributeColumns(count, totalW) {
  if (count <= 1) return [totalW];
  // Первая колонка чуть шире (обычно «Показатель/Год»), остальные — поровну.
  const firstW = totalW * 0.34;
  const rest = (totalW - firstW) / (count - 1);
  return [firstW, ...Array(count - 1).fill(rest)];
}

function chartSlide({ prs, pal }, s) {
  const slide = prs.addSlide();
  slide.background = { color: pal.light };
  headerBar(prs, slide, pal, s.title, null);

  const labels = Array.isArray(s.labels) ? s.labels : [];
  const seriesIn = Array.isArray(s.series) ? s.series : [];
  if (!labels.length || !seriesIn.length) {
    slide.addText("Нет данных для графика", t({
      x: 0.5, y: 2.4, w: 9, h: 0.8, fontSize: 16, italic: true,
      color: pal.text, align: "center",
    }));
    return;
  }

  const chartData = seriesIn.map((ser) => ({
    name: String(ser.name || ""),
    labels,
    values: (ser.data || []).map((v) => Number(v) || 0),
  }));

  const typeKey = String(s.chart_type || "bar").toLowerCase();
  const chartType = {
    bar:  prs.charts.BAR,
    line: prs.charts.LINE,
    pie:  prs.charts.PIE,
  }[typeKey] || prs.charts.BAR;

  if (s.intro) {
    slide.addText(s.intro, t({
      x: 0.5, y: 1.1, w: 9, h: 0.45,
      fontFace: FONT_BODY, fontSize: 13, color: pal.text, align: "left", margin: 0,
    }));
  }

  const chartY = s.intro ? 1.7 : 1.25;
  const chartH = 5.3 - chartY;

  slide.addChart(chartType, chartData, {
    x: 0.5, y: chartY, w: 9.0, h: chartH,
    chartColors: [pal.primary, pal.accent, pal.text, "8b5cf6", "f59e0b"],
    showLegend: seriesIn.length > 1 || typeKey === "pie",
    legendPos: "b",
    catAxisLabelFontSize: 10,
    valAxisLabelFontSize: 10,
    dataLabelFontSize: 10,
    showTitle: false,
    lang: LANG,
  });
}

function finalSlide(prs, plan, pal) {
  const slide = prs.addSlide();
  slide.background = { color: pal.primary };
  slide.addShape(prs.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.18, h: 5.625,
    fill: { color: pal.accent }, line: { color: pal.accent }
  });
  slide.addText("\u0421\u043f\u0430\u0441\u0438\u0431\u043e \u0437\u0430 \u0432\u043d\u0438\u043c\u0430\u043d\u0438\u0435", t({
    x: 0.5, y: 1.8, w: 9, h: 1.0,
    fontFace: FONT_TITLE, fontSize: 36, bold: true,
    color: pal.white, align: "left", margin: 0,
  }));
  slide.addText(plan.topic, t({
    x: 0.5, y: 3.0, w: 9, h: 0.6,
    fontFace: FONT_BODY, fontSize: 16, color: "C7C7C7", align: "left", margin: 0,
  }));
}
