// Builds docs/LeadFlow-Guide.pdf from the guide sources using a local Chrome/Edge.
// Usage: npm run docs:pdf    (screenshots in docs/assets are made by docs/screenshots.mjs)
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";
import { findBrowser } from "./browser.mjs";
import * as A from "./guide/content-part1.mjs";
import * as B from "./guide/content-part2.mjs";

const css = `
@page { size: A4; margin: 16mm 15mm 18mm 15mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", Arial, sans-serif; font-size: 10.2pt; line-height: 1.5; color: #1e293b; margin: 0; }
h1 { font-size: 21pt; margin: 0 0 12px; color: #1e1b4b; border-bottom: 3px solid #6366f1; padding-bottom: 6px; }
h1 span { display: inline-block; background: #4f46e5; color: #fff; border-radius: 8px; padding: 0 10px; margin-right: 10px; font-size: 17pt; }
h2 { font-size: 13pt; color: #3730a3; margin: 18px 0 6px; break-after: avoid; }
p, li { orphans: 3; widows: 3; }
.lead { font-size: 11pt; color: #334155; }
section.chapter { break-before: page; }
code { font-family: Consolas, "Cascadia Mono", monospace; font-size: 8.8pt; background: #f1f5f9; padding: 0 3px; border-radius: 3px; color: #0f172a; }
pre { background: #0f172a; color: #e2e8f0; padding: 10px 12px; border-radius: 8px; font-size: 8.4pt; line-height: 1.45; white-space: pre-wrap; break-inside: avoid; }
pre code { background: none; color: inherit; padding: 0; font-size: inherit; }
table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 9.2pt; break-inside: auto; }
tr { break-inside: avoid; }
th { background: #eef2ff; color: #312e81; text-align: left; padding: 6px 8px; border: 1px solid #c7d2fe; }
td { padding: 5px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
table.matrix td:not(:first-child), table.matrix th:not(:first-child) { text-align: center; }
table.plain td { border: none; padding: 2px 6px; }
table.plain td.k { width: 72px; color: #6366f1; font-weight: 700; }
figure { margin: 10px 0 14px; break-inside: avoid; text-align: center; }
figure svg.diagram { width: 100%; height: auto; }
figure img { max-width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 2px 8px rgba(15,23,42,.08); }
figcaption { font-size: 8.8pt; color: #64748b; margin-top: 4px; font-style: italic; }
.two { display: flex; gap: 14px; } .two figure { flex: 1; } .two img { max-height: 520px; }
.callout { background: #eef2ff; border-left: 4px solid #6366f1; padding: 8px 12px; border-radius: 6px; margin: 10px 0; break-inside: avoid; }
.callout.warn { background: #fffbeb; border-left-color: #f59e0b; }
.pattern { border: 1px solid #e2e8f0; border-radius: 8px; margin: 8px 0; break-inside: avoid; }
.pattern-head { background: #f8fafc; padding: 5px 10px; border-bottom: 1px solid #e2e8f0; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; }
.pattern-head b { color: #312e81; font-size: 10.5pt; } .pattern-head span { color: #64748b; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .05em; }
.pattern table { margin: 4px 0; }
.m { display: inline-block; min-width: 46px; text-align: center; border-radius: 4px; font-weight: 700; font-size: 8pt; color: #fff; padding: 1px 4px; }
.m.get { background: #0891b2; } .m.post { background: #059669; } .m.patch { background: #d97706; } .m.put { background: #7c3aed; }
ol.toc { list-style: none; padding: 0; columns: 2; font-size: 11.5pt; } ol.toc li { padding: 4px 0; border-bottom: 1px dotted #cbd5e1; } ol.toc span { color: #6366f1; font-weight: 700; display: inline-block; width: 28px; }
ul.check { list-style: none; padding-left: 4px; } ul.check li::before { content: "☐  "; color: #6366f1; }
.cover { height: 255mm; display: flex; flex-direction: column; justify-content: center; padding: 0 10mm;
  background: linear-gradient(160deg, #eef2ff 0%, #ffffff 55%); border-radius: 16px; }
.cover-brand { font-weight: 800; letter-spacing: .3em; color: #4f46e5; font-size: 14pt; }
.cover h1 { font-size: 34pt; border: none; line-height: 1.15; margin: 14px 0; color: #1e1b4b; }
.cover-sub { font-size: 13pt; color: #475569; max-width: 140mm; }
.cover-meta { margin-top: 30px; font-size: 10pt; } .cover-meta td { border: none; border-bottom: 1px solid #e2e8f0; padding: 7px 4px; }
.cover-meta td:first-child { color: #6366f1; font-weight: 700; width: 90px; }
.end { text-align: center; color: #94a3b8; margin-top: 30px; }
`;

const sections = [
  A.cover(), A.toc(), A.product(), A.gettingStarted(), A.database(), A.stack(), A.architecture(),
  A.journey(), A.dataModel(), A.statuses(), B.reliability(), B.security(), B.patterns(), B.ai(),
  B.screens(), B.apiRef(), B.testing(), B.deploy(), B.glossary(),
];

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>LeadFlow Guide</title><style>${css}</style></head><body>${sections.join("\n")}</body></html>`;

const buildDir = path.resolve("docs/.build");
fs.mkdirSync(buildDir, { recursive: true });
const htmlPath = path.join(buildDir, "guide.html");
fs.writeFileSync(htmlPath, html);

const browser = await puppeteer.launch({ executablePath: findBrowser(), headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
const out = path.resolve("docs/LeadFlow-Guide.pdf");
await page.pdf({
  path: out,
  format: "A4",
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="width:100%;font-size:8px;color:#94a3b8;padding:0 15mm;display:flex;justify-content:space-between;font-family:Segoe UI,Arial">
    <span>LeadFlow — implementation guide</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  margin: { top: "16mm", bottom: "18mm", left: "15mm", right: "15mm" },
});
await browser.close();
console.log("PDF written to", out, `(${Math.round(fs.statSync(out).size / 1024)} KB)`);
