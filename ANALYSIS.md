# Analyse und Grenzen

## Weitere Untersuchung und Update 0.1.2.0

Das bereitgestellte Serverlog bestätigt den Start von ElegantFin TV 0.1.1.0 mit `balanced`, Media Bar 3.0.0.2 und File Transformation 3.0.0.1. Die Registrierung unter `index.html` ist erfolgreich. Das Log endet kurz nach dem Verbindungsaufbau und enthält keine einzelnen Bildanfragen mit Dauer. Der Fehler im ScheduledTasks-WebSocket betrifft eine bereits freigegebene CancellationTokenSource; er belegt keine Ursache für langsames Scrollen oder Poster. Auch die `/wwwroot`-Warnung allein erklärt die inzwischen funktionierende Theme-Anzeige nicht. Das private Log wird nicht ins Repository aufgenommen.

Die zusätzlich bereitgestellten lokalen Media-Bar-Quellen zeigen:

- `SlideCreator.buildImageUrl` setzt Tag und Qualität, aber keine Pixelgrößenbegrenzung. `createSlideForItem` fordert Backdrop, Logo und Poster eager an. Welche Bildgrößen tatsächlich geliefert werden, ist damit nicht gemessen.
- `preloadAdjacentSlides` lädt den nächsten Slide auch bei `preloadCount = 0`; diese Einstellung verhindert das Vorladen in diesem Stand nicht.
- Eigene feste Blurwerte und die `.logo.animate`-Animation bleiben vom bisherigen Theme-Variablenprofil unberührt.
- Beim Verlassen der Startseite stoppt die Sichtbarkeitssteuerung den Slideshow-Timer, räumt Spieler und Slides auf. Eine Behauptung, Trailer liefen sicher in der Filmbibliothek weiter, wäre deshalb nicht belegt.
- File Transformation interceptiert hier `/web/`-Antworten, deren relativer Pfad registriert ist. Die regulären `/Items/.../Images/...`-Anfragen laufen nicht durch diese Transformationskette.

Update 0.1.2.0 korrigiert den durch überlagerte Fokusregeln möglichen doppelten Kartenrahmen und reduziert die zusätzlich identifizierten Media-Bar-Effekte. Es ergänzt eine standardmäßig ausgeschaltete lokale Messanzeige für die offizielle TV-App. Die Diagnose verwendet Resource/Long-Task-Observer, falls vorhanden, und zeigt nur aggregierte Werte; sie übermittelt nichts und benötigt keinen Entwicklermodus. Die direkten Bildladeanforderungen und die separat gepflegten Pluginquellen wurden nicht geändert. Weitere Optimierungen sollen anhand der Gerätemessung erfolgen.

## Korrektur 0.1.1.0: Media-Bar-Konflikt

Die erste Version registrierte `(^|[/\\])index\.html$`, die Media Bar hingegen `index.html`. File Transformation führt pro Pfad nur eine passende Verarbeitungskette aus und bevorzugt einen exakten Schlüssel. Deshalb wurde bei gleichzeitig registrierter Media Bar unser Einfügen des Bootstrap-Skripts übersprungen. Dieser Integrationsfehler war von den ersten Einzeltests nicht abgedeckt.

Die Registrierung verwendet jetzt ebenfalls `index.html`. Der neue Integrationstest lädt die unveränderte Upstream-Klasse `WebFileTransformationService` aus Commit `2dd4279bc7aedd082de0639278f9142ead229a52`. Mit `index.html` und `/index.html` reproduziert er den Ausfall der alten Registrierung; mit der korrigierten Registrierung laufen beide Callbacks für diese Pfade sowie `web/index.html`, jeweils in beiden Registrierungsreihenfolgen. Die privaten Media-Bar-Callbacks werden dabei durch eine einfache Skripteinfügung vertreten. Die Verarbeitungskette ist echter Upstream-Code, kein nachgebauter Resolver.

Dieser reproduzierte Fehler passt zur gemeldeten unveränderten TV-Oberfläche. Ohne Serverprotokoll bleibt offen, ob zusätzlich Cache-, Installations- oder andere Integrationsprobleme auf dem konkreten Server vorliegen.

## Ausgangslage

LG C4, offizielle Jellyfin-webOS-App, Jellyfin 12.2, drei Custom-CSS-Dateien und privat angepasste Media Bar auf Basis 3.0. PC-Browser laut Nutzer schnell; auf TV Scrollen und Posteranzeige langsam. Kein Zugriff auf TV, Server oder private Media-Bar-Quellen.

Die webOS-App verwendet die vom Server bereitgestellte Weboberfläche. Eine Pluginverpackung verlagert deren Darstellung nicht auf den Server. Quellen: [Jellyfin webOS](https://github.com/jellyfin/jellyfin-webos), [LG-Webengines](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine).

## Statische Befunde

- Originalgrößen: Haupttheme 214216 Bytes, Modern-Zusatz 108268 Bytes, Media-Bar-Zusatz 10289 Bytes.
- Alle drei verwenden den Schutz `:root:is(.layout-desktop, .layout-mobile):not(.layout-tv)`. Bei aktivem TV-Layout greifen diese Regeln nicht. Bei webOS mit Desktop-Layout dagegen schon.
- Der Media-Bar-Zusatz erzeugt keine Slideshow. Er enthält keine Blur-Filter und keine dauerhaften CSS-Animationen; eine Breiten-Transition der Punkte kann Layoutarbeit erzeugen. Früh gesetzte Masken werden später mit gleichen Selektoren aufgehoben.
- Das Haupttheme definiert Blurwerte bis 20px, Karten-/Backdrop-Übergänge und komplexe Selektoren. Diese sind mögliche Renderingkosten, kein nachgewiesener Engpass auf dem C4.
- Google-Fonts-Import und externe Iconfonts erzeugen zusätzliche Netzabhängigkeiten. Ein Test mit blockiertem Import zeigte, dass dessen Fehlschlag die erste Implementierung der Theme-Aktivierung blockierte. Im fertigen Projekt sind diese Ressourcen lokal eingebettet.
- Die vollständige Material-Symbols-Schrift umfasst 5345176 Bytes. Das TV-Profil verwendet stattdessen den im Originaltheme enthaltenen kleineren Font (122052 Bytes) mit Jellyfins Icon-Fallback. Das reduziert die benötigte Iconfont-Übertragung, ist aber kein Nachweis für die Ursache langsamer Poster. Der Font-Vendorprozess prüft WOFF2-Signaturen, damit keine größere TrueType-Antwort mit falschem Formatbezeichner eingebettet wird.
- Die CSS-Dateien steuern nicht die Downloadplanung, Antwortzeit oder Dekodierung von Jellyfins Postern. Deren Langsamkeit kann nicht allein aus CSS diagnostiziert werden.

## Entscheidung

Eigenständiges Plugin statt Änderungen an bestehenden Dateien. Versionsziel 12.2.0 wurde gegen die verfügbaren NuGet-Pakete gebaut. Die File-Transformation-Registrierung nutzt die dokumentierte Reflexionsschnittstelle; sie verändert nur die ausgelieferte `index.html`-Antwort. Relative Asset-URLs erhalten Jellyfins Base-URL.

Die ursprünglichen Scope-Ausdrücke werden beim Build mit einem Pluginmarker ersetzt. Desktopselektoren werden um TV ergänzt, ohne die tatsächlichen Layoutklassen im DOM umzuschalten. Die Reihenfolge der drei CSS-Dateien bleibt erhalten. Keyframenamen sind getrennt, um das Browsertheme nicht zu überschreiben. Einstellungen und aktive Geräteauswahl entscheiden über das Laden.

Das TV-Profil reduziert ausgewählte Effekte; die Slideshow-Opacity-Transition bleibt bestehen, damit nicht pauschal mögliche `transitionend`-Abhängigkeiten entfernt werden. Das Framework-Scrolling, die Bild-URLs und die Wiedergabe bleiben in der Verantwortung von Jellyfin/Media Bar. Es gibt keine globalen Fetch-/XHR-Patches, Scrollhandler oder wiederholten vollständigen DOM-Scans. Ein Body-Observer entdeckt hinzugefügte Media-Bar-Container; ein lokaler Observer behandelt Slide-Wechsel.

## Geprüft

- Release-Build gegen Jellyfin 12.2.0.
- SHA256 der drei Originaldateien und ihrer Vendor-Kopien.
- CSS-Transformation, TV-Isolation und Font-Checksummen.
- Chromium/Edge-Fixture: Fokus, Enter, D-Pad, Slide-Wechsel, Austausch des Containers, Rückbau, Desktop-/webOS-Erkennung, lokale Fonts und Base-URL.
- C#-Checks: idempotente HTML-Einbindung, deaktivierter Zustand, HTML ohne Head, Linux-/Windows-Pfade, eingebettete Assets, Font-Route und Cacheverhalten der Konfiguration.

## Noch am echten System zu prüfen

- Laden des Plugins durch den konkreten Jellyfin-Server und Registrierung bei dessen File-Transformation-Version.
- Plugin-Einstellungsseite innerhalb des konkreten Jellyfin-Webclients.
- Tatsächliche Modern-/TV-DOM-Struktur und visuelle Abstände auf dem LG.
- D-Pad-Eintritt/Austritt der Media Bar zusammen mit Jellyfins eigenen globalen Tastaturhandlern.
- Abspielen, Details, Favoriten, Zurück, Trailer, Startseite erneut betreten mit der privaten Media Bar.
- Gemessene Scrollgeschwindigkeit und Bildantwortzeiten. Keine Leistungsversprechen aus Desktop-Tests ableiten.

Die Implementierung ist ein installierbarer Stand für diesen Integrationstest, keine Bestätigung der Fehlerursache oder der vollständigen C4-Kompatibilität.
