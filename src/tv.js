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

    function components() {
        var mode = isTv() && ['reference', 'theme', 'adapter', 'complete'].includes(config.comparisonMode) ? config.comparisonMode : 'normal';
        return { mode: mode, theme: mode !== 'reference' && mode !== 'adapter',
            adapter: mode === 'adapter' || mode === 'complete' || (mode === 'normal' && config.mediaBar === true) };
    }

    function stopMediaBar() {
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
            stopDiagnostics();
            if (link) link.disabled = true;
            return;
        }
        var parts = components();
        if (parts.theme && !link) {
            link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = new URL('tv.css?v=' + encodeURIComponent(config.version || '0.1.4'), assetBase).href;
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
                    'ElegantFin TV ' + (config.version || '0.1.4') + ' · ' + result.components.mode + ' · Lauf ' + measurementRun,
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
        version: config.version || '0.1.4',
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
