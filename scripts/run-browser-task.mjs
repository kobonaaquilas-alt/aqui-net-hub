import fs from "node:fs";
import { chromium } from "playwright";

const requestId = process.env.REQUEST_ID || "";
const targetUrl = process.env.TARGET_URL || "";
const steps = JSON.parse(process.env.STEPS_JSON || "[]");

function safePublicUrl(value) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blocked = host === "localhost" || host.endsWith(".localhost") ||
    host.endsWith(".local") || host === "0.0.0.0" || host === "::1" ||
    /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || blocked || !host.includes(".")) {
    throw new Error("Navigation vers une adresse non publique bloquée.");
  }
  return url;
}

if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) throw new Error("Identifiant de tâche invalide.");
safePublicUrl(targetUrl);
if (!Array.isArray(steps) || steps.length > 15) throw new Error("Liste d'étapes invalide.");

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  await context.route("**/*", async route => {
    try {
      safePublicUrl(route.request().url());
      await route.continue();
    } catch {
      await route.abort("blockedbyclient");
    }
  });
  const page = await context.newPage();
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  const output = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.action === "wait") {
      await page.waitForTimeout(Math.min(5000, Math.max(0, Number(step.milliseconds) || 0)));
      output.push({ index: i, action: step.action, ok: true });
    } else if (step.action === "extract_text") {
      const locator = page.locator(step.selector).first();
      const value = (await locator.innerText({ timeout: 10000 })).slice(0, 15000);
      output.push({ index: i, action: step.action, selector: step.selector, text: value });
    } else if (step.action === "click_link") {
      const locator = page.locator(step.selector).first();
      const info = await locator.evaluate(el => ({
        tag: el.tagName.toLowerCase(),
        href: el instanceof HTMLAnchorElement ? el.href : ""
      }));
      if (info.tag !== "a" || !info.href) throw new Error("Le sélecteur doit désigner un lien <a>.");
      safePublicUrl(info.href);
      await Promise.all([
        page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {}),
        locator.click({ timeout: 10000 })
      ]);
      output.push({ index: i, action: step.action, destination: page.url() });
    } else if (step.action === "screenshot") {
      await page.screenshot({ path: "browser.png", fullPage: step.full_page === true });
      output.push({ index: i, action: step.action, file: "browser.png" });
    } else {
      throw new Error("Action navigateur non autorisée.");
    }
  }
  const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 15000);
  const result = {
    request_id: requestId,
    title: await page.title(),
    final_url: page.url(),
    body_text: bodyText,
    steps: output,
    screenshot: fs.existsSync("browser.png") ? "browser.png" : null,
    completed_at: new Date().toISOString()
  };
  fs.writeFileSync("result.json", JSON.stringify(result, null, 2));
  await context.close();
} finally {
  await browser.close();
}
