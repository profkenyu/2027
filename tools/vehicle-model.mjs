import { chromium } from "playwright";
import { startPreviewServer } from "./lib/preview-server.mjs";

const server = await startPreviewServer();
let browser;
try {
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--enable-unsafe-swiftshader"]
  });
  for (const tier of ["high", "mid", "low"]) {
    const page = await browser.newPage({viewport: {width: 1400, height: 1000}});
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    await page.goto(`${server.url}/tools/vehicle-model.html?quality=${tier}`);
    await page.waitForFunction(() => window.ready);
    console.log(await page.evaluate(() => preview.check()));
    for (const kind of ["rover", "lander", "fold", "bay"]) {
      await page.evaluate(kind => preview.frame(kind), kind);
      await page.screenshot({path: `dist/model-${tier}-${kind}.png`});
    }
    if (errors.length) throw Error(errors.join("\n"));
    await page.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
