// Converts Vite's single-file build into an artifact page: the publisher wraps pages in its own
// <html>/<head>/<body>, so we keep only the title, meta tags, styles, root element and scripts.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
const [src, out] = process.argv.slice(2);
const html = await readFile(src, "utf8");
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]).join("\n");
const title = pick(/<title>[\s\S]*?<\/title>/g);
const meta = pick(/<meta name="claude:[^>]*>/g);
const styles = pick(/<style[\s\S]*?<\/style>/g);
const scripts = pick(/<script\b[\s\S]*?<\/script>/g);
const page = [title, meta, styles, '<div id="root"></div>', scripts].join("\n");
await mkdir(dirname(out), { recursive: true });
await writeFile(out, page);
console.log(`${out}  ${(page.length / 1024).toFixed(0)} KB`);
