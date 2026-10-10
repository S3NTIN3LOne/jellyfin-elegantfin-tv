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
    var diagnosticsStarted = false;
    var diagnosticsPanel = null;
    var diagnosticsTimer = 0;
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
        if (bodyObserver || !config.mediaBar || !document.body) return;
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

    function reconcile() {
        if (disposed) return;
        var wanted = config.enabled !== false && (config.applyToAllClients === true || isTv());
        if (!wanted) {
            active = false;
            root.removeAttribute('data-eftv');
            root.removeAttribute('data-eftv-performance');
            if (bodyObserver) bodyObserver.disconnect();
            bodyObserver = null;
            unbindBar();
            stopDiagnostics();
            if (link) link.disabled = true;
            return;
        }
        if (!link) {
            link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = new URL('tv.css?v=' + encodeURIComponent(config.version || '0.1.3'), assetBase).href;
            link.onload = function () { loaded = true; reconcile(); };
            link.onerror = function () { console.warn('ElegantFin TV: stylesheet could not be loaded.'); };
            document.head.appendChild(link);
        }
        link.disabled = false;
        if (!loaded) return;
        active = true;
        root.setAttribute('data-eftv', '');
        root.setAttribute('data-eftv-performance', config.performance === 'full' ? 'full' : 'balanced');
        startMediaBar();
        if (config.showDiagnostics === true && isTv()) startDiagnostics();
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
                    active: active, profile: root.getAttribute('data-eftv-performance'),
                    mediaBarFound: !!bar, seconds: Math.round(duration / 100) / 10,
                    frameSamplesPerSecond: wasHidden ? null : Math.round(frames * 1000 / duration),
                    longestFrameMs: wasHidden ? null : Math.round(longestFrame),
                    framesOver50Ms: wasHidden ? null : framesOver50Ms,
                    longTaskCount: taskObserver ? longTasks : null,
                    longTaskTotalMs: taskObserver ? Math.round(longTaskMs) : null,
                    imageRequestsObserved: resources.length,
                    slowestImageRequestMs: resources.length ? Math.round(Math.max.apply(null, resources.map(function (r) { return r.duration; }))) : null,
                    images: categories,
                    note: 'Aggregate Resource Timing only. In-flight requests at the end are excluded. Cache/CORS may hide sizes/timings. TTFB includes network and server time; image decode is not measured. No URLs or tokens are returned.'
                });
            }
            function cancel() { finish(true); }
            measurements.add(cancel);
            timer = setTimeout(function () { finish(false); }, seconds * 1000);
        });
    }

    function stopDiagnostics() {
        clearTimeout(diagnosticsTimer);
        diagnosticsTimer = 0;
        measurements.forEach(function (cancel) { cancel(); });
        if (diagnosticsPanel) diagnosticsPanel.remove();
        diagnosticsPanel = null;
    }

    function startDiagnostics() {
        if (diagnosticsStarted || !document.body) return;
        diagnosticsStarted = true;
        var panel = document.createElement('div');
        panel.id = 'eftv-diagnostics';
        panel.setAttribute('role', 'status');
        panel.textContent = 'ElegantFin TV: Diagnose startet in 5 Sekunden.\nDanach 15 Sekunden durch die Poster navigieren.';
        diagnosticsPanel = panel;
        document.body.appendChild(panel);
        diagnosticsTimer = setTimeout(function () {
            diagnosticsTimer = 0;
            panel.textContent = 'ElegantFin TV: Jetzt 15 Sekunden navigieren.\nMessung läuft lokal auf dem Fernseher.';
            diagnose(15).then(function (result) {
                if (result.cancelled || diagnosticsPanel !== panel) return;
                function number(value) { return value === null ? 'n/v' : value; }
                var rows = [
                    'ElegantFin TV ' + (config.version || '0.1.3') + ' · ' + result.profile + ' · Chrome ' + result.browserEngine,
                    result.viewport.width + '×' + result.viewport.height + ' · DPR ' + result.viewport.pixelRatio + ' · ' + result.startedAt,
                    'Frames/s: ' + number(result.frameSamplesPerSecond) + ' · längste Pause: ' + number(result.longestFrameMs) + ' ms',
                    'Framepausen >50 ms: ' + number(result.framesOver50Ms) + ' · lange Hauptthread-Aufgaben: ' + number(result.longTaskCount),
                    'Bildanfragen: ' + result.imageRequestsObserved + ' · langsamste: ' + number(result.slowestImageRequestMs) + ' ms'
                ];
                Object.keys(result.images).forEach(function (kind) {
                    var g = result.images[kind];
                    rows.push(kind + ': ' + g.count + ' · ohne Größenparameter: ' + g.uncapped + ' · max. ' + g.maxMs + ' ms · TTFB ' + number(g.maxTtfbMs) + ' ms · ' + Math.round(g.encodedBytes / 1024) + ' KiB');
                });
                rows.push('Bitte Ergebnis fotografieren. Keine Messdaten wurden versendet.');
                rows.push('Cache/CORS können Werte verdecken. n/v = nicht verfügbar.');
                panel.textContent = rows.join('\n');
            });
        }, 5000);
    }

    window.ElegantFinTv = {
        version: config.version || '0.1.3',
        diagnose: diagnose,
        status: function () { return { active: active, tv: isTv(), mediaBarFound: !!bar, profile: root.getAttribute('data-eftv-performance') }; },
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
