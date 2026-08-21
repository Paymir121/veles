/**
 * Renders frontend/public/favicon.svg to a PNG via Playwright (already a
 * frontend dep). Used by create_icon.py — cairosvg is unreliable on Windows.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "..", "frontend", "package.json"));
const { chromium } = require("playwright");

const size = Number(process.argv[2] || 256);
const outPath = process.argv[3];
if (!outPath) {
  console.error("usage: render_favicon.mjs <size> <out.png>");
  process.exit(1);
}

const svgPath = path.join(here, "..", "frontend", "public", "favicon.svg");
const svg = fs.readFileSync(svgPath, "utf8");

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: size, height: size },
  deviceScaleFactor: 1,
});
await page.setContent(
  `<!DOCTYPE html>
<html>
<head>
<style>
  html, body { margin: 0; width: ${size}px; height: ${size}px; background: transparent; }
  svg { display: block; width: ${size}px; height: ${size}px; }
</style>
</head>
<body>${svg}</body>
</html>`,
  { waitUntil: "load" },
);
await page.screenshot({ path: outPath, omitBackground: true });
await browser.close();
