/* ElegantFin seasonal effects. Load as a classic script after Jellyfin Web. */
(() => {
    'use strict';
    window.ElegantFinSeasonal?.destroy();

    const root = document.documentElement;
    // A normal script include also loads its companion stylesheet.
    const source = document.currentScript?.src;
    if (source && !document.querySelector('link[data-ef-seasonal-css]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = new URL('ElegantFin-seasonal.css', source).href;
        link.dataset.efSeasonalCss = '';
        document.head.append(link);
    }
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let overlay, currentKey = '', item = null, pending = false, generation = 0;
    let retryAfter = 0, stopped = false;
    let boundsFrame = 0;
    const boundsObserver = new ResizeObserver(scheduleBounds);
    let boundsTargets = [];

    function seasonFor(date, movie) {
        if (movie?.Type !== 'Movie') return '';
        const day = (date.getMonth() + 1) * 100 + date.getDate();
        const labels = [...(movie.Genres || []), ...(movie.Tags || [])].join(' ').toLowerCase();
        if (day >= 1201 && day <= 1231 && /christmas|weihnacht|xmas|x-mas|noël|noel|navidad/.test(labels)) return 'christmas';
        if (day >= 1015 && day <= 1101 && /halloween|horror/.test(labels)) return 'halloween';
        return '';
    }

    function clear() {
        overlay?.remove();
        overlay = null;
        boundsObserver.disconnect();
        boundsTargets = [];
    }

    function updateBounds() {
        boundsFrame = 0;
        if (!overlay) return;
        const home = /(?:^|\/)home(?:\.html)?\/?(?:\?|$)/i.test(location.hash.slice(1) || location.pathname + location.search);
        const targets = home ? [
            ...document.querySelectorAll('#slides-container'),
            ...document.querySelectorAll('.homeLibraryButtonContainer, .homeSectionsContainer .itemsContainer, #homeTab .itemsContainer')
        ].filter(element => visible(element) && (element.id === 'slides-container' ||
            element.matches('.homeLibraryButtonContainer') || element.querySelector('[data-type="UserView"], [data-type="CollectionFolder"]')))
            .map(element => element.id === 'slides-container' ? element : element.closest('.verticalSection') || element) : [];
        const unique = [...new Set(targets)];
        if (unique.length !== boundsTargets.length || unique.some((element, i) => element !== boundsTargets[i])) {
            boundsObserver.disconnect();
            unique.forEach(element => boundsObserver.observe(element));
            boundsTargets = unique;
        }
        const bottom = unique.length ? Math.max(...unique.map(element => element.getBoundingClientRect().bottom))
            : Math.min(innerHeight * .65, 650);
        const height = Math.max(0, Math.min(innerHeight, Math.ceil(bottom)));
        overlay.style.setProperty('--ef-seasonal-height', `${height}px`);
        // Older Jelly+ versions supply their own CSS and suppress the CSS loader.
        overlay.style.height = `${height}px`;
        overlay.style.visibility = height ? '' : 'hidden';
    }

    function scheduleBounds() {
        if (!stopped && overlay && !boundsFrame) boundsFrame = requestAnimationFrame(updateBounds);
    }

    function render(season) {
        if (!season) return clear();
        if (overlay?.dataset.season === season) return updateBounds();
        clear();
        overlay = document.createElement('div');
        overlay.className = 'ef-seasonal';
        overlay.dataset.season = season;
        overlay.setAttribute('aria-hidden', 'true');
        const count = root.classList.contains('layout-mobile') ? 14 : 26;
        for (let i = 0; i < count; i++) {
            const particle = document.createElement('span');
            particle.className = 'ef-seasonal-particle';
            particle.textContent = season === 'christmas' ? (i % 3 ? '❄' : '❅') : (i % 4 ? '🍂' : '🎃');
            particle.style.setProperty('--ef-x', `${(i * 37 + 3) % 100}%`);
            particle.style.setProperty('--ef-duration', `${14 + i % 9}s`);
            particle.style.setProperty('--ef-delay', `${-i * 1.7}s`);
            particle.style.setProperty('--ef-size', `${12 + i % 5 * 3}px`);
            overlay.append(particle);
        }
        document.body.append(overlay);
        updateBounds();
    }

    function routeId() {
        const route = location.hash.slice(1) || location.pathname + location.search;
        if (!/(?:^|\/)details(?:\.html)?(?:[/?]|$)/i.test(route)) return '';
        return new URLSearchParams(route.split('?')[1] || '').get('id') || '';
    }

    function visible(element) {
        return element && !element.closest('.hide, [hidden], [aria-hidden="true"]') &&
            element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
    }

    async function update() {
        if (stopped) return;
        const id = routeId();
        const route = location.hash.slice(1) || location.pathname + location.search;
        const home = /(?:^|\/)home(?:\.html)?\/?(?:\?|$)/i.test(route);
        const client = window.ApiClient;
        const user = client?.getCurrentUserId?.();
        const key = `${client?.serverAddress?.() || ''}|${user || ''}|${id}`;
        if (key !== currentKey) {
            currentKey = key;
            generation++;
            pending = false;
            item = null;
            retryAfter = 0;
            clear();
        }
        const date = new Date();
        const day = (date.getMonth() + 1) * 100 + date.getDate();
        const season = day >= 1201 && day <= 1231 ? 'christmas'
            : day >= 1015 && day <= 1101 ? 'halloween' : '';
        const page = [...document.querySelectorAll('#itemDetailPage, .itemDetailPage')].find(visible);
        // Media Bar trailers are decorative previews, not the main video player.
        const playing = [...document.querySelectorAll('video, .videoPlayerContainer, .videoPlayerContainer-onTop')]
            .some(element => !element.closest('#slides-container') && visible(element));
        const dialog = [...document.querySelectorAll('.jp-overlay, dialog[open], [role="dialog"]')].some(visible);
        if (!season || (!home && (!user || !id || !page)) || playing || dialog || document.hidden || motion.matches ||
            root.classList.contains('layout-tv') || root.hasAttribute('data-eftv') ||
            !root.matches('.layout-desktop, .layout-mobile')) {
            clear();
            return;
        }
        // The home page celebrates the season independently of individual movies.
        if (home) return render(season);
        if (item) return render(seasonFor(date, item));
        if (pending || Date.now() < retryAfter || typeof client?.getItem !== 'function') return;
        pending = true;
        const requestGeneration = generation;
        try {
            const result = await client.getItem(user, id);
            if (stopped || requestGeneration !== generation) return;
            item = result;
            retryAfter = Date.now() + 30000;
        } catch {
            if (requestGeneration === generation) retryAfter = Date.now() + 30000;
        } finally {
            if (!stopped && requestGeneration === generation) {
                pending = false;
                // Recheck route, playback, date and layout after the asynchronous request.
                void update();
            }
        }
    }

    // Also catches pushState navigation and midnight while the detail page stays open.
    const timer = window.setInterval(update, 1000);
    window.addEventListener('hashchange', update);
    window.addEventListener('popstate', update);
    document.addEventListener('visibilitychange', update);
    document.addEventListener('scroll', scheduleBounds, true);
    window.addEventListener('resize', scheduleBounds);
    motion.addEventListener('change', update);
    window.ElegantFinSeasonal = {
        seasonFor,
        destroy() {
            stopped = true;
            generation++;
            clearInterval(timer);
            window.removeEventListener('hashchange', update);
            window.removeEventListener('popstate', update);
            document.removeEventListener('visibilitychange', update);
            motion.removeEventListener('change', update);
            document.removeEventListener('scroll', scheduleBounds, true);
            window.removeEventListener('resize', scheduleBounds);
            cancelAnimationFrame(boundsFrame);
            clear();
        }
    };
    void update();
})();
