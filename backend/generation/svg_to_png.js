/**
 * svg_to_png.js — растеризация SVG → PNG через @resvg/resvg-js.
 * Использование: node svg_to_png.js <input.svg> <output.png> [width]
 * SVG читается с диска, PNG пишется туда, куда скажут.
 */

const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const [, , inputPath, outputPath, widthArg] = process.argv;

if (!inputPath || !outputPath) {
  process.stderr.write("Usage: node svg_to_png.js <input.svg> <output.png> [width]\n");
  process.exit(2);
}

try {
  const svg = fs.readFileSync(inputPath, "utf8");
  const width = Number(widthArg) > 0 ? Number(widthArg) : 1024;
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "rgba(255,255,255,0)",
    font: { loadSystemFonts: false },
  });
  const pngData = resvg.render().asPng();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, pngData);
  process.stdout.write(JSON.stringify({ ok: true, path: outputPath, bytes: pngData.length }) + "\n");
} catch (e) {
  process.stderr.write("rasterize failed: " + (e && e.message ? e.message : String(e)) + "\n");
  process.exit(1);
}
