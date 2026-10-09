// Captures UI screenshots for the guide using the locally installed Edge/Chrome.
// Usage: node docs/screenshots.mjs http://localhost:3000   (app + seed data must be running)
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { findBrowser } from "./browser.mjs";

const base = process.argv[2] ?? "http://localhost:3000";
const out = path.resolve("docs/assets");
fs.mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({ executablePath: findBrowser(), headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();

async function shot(name, url, { width = 1280, height = 820, full = false, mobile = false } = {}) {
  await page.setViewport({ width, height, deviceScaleFactor: mobile ? 2 : 1.5, isMobile: mobile });
  await page.goto(base + url, { waitUntil: "networkidle0", timeout: 120_000 });
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: full });
  console.log("captured", name);
}

await shot("form-en", "/f/smile-clinic", { width: 420, height: 980, mobile: true });
await shot("form-ar", "/f/smile-clinic?lang=ar", { width: 420, height: 980, mobile: true });

// Sign in as the demo admin (seed data, development only).
await page.setViewport({ width: 1280, height: 800 });
await page.goto(base + "/login", { waitUntil: "networkidle0" });
await page.type("#email", "admin@leadflow.local");
await page.type("#password", "LeadFlow#2026");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button")]);

await shot("dashboard", "/dashboard", { width: 1400, height: 900 });
const firstLead = await page.$eval("tbody a", (a) => a.getAttribute("href"));
await shot("lead-detail", firstLead, { width: 1400, height: 1100 });
await shot("integrations", "/integrations", { width: 1400, height: 900 });
await shot("settings", "/settings", { width: 1400, height: 900 });

await browser.close();
