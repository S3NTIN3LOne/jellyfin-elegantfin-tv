import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import cssnano from 'cssnano';

const root = new URL('../', import.meta.url);
const sources = JSON.parse(await readFile(new URL('vendor/sources.json', root), 'utf8'));
const oldScope = ':where(:root:is(.layout-desktop, .layout-mobile):not(.layout-tv), :root:is(.layout-desktop, .layout-mobile):not(.layout-tv) *)';
const scope = ':where(:root[data-eftv], :root[data-eftv] *)';

export function transformTheme(css) {
  const ast = postcss.parse(css);
  ast.walkComments(comment => {
    if (comment.text.includes('Device scope:')) comment.remove();
  });
  ast.walkRules(rule => {
    if (rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
    // Remove only the exact guard introduced in the supplied files.
    if (!rule.selector.includes(oldScope)) throw new Error(`Unexpected unscoped rule: ${rule.selector}`);
    const original = rule.selector.split(oldScope).join(scope);
    rule.selector = selectorParser(selectors => {
      selectors.walkClasses(node => {
        if (node.value === 'layout-desktop') {
          node.replaceWith(selectorParser().astSync(':is(.layout-desktop,.layout-tv)').first.first.clone());
        }
      });
    }).processSync(original);
  });
  // Isolate globally named animations from the existing desktop theme.
  const names = new Map();
  ast.walkAtRules(/keyframes$/i, rule => {
    names.set(rule.params, `eftv-${rule.params}`);
    rule.params = `eftv-${rule.params}`;
  });
  ast.walkDecls(/^(animation|animation-name)$/, decl => {
    for (const [name, replacement] of names) decl.value = decl.value.replaceAll(name, replacement);
  });
  return ast;
}

export async function build() {
  const combined = postcss.root();
  for (const source of sources) {
    const input = await readFile(new URL(`vendor/${source.file}`, root));
    if (createHash('sha256').update(input).digest('hex') !== source.sha256) {
      throw new Error(`Vendor checksum mismatch: ${source.file}`);
    }
    const ast = transformTheme(input.toString('utf8'));
    ast.walkAtRules('import', rule => rule.remove());
    ast.walkAtRules('font-face', rule => rule.remove());
    combined.append(ast.nodes);
  }
  combined.prepend(postcss.parse(await readFile(new URL('vendor/fonts/fonts.css', root), 'utf8')).nodes);
  combined.append(postcss.parse(await readFile(new URL('src/tv-overrides.css', root), 'utf8')).nodes);
  const result = await postcss([cssnano({ preset: ['default', { discardComments: { removeAll: false } }] })])
    .process(combined, { from: undefined, map: false });
  const out = new URL('src/Jellyfin.Plugin.ElegantFinTv/Web/', root);
  await mkdir(out, { recursive: true });
  await mkdir(new URL('fonts/', out), { recursive: true });
  const fonts = JSON.parse(await readFile(new URL('vendor/fonts/sources.json', root), 'utf8'));
  for (const name of await readdir(new URL('fonts/', out))) {
    if (/^font-\d+\.woff2$/.test(name) && !fonts.fonts.some(font => font.file === name)) await unlink(new URL(`fonts/${name}`, out));
  }
  for (const font of fonts.fonts) {
    const bytes = await readFile(new URL(`vendor/fonts/${font.file}`, root));
    if (bytes.toString('ascii', 0, 4) !== 'wOF2') throw new Error(`Expected WOFF2: ${font.file}`);
    if (createHash('sha256').update(bytes).digest('hex') !== font.sha256) throw new Error(`Font checksum mismatch: ${font.file}`);
    await writeFile(new URL(`fonts/${font.file}`, out), bytes);
  }
  await writeFile(new URL('tv.css', out), result.css);
  await writeFile(new URL('tv.js', out), await readFile(new URL('src/tv.js', root)));
  console.log(`TV stylesheet: ${Buffer.byteLength(result.css)} bytes. Vendor checksums verified.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await build();
