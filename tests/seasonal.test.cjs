const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const script = fs.readFileSync(path.join(__dirname, '../desktop/ElegantFin-seasonal.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../desktop/ElegantFin-seasonal.css'), 'utf8');

test('mobile creates no effects, fetches no effect CSS or item metadata, and layout switching is reversible', async () => {
    const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    const browser = await chromium.launch({headless:true, ...(fs.existsSync(edge) ? {executablePath:edge} : {})});
    try {
        const page = await browser.newPage({viewport:{width:390,height:844}});
        await page.clock.install({time:new Date(2026,9,20,12)});
        const cssRequests = [];
        await page.route('https://theme.test/**', route => {
            const isCss = route.request().url().endsWith('.css');
            if (isCss) cssRequests.push(route.request().url());
            return route.fulfill({contentType:isCss ? 'text/css' : 'text/javascript',body:isCss ? css : script});
        });
        await page.setContent('<html class="layout-mobile"><body><div id="itemDetailPage">Movie</div></body></html>');
        await page.evaluate(() => {
            location.hash = '/details?id=horror';
            window.calls = 0;
            window.ApiClient = {getCurrentUserId:()=>'user', getItem:async()=> { window.calls++; return {Type:'Movie', Genres:['Horror']}; }};
        });
        await page.addScriptTag({url:'https://theme.test/ElegantFin-seasonal.js'});
        await page.clock.runFor(1000);
        assert.equal(await page.locator('.ef-seasonal').count(),0);
        assert.equal(await page.evaluate(()=>window.calls),0);
        assert.equal(cssRequests.length,0);
        await page.evaluate(() => { location.hash = '/home'; });
        await page.clock.runFor(1000);
        assert.equal(await page.locator('.ef-seasonal').count(),0);
        assert.equal(cssRequests.length,0);
        await page.evaluate(() => { document.documentElement.className = 'layout-desktop'; });
        await page.clock.runFor(1000);
        await page.waitForSelector('.ef-seasonal', {state:'visible'});
        assert.equal(cssRequests.length,1);
        await page.evaluate(() => { document.documentElement.className = 'layout-mobile'; });
        assert.equal(await page.locator('.ef-seasonal').isVisible(),false,'CSS immediately hides existing particles before the next tick');
        await page.clock.runFor(1000);
        assert.equal(await page.locator('.ef-seasonal').count(),0);
        await page.evaluate(() => window.ElegantFinSeasonal.destroy());
    } finally { await browser.close(); }
});

test('home particles end below Media Bar and My Media and follow scroll, resize and replacement', async () => {
    const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    const browser = await chromium.launch({headless:true, ...(fs.existsSync(edge) ? {executablePath:edge} : {})});
    try {
        const page = await browser.newPage({viewport:{width:1280,height:800}});
        await page.clock.install({time:new Date(2026,9,20,12)});
        await page.setContent('<html class="layout-desktop"><body style="margin:0"><main style="height:600px;overflow:auto"><div style="height:2000px"><div id="slides-container" style="height:240px"></div><div class="homeSectionsContainer"><section class="verticalSection"><div class="homeLibraryButtonContainer" style="height:140px">My Media</div></section></div></div></main></body></html>');
        await page.addStyleTag({content:css});
        await page.evaluate(() => { location.hash = '/home'; });
        await page.addScriptTag({content:script});
        const height = () => page.locator('.ef-seasonal').evaluate(el => el.getBoundingClientRect().height);
        assert.equal(await height(),380);
        await page.evaluate(() => { document.querySelector('.homeLibraryButtonContainer').style.height = '240px'; });
        await page.clock.runFor(1000);
        assert.equal(await height(),480);
        await page.evaluate(() => { document.querySelector('main').scrollTop = 500; });
        await page.clock.runFor(1000);
        assert.equal(await height(),0);
        assert.equal(await page.locator('.ef-seasonal').evaluate(el => getComputedStyle(el).visibility),'hidden');
        await page.evaluate(() => { document.querySelector('main').scrollTop = 0; document.querySelector('.homeLibraryButtonContainer').outerHTML = '<div class="itemsContainer" style="height:100px"><div data-type="UserView">Library tile</div></div>'; });
        await page.clock.runFor(1000);
        assert.equal(await height(),340);
        await page.setViewportSize({width:800,height:300});
        await page.clock.runFor(1000);
        assert.equal(await height(),300);
        await page.evaluate(() => window.ElegantFinSeasonal.destroy());
        assert.equal(await page.locator('.ef-seasonal').count(),0);
    } finally { await browser.close(); }
});

test('seasonal dates, metadata, navigation, accessibility and stale requests', async () => {
    const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
    const browser = await chromium.launch({ headless: true,
        ...(fs.existsSync(edge) ? { executablePath: edge } : {}) });
    try {
        const page = await browser.newPage();
        await page.clock.install({ time: new Date(2026, 11, 1, 12) });
        await page.setContent('<html class="layout-desktop"><body><div id="itemDetailPage">Movie <button>Play</button></div></body></html>');
        await page.addStyleTag({ content: css });
        await page.evaluate(() => {
            location.hash = '/details?id=christmas';
            window.calls = 0;
            window.ApiClient = {
                getCurrentUserId: () => 'user',
                serverAddress: () => 'server',
                getItem: async (user, id) => {
                    window.calls++;
                    if (id === 'slow') return new Promise(resolve => { window.resolveSlow = resolve; });
                    return { Type: 'Movie', Tags: [id], Genres: [] };
                }
            };
        });
        await page.addScriptTag({ content: script });
        await page.waitForSelector('.ef-seasonal');
        assert.equal(await page.locator('.ef-seasonal-particle').count(), 26);
        assert.equal(await page.locator('.ef-seasonal').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
        const results = await page.evaluate(() => {
            const check = window.ElegantFinSeasonal.seasonFor;
            const movie = { Type: 'Movie', Tags: ['Weihnachten', 'Halloween'] };
            return [[10, 14], [10, 15], [10, 31], [11, 1], [11, 2], [11, 30], [12, 1], [12, 31], [1, 1]]
                .map(([month, day]) => check(new Date(2026, month - 1, day, 23, 59), movie))
                .concat([
                    check(new Date(2027, 11, 15), { Type: 'Movie', Genres: ['Christmas'] }),
                    check(new Date(2026, 9, 15), { Type: 'Movie', Genres: ['Horror'] }),
                    check(new Date(2026, 11, 15), { Type: 'Episode', Tags: ['Christmas'] }),
                    check(new Date(2026, 11, 15), { Type: 'Movie', Name: 'Christmas' })
                ]);
        });
        assert.deepEqual(results, ['', 'halloween', 'halloween', 'halloween', '', '', 'christmas', 'christmas', '', 'christmas', 'halloween', '', '']);
        await page.clock.runFor(3000);
        assert.equal(await page.evaluate(() => window.calls), 1);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.clock.runFor(1000);
        assert.equal(await page.locator('.ef-seasonal').count(), 0);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.clock.runFor(1000);
        await page.evaluate(() => document.documentElement.classList.add('layout-tv'));
        await page.clock.runFor(1000);
        assert.equal(await page.locator('.ef-seasonal').count(), 0);
        await page.evaluate(() => document.documentElement.classList.remove('layout-tv'));
        await page.clock.runFor(1000);
        await page.evaluate(() => document.body.append(document.createElement('video')));
        await page.clock.runFor(1000);
        assert.equal(await page.locator('.ef-seasonal').count(), 0);
        await page.evaluate(() => document.querySelector('video').remove());
        await page.clock.runFor(1000);
        assert.equal(await page.locator('.ef-seasonal').count(), 1);
        await page.clock.setSystemTime(new Date(2027, 0, 1));
        await page.clock.runFor(1000);
        assert.equal(await page.locator('.ef-seasonal').count(), 0);
        await page.clock.setSystemTime(new Date(2027, 9, 15));
        await page.evaluate(() => { location.hash = '/details?id=horror'; });
        await page.clock.runFor(1000);
        await page.waitForSelector('.ef-seasonal[data-season="halloween"]');
        await page.evaluate(() => { location.hash = '/details?id=slow'; });
        await page.clock.runFor(1000);
        await page.evaluate(() => { location.hash = '/home'; });
        await page.clock.runFor(1000);
        await page.evaluate(() => window.resolveSlow({ Type: 'Movie', Tags: ['Horror'] }));
        assert.equal(await page.locator('.ef-seasonal[data-season="halloween"]').count(), 1);
        const callsBeforeHome = await page.evaluate(() => window.calls);
        // Home needs no detail-page DOM or metadata, including after a stale response.
        await page.evaluate(() => document.querySelector('#itemDetailPage').remove());
        await page.clock.setSystemTime(new Date(2027, 11, 1));
        await page.clock.runFor(1000);
        assert.equal(await page.locator('.ef-seasonal[data-season="christmas"]').count(), 1);
        await page.evaluate(() => { location.hash = '/home.html?tab=0'; });
        await page.clock.runFor(1000);
        assert.equal(await page.locator('.ef-seasonal[data-season="christmas"]').count(), 1);
        assert.equal(await page.evaluate(() => window.calls), callsBeforeHome);
        await page.evaluate(() => {
            window.ApiClient = undefined;
            document.body.insertAdjacentHTML('beforeend', '<div id="slides-container"><video></video></div><div class="videoPlayerContainer hide" hidden></div>');
        });
        await page.clock.runFor(1000);
        assert.equal(await page.locator('.ef-seasonal').count(), 1, 'preview and hidden player must not suppress home effects');
        assert.equal(await page.locator('.ef-seasonal').evaluate(el => getComputedStyle(el).display), 'block');
        await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<div class="jp-overlay">Jelly+ dialog</div>'));
        await page.clock.runFor(1000);
        assert.equal(await page.locator('.ef-seasonal').count(), 0);
        await page.evaluate(() => document.querySelector('.jp-overlay').remove());
        await page.clock.runFor(1000);
        assert.equal(await page.locator('.ef-seasonal').count(), 1);
        await page.clock.setSystemTime(new Date(2028, 0, 1));
        await page.clock.runFor(1000);
        assert.equal(await page.locator('.ef-seasonal').count(), 0);
        await page.clock.setSystemTime(new Date(2028, 9, 15));
        await page.clock.runFor(1000);
        assert.equal(await page.locator('.ef-seasonal[data-season="halloween"]').count(), 1);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.clock.runFor(1000);
        assert.equal(await page.locator('.ef-seasonal').count(), 0);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.evaluate(() => { location.hash = '/movies'; });
        await page.clock.runFor(1000);
        assert.equal(await page.locator('.ef-seasonal').count(), 0);
        await page.evaluate(() => window.ElegantFinSeasonal.destroy());
        const external = await browser.newPage();
        await external.clock.install({ time: new Date(2026, 9, 20, 12) });
        await external.route('https://theme.test/**', route => {
            const isCss = route.request().url().endsWith('.css');
            return route.fulfill({ contentType: isCss ? 'text/css' : 'text/javascript', body: isCss ? css : script });
        });
        await external.setContent('<html class="layout-desktop"><body>Home</body></html>');
        await external.evaluate(() => { location.hash = '/home'; });
        await external.addScriptTag({url: 'https://theme.test/ElegantFin-seasonal.js'});
        await external.waitForSelector('.ef-seasonal', {state: 'visible'});
        assert.equal(await external.locator('link[data-ef-seasonal-css]').getAttribute('href'), 'https://theme.test/ElegantFin-seasonal.css');
        await external.addStyleTag({content: fs.readFileSync(path.join(__dirname, '../desktop/jellyplus-support.css'), 'utf8')});
        // Jelly+ injects its own styles late; integration must still win.
        await external.addStyleTag({content: '.jp-poster:focus{outline:3px solid blue;outline-offset:3px}'});
        await external.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<a href="#" class="jp-poster">Movie</a>'));
        await external.locator('.jp-poster').focus();
        assert.equal(await external.locator('.jp-poster').evaluate(el => getComputedStyle(el).outlineOffset), '-3px');
        await external.close();
    } finally {
        await browser.close();
    }
});
