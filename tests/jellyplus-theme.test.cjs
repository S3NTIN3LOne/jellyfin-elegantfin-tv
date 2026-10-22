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

test('mobile hides Media Bar and legacy effects without reserving header space', async () => {
    const browser = await launch();
    try {
        const page = await browser.newPage({viewport:{width:390,height:844}});
        await page.route('https://**',route=>route.abort());
        for (const v3 of [false,true]) {
            await page.setContent(`<html class="layout-mobile"><body class="media-bar-mobile-16-9"><div class="MuiAppBar-root"></div><div id="slides-container"><div class="${v3 ? 'slide-content' : 'slide'}">Media Bar</div></div><div class="homePage"><div class="homeSectionsContainer">My Media</div></div><div class="ef-seasonal" style="display:block">Old particles</div></body></html>`);
            for (const content of sheets) await page.addStyleTag({content});
            // A plugin can add high-specificity, important offsets after the theme.
            await page.addStyleTag({content:'#slides-container{display:block;height:65vh} :root:has(#slides-container) .homePage .homeSectionsContainer{position:relative!important;top:70vh!important;margin-top:65vh!important;padding-top:2rem!important}'});
            assert.equal(await page.locator('#slides-container').isVisible(),false);
            assert.equal(await page.locator('.ef-seasonal').isVisible(),false);
            assert.deepEqual(await page.locator('.homeSectionsContainer').evaluate(el=>{
                const style=getComputedStyle(el);
                return {position:style.position,top:style.top,margin:style.marginTop,padding:style.paddingTop};
            }),{position:'static',top:'auto',margin:'0px',padding:'0px'});
            await page.evaluate(()=>{document.documentElement.className='layout-desktop';});
            assert.equal(await page.locator('#slides-container').isVisible(),true,'desktop remains supported');
            assert.notEqual(await page.locator('.homeSectionsContainer').evaluate(el=>getComputedStyle(el).position),'static');
        }
    } finally { await browser.close(); }
});

test('profile image actions have no sticky shadow and stay below the name', async () => {
    const browser = await launch();
    try {
        const page = await browser.newPage();
        await page.route('https://**',route=>route.abort());
        for (const width of [390,1280]) {
            await page.setViewportSize({width,height:844});
            await page.setContent(`<html class="${width<600 ? 'layout-mobile' : 'layout-desktop'}"><body><div id="userProfilePage" class="userPreferencesPage userPasswordPage"><div class="readOnlyContent" style="display:flex;flex-direction:row;align-items:center;margin:0 auto 1.8em;padding:0 1em"><div class="imagePlaceHolder" style="position:relative;display:inline-block;max-width:200px"><div id="image" style="width:200px;height:200px"></div></div><div style="display:flex;flex-direction:column;align-items:center;margin:1em 2em"><h2 class="username" style="margin:0">My Profile</h2><br><button type="button" id="btnAddImage" class="raised button-submit">Bild hinzufügen</button><button type="button" id="btnDeleteImage" class="raised hide">Bild löschen</button></div></div></div></body></html>`);
            await page.addStyleTag({content:'.hide{display:none!important}'});
            for (const content of sheets) await page.addStyleTag({content});
            await page.waitForTimeout(200);
            const style = await page.locator('#btnAddImage').evaluate(el=>{
                const computed=getComputedStyle(el);
                return {position:computed.position,shadow:computed.boxShadow,zIndex:computed.zIndex,
                    top:el.getBoundingClientRect().top,nameBottom:document.querySelector('.username').getBoundingClientRect().bottom};
            });
            assert.equal(style.position,'static');
            assert.equal(style.shadow,'none');
            assert.equal(style.zIndex,'auto');
            assert.ok(style.top>=style.nameBottom);
            assert.equal(await page.locator('#btnDeleteImage').isVisible(),false);
            await page.evaluate(()=>{
                document.querySelector('#btnAddImage').addEventListener('click',()=>{window.clicked=true;});
            });
            await page.locator('#btnAddImage').click();
            assert.equal(await page.evaluate(()=>window.clicked),true);
        }
    } finally { await browser.close(); }
});

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
                : '<div id="languagePreferencesPage"><div class="settingsContainer"><form></form></div></div><div data-id="abc" data-type="Movie"><button class="btnMoreCommands">Menu</button></div><div class="actionSheetContent"><button class="actionSheetMenuItem">Play</button></div>'}</body></html>`);
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
                assert.equal(await page.locator('.jp-menu button').count(),2);
            }
            await page.close();
        }
    } finally { await browser.close(); }
});

test('profile hides reset while keeping save and admin reset available; libraries keep native order', async () => {
    const browser = await launch();
    try {
        const page = await browser.newPage({viewport:{width:1280,height:800}});
        await page.route('https://**', route => route.abort());
        await page.setContent('<html class="layout-desktop"><body><div id="userProfilePage" class="userPreferencesPage"><form class="updatePasswordForm"><div class="detailSection"><div><button type="submit" class="emby-button raised button-submit block">Passwort speichern</button><button type="button" id="btnResetPassword" class="emby-button raised button-cancel block">Passwort zurücksetzen</button></div></div></form></div><div class="homeSectionsContainer"><section class="verticalSection"><div class="itemsContainer homeLibraryButtonContainer" style="display:flex"><a class="homeLibraryButton" href="#movies">Filme</a><a class="homeLibraryButton" href="#tv">Serien</a><a class="homeLibraryButton" href="#music">Musik</a></div></section></div></body></html>');
        await page.addStyleTag({content:'.homeLibraryButton:nth-child(2){order:-1}.hide{display:none!important}'});
        for (const content of sheets) await page.addStyleTag({content});
        await page.waitForTimeout(300); // Let the base theme's shadow transition finish.
        const result = await page.evaluate(() => {
            const save = document.querySelector('.button-submit');
            const reset = document.querySelector('#btnResetPassword');
            return {position:getComputedStyle(save).position, shadow:getComputedStyle(save).boxShadow,
                order:[...document.querySelectorAll('.homeLibraryButton')].sort((a,b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map(el=>el.textContent)};
        });
        assert.equal(result.position,'static');
        assert.equal(result.shadow,'none');
        assert.equal(await page.locator('#btnResetPassword').isVisible(),false);
        assert.equal(await page.locator('.button-submit').isVisible(),true);
        assert.deepEqual(result.order,['Filme','Serien','Musik']);
        await page.evaluate(() => {
            document.querySelector('.homeLibraryButtonContainer').classList.remove('homeLibraryButtonContainer');
            document.querySelectorAll('.homeLibraryButton').forEach((el,i) => {
                el.className = 'card backdropCard';
                el.dataset.type = 'UserView';
                el.style.order = String(2-i);
            });
        });
        assert.deepEqual(await page.locator('[data-type="UserView"]').evaluateAll(items => items
            .sort((a,b) => a.getBoundingClientRect().left-b.getBoundingClientRect().left).map(el=>el.textContent)),['Filme','Serien','Musik']);
        await page.evaluate(() => { document.querySelector('#userProfilePage').id = 'personalProfileVariant'; });
        assert.equal(await page.locator('#btnResetPassword').isVisible(),false,'personal preference class is sufficient without the original page ID');
        await page.evaluate(() => { document.querySelector('#personalProfileVariant').className = 'userPasswordPage'; });
        assert.equal(await page.locator('#btnResetPassword').isVisible(),false,'personal password-page variant is supported');
        await page.evaluate(() => {
            const profile = document.querySelector('#personalProfileVariant');
            profile.id = 'adminUserPage'; profile.className = 'dashboardPage';
        });
        assert.equal(await page.locator('#btnResetPassword').isVisible(),true,'admin reset stays available');
    } finally { await browser.close(); }
});

test('native selection-sheet cancellation follows choices without covering title or text in desktop, mobile and TV', async () => {
    const browser = await launch();
    try {
        const page = await browser.newPage();
        await page.route('https://**', route => route.abort());
        // Native actionSheet.ts places the text cancel button inside .buttons
        // at the end of .actionSheetScroller, and a separate back icon on TVs.
        // Native SCSS positions both with .btnCloseActionSheet {position:fixed}.
        const nativeCss = `
            body { margin:0; background:#080b10; color:#d1d5db; font:16px/1.5 sans-serif; }
            .actionSheet { position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:35em;max-width:90vw;max-height:90vh;display:flex;padding:0; }
            .actionSheetContent { margin:0!important;padding:.4em 0!important;flex-direction:column;display:flex;flex-grow:1;overflow:hidden; }
            .actionSheetContent-centered { text-align:center;align-items:center; }
            .actionSheetScroller { display:flex;flex-direction:column;width:100%;overflow-y:auto;min-height:0; }
            .actionSheetTitle { margin:.6em 0 .7em!important;padding:0 .75rem;flex-grow:0; }
            .actionSheetText { margin-top:0;padding:0 .75rem;flex-grow:0; }
            .actionSheetMenuItem { flex-shrink:0;margin:0;display:flex; }
            .btnCloseActionSheet { position:fixed;top:.75em;left:.5em; }
            button { color:inherit;background:#292933;border:0;padding:.75em;font:inherit; }
            .actionSheetItemText { white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        `;
        const modes = [
            {name:'desktop', root:'class="layout-desktop"', sheets},
            {name:'mobile', root:'class="layout-mobile"', sheets},
            {name:'TV minimal', root:'class="layout-tv" data-eftv', sheets:[read('src/Jellyfin.Plugin.ElegantFinTv/Web/tv.css')]},
            {name:'TV full', root:'class="layout-tv" data-eftv', sheets:[read('src/Jellyfin.Plugin.ElegantFinTv/Web/tv-full.css')]}
        ];
        for (const mode of modes) for (const width of [390,692]) for (const title of ['Watch Together','Ausgeblendete Medien']) {
            await page.setViewportSize({width,height:400});
            await page.setContent(`<html dir="ltr" ${mode.root}><body><div class="dialog actionSheet actionsheet-not-fullscreen" role="dialog"><button is="paper-icon-button-light" class="btnCloseActionSheet tv-back">Back</button><div class="actionSheetContent actionSheetContent-centered"><h1 class="actionSheetTitle">${title}</h1><p class="actionSheetText">${title === 'Watch Together' ? 'Profil auswählen. Beide Profile müssen die Funktion aktiviert haben.' : 'Serie oder Film wieder auf der Startseite zulassen.'}</p><div class="actionSheetScroller scrollY"><button class="listItem listItem-button actionSheetMenuItem"><div class="listItemBody actionsheetListItemBody"><div class="actionSheetItemText">Admin / Naruto</div></div></button><button class="listItem listItem-button actionSheetMenuItem"><div class="listItemBody actionsheetListItemBody"><div class="actionSheetItemText">Dr. House</div></div></button><div class="buttons"><button is="emby-button" type="button" class="btnCloseActionSheet">Abbrechen</button></div></div></div></div></body></html>`);
            await page.addStyleTag({content:nativeCss});
            for (const content of mode.sheets) await page.addStyleTag({content});
            // Small viewports can scroll the native list; focusing cancel must reveal it.
            await page.locator('.buttons .btnCloseActionSheet').focus();
            const geometry = await page.evaluate(() => {
                const rect = selector => document.querySelector(selector).getBoundingClientRect();
                const cancel = rect('.buttons .btnCloseActionSheet');
                const item = document.querySelectorAll('.actionSheetMenuItem')[1].getBoundingClientRect();
                const dialog = rect('.actionSheet');
                return {cancelTop:cancel.top,cancelBottom:cancel.bottom,itemBottom:item.bottom,
                    titleBottom:rect('.actionSheetTitle').bottom,textBottom:rect('.actionSheetText').bottom,
                    dialogBottom:dialog.bottom,dialogLeft:dialog.left,dialogRight:dialog.right,
                    cancelPosition:getComputedStyle(document.querySelector('.buttons .btnCloseActionSheet')).position,
                    backPosition:getComputedStyle(document.querySelector('.tv-back')).position};
            });
            const detail = JSON.stringify({mode:mode.name,width,title,...geometry});
            assert.equal(geometry.cancelPosition,'static',detail);
            assert.equal(geometry.backPosition,'fixed',detail);
            assert.ok(geometry.cancelTop >= Math.max(geometry.titleBottom,geometry.textBottom,geometry.itemBottom),detail);
            assert.ok(geometry.cancelBottom <= geometry.dialogBottom + 1,detail);
            assert.ok(geometry.dialogLeft >= 0 && geometry.dialogRight <= width,detail);
            await page.evaluate(() => document.querySelector('.buttons .btnCloseActionSheet').addEventListener('click',() => document.querySelector('.actionSheet').remove()));
            await page.locator('.buttons .btnCloseActionSheet').focus();
            await page.keyboard.press('Enter');
            assert.equal(await page.locator('.actionSheet').count(),0);
        }
    } finally { await browser.close(); }
});
