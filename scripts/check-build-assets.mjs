import { readFileSync, existsSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
const mode = process.argv[2] ?? "web";
if (!["web", "desktop"].includes(mode)) throw new Error("Use web or desktop mode");
const directory = resolve(process.argv[3] ?? "dist");
const files = mode === "desktop" ? ["index.html", "desktop.html"] : ["index.html"];
let checked = 0;
for (const file of files) {
  const html = readFileSync(resolve(directory, file), "utf8");
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]).filter(url => /^(?:\.\/|\/)?assets\//.test(url));
  if (!assets.length) throw new Error(`${file} has no built asset references`);
  for (const source of assets) {
    let local;
    if (mode === "web") {
      const url = new URL(source, "https://www.yukino.bond/admin/posts");
      if (url.origin !== "https://www.yukino.bond" || !url.pathname.startsWith("/assets/")) throw new Error(`Nested web route resolves asset incorrectly: ${source}`);
      local = resolve(directory, decodeURIComponent(url.pathname).slice(1));
    } else local = fileURLToPath(new URL(source, pathToFileURL(resolve(directory, file))));
    const path = relative(directory, local);
    if (path.startsWith("..") || isAbsolute(path) || !existsSync(local)) throw new Error(`Built asset is outside the output or missing: ${source}`);
    checked++;
  }
}
console.log(`Verified ${checked} ${mode} JS/CSS asset references for ${mode === "web" ? "nested web routes" : "file:// desktop loading"}.`);
