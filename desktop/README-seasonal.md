# Saisonale Effekte für das normale ElegantFin-Theme

Die Erweiterung zeigt auf der Startseite und passenden Filmdetailseiten dezente Schneeflocken bzw. fallende
Herbstblätter und Kürbisse. Die Grenzen gelten einschließlich des letzten Tages,
jedes Jahr nach der lokalen Zeit des Browsers:

| Zeitraum | Film-Metadaten (Genre oder Tag) | Effekt |
| --- | --- | --- |
| 01.12.–31.12. | Christmas, Weihnachten, Xmas, X-mas, Noël/Noel, Navidad | Schneeflocken |
| 15.10.–01.11. | Halloween oder Horror | Herbstblätter und Kürbisse |

Auf der Startseite (`#/home` bzw. `#/home.html`) entscheidet allein das Datum:
Im Dezember schneit es, vom 15.10. bis einschließlich 01.11. erscheinen
Herbstblätter und Kürbisse. Dafür werden keine Film-Metadaten abgerufen.
Auf Filmdetailseiten werden ausschließlich Jellyfin-Einträge mit `Type: Movie` berücksichtigt.
Weihnachtsfilme ohne entsprechendes Genre lassen sich im Jellyfin-Metadateneditor
mit dem Tag `Christmas` oder `Weihnachten` markieren. Titel und Handlung werden
nicht durchsucht; so löst eine beiläufige Erwähnung keinen Effekt aus.

## Installation

1. Das normale ElegantFin-Theme wie bisher laden.
2. Den Inhalt von `ElegantFin-seasonal.css` am Ende des benutzerdefinierten CSS
   ergänzen (alternativ diese Datei über eine selbst gehostete URL importieren;
   CSS-Importe müssen vor normalen CSS-Regeln stehen).
3. `ElegantFin-seasonal.js` zusätzlich im Seitenkontext von Jellyfin Web als
   klassisches Script laden, beispielsweise über die vorhandene JavaScript-
   Injection oder einen eigenen Webclient-Eintrag:
   `<script defer src="ElegantFin-seasonal.js"></script>`.
   Dafür muss die Datei neben der Webclient-HTML-Datei bereitgestellt werden.
   Direkte Webclient-Anpassungen können bei Jellyfin-Updates überschrieben werden.

Bei einem externen Script-Verweis lädt das Script `ElegantFin-seasonal.css`
automatisch aus demselben Ordner. Bei Inline-Injection muss das CSS weiterhin
separat eingebunden werden. Ein CSS-Import allein lädt kein JavaScript.

**Nur CSS reicht für die automatische Aktivierung nicht aus:** CSS kann weder
das aktuelle Datum abfragen noch Film-Metadaten aus der Jellyfin-API laden.
Für die Filmdetailseiten benötigt das Script den angemeldeten Jellyfin-Webclient mit
`window.ApiClient.getCurrentUserId()` und `getItem(userId, itemId)` sowie die
Detailroute `#/details?id=…` und `.itemDetailPage`/`#itemDetailPage`.
Falls ein Webclient diese Schnittstellen nicht bereitstellt, bleiben die Effekte
auf Detailseiten aus. Auf der Startseite ist kein API-Zugriff erforderlich.
Es werden keine Zugangsdaten gespeichert und keine externen Dienste angesprochen.

Die TV-Plugin-Dateien werden nicht verwendet oder verändert. TV-Layout,
Videowiedergabe, ausgeblendete Tabs und die Systemeinstellung „Bewegung reduzieren“
deaktivieren die Effekte. Die Partikel blockieren keine Klicks. Navigation und
Datumswechsel werden spätestens nach einer Sekunde geprüft; Film-Metadaten werden
einmal pro Detailansicht geladen, fehlgeschlagene Abrufe frühestens nach 30 Sekunden
wiederholt. Auf Mobilgeräten werden weniger Partikel erzeugt.

Zum Abschalten die beiden Ergänzungen entfernen; für die laufende Sitzung ist
auch `window.ElegantFinSeasonal.destroy()` in der Browserkonsole möglich.

## Jelly+-Kompatibilität

`jellyplus-support.css` nach dem normalen Desktop-/Mobil-Theme laden bzw. dessen
Inhalt an das benutzerdefinierte CSS anhängen. Es gestaltet die Jelly+-Dialoge,
Profiloptionen und saisonalen Poster. Das TV-Plugin enthält diese Regeln in
beiden erzeugten Stylesheets und verbindet die Jelly+-Posterreihe mit der
Media-Bar-Fokusnavigation. Grundlage ist der lokale Jelly+-Client 0.1.x.

Media-Bar-Vorschauvideos schalten die Partikel nicht ab; echte Wiedergabe und
geöffnete Jelly+-Dialoge dagegen schon. Die Partikel liegen über dem Seiteninhalt.
Die Empfehlungen von Jelly+ verwenden die Serverzeit, die Effekte die Browserzeit.

Die Effekte sind auf den oberen Seitenbereich begrenzt. Auf der Startseite wird
die untere Kante aus Media Bar und „Meine Medien“ ermittelt, sowohl für
Bibliotheksbuttons als auch für Bibliothekskacheln. Scrollen, Größenänderungen und
nachgeladene Reihen aktualisieren die Grenze. Fehlen diese Bereiche, beträgt die
Höhe höchstens 65 Prozent des Fensters bzw. 650 Pixel. Auch Detailseiten verwenden
diese begrenzte Höhe. Die Partikel werden am Rand abgeschnitten und ausgeblendet.

Das ergänzende CSS begrenzt auch ältere Saison-Scripte auf diese Rückfallhöhe.
Für die genaue Messung und das Mitführen beim Scrollen muss die aktualisierte
`ElegantFin-seasonal.js` geladen werden. Ältere Jelly+-Versionen laden noch eine
fest eingetragene Version 0.1.13; deren Loader muss beim Ausrollen ebenfalls auf
die neue veröffentlichte Script-Version aktualisiert werden.

Auf der persönlichen Profilseite blendet die Ergänzung „Passwort zurücksetzen“
aus. „Passwort speichern“ bleibt sichtbar und liegt ohne überdeckenden Schatten
im normalen Formularfluss. Der Adminbereich behält seine Reset-Aktion. Die
Bibliotheken unter „Meine Medien“ folgen Jellyfins gespeicherter DOM-Reihenfolge;
die Ergänzung setzt keine eigene alphabetische oder typbasierte Sortierung.

Die Jelly+-Empfehlungskarten verwenden die gleichen Größenstufen, Abstände und
Rundungen wie die normalen ElegantFin-Poster. Lange Titel werden mit Auslassung
gekürzt, die vollständigen Titel bleiben als Linktext erhalten. Die Zeile ist
horizontal scrollbar. Die Erweiterung ergänzt keine Medienaktionen, Fortschritts-
oder Gesehen-Anzeigen, die Jelly+ selbst nicht liefert.

**Fehlende Jelly+-Optionen in der modernen Oberfläche:** Der lokale Jelly+-Client
0.1.1 bindet Profiloptionen über `#languagePreferencesPage .settingsContainer` und
Medienaktionen über `.actionSheetContent` ein. Die moderne Oberfläche verwendet
andere Einstellungen und Menüs; Jelly+ muss diese selbst unterstützen. CSS kann
fehlende Steuerelemente und deren Aktionen nicht hinzufügen. Im klassischen
Desktop-Webclient bleiben die vorhandenen Jelly+-Optionen auch mit dem Theme
sichtbar. Watch Together setzt außerdem eine aktivierte Profilfreigabe voraus.

Prüfung der Darstellung und der klassischen/modernen Plugin-Einbindung:
`node --test tests/jellyplus-theme.test.cjs` im übergeordneten Theme-Arbeitsordner.
Der Vergleich der Plugin-Einbindung verwendet den benachbarten Jelly+-Quellcode,
falls verfügbar; der Größenvergleich benötigt ihn nicht.

## Prüfung

`node --test tests/seasonal.test.cjs`

Die Browser-Tests verwenden die bereits vorhandene Playwright-Installation unter
`elegantfin-tv-plugin/node_modules`; die Erweiterung selbst benötigt keine Pakete.
Die Tests simulieren Jellyfin-Metadaten und Detailseiten. Eine Prüfung an einem
laufenden Jellyfin-Server ist zusätzlich sinnvoll, insbesondere bei anderen
Webclient-Versionen.
