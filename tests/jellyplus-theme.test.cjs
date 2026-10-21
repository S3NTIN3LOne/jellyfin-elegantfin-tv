const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const sheets = ['vendor/ElegantFin-jellyfin-theme-build-latest-minified.css', 'vendor/ElegantFin-jf12-modern-latest.css', 'desktop/jellyplus-support.css'].map(read);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const launch = () => chromium.launch({headless:true, ...(fs.existsSync(edge) ? {executablePath:edge} : {})});
const pluginPath = path.join(__dirname, '../../../jellyfin_jellyplus/src/Jellyplus/Web/client.js');
const pluginStyle = '.jp-posters{display:flex;gap:1em;overflow-x:auto;padding:.5em .3em 1.5em}.jp-poster{flex:0 0 10em;color:inherit;text-decoration:none}.jp-poster img{width:100%;height:15em;object-fit:cover;border-radius:.4em}.jp-poster span{display:block;margin-top:.5em}';

test('Jelly+ poster dimensions follow regular theme cards at desktop and mobile sizes', async () => {
    const browser = await launch();
    try {
        const page = await browser.newPage();
        await page.route('https://**', route => route.abort());
        for (const width of [1920, 1280, 600, 390]) {
            await page.setViewportSize({width,height:1080});
            const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#273244"/></svg>');
            const poster = `<a class="jp-poster" href="#/details?id=1"><img src="${image}" alt=""><span>A very long seasonal movie title that must not widen the page</span></a>`;
            await page.setContent(`<html class="${width < 800 ? 'layout-mobile' : 'layout-desktop'}"><body style="margin:0"><div class="padded-left padded-right"><h2 class="sectionTitle">Movies</h2><div class="itemsContainer"><div class="card overflowPortraitCard"><img style="width:100%;aspect-ratio:2/3" src="${image}"></div></div><section class="jp-season"><h2 class="sectionTitle">Seasonal recommendations</h2><div class="jp-posters">${poster.repeat(12)}</div></section></div></body></html>`);
            for (const content of sheets) await page.addStyleTag({content});
            // Jelly+ adds its styles after the theme; the integration must still win.
            await page.addStyleTag({content:pluginStyle});
            const dimensions = await page.evaluate(() => {
                const native = document.querySelector('.card');
                const seasonal = document.querySelector('.jp-poster');
                const row = document.querySelector('.jp-posters');
                const img = seasonal.querySelector('img').getBoundingClientRect();
                return {native:native.getBoundingClientRect().width, seasonal:seasonal.getBoundingClientRect().width,
                    ratio:img.width / img.height, scrollable:row.scrollWidth > row.clientWidth,
                    pageWidth:document.documentElement.scrollWidth, viewport:innerWidth};
            });
            assert.ok(Math.abs(dimensions.native - dimensions.seasonal) < 1, JSON.stringify({width,...dimensions}));
            assert.ok(Math.abs(dimensions.ratio - 2/3) < .01);
            assert.ok(dimensions.scrollable);
            assert.ok(dimensions.pageWidth <= dimensions.viewport);
        }
    } finally { await browser.close(); }
});

test('actual Jelly+ classic options remain visible with theme; modern options are absent even without CSS', {skip:!fs.existsSync(pluginPath)}, async () => {
    const browser = await launch();
    try {
        for (const modern of [false,true]) for (const themed of [false,true]) {
            const page = await browser.newPage();
            await page.route('https://**', route => route.abort());
            await page.setContent(`<html class="layout-desktop"><body>${modern
                ? '<div class="MuiAppBar-root"></div><main><h1>Playback</h1><div class="MuiFormGroup-root"></div></main><button class="MuiIconButton-root" data-testid="MoreVertIcon">Menu</button><ul class="MuiMenu-list" role="menu"><li role="menuitem">Play</li></ul>'
                : '<div id="languagePreferencesPage"><div class="settingsContainer"></div></div><div data-id="abc" data-type="Movie"><button class="btnMoreCommands">Menu</button></div><div class="actionSheetContent"><button class="actionSheetMenuItem">Play</button></div>'}</body></html>`);
            if (themed) for (const content of sheets) await page.addStyleTag({content});
            await page.evaluate(() => {
                window.ApiClient = {getCurrentUserId:()=>'user', getUrl:path=>path, accessToken:()=>'fixture'};
                window.fetch = async () => new Response(JSON.stringify({enabled:true, hidden:[], seasonalRecommendations:false}));
            });
            await page.addScriptTag({content:fs.readFileSync(pluginPath,'utf8')});
            if (modern) {
                await page.locator('button').click();
                await page.waitForTimeout(300);
                assert.equal(await page.locator('.jp-preferences, .jp-menu').count(),0);
            } else {
                await page.waitForSelector('.jp-preferences');
                await page.locator('.btnMoreCommands').click();
                await page.waitForSelector('.jp-watch');
                assert.equal(await page.locator('.jp-preferences').isVisible(),true);
                assert.equal(await page.locator('.jp-watch').isVisible(),true);
                assert.equal(await page.locator('.jp-menu .jp-button').count(),2);
            }
            await page.close();
        }
    } finally { await browser.close(); }
});
