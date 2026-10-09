// Explicit vendor refresh only; normal builds are entirely offline after npm restore.
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import postcss from 'postcss';

const root = new URL('../', import.meta.url);
const dir = new URL('vendor/fonts/', root);
await mkdir(dir, { recursive: true });
const request = 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Archivo+Narrow:wght@400..700&display=swap';
async function download(url) {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } });
    if (!response.ok) throw new Error(`${response.status} downloading ${url}`);
    return Buffer.from(await response.arrayBuffer());
}
const ast = postcss.parse((await download(request)).toString('utf8'));
const theme = postcss.parse(await readFile(new URL('vendor/ElegantFin-jellyfin-theme-build-latest-minified.css', root), 'utf8'));
theme.walkAtRules('font-face', rule => ast.append(rule.clone()));
const manifest = [];
const rules = [];
ast.walkAtRules('font-face', rule => rules.push(rule));
for (const rule of rules) {
    const src = rule.nodes.find(node => node.prop === 'src');
    const match = /url\(([^)]+)\)/.exec(src.value);
    if (!match) throw new Error('Unrecognised font source');
    const url = match[1].replace(/["']/g, '');
    let entry = manifest.find(item => item.url === url);
    if (!entry) {
        const bytes = await download(url);
        if (bytes.toString('ascii', 0, 4) !== 'wOF2') throw new Error(`Expected WOFF2 font, received another format: ${url}`);
        const name = `font-${manifest.length}.woff2`;
        await writeFile(new URL(name, dir), bytes);
        entry = { file: name, url, sha256: createHash('sha256').update(bytes).digest('hex') };
        manifest.push(entry);
    }
    src.value = `url("fonts/${entry.file}") format("woff2")`;
    if (!rule.nodes.some(node => node.prop === 'font-display')) rule.append({ prop: 'font-display', value: 'swap' });
}
await writeFile(new URL('fonts.css', dir), ast.toString());
await writeFile(new URL('sources.json', dir), JSON.stringify({ cssRequest: request, fonts: manifest }, null, 2) + '\n');
for (const name of await readdir(dir)) {
    if (/^font-\d+\.woff2$/.test(name) && !manifest.some(font => font.file === name)) await unlink(new URL(name, dir));
}
for (const [name, url] of [
    ['Inter-OFL.txt', 'https://raw.githubusercontent.com/rsms/inter/master/LICENSE.txt'],
    ['ArchivoNarrow-OFL.txt', 'https://raw.githubusercontent.com/google/fonts/main/ofl/archivonarrow/OFL.txt'],
    ['MaterialSymbols-Apache-2.0.txt', 'https://raw.githubusercontent.com/google/material-design-icons/master/LICENSE']
]) await writeFile(new URL(name, dir), await download(url));
console.log(`Vendored ${manifest.length} font files with checksums and licences.`);
