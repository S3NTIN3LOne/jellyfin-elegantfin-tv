# Analyse und Grenzen

## Einstellungen 0.1.12.0

Der persönliche Schalter wird neben Jellyfins Theme-Auswahl in das Anzeigeformular eingefügt. Er verwendet eine eigene DisplayPreferences-ID und den Client-Namensraum `ElegantFinTv`, ohne andere Anzeigeeinstellungen zu überschreiben. Lesen und Schreiben laufen über den angemeldeten ApiClient; es werden keine Tokens oder globalen Plugin-Konfigurationen im Browser gespeichert. Antworten werden mit einer Generationsnummer dem jeweiligen Konto zugeordnet, damit verspätete Antworten nach einem Benutzerwechsel keinen fremden Zustand anwenden.

Die Einstellungen werden unabhängig von der aktiven Theme-Laufzeit beobachtet, damit ein deaktiviertes Theme wieder aktiviert werden kann. Fehlgeschlagene Schreibvorgänge lassen den zuletzt gespeicherten Zustand unverändert. Bei Lesefehlern ist der Schalter gesperrt und zeigt einen Fehler. Die bestehenden Dispose-Pfade entfernen Theme, Navigation, Layoutkorrektur und Fokusadapter; die separate Media Bar bleibt bestehen.

Die drei Debug-Properties sind aus Serverkonfiguration und Bootstrap-Daten entfernt. Alte XML-Felder werden beim Deserialisieren ignoriert. Interne Diagnose-/Vergleichsroutinen bleiben für bestehende Entwicklungstests im Quellcode, werden aber nicht mehr über Plugin-Einstellungen aktiviert. Tests prüfen sowohl die Migration als auch die neue Benutzeroberfläche.

## Korrekturen 0.1.10.0

Der zuvor negative Outline-Offset war keine zuverlässige Lösung für positionierte Bild-/Overlayebenen. Der Rahmen wird nun als absolute, nicht interaktive Pseudoebene über diesen Kindern gezeichnet, weiterhin innerhalb der Kartenbegrenzung. Der Regressionstest rendert ein Bild mit eigenem z-index und prüft die tatsächlichen Screenshot-Pixel der weißen Linie und der dunklen Kontrastkante.

Media Bar kombiniert `frostedGlass` (animierter Filter) mit `kenBurnsZoomIn`. Das schlanke TV-Theme ersetzt diese Kombination durch eine reine Transform-Animation mit linearer Zeitfunktion. Dies reduziert die zu animierenden Eigenschaften; eine Verbesserung der tatsächlichen TV-Frametimes wurde hier nicht gemessen.

Die verschiedenen Bar-Layouts bringen eigene Plot-Clamps und schrumpfende Plotcontainer mit. Das Theme vereinheitlicht drei Zeilen, nicht schrumpfenden Textcontainer, kompakte Metadaten und unten sitzende Aktionen. Die Vorschaupunkte wechseln nach oben links. Server-, Client- und CSS-Standardhöhe von Media Bar werden in 3.0.0.4 auf 50 Prozent angehoben, ohne bestehende gespeicherte Einstellungen zu überschreiben. Das Branding verwendet das unveränderte offizielle Jellyfin-SVG aus `vendor/jellyfin` als eingebettete CSS-Grafik; der Startseitenlink bleibt ein separater Fokuspunkt.

## Korrekturen 0.1.9.0

Die vorherigen Tests hatten native Clipping- und Seitencontainer nicht ausreichend abgebildet. Jellyfin-Web (Referenzcommit `fb9fff44b0c1280d44c8364577383d47e40c7bc2`, `src/styles/librarybrowser.scss`) setzt auf `.skinHeader` tatsächlich `contain: layout style paint`. `overflow: visible` allein hebt dieses Clipping nicht auf. Die korrigierte Ebene bleibt innerhalb der Headerhöhe und blendet nach unten aus; Paint-Containment entfällt. Die nativen 1,3-fachen Fokusvergrößerungen von Iconbuttons und Tabs werden nur im Header durch innenliegende Ringe ersetzt. Karten behalten ihren nativen Zoom, der Ring liegt jetzt innen.

Media Bar hängt `#slides-container` direkt an `body`; die Startseitenkarten liegen dagegen in Jellyfins Seiten-/Fokuscontainern. Eine gezielte Capture-Behandlung verbindet nur die oberste Kartenreihe mit der Bar und bietet einen Rückweg zum Ausgangselement. Modifizierte Tasten, Dialoge, Formulare und tiefere Reihen werden nicht übernommen.

Die feste Abstandsformel mit `--slideshow-page-offset` berücksichtigt verschachteltes Padding und Abschnittsüberschriften nicht zuverlässig. Eine zusätzliche, auf das schlanke Theme begrenzte Layoutkorrektur verwendet die gerenderten Positionen, rechnet Scrollpositionen der Vorfahren heraus und aktualisiert eine eigene CSS-Variable am sichtbaren Reihencontainer. ResizeObserver und relevante DOM-/Seitenereignisse lösen die Korrektur aus; eigene Styles werden beim Abschalten zurückgenommen. Tests decken verschachteltes Padding, verspätete Titel, Größenänderungen während des Scrollens und das Einpendeln ohne erneute Styleänderungen ab. Ein Zugriff auf den laufenden TV-Client liegt nicht vor.

## Korrekturen 0.1.8.0

Das minimale Theme reservierte unabhängig von der Media-Bar-Einstellung 62 vh. Höhe und Reihenabstand lesen jetzt gemeinsam `--slideshow-tv-height`, das Media Bar auf dem Dokument veröffentlicht. Der Regressionstest verändert diese Einstellung mehrfach und prüft den konstanten Abstand mit dem nativen Seitenoffset.

Der bisherige 1-Pixel-Kartenrahmen war auf dem TV zu schwach. Jetzt wird ein weißer 3-Pixel-Rahmen mit einer dunklen 1-Pixel-Außenkante verwendet, ohne den nativen 0,5-em-Rahmen wieder einzuführen. Die Header-Unschärfe wird auf eine maskierte Pseudoebene verschoben; nur diese Ebene reicht 2 rem über die Kopfzeile hinaus und blendet aus. Es gibt keine zusätzlichen Beobachter, Timer oder animierten Filter.

## Korrekturen 0.1.7.0 und Media Bar 3.0.0.3

Die TV-Fotos zeigen überlagernde `.headerTabs`, eine abgeschnittene letzte Bibliothek, überlappende Media-Bar-Pfeile und weiterhin breite türkisfarbene Kartenrahmen. Die bisherige Test-Fixture enthielt weder die native TV-Rahmenregel noch die großen TV-Pfeile und die absolut positionierten Kopfzeilen-Tabs. Die neuen Regressionstests enthalten diese konkurrierenden Regeln und prüfen ihre tatsächliche berechnete Geometrie bei großen Schriften.

Jellyfin verwendet für `.card.show-focus:not(.show-animation)` einen 0,5-em-Rahmen an `.cardScalable` beziehungsweise `.cardBox.visualCardBox`. Die bisherige Schattenkorrektur reichte deshalb nicht aus. Die Kartenbreiten und native Zoomanimation bleiben erhalten; der zusätzliche Rahmen entfällt. Graue Platzhalter und Blurhash-Ebenen werden am gemeinsamen Bildradius beschnitten.

Die Kopfzeile wird fest positioniert. Home-/Favoriten-Tabs werden nur auf diesen Routen ausgeblendet, andere Seiten-Tabs darunter angeordnet. Lange Bibliothekslisten umbrechen. Ein ResizeObserver erfasst nur die Kopfzeilenhöhe; kein Scroll-Polling. Die ausdrücklich gewünschte Unschärfe bleibt auf die Kopfzeile begrenzt. Deren tatsächliche Renderingkosten auf dem LG sind noch offen.

In der lokalen und veröffentlichten Media Bar 3.0.0.2 wurde ein separater Fehler gefunden: `loadSlideshowData` stoppt den neu erzeugten `SlideTimer` und setzt `STATE.slideshow.slideInterval` auf `null`. Ein Regressionstest scheitert vor der Änderung genau an dieser fehlenden Referenz und besteht nach deren Erhalt. Die vorhandene `updateCurrentSlide`-Logik darf den Timer dadurch wieder starten. Kein zusätzlicher Timer im Theme und keine Änderung an der Trailer-Endelogik. Für die Media-Bar-Korrektur wird ein isolierter Checkout unter `.tools/media-bar-fix` verwendet; das ursprüngliche lokale Projekt bleibt unverändert.

## Verfeinerung 0.1.6.0 nach positivem TV-Test

Der Nutzer meldet für das schlanke Design deutlich bessere Performance. Gewünscht sind nun ein dünner weißer Fokusrahmen, eine eingerückte Media Bar und eine transparente Navigation mit Bibliothekslinks entsprechend drei Browser-Referenzbildern. Umsetzung im schlanken Profil: 1-Pixel-Fokuslinie, Entfernung des zusätzlichen Kartenbox-Fokusschattens, Media-Bar-Geometrie und statische Transparenz ohne Blur. Layoutklassen, Kartenbreiten und Jellyfins Bewegungen bleiben erhalten.

Die TV-Leiste übernimmt Bibliothekslinks aus `.mainDrawer .libraryMenuOptions`, ergänzt Home und den Favoriten-Tab und behält vorhandene Kopfzeilenaktionen. Der [Jellyfin-Header](https://github.com/jellyfin/jellyfin-web/blob/master/src/scripts/libraryMenu.js) und die [Home-Tabs](https://github.com/jellyfin/jellyfin-web/blob/master/src/apps/legacy/controllers/home.js) wurden als Integrationsreferenz gelesen; sie sind kein Nachweis des exakten installierten Clientstands. Die moderne Oberfläche hat einen versteckten Legacy-Header und bekommt keine doppelte Navigation. Fehlende Bibliothekslinks werden nicht mit erfundenen IDs ersetzt. Beobachtung ist ereignisbasiert; nach dem Einfügen werden gewöhnliche Poster-/Slide-Mutationen ohne Unterbaumsuche verworfen. Bei Deaktivierung werden Leiste und Observer entfernt.

Die lokal vorhandenen Media-Bar-Quellen wurden nur gelesen. Sie enthalten inzwischen auch neuere Layoutvarianten; der tatsächlich installierte Stand ist damit nicht bestätigt. Die Anpassung nutzt die bekannten v3+-Klassen `slide-content`, `logo-container`, `plot-container`, `dots-container` und `arrow`. Bild-URLs, Downloadplanung und Wiedergabehandler werden nicht verändert. Noch zu prüfen: D-Pad-Wechsel zwischen Header, Hero und Medienreihen im echten Client, Serverbibliotheken, Trailer, genaue Abstände und die Performance mit transparenter Kopfzeile.

## TV-Vergleich vom 10.10.2026 und schlankes Design 0.1.5.0

Auf der Startseite wurden in Version 0.1.4.0 Referenz und Nur Theme verglichen, jeweils ohne Fokusadapter. Referenz: 37 Frame-Aufrufe/s, 42 Pausen über 50 ms, 56 lange Aufgaben mit insgesamt 6337 ms in 15,9 s. Nur Theme (balanced): 11 Frame-Aufrufe/s, 70 Pausen, 83 lange Aufgaben mit insgesamt 11666 ms in 15 s. Die langsamsten erfassten Bildanfragen lagen bei 38/54 ms. Die aggregierten komprimierten Bilddaten unterschieden sich mit 1161/5859 KiB deutlich; Cache und Bildauswahl sind nicht kontrolliert. Der Nutzer beschreibt die Referenz mit und ohne Diagnose als gleichermaßen flüssig.

Damit ist der Fokusadapter für den beobachteten Einbruch nicht erforderlich. Einzelne CSS-Regeln oder Bilddekodierung sind als Ursache noch nicht nachgewiesen. Die Messung zählt requestAnimationFrame-Aufrufe, keine direkt gemessenen GPU-Frames. CSS-Hintergrundbilder fehlen in den Größenstichproben.

Auf Wunsch des Nutzers wird das Design ab 0.1.5.0 im Standardprofil eigenständig und minimal aufgebaut. Farben, Inter-Schrift, Rundungen und Fokusmarkierung bleiben am Custom CSS orientiert; Layout und Bewegung stammen aus Jellyfin. Der Build erzeugt getrennte Dateien für das schlanke Standardprofil und das vollständige Vergleichsprofil. Das Standardprofil lädt keine der drei transformierten Desktop-CSS-Dateien und keine zusätzliche Iconschrift. Die Ausgangsdateien und Vendor-Kopien bleiben unverändert.

Geprüft: 21 Frontendchecks einschließlich nativer Kartenbreite, Fokus-Zoom, Übergängen, Media-Bar-Slide-Transition, getrenntem Laden der Profile, Fokusbedienung, Diagnose und Rückbau; Release-Build und Serverchecks einschließlich beider eingebetteter CSS-Routen. Die Browserchecks verwenden eine synthetische Fixture. Eine optische Abnahme in der tatsächlichen Jellyfin-Oberfläche und ein Performancevergleich auf dem LG stehen aus.

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
