import fs from "node:fs";

/** Finds an installed Chromium-based browser (no download needed). Override with BROWSER_PATH. */
export function findBrowser() {
  const candidates = [
    process.env.BROWSER_PATH,
    // Chrome first: a running Edge instance can swallow headless launches on Windows.
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error("No Chrome/Edge found. Set BROWSER_PATH to a Chromium-based browser executable.");
  return found;
}
