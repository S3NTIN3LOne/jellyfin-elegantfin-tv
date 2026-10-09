# Quellen und Lizenzen

Die drei Dateien in `vendor/` stammen aus dem vorhandenen Nutzerprojekt und wurden unverändert kopiert. Die abgeleitete TV-CSS wird mit dem vollständigen Quellbestand bereitgestellt.

- **ElegantFin / lscambo13**, v26.09.05: [Projekt](https://github.com/lscambo13/ElegantFin), GPL-2.0. Betrifft Haupttheme und den Media-Bar-Theme-Zusatz. Urheberhinweise bleiben in den Quellen und der erzeugten CSS erhalten.
- **ElegantFin for Jellyfin 12 Modern / mihaif7**, v26.10.07: [Projekt](https://github.com/mihaif7/elegantfin-jf12), GPL-2.0 laut Dateikopf und Projektlizenz.
- **Inter**: The Inter Project Authors, SIL Open Font License 1.1, siehe `vendor/fonts/Inter-OFL.txt`.
- **Archivo Narrow**: siehe Urheberangaben und SIL Open Font License 1.1 in `vendor/fonts/ArchivoNarrow-OFL.txt`.
- **Material Symbols Rounded**: Google, Apache License 2.0, siehe `vendor/fonts/MaterialSymbols-Apache-2.0.txt`.

Downloadquellen und SHA256-Prüfsummen aller gebündelten Fontdateien stehen in `vendor/fonts/sources.json`. Fontdateien wurden nicht verändert; CSS-Verweise wurden für lokale Auslieferung angepasst.

Neue Plugin-/Frontend-/Builddateien und abgeleitete Theme-Anpassungen dieses Projekts stehen unter GPL-2.0; vollständiger Text in `LICENSE`. Fontdateien behalten ihre eigenen Lizenzen. NPM-/NuGet-Entwicklungsabhängigkeiten behalten ihre jeweiligen Lizenzen und werden nicht als Bibliotheken im Pluginpaket ausgeliefert.

Das Projekt enthält keinen kopierten Media-Bar-JavaScriptcode und keine Kopie des File-Transformation-Plugins. Beide bleiben separat installierte Komponenten. Die Integration orientiert sich an der dokumentierten File-Transformation-Schnittstelle und den Selektoren der vom Nutzer gelieferten CSS-Datei.
