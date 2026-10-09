# ElegantFin TV für Jellyfin 12.2

Eigenständiges Pluginprojekt für die offizielle Jellyfin-App auf LG webOS. Übernimmt die Gestaltung aus den drei bereitgestellten CSS-Dateien, aktiviert sie auf TVs und ergänzt Fokusbedienung für eine vorhandene Media Bar.

**Status: lokal gebaut und automatisiert geprüft; noch nicht am LG C4 oder mit der privat angepassten Media Bar getestet.** Ein Geschwindigkeitsgewinn ist nicht gemessen. Poster-Anfragen werden nicht verändert; dieses Paket behebt keinen nachgewiesenen Server- oder Netzwerkengpass.

## Update 0.1.1.0

Behebt eine übersprungene Theme-Einbindung bei gleichzeitig installierter Media Bar. Version 0.1.0.0 registrierte eine eigene Regex-Verarbeitungskette; File Transformation bevorzugt jedoch die von Media Bar unter `index.html` registrierte Kette. Beide Plugins verwenden jetzt denselben Schlüssel. Der Konflikt wurde mit der unveränderten Upstream-Verarbeitungsklasse reproduziert und die Korrektur mit beiden Registrierungsreihenfolgen geprüft.

Im Jellyfin-Katalog nach Updates suchen, ElegantFin TV auf **0.1.1.0** aktualisieren und den Server neu starten. Danach die LG-App vollständig beenden und erneut starten, nicht nur zum TV-Startbildschirm wechseln. Der Repository-Link bleibt gleich.

## Enthalten

- Jellyfin-Serverplugin für **12.2.0 / .NET 10** mit eigener Einstellungsseite.
- Einbindung über **File Transformation**, ohne die installierten Jellyfin-Webdateien zu bearbeiten.
- TV-Stylesheet aus unabhängigen Kopien von ElegantFin, dem Jellyfin-12-Modern-Zusatz und dem Media-Bar-Zusatz.
- Erkennung über `layout-tv` oder webOS-User-Agent. Jellyfins Layoutklassen werden nicht verändert.
- Standardprofil **TV / balanced**: keine über die Theme-Variablen gesteuerte Hintergrundunschärfe; weniger dekorative Karten-/Backdrop-Animationen; deutlich sichtbarer Fokus.
- Vergleichsprofil **Volle Theme-Effekte / full**. Fokuskorrekturen bleiben in beiden Profilen aktiv.
- Inter, Archivo Narrow und Material Symbols werden vom eigenen Jellyfin-Server ausgeliefert. Keine externen Schriftanfragen durch das Plugin.
- Das TV-Profil verwendet die kleinere Symbolschrift des Originalthemes mit Jellyfins Icon-Fallback. Die über 5 MB große vollständige Symbolschrift wird nur bei entsprechender Verwendung im Profil **full** benötigt.
- Adapter für `#slides-container`, `.slide.active` und die in der gelieferten CSS-Datei verwendeten Schaltflächen.
- Lokale, manuell gestartete Diagnose ohne Telemetrie.

Die ursprünglichen drei Dateien im übergeordneten Ordner bleiben unverändert. `vendor/` enthält bytegleiche Kopien mit SHA256-Prüfsummen. Das neue Projekt benötigt diese übergeordneten Dateien nicht zum Bauen.

## Installation zum Gerätetest

Für die Installation über Jellyfins Plugin-Katalog ist `manifest.json` vorbereitet:

```text
https://raw.githubusercontent.com/S3NTIN3LOne/jellyfin-elegantfin-tv/main/manifest.json
```

Das Repository und die Release-Downloads sind öffentlich erreichbar. Das Katalogpaket endet auf `-catalog.zip`; das nachfolgend beschriebene Paket ohne diesen Zusatz ist für die manuelle Installation gedacht. Die Voraussetzung File Transformation gilt bei beiden Installationswegen.

1. Im Jellyfin-Dashboard die Serverversion **12.2.0** prüfen. Das Paket ist gegen diese API gebaut; andere Versionen sind nicht freigegeben.
2. Eine zu Jellyfin 12.2 passende Version von [File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation) muss installiert sein. Bei einer Media-Bar-Installation kann sie bereits vorhanden sein. Das Plugin enthält diese Abhängigkeit nicht.
3. Das Paket `artifacts/ElegantFinTV-0.1.1-jf12.2.zip` entpacken. Bei beendetem Jellyfin-Server den enthaltenen Ordner `ElegantFinTV_0.1.1.0` in das **Pluginverzeichnis der aktiven Serverinstallation** kopieren. In Docker ist das üblicherweise `/config/plugins`; bei anderen Installationen den tatsächlich konfigurierten Datenpfad verwenden.
4. Server starten. Im Dashboard unter Plugins **ElegantFin TV** öffnen. Standard: aktiviert, TV-Profil, Media-Bar-Adapter an, „Auch auf Desktop und Mobilgeräten“ aus.
5. Die drei bisherigen CSS-Einbindungen können für den ersten TV-Test bestehen bleiben: Sie schließen `layout-tv` bereits aus. Die Dateien selbst müssen nicht bearbeitet werden. In der LG-App TV-Layout verwenden und die App vollständig schließen/neu starten, damit `index.html` neu angefordert wird.
6. Das vorhandene Media-Bar-Plugin installiert lassen. ElegantFin TV lädt **keine zweite Media Bar** und ersetzt nicht deren Wiedergabe-, Favoriten-, Playlist- oder Trailerlogik.

Falls im TV-Layout trotz Neustart nichts erscheint: Serverprotokoll nach `ElegantFin TV` durchsuchen. Die geplante Aufgabe **ElegantFin TV: Frontend registrieren** kann erneut ausgeführt werden. Eine fehlende/inkompatible File-Transformation-Schnittstelle wird als Fehler gemeldet, statt die Registrierung stillschweigend zu überspringen.

Bei Nutzung des **Desktop-Layouts innerhalb der LG-App** wird das Plugin ebenfalls aktiv; die alten CSS-Einbindungen können dort aber zusätzlich greifen. Für einen aussagekräftigen Vergleich TV-Layout verwenden. Für den späteren vollständigen Wechsel aller Webclients auf das Plugin: Option „Auch auf Desktop und Mobilgeräten“ einschalten und die alten drei Einbindungen im Dashboard entfernen. Die Quelldateien bleiben erhalten. Diese Umstellung wurde hier nicht vorgenommen.

## Vergleich auf dem C4

Immer dieselbe Bibliothek und denselben Navigationsweg verwenden:

1. Plugin deaktiviert, bisherige Oberfläche. App neu laden.
2. Plugin aktiviert, Profil **full**. App neu laden.
3. Plugin aktiviert, Profil **balanced**. App neu laden.

Jeweils erste Anzeige und erneutes Scrollen durch bereits geladene Poster vergleichen. Wenn nur die erste Anzeige langsam ist, Bildanfragen/Server/Netzwerk separat untersuchen. Wenn auch bereits geladene Reihen ruckeln, Rendering und JavaScript näher messen. Ein PC-Browser ist kein Ersatz für diesen Gerätevergleich.

Bei verbundenem webOS-Webinspektor:

```js
ElegantFinTv.status()
// Während der folgenden 10 Sekunden mit der Fernbedienung scrollen:
ElegantFinTv.diagnose(10).then(console.table)
```

Die Diagnose liefert aktive Konfiguration, Frame-Abstände und aggregierte Bildanfragezeiten. Sie enthält keine URLs, Zugangsdaten oder Medientitel. Sie startet keine eigenen Bildanfragen. Browserpuffer, Cache, CORS und Hintergrundbetrieb begrenzen die Aussagekraft; Bilddekodierung und reine Serverzeit werden nicht separat erfasst. Für TTFB, Bildabmessungen und lange JavaScript-Aufgaben den Netzwerk-/Performance-Tab des Inspektors verwenden.

## Media-Bar-Kompatibilität

Der Adapter kennt die Selektoren der gelieferten CSS-Datei. Er ergänzt bei nicht nativen Schaltflächen Rolle/Tabindex, Enter/Leertaste und Navigation innerhalb der Bar. Native Buttons behalten ihre normale Aktivierung. Richtungstasten am Rand und Zurück/Escape werden nicht vom Adapter blockiert. Inaktive `.slide`-Elemente werden nur dann `inert`, wenn eine `.slide.active` erkannt wird. Bei unbekanntem Slide-Markup wird keine Aktivitätskonvention erfunden.

Für die privat geänderte Media Bar 3.0 ist noch ein Integrationstest nötig. Insbesondere globale Tastaturhandler, tatsächliches Markup, Übergänge, Trailer und das Verlassen/erneute Öffnen der Startseite prüfen. Die Integration schaltet **keine unbekannten internen Timer ab**. Unsichtbare Trailer oder automatische Bildwechsel können deshalb weiterhin Last erzeugen. Anpassungen daran benötigen den tatsächlichen Quellcode der verwendeten Media Bar.

## Rückbau

Im Plugin **Theme aktivieren** ausschalten und die LG-App vollständig neu laden. Das deaktiviert das Frontend. Zur vollständigen Entfernung Jellyfin beenden, nur den neuen Pluginordner entfernen und Jellyfin neu starten. Die ursprünglichen CSS-Einbindungen, die Media Bar und die Jellyfin-Webdateien wurden durch dieses Projekt nicht geändert.

## Entwicklung

Voraussetzungen: Node.js 22 oder neuer, .NET SDK 10, für Browserchecks Chromium/Edge.

```powershell
npm ci
npm run build
npm test
dotnet build ElegantFinTv.sln -c Release
dotnet run --project tests/ServerChecks -c Release
powershell -ExecutionPolicy Bypass -File tools/test-file-transformation.ps1
powershell -ExecutionPolicy Bypass -File tools/package.ps1
```

`EFTV_BROWSER` kann auf eine Chromium-/Edge-Programmdatei zeigen. Unter Windows nutzen die Tests andernfalls ein installiertes Edge; alternativ `npx playwright install chromium` ausführen. Die Browserchecks laufen headless und verwenden eine synthetische Media-Bar-Seite, keinen Jellyfin-Server.

Die Shader-/CSS-Änderungen stehen in `src/tv-overrides.css`, der Frontend-Adapter in `src/tv.js`, der C#-Teil in `src/Jellyfin.Plugin.ElegantFinTv/`. `tools/build.mjs` erzeugt die eingebetteten Assets aus `vendor/` und den Anpassungen. Nicht direkt `Web/tv.css` oder `Web/tv.js` bearbeiten.

Normale Builds laden keine Schriftdateien aus dem Internet. Nur `node tools/fetch-fonts.mjs` aktualisiert den Font-Vendorbestand ausdrücklich. Abhängigkeiten sind in `package-lock.json` fixiert.

Siehe [ANALYSIS.md](ANALYSIS.md) für die Befunde und [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) für Quellen/Lizenzen.
