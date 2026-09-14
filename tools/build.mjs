import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm, cp } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEnding } from './build-ending.mjs';
import {buildOpening} from './build-opening.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORK = process.argv[2] ?? "terra_incognita";
async function main() {
  const tmp = `${ROOT}/.build`;
  await rm(tmp, { recursive: true, force: true });
  await rm(`${ROOT}/dist`, { recursive: true, force: true });
  await mkdir(`${ROOT}/dist`, { recursive: true });
  await cp(`${ROOT}/engine`, `${tmp}/engine`, { recursive: true });
  await cp(`${ROOT}/works`, `${tmp}/works`, { recursive: true });
  const cfgPath = `${tmp}/engine/config.js`;
  const cfg = await readFile(cfgPath, "utf8");
  await writeFile(cfgPath, cfg.replace("export const DEV = true;", "export const DEV = false;"));
  const out = await build({
    entryPoints: [`${tmp}/works/${WORK}/main.js`],
    bundle: true,
    format: "iife",
    target: "es2022",
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false,
    charset: "utf8",
    legalComments: "none",
    write: false,
    plugins: [{
      name: "three-local",
      setup(b) {
        b.onLoad({ filter: /works\/[^/]+\/main\.js$/ }, async ({path}) => {
          const source = await readFile(path, 'utf8');
          const imports = [];
          const body = source.replace(/^import\s[\s\S]*?;\s*$/gm, statement => { imports.push(statement); return ''; });
          return { contents: `${imports.join('\n')}\n(async()=>{\n${body}\n})().catch(error=>{console.error(error);document.body.dataset.bootError=error.message;});`, loader: 'js' };
        });
        const threeRoot = `${ROOT}/node_modules/three`;
        const core = `${threeRoot}/build/three.webgpu.js`;
        b.onResolve({ filter: /^three$/ }, () => ({ path: core }));
        b.onResolve({ filter: /^three\/webgpu$/ }, () => ({ path: core }));
        b.onResolve({ filter: /^three\/tsl$/ }, () => ({ path: `${threeRoot}/build/three.tsl.js` }));
        b.onResolve({ filter: /^three\/addons\// }, (args) => ({
          path: `${threeRoot}/examples/jsm/${args.path.slice("three/addons/".length)}`
        }));
      }
    }]
  });
  const js = out.outputFiles[0].text;
  const fontCss = await readFile(`${ROOT}/engine/fonts.css`, "utf8");
  const inlineFonts = (source) => source.replace('<link rel="stylesheet" href="../../engine/fonts.css">', `<style>\n${fontCss}\n</style>`);
  let shell = await readFile(`${ROOT}/works/${WORK}/dev.html`, "utf8");
  if (WORK === "terra_incognita") {
    await buildEnding();
    for (const asset of ["camera-icon.png", "light-icon.png"]) {
      const data = await readFile(`${ROOT}/works/${WORK}/assets/${asset}`);
      shell = shell.replaceAll(`./assets/${asset}`, `data:image/png;base64,${data.toString("base64")}`);
    }
  }
  const html = inlineFonts(shell).replace(/\n?\s*<script type="importmap">[\s\S]*?<\/script>/, "").replace(
    /<script type="module" src="\.\/main\.js"><\/script>/,
    '<script defer src="./planet-engine.js"></script>'
  );
  const archiveShell = await readFile(`${ROOT}/works/${WORK}/field-archive.dev.html`, "utf8");
  const archiveBundle = await build({
    entryPoints: [`${ROOT}/works/${WORK}/field-archive-viewer.js`],
    bundle: true, format: "iife", target: "es2022", write: false,
    minify: false, charset: "utf8", legalComments: "none"
  });
  const archive = inlineFonts(archiveShell).replace(
    '<script type="module" src="./field-archive-viewer.js"></script>',
    () => `<script>${archiveBundle.outputFiles[0].text}</script>`
  );
  try {
    new (await import("node:vm")).SourceTextModule(js);
  } catch (e) {
    throw new Error(`the bundle does not parse: ${e.message}`);
  }
  if ([html, archive].some((candidate) => /<(?:script|link)\b[^>]*(?:src|href)=["']https?:/i.test(candidate) || /<script\s+type=["']importmap["']/i.test(candidate))) {
    throw new Error("the exhibition candidate still contains a network dependency");
  }
  const digest = createHash("sha256").update(html).digest("hex");
  const archiveDigest = createHash("sha256").update(archive).digest("hex");
  await writeFile(`${ROOT}/works/${WORK}/field-archive.html`, archive);
  if (WORK === "terra_incognita") {
    for (const folder of [ROOT, `${ROOT}/dist`, `${ROOT}/works/${WORK}`]) {
      await writeFile(`${folder}/planet-engine.js`, js);
      for (const number of ['01', '02', '03']) {
        await writeFile(`${folder}/planet-${number}.html`, html.replace(/<title>[^<]*<\/title>/, `<title>Terra Incognita · Planet ${number}</title>`));
      }
    }
    await writeFile(`${ROOT}/dist/field-archive.html`, archive);
    await buildOpening();
    await writeFile(`${ROOT}/field-archive.html`, archive);
    const deploymentFiles = [
      "index.html",
      "planet-01.html",
      "planet-02.html",
      "planet-03.html",
      "planet-engine.js",
      "field-archive.html",
      "ending.html"
    ];
    const checksums = [];
    for (const file of deploymentFiles) {
      const content = await readFile(`${ROOT}/dist/${file}`);
      checksums.push(`${createHash("sha256").update(content).digest("hex")}  ${file}`);
    }
    await writeFile(`${ROOT}/dist/SHA256SUMS`, `${checksums.join("\n")}\n`);
  }
  await rm(tmp, { recursive: true, force: true });
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log(`
\u2713 ${WORK} \u2014 ${kb} KB page with shared engine`);
  console.log(`  sha256 ${digest}`);
  console.log(`  field archive sha256 ${archiveDigest}`);
  console.log("  open index.html → planet-01.html → planet-02.html → planet-03.html → ending.html");
  console.log(`  shared planet-engine.js: ${Math.round(Buffer.byteLength(js) / 1024)} KB`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
