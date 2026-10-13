/* ElegantFin TV frontend. No replacement of Jellyfin's layout or playback APIs. */
(function () {
    'use strict';
    if (window.ElegantFinTv) return;
    var config = window.ElegantFinTvConfig || {};
    var root = document.documentElement;
    var script = document.currentScript;
    var assetBase = new URL('./', script ? script.src : document.baseURI);
    var link = null;
    var loaded = false;
    var active = false;
    var disposed = false;
    var bodyObserver = null;
    var barObserver = null;
    var bar = null;
    var frame = 0;
    var originals = new Map();
    var measurements = new Set();
    var diagnosticsPanel = null;
    var diagnosticsTimer = 0;
    var diagnosticsStyle = null;
    var diagnosticsBusy = false;
    var previousFocus = null;
    var measurementRun = 0;
    var navigationObserver = null;
    var navigationFrame = 0;
    var navigation = null;
    var navigationHeader = null;
    var navigationDrawer = null;
    var headerSizeObserver = null;
    var heroObserver = null;
    var heroResizeObserver = null;
    var heroFrame = 0;
    var heroRows = null;
    var heroStage = null;
    var heroMargin = '';
    var heroOriginalMargin = '';
    var heroReturnFocus = null;
    var navigationSignature = '';
    var controls = '.play-button,.detail-button,.favorite-button,.pause-button,.volume-toggle,.left-arrow,.right-arrow,.dot';
    var labels = {
        'play-button': 'Abspielen', 'detail-button': 'Details', 'favorite-button': 'Favorit',
        'pause-button': 'Diashow pausieren oder fortsetzen', 'volume-toggle': 'Ton umschalten',
        'left-arrow': 'Vorheriger Titel', 'right-arrow': 'Nächster Titel', 'dot': 'Titel auswählen'
    };

    function rememberSet(element, name, value) {
        if (!originals.has(element)) originals.set(element, new Map());
        var attrs = originals.get(element);
        if (!attrs.has(name)) attrs.set(name, { original: element.getAttribute(name), applied: value });
        attrs.get(name).applied = value;
        if (value === null) element.removeAttribute(name);
        else if (element.getAttribute(name) !== value) element.setAttribute(name, value);
    }

    function restore(element, attrs) {
        attrs.forEach(function (entry, name) {
            // Do not overwrite a later change made by the actual Media Bar.
            if (element.getAttribute(name) !== entry.applied) return;
            if (entry.original === null) element.removeAttribute(name);
            else element.setAttribute(name, entry.original);
        });
    }

    function visible(element) {
        if (element.closest('[inert],[hidden],[aria-hidden="true"]') || element.disabled) return false;
        var rect = element.getBoundingClientRect();
        var style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    }

    function updateBar() {
        frame = 0;
        if (!bar || !bar.isConnected) { unbindBar(); return; }
        // Release references when the slideshow replaces individual slides.
        originals.forEach(function (attrs, element) {
            if (!bar.contains(element) && element !== bar) { restore(element, attrs); originals.delete(element); }
        });
        var selected = bar.querySelector('.slide.active');
        var focused = document.activeElement;
        var focusedSlide = focused && focused.closest('.slide');
        var focusClass = focused && Object.keys(labels).find(function (name) { return focused.classList.contains(name); });
        if (selected) {
            bar.querySelectorAll('.slide').forEach(function (slide) {
                // Only manage known .slide.active markup; unknown forks keep their own behaviour.
                rememberSet(slide, 'inert', slide === selected ? null : '');
            });
        }
        bar.querySelectorAll(controls).forEach(function (element) {
            rememberSet(element, 'data-eftv-control', '');
            if (!element.matches('button,a[href],input,select,textarea')) {
                if (!element.hasAttribute('tabindex')) rememberSet(element, 'tabindex', '0');
                if (!element.hasAttribute('role')) rememberSet(element, 'role', 'button');
            }
            if (!element.hasAttribute('aria-label') && !element.textContent.trim()) {
                var name = Object.keys(labels).find(function (key) { return element.classList.contains(key); });
                if (name) rememberSet(element, 'aria-label', labels[name]);
            }
        });
        rememberSet(bar, 'data-eftv-adapted', '');
        if (selected && focusedSlide && bar.contains(focusedSlide) && focusedSlide !== selected) {
            var target = focusClass && selected.querySelector('.' + focusClass);
            if (!target) target = selected.querySelector(controls);
            if (target && visible(target)) target.focus({ preventScroll: true });
        }
    }

    function scheduleBar() {
        if (!frame) frame = requestAnimationFrame(updateBar);
    }

    function onBarKey(event) {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        var current = event.target.closest('[data-eftv-control]');
        if (!current || !bar || !bar.contains(current)) return;
        if ((event.key === 'Enter' || event.key === ' ') && !current.matches('button,a[href],input,select,textarea')) {
            event.preventDefault();
            event.stopPropagation();
            if (!event.repeat) current.click();
            return;
        }
        // Internal arrows only. At an edge Jellyfin retains navigation to the rest of the page.
        if (!/^Arrow(Left|Right|Up|Down)$/.test(event.key)) return;
        var from = current.getBoundingClientRect();
        var horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
        var sign = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
        var best = null;
        var score = Infinity;
        bar.querySelectorAll('[data-eftv-control]').forEach(function (candidate) {
            if (candidate === current || !visible(candidate)) return;
            var to = candidate.getBoundingClientRect();
            var dx = (to.left + to.right - from.left - from.right) / 2;
            var dy = (to.top + to.bottom - from.top - from.bottom) / 2;
            var forward = (horizontal ? dx : dy) * sign;
            var cross = Math.abs(horizontal ? dy : dx);
            if (forward <= 1) return;
            var distance = forward + cross * 3;
            if (distance < score) { score = distance; best = candidate; }
        });
        if (best) {
            event.preventDefault();
            event.stopPropagation();
            best.focus({ preventScroll: true });
        }
    }

    function unbindBar() {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        if (barObserver) barObserver.disconnect();
        barObserver = null;
        if (bar) bar.removeEventListener('keydown', onBarKey);
        originals.forEach(function (attrs, element) { restore(element, attrs); });
        originals.clear();
        bar = null;
    }

    function bindBar(candidate) {
        if (candidate === bar) return;
        unbindBar();
        bar = candidate;
        if (!bar) return;
        bar.addEventListener('keydown', onBarKey);
        barObserver = new MutationObserver(scheduleBar);
        barObserver.observe(bar, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
        updateBar();
    }

    function startMediaBar() {
        if (bodyObserver || !document.body) return;
        document.addEventListener('keydown', onHomeBarKey, true);
        bindBar(document.getElementById('slides-container'));
        bodyObserver = new MutationObserver(function (records) {
            if (bar && bar.isConnected) return;
            if (bar) unbindBar();
            for (var record of records) {
                for (var node of record.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    var candidate = node.id === 'slides-container' ? node : node.querySelector('#slides-container');
                    if (candidate && candidate.isConnected) { bindBar(candidate); return; }
                }
            }
        });
        // No global style/class observer and no repeated whole-document scans.
        bodyObserver.observe(document.body, { childList: true, subtree: true });
    }

    function isTv() {
        return root.classList.contains('layout-tv') || /web0s|webos|netcast/i.test(navigator.userAgent);
    }

    function homeRows() {
        return Array.from(document.querySelectorAll('.homeSectionsContainer')).find(visible);
    }

    function firstHomeItems(rows) {
        if (!rows) return [];
        var items = Array.from(rows.querySelectorAll('.card[tabindex],.card a[href],.homeLibraryButton')).filter(visible);
        if (!items.length) return items;
        var firstTop = Math.min.apply(null, items.map(function (item) { return item.getBoundingClientRect().top; }));
        return items.filter(function (item) { return item.getBoundingClientRect().top < firstTop + 10; });
    }

    function onHomeBarKey(event) {
        if (!isTv() || !bar || !visible(bar) || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.target.closest('dialog,[role="dialog"],input,textarea,select')) return;
        var rows = homeRows();
        var first = firstHomeItems(rows);
        var target = null;
        if (event.key === 'ArrowUp' && first.some(function (item) { return item === event.target || item.contains(event.target); })) {
            target = Array.from(bar.querySelectorAll('.slide.active .play-button')).find(visible)
                || Array.from(bar.querySelectorAll('[data-eftv-control]')).find(visible);
            if (target) heroReturnFocus = event.target;
        } else if (event.key === 'ArrowDown' && bar.contains(event.target) && event.target.closest('.button-container,.dots-container,.arrow')) {
            target = heroReturnFocus && heroReturnFocus.isConnected && rows && rows.contains(heroReturnFocus) && visible(heroReturnFocus) ? heroReturnFocus : first[0];
        }
        if (!target) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        target.focus({ preventScroll: true });
        // The bar lives outside Jellyfin's page focus scope and scroll frame.
        if (bar.contains(target)) {
            for (var parent = rows; parent && parent !== document.body; parent = parent.parentElement) {
                if (parent.scrollTop) parent.scrollTop = 0;
            }
            window.scrollTo(0, 0);
        } else target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function clearHeroMargin() {
        if (heroRows && heroRows.style.getPropertyValue('--eftv-rows-margin') === heroMargin) {
            if (heroOriginalMargin) heroRows.style.setProperty('--eftv-rows-margin', heroOriginalMargin);
            else heroRows.style.removeProperty('--eftv-rows-margin');
        }
        heroRows = null;
        heroStage = null;
        heroMargin = '';
        heroOriginalMargin = '';
    }

    function unscrolledTop(element) {
        var top = element.getBoundingClientRect().top;
        for (var parent = element.parentElement; parent && parent !== document.body && parent !== root; parent = parent.parentElement) top += parent.scrollTop;
        return top;
    }

    function updateHeroLayout() {
        heroFrame = 0;
        var stage = document.getElementById('slides-container');
        var rows = homeRows();
        if (!stage || !rows) {
            if (heroResizeObserver) heroResizeObserver.disconnect();
            clearHeroMargin();
            return;
        }
        if (heroRows !== rows || heroStage !== stage) {
            clearHeroMargin();
            heroRows = rows;
            heroStage = stage;
            heroOriginalMargin = rows.style.getPropertyValue('--eftv-rows-margin');
            if (heroResizeObserver) {
                heroResizeObserver.disconnect();
                heroResizeObserver.observe(stage);
                for (var parent = rows; parent && parent !== document.body; parent = parent.parentElement) heroResizeObserver.observe(parent);
            }
        }
        if (!visible(stage)) {
            rows.style.removeProperty('--eftv-rows-margin');
            heroMargin = '';
            return;
        }
        var title = Array.from(rows.querySelectorAll('.sectionTitle')).find(visible);
        var first = title || Array.from(rows.children).find(visible) || rows;
        var top = unscrolledTop(first) + (parseFloat(getComputedStyle(first).paddingTop) || 0);
        var gap = parseFloat(getComputedStyle(root).fontSize) * .75;
        var difference = unscrolledTop(stage) + stage.getBoundingClientRect().height + gap - top;
        if (Math.abs(difference) < .5) return;
        var margin = parseFloat(getComputedStyle(rows).marginTop) || 0;
        heroMargin = (Math.round((margin + difference) * 100) / 100) + 'px';
        rows.style.setProperty('--eftv-rows-margin', heroMargin);
    }

    function scheduleHeroLayout() {
        if (!heroFrame) heroFrame = requestAnimationFrame(updateHeroLayout);
    }

    function startHeroLayout() {
        if (heroObserver || !document.body) return;
        if (window.ResizeObserver) heroResizeObserver = new ResizeObserver(scheduleHeroLayout);
        heroObserver = new MutationObserver(function (records) {
            if (records.some(function (record) {
                if (heroRows && heroRows.contains(record.target)) return true;
                return Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(function (node) {
                    return node.nodeType === 1 && (node.matches('#slides-container,.homeSectionsContainer') || node.querySelector('#slides-container,.homeSectionsContainer'));
                });
            })) scheduleHeroLayout();
        });
        heroObserver.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('resize', scheduleHeroLayout);
        window.addEventListener('hashchange', scheduleHeroLayout);
        document.addEventListener('viewshow', scheduleHeroLayout);
        scheduleHeroLayout();
    }

    function stopHeroLayout() {
        if (heroObserver) heroObserver.disconnect();
        if (heroResizeObserver) heroResizeObserver.disconnect();
        if (heroFrame) cancelAnimationFrame(heroFrame);
        heroObserver = heroResizeObserver = null;
        heroFrame = 0;
        window.removeEventListener('resize', scheduleHeroLayout);
        window.removeEventListener('hashchange', scheduleHeroLayout);
        document.removeEventListener('viewshow', scheduleHeroLayout);
        clearHeroMargin();
    }

    // Reuse the classic client's user-specific library links. No extra API
    // requests, fixed library IDs, polling, or replacement of native controls.
    function refreshNavigation() {
        navigationFrame = 0;
        var header = document.querySelector('.skinHeader:not(.osdHeader)');
        var top = header && header.querySelector('.headerTop');
        var drawer = document.querySelector('.mainDrawer .libraryMenuOptions');
        var sources = drawer ? Array.from(drawer.querySelectorAll('a.navMenuOption[href]')) : [];
        // Modern layouts already render their own navigation. Their legacy
        // header is hidden inside a wrapper; do not add a second menu there.
        if (!top || !header.getClientRects().length || !sources.length) {
            removeNavigation();
            return;
        }
        var items = [{ href: '#/home', label: 'Startseite', icon: 'home' },
            { href: '#/home?tab=1', label: 'Favoriten', icon: 'favorite' }];
        var seen = new Set();
        sources.forEach(function (source) {
            var href = source.getAttribute('href');
            // Only copy same-client hash routes, never custom external links.
            if (!href || !href.startsWith('#/') || seen.has(href)) return;
            // The drawer can include an extra TV guide link for the same library.
            var id = source.getAttribute('data-itemid');
            if (id && seen.has('id:' + id)) return;
            seen.add(href);
            if (id) seen.add('id:' + id);
            var label = source.querySelector('.navMenuOptionText');
            var icon = source.querySelector('.material-icons');
            var glyph = icon && (icon.textContent.trim() || Array.from(icon.classList).find(function (name) {
                return name !== 'material-icons' && name !== 'navMenuOptionIcon';
            }));
            items.push({ href: href, label: (label || source).textContent.trim(), icon: glyph || 'video_library' });
        });
        var signature = JSON.stringify(items);
        if (!navigation || !navigation.isConnected || navigationHeader !== header || signature !== navigationSignature) {
            var focusedHref = navigation && navigation.contains(document.activeElement) ? document.activeElement.getAttribute('href') : null;
            removeNavigation();
            navigation = document.createElement('nav');
            navigation.className = 'eftv-library-nav focuscontainer-x';
            navigation.setAttribute('aria-label', 'Bibliotheken');
            var brand = document.createElement('span');
            brand.className = 'eftv-brand';
            var brandIcon = document.createElement('span');
            brandIcon.className = 'eftv-brand-icon';
            brandIcon.setAttribute('aria-hidden', 'true');
            brand.appendChild(brandIcon);
            brand.appendChild(document.createTextNode('Jellyfin'));
            navigation.appendChild(brand);
            items.forEach(function (item) {
                var a = document.createElement('a');
                a.href = item.href;
                a.className = 'emby-button';
                var icon = document.createElement('span');
                icon.className = 'material-icons';
                icon.setAttribute('aria-hidden', 'true');
                icon.textContent = item.icon;
                a.appendChild(icon);
                a.appendChild(document.createTextNode(item.label));
                navigation.appendChild(a);
            });
            top.insertBefore(navigation, top.querySelector('.headerRight'));
            navigationHeader = header;
            navigationDrawer = drawer;
            header.setAttribute('data-eftv-navigation', '');
            if (window.ResizeObserver) {
                headerSizeObserver = new ResizeObserver(function () {
                    var height = Math.ceil(header.getBoundingClientRect().height);
                    if (height > 0) root.style.setProperty('--eftv-header-height', height + 'px');
                    if (heroObserver) scheduleHeroLayout();
                });
                headerSizeObserver.observe(header);
            }
            navigationSignature = signature;
            if (focusedHref) {
                var replacement = Array.from(navigation.children).find(function (a) { return a.getAttribute('href') === focusedHref; });
                if (replacement) replacement.focus({ preventScroll: true });
            }
        }
        Array.from(navigation.children).forEach(function (a) {
            if (a.getAttribute('href') === window.location.hash) a.setAttribute('aria-current', 'page');
            else a.removeAttribute('aria-current');
        });
        header.toggleAttribute('data-eftv-home-tabs', /^#\/home(?:\.html)?(?:\?|$)/.test(window.location.hash));
    }

    function removeNavigation() {
        if (navigation) navigation.remove();
        if (headerSizeObserver) headerSizeObserver.disconnect();
        headerSizeObserver = null;
        root.style.removeProperty('--eftv-header-height');
        if (navigationHeader) {
            navigationHeader.removeAttribute('data-eftv-navigation');
            navigationHeader.removeAttribute('data-eftv-home-tabs');
        }
        navigation = null;
        navigationHeader = null;
        navigationDrawer = null;
        navigationSignature = '';
    }

    function scheduleNavigation() {
        if (!navigationFrame) navigationFrame = requestAnimationFrame(refreshNavigation);
    }

    function startNavigation() {
        if (navigationObserver) { scheduleNavigation(); return; }
        if (!document.body) return;
        refreshNavigation();
        navigationObserver = new MutationObserver(function (records) {
            // Once mounted, ordinary poster/slide mutations need no discovery
            // scans. Only library contents or removal of the owned nodes matter.
            if (navigation && navigation.isConnected && navigationDrawer && navigationDrawer.isConnected) {
                if (records.some(function (record) { return navigationDrawer.contains(record.target); })) scheduleNavigation();
                return;
            }
            var relevant = '.skinHeader,.headerTop,.mainDrawer,.libraryMenuOptions';
            var changed = records.some(function (record) {
                var target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
                if (target && target.closest('.eftv-library-nav')) return false;
                if (target && target.closest('.libraryMenuOptions')) return true;
                return Array.from(record.addedNodes).concat(Array.from(record.removedNodes)).some(function (node) {
                    return node.nodeType === 1 && (node.matches(relevant) || node.querySelector(relevant));
                });
            });
            if (changed) scheduleNavigation();
        });
        navigationObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
        window.addEventListener('hashchange', scheduleNavigation);
        document.addEventListener('viewshow', scheduleNavigation);
        document.addEventListener('pageshow', scheduleNavigation);
    }

    function stopNavigation() {
        if (navigationObserver) navigationObserver.disconnect();
        navigationObserver = null;
        if (navigationFrame) cancelAnimationFrame(navigationFrame);
        navigationFrame = 0;
        window.removeEventListener('hashchange', scheduleNavigation);
        document.removeEventListener('viewshow', scheduleNavigation);
        document.removeEventListener('pageshow', scheduleNavigation);
        removeNavigation();
    }

    function components() {
        var mode = isTv() && ['reference', 'theme', 'adapter', 'complete'].includes(config.comparisonMode) ? config.comparisonMode : 'normal';
        return { mode: mode, theme: mode !== 'reference' && mode !== 'adapter',
            adapter: mode === 'adapter' || mode === 'complete' || (mode === 'normal' && config.mediaBar === true) };
    }

    function stopMediaBar() {
        document.removeEventListener('keydown', onHomeBarKey, true);
        heroReturnFocus = null;
        if (bodyObserver) bodyObserver.disconnect();
        bodyObserver = null;
        unbindBar();
    }

    function reconcile() {
        if (disposed) return;
        var wanted = config.enabled !== false && (config.applyToAllClients === true || isTv());
        if (!wanted) {
            active = false;
            root.removeAttribute('data-eftv');
            root.removeAttribute('data-eftv-performance');
            stopMediaBar();
            stopNavigation();
            stopHeroLayout();
            stopDiagnostics();
            if (link) link.disabled = true;
            return;
        }
        var parts = components();
        if (parts.theme && !link) {
            link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = new URL((config.performance === 'full' ? 'tv-full.css' : 'tv.css') + '?v=' + encodeURIComponent(config.version || '0.1.10'), assetBase).href;
            link.onload = function () { loaded = true; reconcile(); };
            link.onerror = function () { console.warn('ElegantFin TV: stylesheet could not be loaded.'); };
            document.head.appendChild(link);
        }
        if (link) link.disabled = !parts.theme;
        if (parts.theme && !loaded) return;
        active = true;
        if (parts.theme) {
            root.setAttribute('data-eftv', '');
            root.setAttribute('data-eftv-performance', config.performance === 'full' ? 'full' : 'balanced');
        } else {
            root.removeAttribute('data-eftv');
            root.removeAttribute('data-eftv-performance');
        }
        if (parts.adapter) startMediaBar(); else stopMediaBar();
        if (parts.theme && config.performance !== 'full' && isTv()) startNavigation(); else stopNavigation();
        if (parts.theme && config.performance !== 'full' && isTv()) startHeroLayout(); else stopHeroLayout();
        if (config.showDiagnostics === true && isTv()) startDiagnostics();
        else stopDiagnostics();
    }

    var layoutObserver = new MutationObserver(reconcile);
    layoutObserver.observe(root, { attributes: true, attributeFilter: ['class'] });

    function diagnose(seconds) {
        seconds = Math.min(30, Math.max(1, Number(seconds) || 10));
        var start = performance.now();
        var startedAt = new Date().toISOString();
        var frames = 0;
        var longestFrame = 0;
        var framesOver50Ms = 0;
        var last = start;
        var token;
        var wasHidden = document.hidden;
        var resources = [];
        var resourceObserver = null;
        var taskObserver = null;
        var longTasks = 0;
        var longTaskMs = 0;
        var categories = {};
        function collect(entries) {
            entries.forEach(function (entry) {
                if (entry.startTime < start) return;
                var kind = /\/images\/(primary|backdrop|thumb|logo)(\/|\?|$)/i.exec(entry.name);
                if (!kind) return;
                var capped = false;
                try {
                    new URL(entry.name).searchParams.forEach(function (value, key) {
                        if (/^(maxwidth|maxheight|width|height|fillwidth|fillheight)$/i.test(key) && Number(value) > 0) capped = true;
                    });
                } catch (_) { /* Aggregate timing remains useful for an unparseable URL. */ }
                // Keep only numbers/types, never URLs, IDs, query strings or tokens.
                resources.push({ kind: kind[1].toLowerCase(), duration: entry.duration,
                    ttfb: entry.responseStart > 0 ? entry.responseStart - entry.requestStart : null,
                    bytes: entry.encodedBodySize || 0, capped: capped });
            });
        }
        if (window.PerformanceObserver) {
            try {
                resourceObserver = new PerformanceObserver(function (list) { collect(list.getEntries()); });
                resourceObserver.observe({ entryTypes: ['resource'] });
            } catch (_) { resourceObserver = null; }
            try {
                if (PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.includes('longtask')) {
                    taskObserver = new PerformanceObserver(function (list) {
                        list.getEntries().forEach(function (entry) { if (entry.startTime >= start) { longTasks++; longTaskMs += entry.duration; } });
                    });
                    taskObserver.observe({ entryTypes: ['longtask'] });
                }
            } catch (_) { taskObserver = null; }
        }
        function tick(now) {
            var gap = now - last;
            longestFrame = Math.max(longestFrame, gap);
            if (gap > 50) framesOver50Ms++;
            last = now;
            frames++;
            token = requestAnimationFrame(tick);
        }
        function onVisibility() { wasHidden = wasHidden || document.hidden; }
        document.addEventListener('visibilitychange', onVisibility);
        token = requestAnimationFrame(tick);
        return new Promise(function (resolve) {
            var finished = false;
            var timer;
            function finish(cancelled) {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                cancelAnimationFrame(token);
                measurements.delete(cancel);
                document.removeEventListener('visibilitychange', onVisibility);
                if (resourceObserver) { collect(resourceObserver.takeRecords()); resourceObserver.disconnect(); }
                else collect(performance.getEntriesByType('resource'));
                if (taskObserver) {
                    taskObserver.takeRecords().forEach(function (entry) { if (entry.startTime >= start) { longTasks++; longTaskMs += entry.duration; } });
                    taskObserver.disconnect();
                }
                resources.forEach(function (r) {
                    if (!categories[r.kind]) categories[r.kind] = { count: 0, uncapped: 0, maxMs: 0, maxTtfbMs: null, encodedBytes: 0 };
                    var group = categories[r.kind];
                    group.count++;
                    if (!r.capped) group.uncapped++;
                    group.maxMs = Math.max(group.maxMs, Math.round(r.duration));
                    if (r.ttfb !== null) group.maxTtfbMs = Math.max(group.maxTtfbMs || 0, Math.round(r.ttfb));
                    group.encodedBytes += r.bytes;
                });
                var duration = performance.now() - start;
                resolve({
                    cancelled: cancelled === true, startedAt: startedAt,
                    browserEngine: (navigator.userAgent.match(/Chrome\/(\d+)/) || [])[1] || 'unknown',
                    viewport: { width: window.innerWidth, height: window.innerHeight, pixelRatio: window.devicePixelRatio },
                    active: active, profile: root.getAttribute('data-eftv-performance'), components: components(),
                    mediaBarFound: !!bar, seconds: Math.round(duration / 100) / 10,
                    frameSamplesPerSecond: wasHidden ? null : Math.round(frames * 1000 / duration),
                    longestFrameMs: wasHidden ? null : Math.round(longestFrame),
                    framesOver50Ms: wasHidden ? null : framesOver50Ms,
                    longTaskCount: taskObserver ? longTasks : null,
                    longTaskTotalMs: taskObserver ? Math.round(longTaskMs) : null,
                    imageRequestsObserved: resources.length,
                    slowestImageRequestMs: resources.length ? Math.round(Math.max.apply(null, resources.map(function (r) { return r.duration; }))) : null,
                    images: categories,
                    imageDimensions: cancelled ? [] : sampleImageDimensions(),
                    note: 'Aggregate Resource Timing only. In-flight requests at the end are excluded. Cache/CORS may hide sizes/timings. TTFB includes network and server time; image decode is not measured. No URLs or tokens are returned.'
                });
            }
            function cancel() { finish(true); }
            measurements.add(cancel);
            timer = setTimeout(function () { finish(false); }, seconds * 1000);
        });
    }

    // Read existing decoded IMG dimensions only, after frame timing stops.
    // No new Image(), decode(), fetch or background-image downloads for sampling.
    function sampleImageDimensions() {
        var samples = [];
        var images = document.images;
        for (var i = 0; i < images.length && i < 128 && samples.length < 6; i++) {
            var img = images[i];
            var kind = /\/images\/(primary|backdrop|thumb|logo)(\/|\?|$)/i.exec(img.currentSrc || img.src);
            if (!kind || !img.complete || !img.naturalWidth || img.closest('[hidden],[inert],[aria-hidden="true"]')) continue;
            var rect = img.getBoundingClientRect();
            if (!rect.width || !rect.height || rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) continue;
            if (getComputedStyle(img).visibility === 'hidden') continue;
            samples.push({kind: kind[1].toLowerCase(), width: img.naturalWidth, height: img.naturalHeight,
                displayWidth: Math.round(rect.width), displayHeight: Math.round(rect.height)});
        }
        return samples;
    }

    function stopDiagnostics() {
        clearTimeout(diagnosticsTimer);
        diagnosticsTimer = 0;
        measurements.forEach(function (cancel) { cancel(); });
        document.removeEventListener('keydown', onDiagnosticsKey, true);
        document.removeEventListener('focusin', rememberFocus, true);
        if (diagnosticsStyle) diagnosticsStyle.remove();
        diagnosticsStyle = null;
        if (diagnosticsPanel) diagnosticsPanel.remove();
        diagnosticsPanel = null;
        diagnosticsBusy = false;
        previousFocus = null;
    }

    function startDiagnostics() {
        if (diagnosticsPanel || !document.body) return;
        diagnosticsStyle = document.createElement('style');
        diagnosticsStyle.textContent = '#eftv-diagnostics{position:fixed;z-index:2147483647;inset:1rem 1rem auto auto;max-width:85vw;max-height:90vh;overflow:auto;padding:1rem;background:#111827;color:white;border:2px solid #a5b4fc;border-radius:.5rem;font:500 1rem/1.4 sans-serif;white-space:pre-line;pointer-events:auto}#eftv-diagnostics[hidden]{display:none!important}#eftv-diagnostics button{font:inherit;color:white;background:#29364f;border:2px solid #a5b4fc;padding:.4rem .8rem;margin:.4rem}#eftv-diagnostics button:focus{outline:3px solid white}';
        document.head.appendChild(diagnosticsStyle);
        var panel = document.createElement('div');
        panel.id = 'eftv-diagnostics';
        panel.setAttribute('role', 'status');
        diagnosticsPanel = panel;
        document.body.appendChild(panel);
        document.addEventListener('keydown', onDiagnosticsKey, true);
        document.addEventListener('focusin', rememberFocus, true);
        previousFocus = document.activeElement;
        showDiagnosticText('ElegantFin TV · ' + components().mode + '\nBibliothek öffnen, dann Messung starten (rote Farbtaste).');
    }

    function rememberFocus(event) {
        if (diagnosticsPanel && !diagnosticsPanel.contains(event.target)) previousFocus = event.target;
    }

    function restoreFocus() {
        if (diagnosticsPanel && diagnosticsPanel.contains(document.activeElement) && previousFocus && previousFocus.isConnected) {
            previousFocus.focus({ preventScroll: true });
        }
    }

    function showDiagnosticText(text) {
        var panel = diagnosticsPanel;
        restoreFocus();
        panel.textContent = text + '\n';
        panel.hidden = false;
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'emby-button show-focus';
        button.textContent = 'Messung starten';
        button.addEventListener('click', beginMeasurement);
        panel.appendChild(button);
        var hide = document.createElement('button');
        hide.type = 'button'; hide.className = 'emby-button show-focus'; hide.textContent = 'Ausblenden';
        hide.addEventListener('click', function () { restoreFocus(); panel.hidden = true; });
        panel.appendChild(hide);
    }

    function onDiagnosticsKey(event) {
        if (event.keyCode !== 403 && event.key !== 'ColorF0Red' && event.key !== 'F8') return;
        event.preventDefault(); event.stopImmediatePropagation();
        if (!event.repeat && !diagnosticsBusy) beginMeasurement();
    }

    function beginMeasurement() {
        if (!diagnosticsPanel || diagnosticsBusy) return;
        diagnosticsBusy = true;
        var panel = diagnosticsPanel;
        restoreFocus();
        panel.hidden = false;
        panel.textContent = 'Start in 3 Sekunden. Danach 15 Sekunden navigieren.\nWährend der Messung wird die Anzeige ausgeblendet.';
        diagnosticsTimer = setTimeout(function () {
            diagnosticsTimer = 0;
            panel.hidden = true;
            // Allow the display:none update to settle before the timing window.
            diagnosticsTimer = setTimeout(function () {
            diagnosticsTimer = 0;
            diagnose(15).then(function (result) {
                if (result.cancelled || diagnosticsPanel !== panel) return;
                diagnosticsBusy = false;
                measurementRun++;
                function number(value) { return value === null ? 'n/v' : value; }
                var rows = [
                    'ElegantFin TV ' + (config.version || '0.1.10') + ' · ' + result.components.mode + ' · Lauf ' + measurementRun,
                    'Theme: ' + result.components.theme + ' · Adapter: ' + result.components.adapter + ' · Profil: ' + (result.profile || 'Standard') + ' · Chrome ' + result.browserEngine,
                    result.viewport.width + '×' + result.viewport.height + ' · DPR ' + result.viewport.pixelRatio + ' · ' + result.startedAt,
                    'Frames/s: ' + number(result.frameSamplesPerSecond) + ' · längste Pause: ' + number(result.longestFrameMs) + ' ms',
                    'Framepausen >50 ms: ' + number(result.framesOver50Ms) + ' · lange Hauptthread-Aufgaben: ' + number(result.longTaskCount),
                    'Hauptthread-Aufgaben gesamt: ' + number(result.longTaskTotalMs) + ' ms · Messdauer: ' + result.seconds + ' s',
                    'Bildanfragen: ' + result.imageRequestsObserved + ' · langsamste: ' + number(result.slowestImageRequestMs) + ' ms'
                ];
                Object.keys(result.images).forEach(function (kind) {
                    var g = result.images[kind];
                    rows.push(kind + ': ' + g.count + ' · ohne Größenparameter: ' + g.uncapped + ' · max. ' + g.maxMs + ' ms · TTFB ' + number(g.maxTtfbMs) + ' ms · ' + Math.round(g.encodedBytes / 1024) + ' KiB');
                });
                result.imageDimensions.forEach(function (s) {
                    rows.push(s.kind + ': Bild ' + s.width + '×' + s.height + ' → Anzeige ' + s.displayWidth + '×' + s.displayHeight + ' CSS-px');
                });
                rows.push('Bildgrößen: ' + result.imageDimensions.length + ' IMG-Stichproben; CSS-Hintergrundbilder nicht erfasst.');
                rows.push('Bitte Ergebnis fotografieren. Keine Messdaten wurden versendet.');
                rows.push('Cache/CORS können Werte verdecken. n/v = nicht verfügbar.');
                showDiagnosticText(rows.join('\n'));
            });
            }, 100);
        }, 3000);
    }

    window.ElegantFinTv = {
        version: config.version || '0.1.10',
        diagnose: diagnose,
        status: function () { return { active: active, tv: isTv(), mediaBarFound: !!bar, profile: root.getAttribute('data-eftv-performance'), components: components() }; },
        dispose: function () {
            config.enabled = false;
            reconcile();
            disposed = true;
            layoutObserver.disconnect();
            document.removeEventListener('DOMContentLoaded', reconcile);
            if (link) link.remove();
        }
    };
    document.addEventListener('DOMContentLoaded', reconcile, { once: true });
    reconcile();
}());
