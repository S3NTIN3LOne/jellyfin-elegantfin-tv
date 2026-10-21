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
const fullCss = await readFile(new URL('src/Jellyfin.Plugin.ElegantFinTv/Web/tv-full.css', root), 'utf8');
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
        } else if (req.url.includes('tv-full.css')) {
            res.setHeader('content-type', 'text/css');
            res.end(fullCss);
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
    assert.doesNotMatch(await page.locator('.material-icons').evaluate(el => getComputedStyle(el).fontFamily), /Rounded/);
    assert.equal(requests.some(path => path.includes('tv-full.css')), false);
    const fonts = JSON.parse(await readFile(new URL('vendor/fonts/sources.json', root), 'utf8'));
    const fullIcons = fonts.fonts.find(font => font.url.includes('/materialsymbolsrounded/'));
    assert.ok(fullIcons);
    assert.equal(requests.some(path => path.endsWith('/fonts/' + fullIcons.file)), false);
    await context.close();
});

test('full comparison loads its own bundle; minimal leaves Media Bar transitions intact', async () => {
    const {page, context} = await open();
    await page.addStyleTag({content:'#slides-container .slide {transition:opacity .7s linear}'});
    assert.equal(await page.locator('#one').evaluate(el => getComputedStyle(el).transitionDuration), '0.7s');
    await context.close();
    requests = [];
    const full = await browser.newPage();
    await full.route('**/bootstrap.js', route => route.fulfill({contentType:'text/javascript', body:
        'window.ElegantFinTvConfig={enabled:true,performance:"full"};\n' + js}));
    await full.goto(base + '/jellyfin/web/index.html');
    await full.waitForFunction(() => window.ElegantFinTv?.status().active);
    assert.ok(requests.some(path => path.startsWith('/jellyfin/ElegantFinTv/tv-full.css?')));
    assert.equal(requests.some(path => path.includes('/tv.css?')), false);
    assert.match(await full.locator('.material-icons').evaluate(el => getComputedStyle(el).fontFamily), /Rounded/);
    await full.close();
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
    await page.addStyleTag({content:'#poster-test .cardImageContainer{position:absolute;inset:0;z-index:4;background:#888}'});
    assert.equal(await page.locator('#poster-test').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    assert.equal(await page.locator('#poster-test .cardScalable').evaluate(el => getComputedStyle(el, '::after').borderTopStyle), 'solid');
    assert.equal(await page.locator('#poster-test .cardScalable').evaluate(el => getComputedStyle(el, '::after').borderTopWidth), '3px');
    assert.equal(await page.locator('#poster-test .cardScalable').evaluate(el => getComputedStyle(el, '::after').borderTopColor), 'rgb(255, 255, 255)');
    const pixels = await page.locator('#poster-test .cardScalable').screenshot();
    const edges = await page.evaluate(async png => {
        const img = new Image(); img.src='data:image/png;base64,'+png; await img.decode();
        const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
        const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
        return [1,3].map(x=>Array.from(ctx.getImageData(x,100,1,1).data).slice(0,3));
    },pixels.toString('base64'));
    assert.deepEqual(edges, [[255,255,255],[17,24,39]], 'white ring and dark contrast edge are painted above the image');
    await page.locator('#poster-test a').focus();
    assert.equal(await page.locator('#poster-test a').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    assert.equal(await page.locator('#poster-test .cardScalable').evaluate(el => getComputedStyle(el, '::after').borderTopStyle), 'solid');
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

test('minimal theme preserves native card dimensions, focus zoom, transitions and actions', async () => {
    const {page, context} = await open();
    await page.addStyleTag({ content: '.card {width:150px} .card.show-animation:focus .cardBox {transform:scale(1.1);transition:transform .2s;box-shadow:0 0 12px red} .cardOverlayContainer::after {content:"";transition:transform 1s}' });
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
    await page.waitForTimeout(250);
    const native = await read();
    assert.equal(native.transform, 'matrix(1.1, 0, 0, 1.1, 0, 0)');
    assert.equal(native.duration, '0.2s');
    assert.equal(native.shadow, 'none');
    assert.equal(await page.locator('#motion-card').evaluate(el => getComputedStyle(el).width), '150px');
    assert.equal(await page.locator('#motion-card .cardScalable').evaluate(el => getComputedStyle(el, '::after').borderTopStyle), 'solid');
    await page.locator('#motion-card button').focus();
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Play');
    await page.evaluate(() => window.ElegantFinTv.dispose());
    await page.locator('#motion-card').focus();
    await page.waitForTimeout(250);
    const restored = await read();
    assert.equal(restored.transform, native.transform);
    assert.equal(restored.duration, native.duration);
    assert.notEqual(restored.shadow, 'none');
    await context.close();
});

test('minimal navigation header blurs only its fixed surface; playback header is not overridden', async () => {
    const {page, context} = await open();
    await page.addStyleTag({ content: '.skinHeader {background:rgba(10,20,30,.5)} .skinHeader::after {content:""}' });
    await page.evaluate(() => {
        for (const name of ['skinHeader','skinHeader osdHeader']) {
            const el = document.createElement('header'); el.className=name; document.body.appendChild(el);
        }
    });
    assert.equal(await page.locator('.skinHeader:not(.osdHeader)').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    const header = page.locator('.skinHeader:not(.osdHeader)');
    assert.equal(await header.evaluate(el => getComputedStyle(el).backdropFilter), 'none');
    assert.equal(await header.evaluate(el => getComputedStyle(el).maskImage), 'none');
    const fade = await header.evaluate(el => {
        const s = getComputedStyle(el, '::before');
        return {blur:s.backdropFilter, mask:s.maskImage, bottom:s.bottom, pointer:s.pointerEvents};
    });
    assert.equal(fade.blur, 'blur(8px)');
    assert.match(fade.mask, /linear-gradient.*rgba\(0, 0, 0, 0\)/);
    assert.equal(fade.bottom, '0px');
    assert.equal(fade.pointer, 'none');
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
    await page.clock.fastForward(20000);
    assert.match(await page.locator('#eftv-diagnostics').textContent(), /Bibliothek öffnen/);
    await page.keyboard.press('F8');
    await page.clock.fastForward(3000);
    assert.equal(await page.locator('#eftv-diagnostics').isVisible(), false);
    await page.clock.fastForward(100);
    await page.clock.fastForward(15000);
    await page.waitForFunction(() => document.getElementById('eftv-diagnostics').textContent.includes('Bitte Ergebnis fotografieren'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'outside');
    assert.equal(posts, 0);
    assert.match(await page.locator('#eftv-diagnostics').textContent(), /Hauptthread-Aufgaben gesamt:/);
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', {keyCode:403, bubbles:true})));
    await page.clock.fastForward(3000);
    await page.clock.fastForward(100);
    await page.clock.fastForward(15000);
    assert.match(await page.locator('#eftv-diagnostics').textContent(), /Lauf 2/);
    await page.evaluate(() => window.ElegantFinTv.dispose());
    assert.equal(await page.locator('#eftv-diagnostics').count(), 0);
    await page.close();
});

test('comparison matrix isolates CSS and adapter, independently of measurement', async () => {
    for (const showDiagnostics of [false, true]) {
        for (const [mode, theme, adapter] of [['reference',false,false],['theme',true,false],['adapter',false,true],['complete',true,true]]) {
            const page = await browser.newPage();
            const downloaded = [];
            page.on('request', request => downloaded.push(request.url()));
            await page.route('**/bootstrap.js', route => route.fulfill({contentType:'text/javascript', body:
                'window.ElegantFinTvConfig=' + JSON.stringify({enabled:true, mediaBar:false, performance:'balanced', comparisonMode:mode, showDiagnostics}) + ';\n' + js}));
            await page.goto(base + '/web/index.html');
            await page.waitForFunction(() => window.ElegantFinTv?.status().active);
            assert.deepEqual(await page.evaluate(() => window.ElegantFinTv.status().components), {mode, theme, adapter});
            assert.equal(await page.locator('html').getAttribute('data-eftv') !== null, theme);
            assert.equal(downloaded.some(url => url.includes('/tv.css')), theme);
            if (!theme) assert.equal(downloaded.some(url => url.includes('/fonts/')), false);
            assert.equal(await page.locator('#slides-container[data-eftv-adapted]').count(), adapter ? 1 : 0);
            assert.equal(await page.locator('#eftv-diagnostics').count(), showDiagnostics ? 1 : 0);
            if (showDiagnostics) assert.equal(await page.locator('#eftv-diagnostics').evaluate(el => getComputedStyle(el).pointerEvents), 'auto');
            await page.close();
        }
    }
});

test('comparison settings do not change desktop behavior even with apply-to-all enabled', async () => {
    const page = await browser.newPage();
    await page.route('**/web/index.html', route => route.fulfill({contentType:'text/html', body:fixture.replace('class="layout-tv"','class="layout-desktop"')}));
    await page.route('**/bootstrap.js', route => route.fulfill({contentType:'text/javascript', body:
        'window.ElegantFinTvConfig={enabled:true,applyToAllClients:true,mediaBar:false,showDiagnostics:true,comparisonMode:"adapter"};\n' + js}));
    await page.goto(base + '/web/index.html');
    await page.waitForFunction(() => window.ElegantFinTv?.status().active);
    assert.deepEqual(await page.evaluate(() => window.ElegantFinTv.status().components), {mode:'normal',theme:true,adapter:false});
    assert.equal(await page.locator('#eftv-diagnostics').count(), 0);
    await page.close();
});

test('manual start restores content focus; dispose cancels the countdown and red shortcut', async () => {
    const page = await browser.newPage();
    await page.clock.install();
    await page.route('**/bootstrap.js', route => route.fulfill({contentType:'text/javascript', body:
        'window.ElegantFinTvConfig={enabled:true,comparisonMode:"reference",showDiagnostics:true};\n' + js}));
    await page.goto(base + '/web/index.html');
    await page.waitForSelector('#eftv-diagnostics');
    await page.locator('#outside').focus();
    const start = page.getByRole('button', {name:'Messung starten'});
    await start.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'outside');
    await page.evaluate(() => window.ElegantFinTv.dispose());
    await page.clock.fastForward(20000);
    await page.keyboard.press('F8');
    assert.equal(await page.locator('#eftv-diagnostics').count(), 0);
    assert.equal(await page.locator('style').count(), 1); // only the fixture style remains
    await page.close();
});

test('dimension samples read existing IMG sizes only and do not retain identifying data', async () => {
    const {page, context} = await open();
    await page.route('**/Items/private-id/Images/Primary*', route => route.fulfill({contentType:'image/svg+xml',
        body:'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"></svg>'}));
    const result = await page.evaluate(async () => {
        const img = new Image();
        img.src='/Items/private-id/Images/Primary?token=secret';
        img.style.cssText='position:fixed;top:0;left:0;width:100px;height:150px';
        document.body.appendChild(img);
        await img.decode();
        return await window.ElegantFinTv.diagnose(1);
    });
    assert.deepEqual(result.imageDimensions, [{kind:'primary',width:600,height:900,displayWidth:100,displayHeight:150}]);
    assert.equal(result.imageRequestsObserved, 0);
    assert.doesNotMatch(JSON.stringify(result), /private-id|secret|token=/);
    await context.close();
});


test('classic TV navigation uses user library routes and handles late rendering, focus and removal', async () => {
    const {page, context} = await open();
    await page.evaluate(() => {
        const header = document.createElement('header');
        header.className = 'skinHeader';
        header.innerHTML = '<div class="headerTop"><div class="headerLeft"><h3 class="pageTitle">Startseite</h3></div><div class="headerRight"><button id="native-search">Search</button></div></div>';
        document.body.prepend(header);
        const drawer = document.createElement('div');
        drawer.className = 'mainDrawer'; drawer.hidden = true;
        drawer.innerHTML = '<div class="libraryMenuOptions"><a class="navMenuOption" data-itemid="movie-id" href="#/movies?topParentId=movie-id"><span class="material-icons navMenuOptionIcon movie"></span><span class="navMenuOptionText">Meine Filme</span></a><a class="navMenuOption" data-itemid="tv-id" href="#/livetv"><span class="navMenuOptionText">Live TV</span></a><a class="navMenuOption" data-itemid="tv-id" href="#/livetv?tab=1">Guide</a><a class="navMenuOption" href="https://example.com">External</a></div>';
        document.body.appendChild(drawer);
    });
    await page.waitForSelector('.eftv-library-nav');
    assert.equal(await page.locator('.eftv-library-nav a').count(), 4);
    assert.equal(await page.locator('.eftv-brand').evaluate(el => el.tagName), 'SPAN');
    assert.equal(await page.locator('.eftv-brand').evaluate(el => el.tabIndex), -1);
    assert.equal(await page.locator('.eftv-library-nav a[href="#/home"]').textContent(), 'homeStartseite');
    const movieLink = page.locator('.eftv-library-nav a[href="#/movies?topParentId=movie-id"]');
    await movieLink.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => location.hash === '#/movies?topParentId=movie-id');
    await page.waitForFunction(() => document.querySelector('.eftv-library-nav a[aria-current="page"]')?.textContent.includes('Meine Filme'));
    await page.evaluate(() => document.querySelector('.libraryMenuOptions .navMenuOptionText').textContent = 'Filme & Serien');
    await page.waitForFunction(() => document.activeElement?.textContent.includes('Filme & Serien'));
    assert.equal(await page.locator('#native-search').count(), 1);
    await page.locator('.eftv-library-nav a[href="#/home?tab=1"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => location.hash === '#/home?tab=1');
    await page.evaluate(() => document.querySelector('.libraryMenuOptions').replaceChildren());
    await page.waitForFunction(() => !document.querySelector('.eftv-library-nav'));
    assert.equal(await page.locator('.skinHeader').getAttribute('data-eftv-navigation'), null);
    await page.evaluate(() => document.querySelector('.libraryMenuOptions').innerHTML = '<a class="navMenuOption" href="#/movies">Movies</a>');
    await page.waitForSelector('.eftv-library-nav');
    await page.evaluate(() => window.ElegantFinTv.dispose());
    assert.equal(await page.locator('.eftv-library-nav').count(), 0);
    assert.notEqual(await page.locator('.pageTitle').evaluate(el => getComputedStyle(el).display), 'none');
    await context.close();
});

test('modern header does not get duplicate navigation from its hidden legacy header', async () => {
    const {page, context} = await open();
    await page.evaluate(() => {
        const hidden = document.createElement('div'); hidden.style.display = 'none';
        hidden.innerHTML = '<div class="skinHeader"><div class="headerTop"></div></div><div class="mainDrawer"><div class="libraryMenuOptions"><a class="navMenuOption" href="#/movies">Movies</a></div></div>';
        document.body.appendChild(hidden);
        const modern = document.createElement('header'); modern.className = 'MuiAppBar-root';
        modern.innerHTML = '<a class="MuiButton-text" href="#/movies">Movies</a>';
        document.body.appendChild(modern);
    });
    await page.waitForTimeout(60);
    assert.equal(await page.locator('.eftv-library-nav').count(), 0);
    assert.equal(await page.locator('.MuiAppBar-root a').count(), 1);
    await context.close();
});

test('hero fits TV viewports, preserves slide transitions and leaves room for home rows', async () => {
    for (const viewport of [{width:1920,height:1080},{width:1280,height:720}]) {
        const {page, context} = await open({viewport, deviceScaleFactor:2});
        await page.evaluate(() => {
            // Representative native Media Bar v3+ structure and absolute stage.
            document.querySelector('head style').remove();
            const style = document.createElement('style');
            style.textContent = 'html{font-size:20px}body{margin:0}#slides-container{position:absolute;top:0;left:0;width:100%;height:100vh;margin-top:-50vw}.slide{position:absolute;inset:0;transition:opacity .5s}.slide-content{position:absolute;display:flex;flex-direction:column}.logo-container{display:flex}.logo{height:100%;width:100%}.button-container{display:flex;gap:15px}.dots-container,.arrow{position:absolute}.homeSectionsContainer{position:relative;height:180px}';
            document.head.appendChild(style);
            document.querySelector('#one').innerHTML = '<div class="slide-content"><div class="logo-container"><div class="logo">Example title</div></div><div>2026 ? 2h 7m</div><div class="plot">A short description of this example film.</div><div class="button-container"><button class="play-button">Play</button><button class="detail-button">Info</button><button class="favorite-button">Favorite</button></div></div>';
            document.querySelector('#two').remove();
            const bar = document.querySelector('#slides-container');
            bar.insertAdjacentHTML('beforeend','<div class="dots-container"><button class="dot active"></button><button class="dot"></button></div><button class="arrow left-arrow">Previous</button><button class="arrow right-arrow">Next</button>');
            document.body.insertAdjacentHTML('beforeend','<div class="homeSectionsContainer">Meine Medien</div>');
        });
        const bar = await page.locator('#slides-container').boundingBox();
        const content = await page.locator('.slide-content').boundingBox();
        const rows = await page.locator('.homeSectionsContainer').boundingBox();
        assert.ok(bar.x > 0 && bar.x + bar.width < viewport.width);
        assert.ok(content.y >= bar.y && content.y + content.height < bar.y + bar.height);
        assert.ok(rows.y > bar.y + bar.height);
        assert.equal(await page.locator('#one').evaluate(el => getComputedStyle(el).transitionDuration), '0.5s');
        assert.equal(await page.locator('#one').evaluate(el => getComputedStyle(el).maskImage), 'none');
        assert.equal(await page.locator('.play-button').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(209, 213, 219)');
        const next = await page.locator('.right-arrow').boundingBox();
        assert.ok(next.x > bar.x + bar.width / 2 && next.y > bar.y + bar.height / 2);
        await context.close();
    }
});

test('Media Bar height setting keeps the following rows at a constant gap', async () => {
    for (const viewport of [{width:1920,height:1080}, {width:1280,height:720}]) {
        const {page, context} = await open({viewport});
        await page.evaluate(() => {
            document.querySelector('head style').remove();
            document.body.innerHTML = '<div class="page"><div id="slides-container"></div><div class="homeSectionsContainer">Movies</div></div>';
            document.documentElement.style.setProperty('--slideshow-page-offset', '80px');
        });
        await page.addStyleTag({content: `
            body{margin:0;padding:0}.page{display:flow-root;padding-top:80px}
            #slides-container{position:absolute}
            .homeSectionsContainer{position:relative;height:180px;margin-top:calc(var(--slideshow-tv-height) - var(--slideshow-page-offset))}
        `});
        for (const height of [60,30,40,undefined]) {
            await page.evaluate(height => {
                if (height) document.documentElement.style.setProperty('--slideshow-tv-height', height+'vh');
                else document.documentElement.style.removeProperty('--slideshow-tv-height');
            }, height);
            await page.waitForFunction(() => {
                const bar = document.getElementById('slides-container').getBoundingClientRect();
                const rows = document.querySelector('.homeSectionsContainer').getBoundingClientRect();
                return Math.abs(rows.top - bar.bottom - 12) < 1;
            });
            const bar = await page.locator('#slides-container').boundingBox();
            const rows = await page.locator('.homeSectionsContainer').boundingBox();
            assert.ok(Math.abs(bar.height - viewport.height * (height || 50) / 100) < 1);
            assert.ok(Math.abs(rows.y - bar.y - bar.height - 12) < 1, 'gap must not grow when bar height decreases');
        }
        await context.close();
    }
});

test('TV header wraps every library, separates page tabs and remains visible on scroll', async () => {
    for (const width of [1920, 1280]) {
        const {page, context} = await open({viewport:{width,height:1080}});
        await page.evaluate(() => {
            location.hash = '#/home.html';
            const style = document.createElement('style');
            style.textContent = 'html{font-size:32px}body{height:3000px}.skinHeader{position:absolute;transform:translateY(-100%)}.headerTabs{position:absolute;top:0;left:25%;width:50%;display:flex}.headerRight{width:10rem}.headerLeft{position:absolute}.headerTop{display:flex}.headerTabs button{font-size:1rem}';
            document.head.appendChild(style);
            document.body.insertAdjacentHTML('afterbegin', '<header class="skinHeader headroom--unpinned"><div class="headerTop"><div class="headerLeft"><h3 class="pageTitle">Startseite</h3></div><div class="headerRight">Search / User</div></div><div class="headerTabs"><button>Startseite</button><button>Favoriten</button></div></header><div class="mainDrawer" hidden><div class="libraryMenuOptions"></div></div>');
            document.querySelector('.libraryMenuOptions').innerHTML = ['Anime','Filme','Live TV','Sammlungen','Serien'].map((label,i) => '<a class="navMenuOption" href="#/library?id='+i+'"><span class="navMenuOptionText">'+label+'</span></a>').join('');
        });
        await page.waitForSelector('.eftv-library-nav');
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.headerTabs')).display === 'none');
        const nav = await page.locator('.eftv-library-nav').boundingBox();
        for (const link of await page.locator('.eftv-library-nav a').all()) {
            const box = await link.boundingBox();
            assert.ok(box.x >= nav.x && box.x + box.width <= nav.x + nav.width + 1, await link.textContent());
        }
        await page.evaluate(() => window.scrollTo(0, 300));
        assert.equal((await page.locator('.skinHeader').boundingBox()).y, 0);
        await page.evaluate(() => location.hash = '#/livetv');
        await page.waitForFunction(() => !document.querySelector('.skinHeader').hasAttribute('data-eftv-home-tabs'));
        const tabs = await page.locator('.headerTabs').boundingBox();
        const top = await page.locator('.headerTop').boundingBox();
        assert.ok(tabs.y >= top.y + top.height - 1);
        await page.waitForFunction(() => parseFloat(document.documentElement.style.getPropertyValue('--eftv-header-height')) === Math.ceil(document.querySelector('.skinHeader').getBoundingClientRect().height));
        await page.evaluate(() => window.ElegantFinTv.dispose());
        assert.equal(await page.locator('.skinHeader').getAttribute('data-eftv-home-tabs'), null);
        assert.equal(await page.locator('html').evaluate(el => el.style.getPropertyValue('--eftv-header-height')), '');
        await context.close();
    }
});

test('native non-animated TV card borders and grey image corners are removed', async () => {
    const {page, context} = await open();
    await page.addStyleTag({content: `
        html{font-size:32px}
        .card.show-focus:not(.show-animation) .cardBox.visualCardBox,
        .card.show-focus:not(.show-animation) .cardBox:not(.visualCardBox) .cardScalable{border:.5em solid transparent;border-radius:.7em}
        .card:focus .cardScalable,.card:focus .cardBox.visualCardBox{border-color:cyan}
        .cardBox:not(.visualCardBox) .cardPadder{background:#242424;border-radius:.2em}
        .cardScalable{width:200px;height:120px}.cardPadder{width:100%;height:100%}
    `});
    for (const visual of [false, true]) {
        await page.evaluate(visual => {
            document.getElementById('native-card')?.remove();
            const card = document.createElement('div');
            card.id='native-card';card.className='card show-focus';card.tabIndex=0;
            card.innerHTML='<div class="cardBox '+(visual?'visualCardBox':'')+'"><div class="cardScalable"><div class="cardPadder"><canvas class="blurhash-canvas"></canvas></div><a class="cardImageContainer" href="#/details">Poster</a></div></div>';
            document.body.appendChild(card);
        }, visual);
        await page.locator('#native-card').focus();
        const border = await page.locator(visual ? '#native-card .cardBox' : '#native-card .cardScalable').evaluate(el => getComputedStyle(el).borderTopWidth);
        assert.equal(border, '0px');
        assert.equal(await page.locator('#native-card .cardScalable').evaluate(el => getComputedStyle(el, '::after').borderTopWidth), '3px');
        const radius = await page.locator('#native-card .cardScalable').evaluate(el => getComputedStyle(el).borderTopLeftRadius);
        for (const selector of ['.cardPadder','.cardImageContainer','.blurhash-canvas']) {
            assert.equal(await page.locator('#native-card '+selector).evaluate(el => getComputedStyle(el).borderTopLeftRadius), radius);
        }
        assert.equal(await page.locator('#native-card .cardScalable').evaluate(el => getComputedStyle(el).overflow), 'hidden');
    }
    await context.close();
});

test('TV-size Media Bar controls stay separated and selected actions are not clipped', async () => {
    const {page, context} = await open({viewport:{width:1920,height:1080}});
    await page.addStyleTag({content: `html{font-size:32px}
        .layout-tv #slides-container .arrow{position:absolute;width:4.5rem;height:4.5rem;min-width:5rem}
        .pause-button,.volume-toggle,.ss-settings-toggle{position:absolute;width:3rem;height:3rem}
        .pause-button{right:.8rem}.volume-toggle{right:3.5rem}.ss-settings-toggle{right:4rem}
        .slide-content{position:absolute;overflow:hidden}.play-button:focus{transform:scale(1.2);box-shadow:0 0 0 8px cyan}
    `});
    await page.evaluate(() => {
        document.querySelector('#one').innerHTML='<div class="slide-content"><div class="button-container"><button class="play-button">Play</button><button class="detail-button">Info</button><button class="favorite-button">Favorite</button></div></div>';
        document.querySelector('#slides-container').insertAdjacentHTML('beforeend','<button class="arrow left-arrow">Left</button><button class="arrow right-arrow">Right</button><button class="pause-button">Pause</button><button class="volume-toggle">Mute</button><button class="ss-settings-toggle">Settings</button>');
    });
    const boxes = {};
    for (const name of ['left-arrow','right-arrow','ss-settings-toggle','volume-toggle','pause-button']) boxes[name] = await page.locator('.'+name).boundingBox();
    for (const [a,b] of [['left-arrow','right-arrow'],['ss-settings-toggle','volume-toggle'],['volume-toggle','pause-button']]) {
        assert.ok(boxes[a].x + boxes[a].width < boxes[b].x, a+' / '+b);
        assert.equal(boxes[a].width, boxes[b].width);
    }
    await page.locator('#one .play-button').focus();
    assert.equal(await page.locator('#one .play-button').evaluate(el => getComputedStyle(el).transform), 'none');
    assert.equal(await page.locator('#one .slide-content').evaluate(el => getComputedStyle(el).overflow), 'visible');
    assert.equal(await page.locator('#one .play-button').evaluate(el => getComputedStyle(el).outlineOffset), '-2px');
    await context.close();
});

test('actual home content position includes nested page padding and late section titles', async () => {
    const {page, context} = await open({viewport:{width:1920,height:1080}});
    await page.evaluate(() => {
        document.querySelector('head style').remove();
        document.body.innerHTML = '<div class="page"><div class="scrollFrame"><div class="homeSectionsContainer"><div class="verticalSection"><h2 class="sectionTitle">My media</h2><div style="height:1000px">Cards</div></div></div></div></div><div id="slides-container"></div>';
        document.documentElement.style.setProperty('--slideshow-page-offset', '0px');
        document.documentElement.style.setProperty('--slideshow-tv-height', '40vh');
    });
    await page.addStyleTag({content:`body{margin:0;padding:0}.page{padding-top:100px}
        .scrollFrame{height:850px;overflow:auto;padding-top:170px;box-sizing:border-box}
        .homeSectionsContainer{display:flow-root;padding-top:50px}
        .verticalSection{padding-top:40px}.sectionTitle{margin:0;padding-top:20px;font-size:24px}
        #slides-container{position:absolute}
    `});
    const waitGap = () => page.waitForFunction(() => {
        const title = document.querySelector('.sectionTitle');
        const frame = document.querySelector('.scrollFrame');
        const bottom = document.getElementById('slides-container').getBoundingClientRect().bottom;
        return Math.abs(title.getBoundingClientRect().top + 20 + frame.scrollTop - bottom - 12) < 1;
    });
    await waitGap();
    await page.evaluate(() => document.querySelector('.scrollFrame').scrollTop = 120);
    await page.evaluate(() => document.documentElement.style.setProperty('--slideshow-tv-height', '30vh'));
    await waitGap();
    await page.evaluate(() => {
        document.querySelector('.verticalSection').style.paddingTop = '90px';
        document.querySelector('.sectionTitle').textContent = 'Recently added';
    });
    await waitGap();
    const before = await page.locator('.homeSectionsContainer').getAttribute('style');
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.homeSectionsContainer').getAttribute('style'), before, 'layout correction settles');
    await page.evaluate(() => window.ElegantFinTv.dispose());
    assert.equal(await page.locator('.homeSectionsContainer').evaluate(el => el.style.getPropertyValue('--eftv-rows-margin')), '');
    await context.close();
});

test('Jelly+ posters integrate with Media Bar navigation', async () => {
    const {page, context} = await open();
    await page.evaluate(() => {
        document.body.insertAdjacentHTML('beforeend', '<div class="homeSectionsContainer"><section class="jp-season"><div class="jp-posters"><a class="jp-poster" href="#/details?id=one">Movie</a></div></section></div>');
    });
    await page.locator('.jp-poster').focus();
    assert.equal(await page.locator('.jp-poster').evaluate(el => getComputedStyle(el).outlineOffset), '-3px');
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.locator('#one .play-button').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('.jp-poster').evaluate(el => el === document.activeElement), true);
    await context.close();
});

test('both TV profiles keep player button focus inside and range focus off the rectangle', async () => {
    const page = await browser.newPage();
    for (const sheet of [css, fullCss]) {
        await page.setContent('<html class="layout-tv" data-eftv><body><div class="osdHeader" style="overflow:hidden;contain:paint"><button class="paper-icon-button-light" style="width:50px;height:50px">Back</button></div><div class="videoOsdBottom"><input type="range" class="mdl-slider show-focus"></div></body></html>');
        await page.addStyleTag({content: sheet});
        await page.locator('button').focus();
        const focus = await page.locator('button').evaluate(el => {
            const style = getComputedStyle(el);
            return { offset: style.outlineOffset, transform: style.transform, outline: style.outlineStyle };
        });
        assert.deepEqual(focus, {offset: '-3px', transform: 'none', outline: 'solid'});
        await page.locator('input').focus();
        assert.equal(await page.locator('input').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
        assert.equal(await page.locator('input').evaluate(el => getComputedStyle(el).boxShadow), 'none');
    }
    await page.close();
});

test('Up enters Media Bar from the first row and Down returns without stealing lower-row navigation', async () => {
    const {page, context} = await open();
    await page.evaluate(() => {
        document.body.insertAdjacentHTML('beforeend', '<div class="homeSectionsContainer"><div class="itemsContainer focuscontainer-x"><button class="card" tabindex="0" id="first-card">First</button><button class="card" tabindex="0" id="second-card">Second</button></div><div class="itemsContainer"><button class="card" tabindex="0" id="lower-card">Lower</button></div></div>');
        window.nativeKeys = [];
        document.addEventListener('keydown', e => window.nativeKeys.push(e.key));
    });
    await page.locator('#second-card').focus();
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.locator('#one .play-button').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'second-card');
    assert.deepEqual(await page.evaluate(() => window.nativeKeys), []);
    await page.locator('#lower-card').focus();
    await page.keyboard.press('ArrowUp');
    assert.deepEqual(await page.evaluate(() => window.nativeKeys), ['ArrowUp']);
    await page.evaluate(() => window.ElegantFinTv.dispose());
    await page.locator('#first-card').focus();
    await page.keyboard.press('ArrowUp');
    assert.deepEqual(await page.evaluate(() => window.nativeKeys), ['ArrowUp','ArrowUp']);
    await context.close();
});

test('native header paint containment and TV focus zoom cannot clip the revised effects', async () => {
    const {page, context} = await open();
    await page.addStyleTag({content: `
        .skinHeader{contain:layout style paint;height:130px}
        .headerTop{height:65px;overflow:hidden}.headerTabs{height:65px;overflow:hidden}
        .paper-icon-button-light{width:60px;height:60px;border-radius:50%}
        .paper-icon-button-light.show-focus:focus{transform:scale(1.3)}
        .emby-tab-button.show-focus:focus{transform:scale(1.3)!important;background:transparent!important}
        .emby-tab-button{height:60px}
        .clip-row{overflow:hidden;width:200px}.cardScalable{height:150px;width:200px;background:white}
    `});
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<header class="skinHeader"><div class="headerTop"><button class="paper-icon-button-light show-focus">Back</button></div><div class="headerTabs"><button class="emby-tab-button show-focus emby-tab-button-active">Movies</button></div></header><div class="clip-row"><div class="card show-focus" tabindex="0"><div class="cardScalable">Poster</div></div></div>'));
    assert.equal(await page.locator('.skinHeader').evaluate(el => getComputedStyle(el).contain), 'layout style');
    assert.equal(await page.locator('.skinHeader').evaluate(el => getComputedStyle(el,'::before').bottom), '0px');
    for (const name of ['.paper-icon-button-light','.emby-tab-button']) {
        await page.locator(name).focus();
        assert.equal(await page.locator(name).evaluate(el => getComputedStyle(el).transform), 'none');
        assert.equal(await page.locator(name).evaluate(el => getComputedStyle(el).outlineOffset), '-3px');
    }
    await page.locator('.clip-row .card').focus();
    assert.equal(await page.locator('.clip-row .cardScalable').evaluate(el => getComputedStyle(el, '::after').left), '0px');
    await context.close();
});

test('50vh TV hero keeps three plot lines and bottom actions within every layout', async () => {
    for (const [width,height,fontSize] of [[1920,1080,32],[1280,720,24]]) {
        const {page, context} = await open({viewport:{width,height}});
        await page.evaluate(fontSize => {
            document.querySelector('head style').remove();
            document.documentElement.style.fontSize=fontSize+'px';
            document.documentElement.style.setProperty('--slideshow-tv-height','50vh');
            document.querySelector('#two').remove();
            document.querySelector('#one').innerHTML='<div class="slide-content"><div class="logo-container"><img class="logo" alt="Title"></div><div class="info-container">2026 · 2h 10min</div><div class="genre">Drama · Adventure</div><div class="plot-container"><div class="plot">'+('A long film summary with enough words to fill more than three lines. ').repeat(20)+'</div></div><div class="button-container"><button class="play-button">Play</button><button class="detail-button">Info</button><button class="favorite-button">Favorite</button></div></div>';
            document.querySelector('.logo').src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect width="400" height="100" fill="white"/></svg>');
            document.querySelector('#slides-container').insertAdjacentHTML('beforeend','<div class="dots-container">● ● ●</div>');
        },fontSize);
        await page.addStyleTag({content:`body{margin:0}#slides-container{position:absolute}.slide{position:absolute;inset:0}
            .slide-content{position:absolute;display:flex;flex-direction:column;align-items:flex-start}
            .logo-container{display:flex;flex:0 1 auto;width:100%;min-height:0}.logo{height:100%;max-width:100%}
            .info-container,.genre,.button-container{flex:0 0 auto}.button-container{display:flex}
            #slides-container.layout-marquee .plot-container{flex:0 1 auto;overflow:hidden}
            #slides-container.layout-marquee .plot{-webkit-line-clamp:2}
            .dots-container{position:absolute}
        `});
        for (const layout of ['','layout-plate','layout-marquee']) {
            await page.locator('#slides-container').evaluate((el,layout)=>el.className=layout,layout);
            const stage = await page.locator('#slides-container').boundingBox();
            const plot = await page.locator('.plot').boundingBox();
            const lineHeight = await page.locator('.plot').evaluate(el=>parseFloat(getComputedStyle(el).lineHeight));
            assert.ok(Math.abs(plot.height - lineHeight*3) < 1, 'three full lines');
            const buttons = await page.locator('.button-container').boundingBox();
            const dots = await page.locator('.dots-container').boundingBox();
            assert.ok(plot.y>=stage.y && plot.y+plot.height<=buttons.y);
            assert.ok(buttons.y+buttons.height<=stage.y+stage.height);
            assert.ok(dots.y+dots.height<plot.y);
        }
        await context.close();
    }
});

test('TV zoom uses only transform and honours reduced motion', async () => {
    const {page,context}=await open();
    await page.addStyleTag({content:'.backdrop.animate{animation:frostedGlass 1.2s,kenBurnsZoomIn 12s;filter:blur(8px)}'});
    await page.locator('#one').evaluate(el=>el.insertAdjacentHTML('afterbegin','<div class="backdrop animate"></div>'));
    const backdrop=page.locator('#one .backdrop');
    assert.equal(await backdrop.evaluate(el=>getComputedStyle(el).animationName),'eftv-backdrop-zoom');
    assert.equal(await backdrop.evaluate(el=>getComputedStyle(el).animationTimingFunction),'linear');
    assert.equal(await backdrop.evaluate(el=>getComputedStyle(el).filter),'none');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await backdrop.evaluate(el=>getComputedStyle(el).animationName),'none');
    await context.close();
});

test('library links remain on one line with native right actions and redundant home/back controls', async () => {
    const {page,context}=await open({viewport:{width:1920,height:1080}});
    await page.addStyleTag({content:`html{font-size:32px}.headerTop{padding:.8em;display:flex}
        .headerLeft,.headerRight{display:flex}.headerButton{flex-shrink:0}
        .paper-icon-button-light{padding:.556em;margin:0 .29em;border-radius:50%;display:inline-flex;align-items:center;justify-content:center}
        .paper-icon-button-light>.material-icons{font-size:1.669em}.paper-icon-button-light>div{transform:scale(1.8)}
        .emby-button{margin:.3em}.hide{display:none!important}
        .material-icons{display:inline-block;width:1em;overflow:hidden;font-size:1.36em;white-space:nowrap}
    `});
    await page.evaluate(()=>{
        location.hash='#/home';
        document.body.insertAdjacentHTML('afterbegin','<header class="skinHeader"><div class="headerTop"><div class="headerLeft"><button class="headerButton paper-icon-button-light headerBackButton hide">Back</button><button class="headerButton paper-icon-button-light headerHomeButton hide">Home</button></div><div class="headerRight">'+['Sync','Audio','Cast','Search','User'].map(name=>'<button class="headerButton paper-icon-button-light header'+name+'Button"><span class="material-icons">●</span></button>').join('')+'</div></div></header><div class="mainDrawer" hidden><div class="libraryMenuOptions">'+['Anime','Filme','Live TV','Sammlungen','Serien'].map((name,i)=>'<a class="navMenuOption" href="#/library?id='+i+'"><span class="navMenuOptionText">'+name+'</span></a>').join('')+'</div></div>');
    });
    await page.waitForSelector('.eftv-library-nav');
    for (const hash of ['#/home','#/movies']) {
        await page.evaluate(hash=>{
            location.hash=hash;
            document.querySelectorAll('.headerHomeButton,.headerBackButton').forEach(el=>el.classList.toggle('hide',hash==='#/home'));
        },hash);
        const links=await page.locator('.eftv-library-nav a').all();
        const first=await links[0].boundingBox();
        for (const link of links) assert.ok(Math.abs((await link.boundingBox()).y-first.y)<1,'all library links on first line');
        assert.equal(await page.locator('.headerHomeButton').isVisible(),false);
        assert.equal(await page.locator('.headerBackButton').isVisible(),false);
        assert.equal(await page.locator('.headerSearchButton').isVisible(),true);
        assert.equal(await page.locator('.headerUserButton').isVisible(),true);
    }
    await page.locator('.headerUserButton').evaluate(el=>el.innerHTML='<div class="headerUserButtonRound paper-icon-button-light"></div>');
    assert.equal(await page.locator('.headerUserButtonRound').evaluate(el=>getComputedStyle(el).transform),'none');
    await page.evaluate(()=>window.ElegantFinTv.dispose());
    assert.equal(await page.locator('.headerHomeButton').isVisible(),true);
    assert.equal(await page.locator('.headerBackButton').isVisible(),true);
    await context.close();
});

test('personal theme preference persists per account and remains reachable while disabled', async () => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
        window.testUser = 'one';
        window.ApiClient = {
            getCurrentUserId: () => window.testUser,
            serverAddress: () => 'https://example.test',
            getDisplayPreferences: async (id,user,client) => {
                if (client !== 'ElegantFinTv') throw Error('Wrong namespace');
                return JSON.parse(localStorage.getItem('test-prefs-'+user) || '{"CustomPrefs":{"unrelated":"keep"}}');
            },
            updateDisplayPreferences: async (id,data,user) => {
                if (window.failSave) throw Error('Network unavailable');
                localStorage.setItem('test-prefs-'+user, JSON.stringify(data));
            }
        };
    });
    const page=await context.newPage();
    const showSettings=async () => {
        await page.evaluate(() => document.body.insertAdjacentHTML('beforeend','<form><div class="selectContainer"><select id="selectTheme"><option>Dark</option></select></div></form>'));
        await page.waitForFunction(()=>document.querySelector('#eftv-personal-enabled')?.disabled === false);
    };
    await page.goto(base+'/web/index.html');
    await showSettings();
    await page.locator('#eftv-personal-enabled').uncheck();
    await page.waitForFunction(()=>!window.ElegantFinTv.status().active);
    assert.equal(await page.locator('[data-eftv]').count(),0);
    assert.equal(await page.locator('[data-eftv-adapted]').count(),0);
    assert.equal(await page.locator('#eftv-personal-enabled').isEnabled(),true);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('test-prefs-one')).CustomPrefs.unrelated),'keep');
    await page.reload();
    await showSettings();
    assert.equal(await page.locator('#eftv-personal-enabled').isChecked(),false);
    assert.equal(await page.evaluate(()=>window.ElegantFinTv.status().active),false);
    await page.evaluate(()=>{window.testUser='two';window.dispatchEvent(new Event('hashchange'));});
    await page.waitForFunction(()=>window.ElegantFinTv.status().active && !document.querySelector('#eftv-personal-enabled').disabled);
    assert.equal(await page.locator('#eftv-personal-enabled').isChecked(),true);
    await page.evaluate(()=>window.failSave=true);
    await page.locator('#eftv-personal-enabled').click();
    await page.waitForFunction(()=>document.querySelector('#eftv-personal-setting [role=status]').textContent.includes('fehlgeschlagen'));
    assert.equal(await page.locator('#eftv-personal-enabled').isChecked(),true);
    assert.equal(await page.evaluate(()=>window.ElegantFinTv.status().active),true);
    await page.evaluate(()=>{window.failSave=false;window.testUser='one';window.dispatchEvent(new Event('hashchange'));});
    await page.waitForFunction(()=>!window.ElegantFinTv.status().active && !document.querySelector('#eftv-personal-enabled').disabled);
    await page.locator('#eftv-personal-enabled').check();
    await page.waitForFunction(()=>window.ElegantFinTv.status().active);
    assert.equal(await page.locator('#eftv-personal-setting').count(),1);
    await page.evaluate(()=>window.ElegantFinTv.dispose());
    assert.equal(await page.locator('#eftv-personal-setting').count(),0);
    await context.close();
});

test('administrator settings expose the theme switch without retired debug options', async () => {
    const settings=await readFile(new URL('src/Jellyfin.Plugin.ElegantFinTv/Web/settings.html',root),'utf8');
    const page=await browser.newPage();
    await page.addInitScript(()=>window.ApiClient={
        getPluginConfiguration:async()=>({Enabled:true,MediaBar:true,ApplyToAllClients:false}),
        updatePluginConfiguration:async(id,config)=>window.savedConfig=config
    });
    await page.route('**/settings-test',route=>route.fulfill({contentType:'text/html',body:settings}));
    await page.goto(base+'/settings-test');
    await page.locator('#ElegantFinTvSettingsPage').evaluate(el=>el.dispatchEvent(new Event('viewshow')));
    await page.waitForFunction(()=>document.getElementById('eftvEnabled').checked);
    assert.equal(await page.locator('select,#eftvDiagnostics').count(),0);
    await page.locator('#eftvEnabled').uncheck();
    await page.locator('button[type=submit]').click();
    await page.waitForFunction(()=>window.savedConfig?.Enabled===false);
    assert.equal(await page.evaluate(()=>window.savedConfig.MediaBar),true);
    await page.close();
});

test('late preference responses cannot change another account and read errors cannot be saved', async () => {
    const {page,context}=await open();
    await page.evaluate(()=>{
        window.testUser='one';
        window.ApiClient={
            getCurrentUserId:()=>window.testUser,
            serverAddress:()=>'/server',
            getDisplayPreferences:(id,user)=>user==='one' ? new Promise(resolve=>window.finishOldRead=resolve) : user==='two' ? Promise.resolve({CustomPrefs:{Enabled:'true'}}) : Promise.reject(Error('offline')),
            updateDisplayPreferences:()=>{throw Error('must not write after read failure');}
        };
        document.body.insertAdjacentHTML('beforeend','<form><div class="selectContainer"><select id="selectTheme"></select></div></form>');
    });
    await page.waitForFunction(()=>window.finishOldRead);
    await page.evaluate(()=>{window.testUser='two';window.dispatchEvent(new Event('hashchange'));});
    await page.waitForFunction(()=>document.querySelector('#eftv-personal-enabled')?.disabled===false);
    await page.evaluate(()=>window.finishOldRead({CustomPrefs:{Enabled:'false'}}));
    assert.equal(await page.locator('#eftv-personal-enabled').isChecked(),true);
    assert.equal(await page.evaluate(()=>window.ElegantFinTv.status().active),true);
    await page.evaluate(()=>{window.testUser='three';window.dispatchEvent(new Event('hashchange'));});
    await page.waitForFunction(()=>document.querySelector('#eftv-personal-setting [role=status]').textContent.includes('nicht geladen'));
    assert.equal(await page.locator('#eftv-personal-enabled').isDisabled(),true);
    await context.close();
});
