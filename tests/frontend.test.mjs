import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import postcss from 'postcss';
import { transformTheme } from '../tools/build.mjs';

const root = new URL('../', import.meta.url);
const js = await readFile(new URL('src/tv.js', root), 'utf8');
const css = await readFile(new URL('src/Jellyfin.Plugin.ElegantFinTv/Web/tv.css', root), 'utf8');
let browser, server, base;
let requests = [];
const fixture = `<!doctype html><html class="layout-tv"><head><meta charset="utf-8">
<style>
body { margin:0; padding:30px; background:#111827; }
#slides-container { position:relative!important; top:0!important; left:0!important; width:900px!important; height:350px!important; }
.slide { position:absolute; inset:0; }
.slide:not(.active) { opacity:0; }
.button-container { position:absolute; bottom:30px!important; display:flex; gap:25px; }
.play-button,.detail-button { display:inline-block; width:120px; height:55px; }
</style></head><body>
<div id="slides-container"><div class="slide active" id="one"><div class="button-container"><button class="play-button">Play</button><div class="detail-button">Details</div></div></div>
<div class="slide" id="two"><div class="button-container"><button class="play-button">Play 2</button><div class="detail-button">Details 2</div></div></div></div>
<button id="outside">Outside</button><footer class="appfooter">Footer <span class="material-icons">play_arrow</span></footer>
<script src="../ElegantFinTv/bootstrap.js"></script></body></html>`;

before(async () => {
    server = createServer(async (req, res) => {
        requests.push(req.url);
        if (/\/fonts\/font-\d+\.woff2$/.test(req.url)) {
            res.setHeader('content-type', 'font/woff2');
            res.end(await readFile(new URL('vendor/fonts/' + req.url.split('/').pop(), root)));
        } else if (req.url.includes('bootstrap.js')) {
            res.setHeader('content-type', 'text/javascript');
            res.end('window.ElegantFinTvConfig={enabled:true,mediaBar:true,performance:"balanced"};\n' + js);
        } else if (req.url.includes('tv.css')) {
            res.setHeader('content-type', 'text/css');
            res.end(css);
        } else { res.setHeader('content-type', 'text/html'); res.end(fixture); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    let executablePath = process.env.EFTV_BROWSER;
    if (!executablePath) { try { await access(edge); executablePath = edge; } catch {} }
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });

async function open(options = {}) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.on('pageerror', error => console.error('Browser error:', error.message));
    page.on('console', message => { if (message.type() === 'warning') console.error(message.text()); });
    await page.route(/https:\/\/(fonts.googleapis.com|fonts.gstatic.com)/, route => route.abort());
    await page.goto(base + '/jellyfin/web/index.html');
    await page.waitForFunction(() => window.ElegantFinTv?.status().active);
    return { page, context };
}

test('originals and independent vendor copies retain their SHA256 hashes', async () => {
    const sources = JSON.parse(await readFile(new URL('vendor/sources.json', root), 'utf8'));
    for (const source of sources) {
        for (const location of [`vendor/${source.file}`, `../${source.file}`]) {
            // Original workspace files are optional when this independent project is copied elsewhere.
            if (location.startsWith('../')) {
                try { await access(new URL(location, root)); } catch { continue; }
            }
            const bytes = await readFile(new URL(location, root));
            assert.equal(createHash('sha256').update(bytes).digest('hex'), source.sha256, location);
        }
    }
});

test('selector transform handles root, body, desktop and keyframes without losing TV scope', () => {
    const guard = ':where(:root:is(.layout-desktop, .layout-mobile):not(.layout-tv), :root:is(.layout-desktop, .layout-mobile):not(.layout-tv) *)';
    const output = transformTheme(`${guard}:root.layout-desktop { color:red; animation:spin 1s; } body${guard} .x {color:blue} @keyframes spin {to {opacity:0}}`).toString();
    assert.match(output, /:is\(\.layout-desktop,\.layout-tv\)/);
    assert.match(output, /body:where\(:root\[data-eftv\]/);
    assert.match(output, /animation:eftv-spin/);
    assert.match(output, /@keyframes eftv-spin/);
    assert.throws(() => transformTheme('.unscoped { color:red }'));
    postcss.parse(css).walkRules(rule => {
        if (rule.parent.type === 'atrule' && /keyframes/.test(rule.parent.name)) return;
        assert.ok(rule.selector.includes('[data-eftv]'), rule.selector);
    });
});

test('TV activation preserves Jellyfin layout and reverse-proxy base URL; blur is removed', async () => {
    requests = [];
    const {page, context} = await open();
    assert.equal(await page.locator('html').getAttribute('class'), 'layout-tv');
    assert.equal(await page.locator('.appfooter').evaluate(el => getComputedStyle(el).backdropFilter), 'none');
    assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--accentColor').trim()), '#5d55e7');
    assert.ok(requests.some(path => path.startsWith('/jellyfin/ElegantFinTv/tv.css?')));
    assert.equal(await page.locator('link[rel=stylesheet]').count(), 1);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.fonts.check('425 16px Inter')), true);
    assert.equal(css.includes('fonts.googleapis.com'), false);
    assert.equal(css.includes('fonts.gstatic.com'), false);
    assert.match(await page.locator('.material-icons').evaluate(el => getComputedStyle(el).fontFamily), /Rounded Minimal/);
    const fonts = JSON.parse(await readFile(new URL('vendor/fonts/sources.json', root), 'utf8'));
    const fullIcons = fonts.fonts.find(font => font.url.includes('/materialsymbolsrounded/'));
    assert.ok(fullIcons);
    assert.equal(requests.some(path => path.endsWith('/fonts/' + fullIcons.file)), false);
    await context.close();
});

test('inactive slides cannot capture focus; D-pad and Enter work without native double clicks', async () => {
    const {page, context} = await open();
    await page.waitForSelector('#slides-container[data-eftv-adapted]');
    assert.equal(await page.locator('#two').getAttribute('inert'), '');
    await page.evaluate(() => {
        window.clicks = 0;
        document.getElementById('slides-container').addEventListener('click', () => window.clicks++);
    });
    await page.locator('#one .play-button').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.clicks), 1);
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'detail-button');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.clicks), 2);
    await page.evaluate(() => {
        document.getElementById('one').classList.remove('active');
        document.getElementById('two').classList.add('active');
    });
    await page.waitForFunction(() => document.activeElement.closest('.slide')?.id === 'two');
    assert.equal(await page.locator('#one').getAttribute('inert'), '');
    await context.close();
});

test('edge navigation and Back remain available to Jellyfin', async () => {
    const {page, context} = await open();
    await page.evaluate(() => {
        window.keys = [];
        document.addEventListener('keydown', event => window.keys.push(event.key));
    });
    await page.locator('#one .detail-button').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => window.keys), ['ArrowDown', 'Escape']);
    await context.close();
});

test('late/replaced Media Bar is adapted; dispose restores owned attributes', async () => {
    const {page, context} = await open();
    await page.evaluate(() => {
        document.getElementById('slides-container').remove();
        const node = document.createElement('div');
        node.id = 'slides-container';
        node.innerHTML = '<div class="slide active"><div class="detail-button">Details</div></div><div class="slide"></div>';
        document.body.appendChild(node);
    });
    await page.waitForSelector('#slides-container[data-eftv-adapted]');
    assert.equal(await page.locator('.detail-button').getAttribute('tabindex'), '0');
    await page.evaluate(() => window.ElegantFinTv.dispose());
    assert.equal(await page.locator('html').getAttribute('data-eftv'), null);
    assert.equal(await page.locator('.detail-button').getAttribute('tabindex'), null);
    assert.equal(await page.locator('.slide[inert]').count(), 0);
    assert.equal(await page.locator('link[rel=stylesheet]').count(), 0);
    await context.close();
});

test('desktop stays unchanged; runtime layout switch activates then restores theme', async () => {
    const {page, context} = await open();
    await page.evaluate(() => document.documentElement.className = 'layout-desktop');
    await page.waitForFunction(() => !window.ElegantFinTv.status().active);
    assert.equal(await page.locator('#slides-container').getAttribute('data-eftv-adapted'), null);
    await page.evaluate(() => document.documentElement.className = 'layout-tv');
    await page.waitForFunction(() => window.ElegantFinTv.status().active);
    assert.equal(await page.locator('link[rel=stylesheet]').count(), 1);
    await context.close();
});

test('webOS is detected even when Jellyfin uses desktop layout', async () => {
    const {page, context} = await open({ userAgent: 'Mozilla/5.0 (Web0S; Linux/SmartTV) Chrome/108.0.5359.211' });
    await page.evaluate(() => document.documentElement.className = 'layout-desktop');
    await page.waitForTimeout(30);
    assert.equal(await page.evaluate(() => window.ElegantFinTv.status().active), true);
    await context.close();
});

test('initial desktop load downloads no TV stylesheet or fonts', async () => {
    const page = await browser.newPage();
    await page.route('**/web/index.html', route => route.fulfill({ contentType: 'text/html', body: fixture.replace('class="layout-tv"', 'class="layout-desktop"') }));
    await page.goto(base + '/web/index.html');
    assert.equal(await page.evaluate(() => window.ElegantFinTv.status().active), false);
    assert.equal(await page.locator('link[rel=stylesheet]').count(), 0);
    await page.close();
});

test('unknown Media Bar slide conventions are left focusable', async () => {
    const {page, context} = await open();
    await page.evaluate(() => {
        const old = document.getElementById('slides-container');
        old.remove();
        const replacement = document.createElement('div');
        replacement.id = 'slides-container';
        replacement.innerHTML = '<div class="slide current"><button class="play-button">Play</button></div><div class="slide"></div>';
        document.body.appendChild(replacement);
    });
    await page.waitForSelector('#slides-container[data-eftv-adapted]');
    assert.equal(await page.locator('.slide[inert]').count(), 0);
    await context.close();
});

test('poster cards have one outline; standalone buttons keep a visible focus indicator', async () => {
    const {page, context} = await open();
    await page.evaluate(() => {
        const card = document.createElement('div');
        card.id = 'poster-test';
        card.className = 'card show-focus';
        card.tabIndex = 0;
        card.innerHTML = '<div class="cardScalable" style="width:150px;height:220px"><a href="#film" class="cardImageContainer cardContent" style="display:block;width:150px;height:220px">Poster</a><button>Action</button></div>';
        document.body.appendChild(card);
    });
    await page.locator('#poster-test').focus();
    assert.equal(await page.locator('#poster-test').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    assert.equal(await page.locator('#poster-test .cardScalable').evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
    await page.locator('#poster-test a').focus();
    assert.equal(await page.locator('#poster-test a').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    assert.equal(await page.locator('#poster-test .cardScalable').evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
    await page.locator('#outside').focus();
    assert.equal(await page.locator('#outside').evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
    await context.close();
});

test('balanced profile overrides Media Bar literal blur and animated logos', async () => {
    const {page, context} = await open();
    await page.addStyleTag({ content: '#slides-container .detail-button {backdrop-filter:blur(6px)} #slides-container .logo.animate {animation:foreignBlur 10s infinite} @keyframes foreignBlur{to{filter:blur(8px)}}' });
    await page.evaluate(() => {
        const logo = document.createElement('div'); logo.className = 'logo animate';
        document.getElementById('one').appendChild(logo);
    });
    assert.equal(await page.locator('#one .detail-button').evaluate(el => getComputedStyle(el).backdropFilter), 'none');
    assert.equal(await page.locator('#one .logo').evaluate(el => getComputedStyle(el).animationName), 'none');
    await context.close();
});

test('diagnosis groups image timing without retaining URLs or tokens', async () => {
    const {page, context} = await open();
    await page.route('**/Items/private-id/Images/Primary*', route => route.fulfill({
        contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>'
    }));
    const result = await page.evaluate(async () => {
        const pending = window.ElegantFinTv.diagnose(1);
        const image = new Image();
        image.src = '/Items/private-id/Images/Primary?api_key=private-token';
        document.body.appendChild(image);
        const sized = new Image();
        sized.src = '/Items/private-id/Images/Primary?fillWidth=300&fillHeight=450';
        document.body.appendChild(sized);
        return await pending;
    });
    assert.equal(result.cancelled, false);
    assert.equal(result.images.primary.count, 2);
    assert.equal(result.images.primary.uncapped, 1);
    assert.ok(result.images.primary.encodedBytes > 0);
    assert.doesNotMatch(JSON.stringify(result), /private-id|private-token|api_key|127\.0\.0\.1/);
    await page.evaluate(async () => {
        const pending = window.ElegantFinTv.diagnose(30);
        window.ElegantFinTv.dispose();
        window.cancelledReport = await pending;
    });
    assert.equal(await page.evaluate(() => window.cancelledReport.cancelled), true);
    await context.close();
});

test('balanced cards suppress native focus zoom and shadows while preserving actions and full profile', async () => {
    const {page, context} = await open();
    await page.addStyleTag({ content: '.card.show-animation:focus .cardBox {transform:scale(1.1);transition:transform .2s;box-shadow:0 0 12px red} .cardOverlayContainer::after {content:"";transition:transform 1s}' });
    await page.evaluate(() => {
        const card = document.createElement('div');
        card.id = 'motion-card'; card.className = 'card show-animation'; card.tabIndex = 0;
        card.innerHTML = '<div class="cardBox"><div class="cardScalable"><a href="#film" class="cardImageContainer">Poster</a><div class="cardOverlayContainer"><button>Play</button></div></div></div>';
        document.body.appendChild(card);
    });
    await page.locator('#motion-card').focus();
    const read = () => page.locator('#motion-card .cardBox').evaluate(el => {
        const s = getComputedStyle(el); return {transform:s.transform, shadow:s.boxShadow, duration:s.transitionDuration};
    });
    assert.deepEqual(await read(), {transform:'none', shadow:'none', duration:'0s'});
    assert.equal(await page.locator('#motion-card .cardOverlayContainer').evaluate(el => getComputedStyle(el, '::after').content), 'none');
    assert.equal(await page.locator('#motion-card .cardScalable').evaluate(el => getComputedStyle(el).outlineStyle), 'solid');
    await page.locator('#motion-card button').focus();
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Play');
    await page.evaluate(() => document.documentElement.setAttribute('data-eftv-performance', 'full'));
    await page.locator('#motion-card').focus();
    assert.notEqual((await read()).shadow, 'none');
    assert.notEqual((await read()).duration, '0s');
    await context.close();
});

test('balanced navigation header is opaque; playback header is not overridden', async () => {
    const {page, context} = await open();
    await page.addStyleTag({ content: '.skinHeader {background:rgba(10,20,30,.5)} .skinHeader::after {content:""}' });
    await page.evaluate(() => {
        for (const name of ['skinHeader','skinHeader osdHeader']) {
            const el = document.createElement('header'); el.className=name; document.body.appendChild(el);
        }
    });
    assert.equal(await page.locator('.skinHeader:not(.osdHeader)').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(17, 24, 39)');
    assert.equal(await page.locator('.skinHeader:not(.osdHeader)').evaluate(el => getComputedStyle(el, '::after').content), 'none');
    assert.equal(await page.locator('.osdHeader').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(10, 20, 30, 0.5)');
    await context.close();
});

test('opt-in TV diagnostics produces a report without taking focus or posting data', async () => {
    const page = await browser.newPage();
    await page.clock.install();
    await page.route('**/bootstrap.js', route => route.fulfill({ contentType: 'text/javascript',
        body: 'window.ElegantFinTvConfig={enabled:true,mediaBar:true,performance:"balanced",showDiagnostics:true};\n' + js }));
    let posts = 0;
    page.on('request', request => { if (request.method() === 'POST') posts++; });
    await page.goto(base + '/web/index.html');
    await page.waitForSelector('#eftv-diagnostics');
    await page.locator('#outside').focus();
    await page.clock.fastForward(5000);
    await page.clock.fastForward(15000);
    await page.waitForFunction(() => document.getElementById('eftv-diagnostics').textContent.includes('Bitte Ergebnis fotografieren'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'outside');
    assert.equal(posts, 0);
    await page.evaluate(() => window.ElegantFinTv.dispose());
    assert.equal(await page.locator('#eftv-diagnostics').count(), 0);
    await page.close();
});
