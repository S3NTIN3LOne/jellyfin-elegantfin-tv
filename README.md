# ElegantFin TV für Jellyfin 12.2

## Update 0.1.16: Auswahldialoge und Profilansichten

- „Abbrechen“ steht in nativen Auswahldialogen unter der Liste. Der Button
  überdeckt keine Titel oder Beschreibungen mehr, etwa bei Watch Together und
  ausgeblendeten Medien. Der separate TV-Zurück-Pfeil behält seine Position.
- „Passwort zurücksetzen“ wird auf der persönlichen Profilseite auch dann
  ausgeblendet, wenn nur die persönlichen Seitenklassen vorhanden sind.
  „Passwort speichern“ und die Reset-Aktion im Adminbereich bleiben verfügbar.

Für Browser den bisherigen Zusatzimport ersetzen und vor normale CSS-Regeln setzen:

```css
@import url("https://cdn.jsdelivr.net/gh/S3NTIN3LOne/jellyfin-elegantfin-tv@v0.1.16/desktop/jellyplus-support.css");
```

Danach vollständig neu laden. Für TV das Plugin aktualisieren und Server sowie
App neu starten. Jelly+ 0.1.5.0 kann weiterverwendet werden; dieses Release
benötigt keine neue Script-Version.

Geprüft: 45 Browser-Tests einschließlich Dialoggeometrie, Tastatur-Abbruch und
Profilvarianten sowie Serverchecks und Release-Build. Der Test auf einem echten
LG-TV steht weiterhin aus.

## Update 0.1.15: Begrenzte Saisoneffekte und Profilkorrekturen

- Browser-Saisoneffekte enden an der Unterkante von Media Bar/„Meine Medien“.
  Die Grenze folgt Scrollen, Größenänderungen und nachgeladenen Reihen.
- Auf der persönlichen Profilseite ist „Passwort zurücksetzen“ ausgeblendet.
  „Passwort speichern“ bleibt im normalen Formularfluss; Admin-Reset bleibt verfügbar.
- Die Bibliotheken innerhalb von „Meine Medien“ folgen der gespeicherten
  Jellyfin-Reihenfolge ohne eigene Sortierung.

Für Browser den bisherigen Jelly+-Import ersetzen:

```css
@import url("https://cdn.jsdelivr.net/gh/S3NTIN3LOne/jellyfin-elegantfin-tv@v0.1.15/desktop/jellyplus-support.css");
```

Jelly+ 0.1.5.0 lädt das neue Saison-Script automatisch. Bei eigener Script-Einbindung
die Version in der URL ebenfalls auf `v0.1.15` ändern. CSS allein lädt kein Script.
TV-Plugin und gegebenenfalls Jelly+ aktualisieren, danach Server und Apps neu starten.
Geprüft: 44 Browser-Tests, Serverchecks und Release-Build. Ein Test auf dem LG steht aus.

## Update 0.1.14: Einheitliche Jelly+-Empfehlungskarten

Die saisonalen Jelly+-Empfehlungen verwenden die Größenstufen, Abstände und
Rundungen der normalen ElegantFin-Filmkarten. Poster behalten das 2:3-Format;
lange Titel werden gekürzt und verbreitern die Seite nicht. Die Anpassungen
sind in beiden TV-Profilen und der separaten Browser-Datei enthalten.

Für Browser den bisherigen Jelly+-Import durch diesen ersetzen:

```css
@import url("https://cdn.jsdelivr.net/gh/S3NTIN3LOne/jellyfin-elegantfin-tv@v0.1.14/desktop/jellyplus-support.css");
```

Fehlende Jelly+-Optionen in der modernen Oberfläche erfordern eine Erweiterung
von Jelly+ selbst. Im klassischen Webclient bleiben die vorhandenen Optionen
auch mit Theme sichtbar. Dies wurde mit dem tatsächlichen lokalen Jelly+-Script
mit und ohne Theme geprüft. Der Vergleich wird beim Testlauf übersprungen,
wenn der benachbarte Jelly+-Quellcode fehlt.

Geprüft: 39 TV-Frontendtests, zwei Jelly+-Integrationstests einschließlich
Kartengrößen bei 390, 600, 1280 und 1920 Pixeln sowie Serverchecks und Build.
Nach dem TV-Plugin-Update Server und TV-App neu starten.

## Update 0.1.13: Jelly+-Integration und Player-Fokus

- Jelly+ 0.1.x: Dialoge, Profiloptionen und Poster erhalten passende Farben und
  innenliegende Fokusrahmen. Von der obersten Jelly+-Posterreihe führt Pfeil nach
  oben zur Media Bar; Pfeil nach unten kehrt zur gewählten Karte zurück.
- Der Fokusrahmen der Player-Kopfzeilenbuttons liegt innerhalb des Buttons und
  wird nicht mehr durch den OSD-Container abgeschnitten.
- Wiedergaberegler erhalten keinen rechteckigen Fokusrahmen. Der Reglerknopf
  behält eine sichtbare Fokusmarkierung.

Die CSS-Korrekturen sind in beiden TV-Profilen enthalten. Geprüft mit 39
Frontendtests; ein Test auf dem echten LG-Gerät steht noch aus.
Desktop-/Mobil-Erweiterungen liegen unter `desktop/` und als separate Release-Dateien
bereit. Installation: [Saison-Effekte und Jelly+](desktop/README-seasonal.md).
Nach dem Plugin-Update Server und TV-App neu starten.

Eigenständiges Pluginprojekt für die offizielle Jellyfin-App auf LG webOS. Übernimmt die Gestaltung aus den drei bereitgestellten CSS-Dateien, aktiviert sie auf TVs und ergänzt Fokusbedienung für eine vorhandene Media Bar.

**Status: Version 0.1.16.0 korrigiert native Auswahldialoge und weitere persönliche Profilansichten.** Installation über den bestehenden Plugin-Katalog oder das [GitHub-Release](https://github.com/S3NTIN3LOne/jellyfin-elegantfin-tv/releases/tag/v0.1.16). Media Bar bleibt auf **3.0.0.4**.

## Update 0.1.12.0: Persönlicher Theme-Schalter

Unter **Benutzereinstellungen → Anzeige → ElegantFin TV aktivieren** kann jeder Nutzer das Theme ausschalten und wieder einschalten. Die Auswahl wird sofort über Jellyfins DisplayPreferences-API für das angemeldete Benutzerkonto auf dem Server gespeichert. Andere Geräte übernehmen sie beim nächsten vollständigen Laden der App. Der Schalter bleibt auch bei ausgeschaltetem Theme verfügbar; CSS, eigene Navigation und Fokusadapter werden beim Abschalten zurückgenommen. Die separat installierte Media Bar wird dadurch nicht deaktiviert.

Der zentrale Schalter unter **Dashboard → Plugins → ElegantFin TV → TV-Theme aktivieren** bleibt zusätzlich bestehen. Ist das Plugin zentral deaktiviert, kann ein persönlicher Schalter es nicht übersteuern. Media-Bar-Fokusbedienung und die Option für Desktop-/Mobilclients bleiben als Admin-Einstellungen erhalten.

**Darstellung, Diagnose und Vergleichsmodus entfallen aus den Plugin-Einstellungen.** Alte gespeicherte Werte werden ignoriert; das schlanke TV-Theme läuft im Normalbetrieb. Die älteren Update-Abschnitte unten beschreiben historische Versionen und deren damalige Debug-Optionen.

Nach dem Plugin-Update Server und TV-App neu starten. Danach wirkt der persönliche Schalter ohne App-Neustart. Geprüft: 37 Frontendtests einschließlich Speicherung, erneutem Laden, Benutzerwechsel, veralteten Antworten und Netzwerkfehlern; außerdem Serverchecks einschließlich alter Konfigurationsdateien. Der Test der Einstellungsseite auf dem LG steht aus.

## Update 0.1.11.0: Kompaktere Kopfzeile

- Rechte Kopfzeilenaktionen wie Suche und Profil erhalten kleinere Schaltflächen und Symbole. Profilbilder passen ohne zusätzliche Vergrößerung in ihren Button.
- Die zusätzlichen nativen Home-/Zurück-Buttons werden ausgeblendet, solange die eigene Bibliotheksnavigation vorhanden ist. Der eigene Startseite-Button bleibt verfügbar; die Zurück-Taste der Fernbedienung bleibt nativ.
- Kleinere Abstände und kompaktere Bibliothekslinks schaffen zusätzlichen Platz. Bei sehr vielen oder langen Bibliotheksnamen bleibt ein Umbruch möglich, statt Links abzuschneiden.

ElegantFin TV auf 0.1.11.0 aktualisieren und Server sowie TV-App neu starten. Kein weiteres Media-Bar-Update erforderlich. Geprüft: 34 Frontendtests, darunter eine einzeilige Navigation bei 1920×1080 mit fünf Bibliotheken und fünf rechten Aktionen auf Startseite und Bibliotheksseite, sowie Serverchecks und Build. Die konkrete Darstellung auf dem LG steht noch zur Prüfung aus.

## Update 0.1.10.0: Fokus, Vorschau und Branding

- Der innenliegende weiße 3-Pixel-Fokusrahmen liegt jetzt auf einer eigenen Ebene über Bild und Overlay. Eine dunkle Innenkante verbessert den Kontrast auf hellen Bildern. Bibliotheksbuttons erhalten ebenfalls einen deutlichen Innenrahmen.
- Der TV-Vorschauzoom verwendet eine gleichmäßige, reduzierte Vergrößerung von 1 auf 1,06 über 12 Sekunden. Die zusätzliche animierte Unschärfe entfällt; die aktive Bildfläche erhält einen Compositor-Hinweis. Reduzierte Bewegung wird berücksichtigt. Ob der Zoom auf dem LG damit ausreichend flüssig ist, muss am Gerät geprüft werden.
- Drei Textzeilen, breiterer Inhaltsbereich und kompaktere Metadaten schaffen mehr Platz für die Zusammenfassung. Play/Info/Favorit sitzen weiter unten. Die Vorschaupunkte stehen oben links.
- Das offizielle Jellyfin-Symbol und der Schriftzug sind links reine Dekoration. Ein separater Button „Startseite“ übernimmt die Navigation. Das Symbol ist lokal eingebettet und benötigt keine externe Anfrage.
- Der Theme-Rückfallwert beträgt 50 vh. Media Bar 3.0.0.4 verwendet in neuen Konfigurationen ebenfalls 50 Prozent. Bei bestehenden Installationen die gespeicherte Einstellung **TV bar height auf 50** setzen; benutzerdefinierte Werte werden nicht automatisch überschrieben.

Beide Updates installieren, Server und TV-App vollständig neu starten. Das schlanke TV-Profil verwenden. Validierung: 33 Frontendtests einschließlich Bildpixel-Prüfung des Fokusrahmens, drei Textzeilen bei 720p/1080p und aller drei Bar-Layouts, reduzierte Bewegung und dekorative Navigation; außerdem Serverchecks und 8 Media-Bar-Tests. Ein Test auf dem konkreten TV steht aus.

## Update 0.1.9.0: Scrollcontainer und Bibliotheksnavigation

- Der weiße 3-Pixel-Kartenrahmen liegt innerhalb des Bildes. Dadurch kann der Scrollcontainer ihn am linken Rand nicht mehr abschneiden. Bibliotheksbuttons erhalten ebenfalls einen innenliegenden Fokus.
- Pfeil nach oben aus der obersten Startseitenreihe führt direkt zum sichtbaren Play-Button der Media Bar. Pfeil nach unten aus den unteren Bar-Aktionen führt zum zuvor ausgewählten Element zurück. Die Navigation zwischen tieferen Reihen bleibt nativ. Dafür muss der Media-Bar-Adapter eingeschaltet sein.
- Der Abstand zur ersten sichtbaren Startseitenüberschrift wird anhand ihrer tatsächlichen Position zur Bar korrigiert, einschließlich verschachtelter Seitenabstände und Überschriften-Padding. Der Zielabstand beträgt 0,75 rem. Größenänderungen und nachgeladene Abschnitte werden ereignisgesteuert berücksichtigt; es gibt keine laufende Messschleife beim Scrollen.
- Die native Kopfzeile verwendet `contain: paint`, das den bisherigen Verlauf abgeschnitten hat. Die Theme-Kopfzeile behält Layout-/Style-Containment, entfernt Paint-Containment und blendet die Unschärfe innerhalb der letzten 2 rem der Kopfzeile aus. Sie reicht nicht mehr unter die Kopfzeile in die Filter hinein.
- Home-/Zurück-Buttons und Bibliotheks-Tabs erhalten einen innenliegenden Fokus ohne native Vergrößerung. Der aktive Tab behält eine eigene Hintergrundmarkierung; der Tastaturfokus bleibt davon unterscheidbar.

ElegantFin TV aktualisieren, Server und TV-App vollständig neu starten. Media Bar bleibt auf 3.0.0.3. Die Änderungen gelten für das schlanke Standardprofil. Validiert: 31 Frontendtests, Serverchecks und Release-Build sowie Browser-Vorschauen mit beschnittenen Containern. Die konkrete Darstellung und Fernbedienung auf dem LG müssen noch geprüft werden.

## Update 0.1.8.0: Höhe, Fokus und weicher Header-Übergang

- Media-Bar-Höhe und Abstand der folgenden Startseitenzeilen verwenden dieselbe `TV-Bar-Height` aus dem Media-Bar-Plugin. Ohne veröffentlichte Höheneinstellung bleiben 62 vh der Rückfallwert. Der Abstand unter der Bar bleibt beim Verkleinern konstant.
- Ausgewählte Film-/Serienkarten erhalten einen weißen 3-Pixel-Rahmen mit einer zusätzlichen dunklen Außenkante von 1 Pixel. Andere Schaltflächen erhalten 2 Pixel. Der native breite TV-Rahmen bleibt entfernt.
- Die Hintergrundunschärfe liegt auf einer eigenen, nicht anklickbaren Ebene. Sie blendet über 2 rem unterhalb der Kopfzeile aus; Navigation und Text bleiben vollständig sichtbar.

ElegantFin TV auf **0.1.8.0** aktualisieren und Server sowie TV-App neu starten. Diese Änderungen benötigen kein weiteres Media-Bar-Update. Sie gelten für das schlanke Standardprofil.

Validiert: 28 Frontendtests einschließlich wechselnder Bar-Höhen bei 1080p und 720p, Serverchecks und Release-Build. Der Verlauf wurde zusätzlich in einer Browser-Vorschau geprüft; der Test auf dem LG steht aus.

## Update 0.1.7.0: Korrekturen nach TV-Rückmeldung

- Auf Startseite und Favoriten entfallen die doppelten nativen Kopfzeilen-Tabs. Bibliotheks-Tabs, etwa Live-TV-Programme und Aufnahmen, stehen in einer separaten Zeile darunter.
- Bibliothekslinks umbrechen bei Platzmangel vollständig in eine weitere Zeile. Die Höhe der Kopfzeile wird bei Größenänderungen erfasst und für den Abstand zur Media Bar verwendet.
- Die Kopfzeile bleibt beim Scrollen oben sichtbar. Die gewünschte Hintergrundunschärfe ist auf diese kleine Fläche begrenzt (8 px); ihre Performance auf dem LG muss erneut geprüft werden.
- Obere Media-Bar-Schaltflächen und die beiden Pfeile erhalten einheitliche Größen und daraus berechnete Abstände. Selektierte Play-/Info-/Favoriten-Schaltflächen werden nicht mehr durch den Inhaltscontainer abgeschnitten.
- Der native TV-Kartenrahmen von 0,5 em wird entfernt. Eine einzelne weiße 1-Pixel-Linie bleibt sichtbar. Bild, grauer Platzhalter und Blurhash-Ebene erhalten dieselben Rundungen und werden am Bildcontainer beschnitten.

Der stehende Vorschauwechsel hat eine separate Ursache: Media Bar 3.0.0.2 stoppt nach dem Laden den Timer und setzt die Referenz auf `null`. Der Timer kann danach nicht wieder gestartet werden. **Media Bar 3.0.0.3** behält ihn für den vorgesehenen Start nach dem Rendern beziehungsweise nach einem fehlgeschlagenen Trailer. Die Korrektur liegt im Media-Bar-Plugin, nicht in einem zusätzlichen Theme-Timer.

Beide Plugins aktualisieren: **ElegantFin TV 0.1.7.0** und **Media Bar 3.0.0.3**. Danach Server und TV-App vollständig neu starten. Die vorhandenen Repository-Links bleiben gültig. Falls das Media-Bar-Repository fehlt, unter Plugins → Repositorys ergänzen:

```text
https://github.com/S3NTIN3LOne/jellyfin-plugins/releases/latest/download/manifest.json
```

Geprüft: 27 Frontendchecks, Serverchecks und Release-Build; zusätzlich 8 Media-Bar-Tests einschließlich Timer-Erhalt, mehrfacher Fortschaltung, Pause, Trailerende und Seitensichtbarkeit. Die Oberflächentests berücksichtigen große TV-Schriften, native Kartenrahmen, überlagernde Seiten-Tabs und native große Pfeilbuttons. Eine Prüfung direkt auf dem LG steht aus.

## Update 0.1.6.0: Fokus, Media Bar und Navigation

- Weißer Fokusrahmen mit 1 CSS-Pixel statt 3 Pixeln. Der zusätzliche Fokus-Schatten an der Kartenbox entfällt; Jellyfins Fokus-Zoom bleibt erhalten.
- Eingerückte Media Bar mit abgerundeten Ecken, 62 vh Höhe, links angeordnetem Inhalt, zweizeiliger Beschreibung, hellem pillenförmigem Play-Button, runden Nebenaktionen, Punkten unten links und Pfeilen unten rechts. Bestehende Slide-Übergänge bleiben erhalten.
- Transparente Kopfzeile mit statischem dunklem Verlauf zur Lesbarkeit, ohne Hintergrundunschärfe.
- Im klassischen TV-Header werden Startseite, Favoriten und Bibliotheken ergänzt. Namen, Reihenfolge, Symbole und Bibliotheksziele stammen aus den vorhandenen Benutzer-Menülinks. Such-, Benutzer- und andere native Kopfzeilenaktionen bleiben bei Jellyfin. Die moderne Browser-Navigation wird nur gestaltet und erhält keine zweite Leiste. Lange Bibliothekslisten können horizontal scrollen.

Die Änderungen gelten für das schlanke Standardprofil (`balanced`). Das vollständige Vergleichsprofil bleibt unverändert. Es wird weiterhin kein komplettes Desktop-Theme geladen; das Standard-CSS umfasst jetzt rund 11 KB einschließlich Fontdefinitionen. Die Header-Ergänzung benötigt keine zusätzlichen Serveranfragen. Die Original-CSS-Dateien und das separate Media-Bar-Plugin werden nicht verändert.

Im Jellyfin-Plugin-Katalog auf **0.1.6.0** aktualisieren, Server und TV-App vollständig neu starten. Darstellung **„TV: schlankes Design mit Jellyfin-Animationen“**, Vergleichsmodus **Normalbetrieb** wählen. Zum isolierten Themevergleich ist weiterhin **Nur Theme** möglich. Der Repository-Link bleibt gleich.

Für manuelle Installation: `ElegantFinTV-0.1.6-jf12.2.zip` aus dem Release verwenden, bei beendetem Server den bisherigen ElegantFinTV-Pluginordner durch `ElegantFinTV_0.1.6.0` ersetzen. Beide Versionsordner nicht parallel installieren.

Validiert sind 24 Frontendchecks, einschließlich Navigation mit später geladenen Bibliotheken, Linkaktivierung, Umbenennung und Rückbau, sowie Media-Bar-Geometrie bei 1920×1080 und 1280×720. Diese Tests verwenden synthetische DOM-Fixtures; sie ersetzen keinen Test der konkreten TV-Oberfläche.

## Update 0.1.5.0: schlankes Design, native Bewegung

Das Standardprofil **„TV: schlankes Design mit Jellyfin-Animationen“** übernimmt ElegantFins dunkelblaue Flächen, violette Akzente, Inter-Schrift, abgerundete Poster und Schaltflächen sowie eine sichtbare Fokusmarkierung. Es lädt ein eigenes Stylesheet von rund 6,6 KB einschließlich Fontdefinitionen. Die drei Desktop-Stylesheets und deren Modern-/Media-Bar-Layoutanpassungen werden in diesem Profil nicht geladen. Das bisherige vollständige Paket umfasst rund 194 KB; diese Größen sind keine Messung der Rendergeschwindigkeit.

Kartenbreiten, Posteranordnung, Scrollverhalten, Fokus-Zoom und Animationen kommen von Jellyfin. Die vorhandene Media Bar behält ihre Geometrie und Slide-Übergänge. Ihre festen Unschärfeeffekte an Inhalt und Bedienelementen sowie die Logoanimation werden reduziert. Icons verwenden Jellyfins vorhandene Schrift; das schlanke Profil lädt nur die lokal eingebundene Inter-Schrift bei Bedarf. Das bisherige vollständige Theme bleibt als zweite Darstellung auswählbar und wird als separate Datei geladen.

Bestehende Einstellungen mit `balanced` verwenden nach dem Update automatisch das neue Design; `full` bleibt das bisherige vollständige Theme. Vergleichsmodi und Fokusadapter funktionieren weiterhin wie unten beschrieben. Für den ersten Vergleich auf der Startseite **Nur Theme** und die schlanke Darstellung wählen; anschließend den gleichen Abschnitt erneut mit bereits geladenen Bildern durchlaufen. Der zuletzt gemessene Modus Referenz zeigt weiterhin kein Theme. Für den Alltag anschließend Normalbetrieb wählen und die Diagnose ausschalten.

Version 0.1.5.0 wurde über GitHub und den Plugin-Katalog veröffentlicht. Für die aktuelle Installation gelten die Hinweise zu 0.1.6.0 oben.

Die folgenden Updateabschnitte dokumentieren frühere Versionen; die damaligen Effektkorrekturen gelten für das alte Theme. Das schlanke Design wird in `src/tv-minimal.css` gepflegt. `src/tv-overrides.css` gehört weiterhin zum vollständigen Vergleichsprofil.

## Update 0.1.4.0: gezielte Vergleichsmessungen

Im Dashboard unter Plugins → ElegantFin TV das Plugin aktivieren, die reduzierte Darstellung beibehalten und einen **Vergleichsmodus** wählen:

| Modus | TV-Stylesheet dieses Plugins | Fokusadapter dieses Plugins |
| --- | --- | --- |
| Referenz | aus | aus |
| Nur Theme | an | aus |
| Nur Adapter | aus | an |
| Komplett | an | an |

Die eigentliche Media Bar und anderweitig eingebundenes CSS bleiben unverändert. Die Vergleichsmodi gelten ausschließlich auf TV/webOS und übersteuern dort die Einstellung „Media-Bar-Fokusbedienung ergänzen“. **Normalbetrieb** verwendet wieder die normalen Einstellungen. Referenz und Nur Adapter laden weder das TV-Stylesheet noch dessen Fonts. Ein kleiner Diagnose-Stil wird nur bei eingeschalteter Diagnose geladen.

### Ablauf ohne Entwicklermodus

1. Auf **0.1.4.0** aktualisieren, Server neu starten. Plugin aktivieren, Vergleichsmodus **Referenz** und **„Diagnose auf dem Fernseher anzeigen“** wählen, speichern.
2. TV-App vollständig neu öffnen. Die Filmbibliothek und den gewünschten Startpunkt öffnen. Es gibt keine automatische Messung beim App-Start.
3. Die **rote Farbtaste** drücken oder den Bildschirmbutton **„Messung starten“** wählen. Drei Sekunden Vorlauf geben Zeit, den Fokus wieder auf die Poster zu setzen. Danach verschwindet die Anzeige und es folgen 15 Sekunden Navigation. Die rote Farbtaste wird nur bei aktivierter TV-Diagnose verwendet; auf einer Tastatur ist alternativ F8 möglich. Die Farbtaste entspricht [LGs dokumentiertem Keycode 403](https://webostv.developer.lge.com/develop/guides/magic-remote).
4. Ergebnis fotografieren. Zum gleichen Startpunkt zurückkehren und mit der roten Taste erneut messen, diesmal mit bereits geladenen Postern. „Ausblenden“ versteckt das Ergebnis, die rote Taste bleibt verfügbar. Die Diagnose löscht keinen Cache; der erste Durchlauf ist daher nicht garantiert ungecached.
5. Für **Nur Theme**, **Nur Adapter** und **Komplett** wiederholen. Nach jedem Moduswechsel speichern und die App vollständig neu öffnen. Darstellung, Bibliothek und Navigationsweg konstant halten. Der Bericht nennt Modus und Laufnummer; diese zählt pro App-Start neu.
6. Für den Einfluss der Messung den gleichen Modus beibehalten, nur die Diagnose ausschalten und die App neu öffnen. Es erscheinen dann keine Diagnoseelemente, und keine Messung oder Bildgrößen-Stichprobe startet automatisch. Abschließend **Normalbetrieb** wählen und Diagnose ausschalten.

Der Bericht zeigt jetzt zusätzlich die Gesamtdauer langer Hauptthread-Aufgaben. Bildgrößen werden erst nach Ende der Zeitmessung aus maximal sechs sichtbaren, fertig geladenen `IMG`-Elementen erfasst (höchstens 128 Elemente geprüft). Angezeigt werden natürliche Bildmaße und dargestellte CSS-Pixel; DPR steht im Bericht. CSS-Hintergrundbilder, versteckte und noch nicht geladene Bilder werden nicht erfasst. Es werden keine Bilder für die Diagnose nachgeladen oder dekodiert. Eine leere Stichprobe bedeutet nicht, dass die Poster klein sind.

Die Bildgrößen-Stichprobe gehört zum aktuellen Bildschirminhalt, nicht zwingend zu den während der Messung erfassten Anfragen. Die Messung verursacht selbst etwas Aufwand; ausgeschaltete Diagnose ist deshalb ein zusätzlicher subjektiver Vergleich. Frame-Aufrufe sind keine direkte Messung der GPU-Bildrate. Es werden keine URLs, Tokens oder Medientitel im Ergebnis gespeichert und keine Berichte hochgeladen. Die Bedienelemente übernehmen beim Erscheinen keinen Fokus.

### Bisheriger Befund

Die Messungen mit 0.1.2/0.1.3 zeigten 13/9 Frame-Aufrufe pro Sekunde bei maximal 151/49 ms für abgeschlossene Bildanfragen. Ohne Plugin wurde subjektiv deutlich flüssigere Navigation gemeldet. Das grenzt den aktivierten Pluginpfad ein, trennt aber bisher CSS, Adapter und Messaufwand nicht. Die neuen Modi dienen dieser Trennung; sie sind keine weitere behauptete Performancekorrektur.

## Update 0.1.3.0: reduziertes Profil nach TV-Vergleich

Der Vergleich am LG C4 zeigte deutlich flüssigere Navigation bei deaktiviertem Plugin. Das grenzt den Engpass auf den aktivierten Pluginpfad ein, beweist aber noch keine einzelne CSS-Regel als Ursache.

Das reduzierte Profil entfernt nun zusätzlich Kartenschatten, Kartenbreiten- und Fokusanimationen sowie den Zoom der Bildcontainer. Die Navigationskopfzeile erhält eine deckende Themefarbe statt transparenter, maskierter Ebenen über den scrollenden Postern. Posteranordnung, Farben, Fokusmarkierung und Media-Bar-Bedienung bleiben erhalten; das vollständige Profil behält die bisherigen Effekte. Der Geschwindigkeitsgewinn muss erneut auf dem TV gemessen werden.

Die Diagnose erkennt jetzt auch `fillWidth`/`fillHeight`. Die alte Anzeige „ohne Größenlimit“ konnte dadurch größenangepasste Bilder falsch einordnen. Sie heißt nun „ohne Größenparameter“. „Lange Hauptthread-Aufgaben“ ersetzt die ungenaue Beschriftung „lange JS-Aufgaben“.

Nach Aktualisierung auf **0.1.3.0** Server und TV-App neu starten, das Plugin wieder aktivieren und das reduzierte Profil wählen. Für den Vergleich denselben Bibliotheksabschnitt mit aktivierter Diagnose durchlaufen und das Ergebnis fotografieren. Es sind keine Änderungen an den Browser-CSS-Dateien oder der Media Bar erforderlich.

## Update 0.1.2.0 und Diagnose ohne Entwicklermodus

- Poster erhalten eine Kontur am Vorschaubild statt zusätzlicher Konturen am umgebenden Link/Kartencontainer. Separate Aktionsbuttons bleiben erkennbar fokussiert.
- Im reduzierten Profil werden zusätzlich feste Blurwerte der Media-Bar-Schaltflächen, Pfeile und Inhaltsfläche sowie die animierte Logo-Unschärfe abgeschaltet.
- Eine freiwillig aktivierte Diagnoseanzeige misst direkt auf dem TV. Ein Web Inspector oder Entwicklermodus ist dafür nicht erforderlich.

**Historischer Ablauf bis 0.1.3.0:** Nach App-Start erfolgte eine automatische Messung mit fünf Sekunden Vorlauf. Ab 0.1.4.0 gilt der manuelle Ablauf oben.

Der Bericht zeigt Chromium-Hauptversion, sichtbare Auflösung/DPR, Framepausen, lange Hauptthread-Aufgaben und aggregierte Bildanfragen nach Primary/Backdrop/Logo/Thumb. „Ohne Größenparameter“ bedeutet ab 0.1.3.0, dass in der Anfrage weder width/height, maxWidth/maxHeight noch fillWidth/fillHeight mit positivem Wert vorkommen; daraus allein folgt nicht, dass das tatsächlich ausgelieferte Bild groß ist. TTFB enthält Netzwerk- und Serveranteile. Null-/Nullbyte-Werte können Cache- oder CORS-bedingt sein. Zum Messende noch laufende Anfragen und die Bilddekodierung werden nicht erfasst.

Keine URLs, Medientitel, IDs oder Zugangstoken werden im Bericht gespeichert oder angezeigt. Es gibt keinen automatischen Upload. Normale Desktopbrowser erhalten keine Diagnoseanzeige. Bei Abschalten des Frontends werden Messung und Observer beendet.

Die Änderungen sind lokal geprüft, der tatsächliche Performancegewinn muss auf dem TV verglichen werden. Das Poster-Ladeverhalten von Jellyfin und die Bild-URLs der Media Bar werden durch dieses Update nicht verändert.

## Update 0.1.1.0

Behebt eine übersprungene Theme-Einbindung bei gleichzeitig installierter Media Bar. Version 0.1.0.0 registrierte eine eigene Regex-Verarbeitungskette; File Transformation bevorzugt jedoch die von Media Bar unter `index.html` registrierte Kette. Beide Plugins verwenden jetzt denselben Schlüssel. Der Konflikt wurde mit der unveränderten Upstream-Verarbeitungsklasse reproduziert und die Korrektur mit beiden Registrierungsreihenfolgen geprüft.

Im Jellyfin-Katalog nach Updates suchen, ElegantFin TV auf **0.1.1.0** aktualisieren und den Server neu starten. Danach die LG-App vollständig beenden und erneut starten, nicht nur zum TV-Startbildschirm wechseln. Der Repository-Link bleibt gleich.

## Enthalten

- Jellyfin-Serverplugin für **12.2.0 / .NET 10** mit eigener Einstellungsseite.
- Einbindung über **File Transformation**, ohne die installierten Jellyfin-Webdateien zu bearbeiten.
- TV-Stylesheet aus unabhängigen Kopien von ElegantFin, dem Jellyfin-12-Modern-Zusatz und dem Media-Bar-Zusatz.
- Erkennung über `layout-tv` oder webOS-User-Agent. Jellyfins Layoutklassen werden nicht verändert.
- Schlankes TV-Theme mit nativer Kartenbewegung, begrenzter Header-Unschärfe und deutlich sichtbarem Fokus.
- Persönlicher Ein-/Aus-Schalter in den Anzeigeeinstellungen, zusätzlich zum zentralen Admin-Schalter.
- Inter, Archivo Narrow und Material Symbols werden vom eigenen Jellyfin-Server ausgeliefert. Keine externen Schriftanfragen durch das Plugin.
- Das aktive TV-Theme verwendet Inter und Jellyfins vorhandene Icons. Das frühere vollständige Vergleichsprofil ist nicht mehr auswählbar.
- Adapter für `#slides-container`, `.slide.active` und die in der gelieferten CSS-Datei verwendeten Schaltflächen.
- Keine Diagnose- oder Vergleichsoptionen in der Einstellungsoberfläche.

Die ursprünglichen drei Dateien im übergeordneten Ordner bleiben unverändert. `vendor/` enthält bytegleiche Kopien mit SHA256-Prüfsummen. Das neue Projekt benötigt diese übergeordneten Dateien nicht zum Bauen.

## Installation zum Gerätetest

Für die Installation über Jellyfins Plugin-Katalog ist `manifest.json` vorbereitet:

```text
https://raw.githubusercontent.com/S3NTIN3LOne/jellyfin-elegantfin-tv/main/manifest.json
```

Das Repository und die Release-Downloads sind öffentlich erreichbar. Das Katalogpaket endet auf `-catalog.zip`; das nachfolgend beschriebene Paket ohne diesen Zusatz ist für die manuelle Installation gedacht. Die Voraussetzung File Transformation gilt bei beiden Installationswegen.

1. Im Jellyfin-Dashboard die Serverversion **12.2.0** prüfen. Das Paket ist gegen diese API gebaut; andere Versionen sind nicht freigegeben.
2. Eine zu Jellyfin 12.2 passende Version von [File Transformation](https://github.com/IAmParadox27/jellyfin-plugin-file-transformation) muss installiert sein. Bei einer Media-Bar-Installation kann sie bereits vorhanden sein. Das Plugin enthält diese Abhängigkeit nicht.
3. Das Paket `artifacts/ElegantFinTV-0.1.12-jf12.2.zip` entpacken. Bei beendetem Jellyfin-Server den enthaltenen Ordner `ElegantFinTV_0.1.12.0` in das **Pluginverzeichnis der aktiven Serverinstallation** kopieren. In Docker ist das üblicherweise `/config/plugins`; bei anderen Installationen den tatsächlich konfigurierten Datenpfad verwenden.
4. Server starten. Im Dashboard unter Plugins **ElegantFin TV** öffnen. Standard: aktiviert, TV-Profil, Media-Bar-Adapter an, „Auch auf Desktop und Mobilgeräten“ aus.
5. Die drei bisherigen CSS-Einbindungen können für den ersten TV-Test bestehen bleiben: Sie schließen `layout-tv` bereits aus. Die Dateien selbst müssen nicht bearbeitet werden. In der LG-App TV-Layout verwenden und die App vollständig schließen/neu starten, damit `index.html` neu angefordert wird.
6. Das vorhandene Media-Bar-Plugin installiert lassen. ElegantFin TV lädt **keine zweite Media Bar** und ersetzt nicht deren Wiedergabe-, Favoriten-, Playlist- oder Trailerlogik.

Falls im TV-Layout trotz Neustart nichts erscheint: Serverprotokoll nach `ElegantFin TV` durchsuchen. Die geplante Aufgabe **ElegantFin TV: Frontend registrieren** kann erneut ausgeführt werden. Eine fehlende/inkompatible File-Transformation-Schnittstelle wird als Fehler gemeldet, statt die Registrierung stillschweigend zu überspringen.

Bei Nutzung des **Desktop-Layouts innerhalb der LG-App** wird das Plugin ebenfalls aktiv; die alten CSS-Einbindungen können dort aber zusätzlich greifen. Für einen aussagekräftigen Vergleich TV-Layout verwenden. Für den späteren vollständigen Wechsel aller Webclients auf das Plugin: Option „Auch auf Desktop und Mobilgeräten“ einschalten und die alten drei Einbindungen im Dashboard entfernen. Die Quelldateien bleiben erhalten. Diese Umstellung wurde hier nicht vorgenommen.

## Vergleich auf dem C4

Immer dieselbe Bibliothek und denselben Navigationsweg verwenden:

1. Plugin deaktiviert, bisherige Oberfläche. App neu laden.
2. Plugin aktiviert, persönlichen Theme-Schalter einschalten.
3. Den persönlichen Theme-Schalter wieder ausschalten und denselben Abschnitt vergleichen.

Jeweils erste Anzeige und erneutes Scrollen durch bereits geladene Poster vergleichen. Wenn nur die erste Anzeige langsam ist, Bildanfragen/Server/Netzwerk separat untersuchen. Wenn auch bereits geladene Reihen ruckeln, Rendering und JavaScript näher messen. Ein PC-Browser ist kein Ersatz für diesen Gerätevergleich.

Bei verbundenem webOS-Webinspektor:

```js
ElegantFinTv.status()
// Während der folgenden 10 Sekunden mit der Fernbedienung scrollen:
ElegantFinTv.diagnose(10).then(console.table)
```

Die Diagnose liefert aktive Konfiguration, Frame-Abstände und aggregierte Bildanfragezeiten. Sie enthält keine URLs, Zugangsdaten oder Medientitel. Sie startet keine eigenen Bildanfragen. Browserpuffer, Cache, CORS und Hintergrundbetrieb begrenzen die Aussagekraft; Bilddekodierung und reine Serverzeit werden nicht separat erfasst. Für TTFB, Bildabmessungen und lange Hauptthread-Aufgaben den Netzwerk-/Performance-Tab des Inspektors verwenden.

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
