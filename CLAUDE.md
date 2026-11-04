# Stromlaufplan – Hinweise für Claude

Web-App, die aus einer Eingabe per Formular Stromlaufpläne und verwandte Planarten für
Elektroverteiler erzeugt. Nachfolger des Prinzipschaltbilds aus SF E-Plan; ob und wie sie
später in andere Apps (SF E-Plan, BDS E-Assistent) eingebunden wird, ist offen.

- Ausgeliefert wird **eine einzige HTML-Datei** (`docs/index.html`, GitHub Pages).
- Zielgeräte: **iPad (quer und hoch) und Desktop.** Das Smartphone bleibt zum Ansehen und
  Drucken nutzbar, wird aber nicht eigens optimiert.
- Sprache in App, Plan, Code-Kommentaren und Gesprächen: **Deutsch**.

## Arbeitsweise (verbindlich, von Jean)

1. **Keine eigenmächtigen Änderungen.** Ideen zuerst als Vorschlag formulieren und die
   Umsetzung im Detail abklären, bevor Code geändert wird. Das gilt auch für kleine
   Layoutverschiebungen in bestehenden Plänen.
2. **Etappen.** Große Aufgaben in Etappen teilen. Nach jeder Etappe ein lauffähiger Stand
   mit eigener Version (`python3 tools/app_bauen.py v1.x`), der Versionseintrag im Kopf von
   `src/app-vorlage.html` und in `VERSIONEN.md`, ein Commit.
3. **Prüfen vor Abgabe.** `python3 tests/pruefen.py --vergleich`: keine Skriptfehler, alle
   Abgänge enden auf einer Höhe, Druck als PDF. Weichen Blätter von `tests/referenz.json`
   ab, muss die Abweichung gewollt und mit Jean abgesprochen sein; erst dann
   `--referenz`. Neue Funktionen bekommen ein Beispiel in `tests/beispiele.js`.
   Die PNGs in `build/pruefung/` ansehen, nicht nur die Zahlen.
4. **Schaltzeichen** kommen aus der QElectroTech-Sammlung (EN-60617-Satz bevorzugt) oder
   aus dem EN-Baukasten (`tools/baukasten.py`, aus EN-Grundzeichen zusammengesetzt). Neue
   Zeichen wählt Jean über ein Auswahlblatt (`tools/auswahl_bauen.py`). Auf einer Karte
   stehen **nur Varianten derselben Bedeutung** – Schließer/Öffner, Masse/Erde,
   3 Sicherungen/Sicherungstrenner usw. sind getrennte Karten. Namen nach dem, was das
   Zeichen zeigt; die deutschen Namen der Sammlung sind teils falsch übersetzt.
5. **Pushen:** jeden fertigen Stand immer direkt auf `main` pushen (Jean, 29.10.2026).

## Aufbau

```
src/app-vorlage.html      App: Datenmodell, berechne(), Eingabebildschirme, Türzettel, Druck
src/plan.js               Generator (PLAN.blaetter): alle Planblätter als SVG
src/qet-render.js         Übersetzer QElectroTech-XML (.elmt) → SVG (QET.zeichne)
src/bibliothek-vorlage.html  Ansichtsseite der Bibliothek
src/auswahl-vorlage.html  Auswahlblatt (Musterblatt) für neue Zeichen
bibliothek/bibliothek.json  feste Bibliothek (Fassung, Stand, Zeichen als QET-XML)
bibliothek/kandidaten-*.json  Kandidaten der Auswahlblätter
tools/                    Build: app_bauen.py, bibliothek.py, auswahl_bauen.py, baukasten.py,
                          pfade.py, sammlung_holen.sh; Hilfen kontakt.py, zoom.py
tests/                    beispiele.js, pruefen.py, referenz.json
docs/                     GitHub Pages: index.html (App), bibliothek.html
build/, quelle/           nicht im Repository (versionierte Dateien, Sammlung)
```

Befehle:

```
python3 tools/app_bauen.py v1.8          # App bauen → docs/index.html, build/stromlaufplan-v1.8.html
python3 tests/pruefen.py --vergleich     # prüfen
tools/sammlung_holen.sh                  # Sammlung holen (nur für Bibliothek/Auswahl)
python3 tools/bibliothek.py              # Bibliothek neu bauen (FASSUNG/STAND im Skript)
python3 tools/auswahl_bauen.py kandidaten-steuerung.json build/steuerung-auswahl-v0.3.html 'Steuerung v0.3' 'Untertitel' 'slp.steuerung.auswahl.v3'
```

Voraussetzungen: Python 3, Playwright mit Chromium (`pip install playwright`,
`playwright install chromium`).

## Fachliche Festlegungen (Stand v1.7)

**Plan und Blatt**
- Allpoliger Stromlaufplan, senkrechte Strompfade; Wohnungs-/Hausverteiler und
  Baustrom-/mobile Verteiler, mehrere Verteiler je Projekt, Unterverteiler werden aus
  einem Abgang gespeist (Querverweise in beide Richtungen).
- A4 quer voreingestellt, A3 möglich. Rahmen mit Spalten 1… und Zeilen A…; Ränder links
  20 mm, sonst 10 mm.
- Schriftfeld als 20 mm hoher Streifen über die ganze Breite (bewusste Abweichung von
  DIN EN ISO 7200): links Firma und Anschrift (70 mm), Zeile 1 Projekt, Dokumenttitel,
  Verteiler; Zeile 2 Zeichnungsnummer, Revision, Ausgabedatum, Erstellt durch, Blatt x/y.
  Kein Logo.
- Blattfolge: Deckblatt, Inhaltsverzeichnis (abschaltbar), Übersichtsschaltplan einpolig
  (abschaltbar), Stromlaufplan je Verteiler, Klemmenplan -X1 (abschaltbar). Blattnummern
  durchgehend. Eigenes Einspeisungsblatt, außer bei sehr kurzer Einspeisung (höchstens
  Vorsicherung ODER Hauptschalter, kein Zähler) – dann aufs erste Abgangsblatt.
- Türzettel (Sicherungsübersicht) je Verteiler als eigener Ausdruck, A4 hoch.
- Stückliste und TE-Aufbauplan sind vorerst ausgeklammert.

**Darstellung**
- Farben: N blau, PE grün, durchgezogen; Zeichen auf N-/PE-Leitern mit eingefärbt, auch
  Querverweis-Pfeile. **Alle Schrift schwarz.**
- Alle Linien 0,25 mm, auch Sammel- und Untersammelschienen.
- Verbindungspunkte überall, wo drei oder mehr Linien zusammentreffen, an Ecken nicht.
- Alle Abgänge enden ganz unten auf **einer** Höhe; Endklemmen (Geräteanschlussdose) und
  offene Enden schließen exakt mit der Unterkante der Steckdosen ab (7,5 mm unter dem
  Anschluss). Leuchten: PE wird unter der Lampe ans Gehäuse geführt (reicht 1,5 mm tiefer).
- Untersammelschienen nur von der ersten bis zur letzten Verbindung; N/PE einer Gruppe
  rechts neben dem Gruppengerät von der Hauptschiene zugeführt.
- Beschriftung von Geräten mit IΔ-Kasten links unter dem Gerät.
- Übersichtsschaltplan: halbes Spaltenraster, Leiterzahl als Schrägstrich mit Zahl,
  Beschriftung unten senkrecht; Schaltgeräte (Schütz, Stromstoß, Zeitrelais) dort mit dem
  Schützzeichen. Verdichtung nur, wenn sonst kein Platz ist (bestehende Pläne bleiben).

**Kennzeichen** (DIN EN IEC 81346, automatisch, von Hand überschreibbar)
- -Q Hauptschalter und Schaltgeräte (Schütz, Stromstoßschalter), -K Zeitrelais,
  -F Schutzorgane, -P Zähler, -X1 Klemmleiste im Verteiler, -X2 … Geräteanschlussdosen,
  -XD Steckdosen, -E Leuchten, -W Leitungen; Steuerstromkreise: -S Taster, Schalter, Not-Aus,
  Wahlschalter; -B Melder (Dämmerung, Bewegung, Präsenz; seit v1.33) und Endschalter (seit v1.33.1), später auch
  Schwimmerschalter (seit v1.41; alle nach 81346-2:2019, Jean
  04.11.2026); -H Meldeleuchten.

**Eingabe und Daten**
- Bedienung wie SF E-Plan: eigene Bildschirme, ein Feld je Fenster, sofort gespeichert
  (localStorage `slp.projekt.v1`), Export/Import als `JJ-MM-TT Projekt.slp.json`.
- Neuer Abgang: Voreinstellung Steckdose. Anschlüsse: Steckdose 1/N/PE, Steckdose 3/N/PE,
  Geräteanschlussdose, Leuchte, fester Anschluss.
- Phasenverteilung einphasiger Abgänge automatisch (je Abgang bzw. Gruppe überschreibbar).
- Abgangsklemmen je Verteiler (Voreinstellung „ohne“), je Abgang abweichend; N-Klemme je
  Verteiler: N-Trennklemme (Voreinstellung) oder N-Klemme.
- Klemmenplan nur für die Klemmleiste im Verteiler; Aderfarben als deutsche Kürzel
  br, sw, gr, bl, gnge (3-adrig: Phase immer br).
- Schaltgeräte je Abgang: Schütz, Stromstoßschalter, Zeitrelais (aus-/ein-/ein- und
  ausschaltverzögert, Zeit). N mitschalten nicht voreingestellt. Ausstattung an
  Hilfsschließern/-öffnern je Gerät; **gezeichnet werden nur die genutzten
  Hilfskontakte**, der Kontaktspiegel nennt alle.

## Etappe C – Steuerstromkreise (umgesetzt bis C4, v1.14; Abnahme durch Jean steht aus)

**Detailvorschlag (abgestimmt 28.10.2026)** – Teil-Etappen je mit eigener Version:
C1 v1.9 Blatt „Steuerstromkreis“ aus dem Datenmodell, Eingabe zunächst nur über das
Beispiel `steuerung` (Aussehen festlegen); C1b v1.10 Steuerspannung wählbar (Beispiele
`gemeinsam`, `bruecke`, `bruecke0`); C2a v1.11 Eingabe in Bildschirmen wie bisher
(Steuerspannung, Kreise mit Pfadliste, Befehlsgeber/Meldeleuchten, Steuer-LS; Beispiel
`eingabe`); C2b v1.12 Raster-Editor (seit v1.19 im Plan-Editor aufgegangen); C3 v1.13
Warnungen, Klemmen über -X1, Leitungen -W, eigenständiges Zeitrelais, Kreis ohne
Schaltgerät (z. B. nur Meldeleuchte); C4 v1.14 Vorlagen.
- C3 (v1.13): Befehlsgeber stehen voreingestellt „im Feld“, Meldeleuchten „im Verteiler“
  (je Gerät umstellbar). Feldgeräte laufen bei Klemmleiste über -X1: je Kontakt zwei Klemmen
  (nach den Abgangs- und Brückenklemmen), im Steuerstromkreis als kleiner Klemmenkreis mit
  `X1:nr` am Kontakt, je Gerät eine Leitung -W (Adern = Klemmen, Voreinstellung NYM-J 1,5).
  Eigenständiges Zeitrelais -K (Funktion, Zeit, verzögerte Schließer n7/n8 und Öffner n5/n6)
  als Verbraucher eines Kreises ohne Schaltgerät; verzögerte Kontakte auch an Zeitrelais im
  Abgang. Warnungen stehen im Verteiler, unter „Steuerstromkreise“ und im Raster.
- C4 (v1.14): Vorlagen ersetzen die Pfade eines Kreises (Rückgängig möglich) und legen die
  Geräte neu an: Taster parallel (1–5), Selbsthaltung Ein/Aus bzw. mit Not-Aus, je mit/ohne
  Meldeleuchte „Betrieb“ (Hilfsschließer werden bei Bedarf ergänzt), Hand-0-Automatik
  (Wahlschalter -S als zwei Schließer desselben Geräts, „im Verteiler“; Automatik in Reihe mit
  Melder). Mehrfach genutzte Befehlsgeber zählen ihre Anschlüsse fort (13/14, 23/24 …).
- Ein Kreis entsteht automatisch mit der Wahl des Schaltgeräts (leerer Pfad, Spule auf dem
  Verbraucherplatz); Kreise, deren Schaltgerät entfernt wurde, bleiben in den Daten, werden
  aber nicht gezeichnet. Befehlsgeber entstehen beim Belegen eines Platzes oder vorab in der
  Geräteliste.
- Eigene Blätter je Verteiler direkt hinter dessen Stromlaufplan, ein Kreis je
  Schaltgerät hintereinander (ein Kreis wird nicht geteilt), ein Pfad je Rahmenspalte.
- Je Pfad **6 Kontaktplätze** und darunter ein Verbraucherplatz (Spule, Meldeleuchte);
  parallele Zweige neben dem Pfad links davon, von Platz a bis Platz b.
- Steuerspannung je Verteiler wählbar, je Kreis Ausnahme „eigener Abgriff“:
  **je Abgang** (jeder Kreis eigene kurze L/N-Schienen), **gemeinsam durchgeschliffen**
  (eine durchgehende L- und N-Leitung, Verbindungspunkte genügen) oder **gemeinsam über
  gebrückte Klemmen** (je Anschluss an L bzw. N eine Klemme, erst alle L, dann alle N;
  wahlweise auf -X1 hinter den Abgangsklemmen oder auf eigener Leiste -X0 mit eigenem
  Klemmenplan). Quelle der gemeinsamen Spannung wahlweise ein vorhandener Abgang oder ein
  **Steuer-LS** (Abgang ohne Leitung mit `steuer: true`, nur L und N).
- Abgriff: L (erster Außenleiter) und N hinter dem Schutzorgan, im Stromlaufplan mit
  gehendem, im Steuerstromkreis mit kommendem Querverweis.
- Steuertrafo (v1.16) als dritte Quelle: Abgang mit `steuer: true` und `trafo: { prim: '230' | '400',
  sek, va, erde, ls }` – Primär-LS (230 V auf L, N läuft durch; 400 V zwei Schaltglieder auf
  L1/L2), Trafo -T, Sekundär-LS -F; Steuerspannung heißt „24 V“ usw. und „0 V“ (schwarz,
  kein N), 0 V wahlweise an PE geerdet. Zeichen: Bibliothek v1.6 `trafo` (allpolig, Sammlung)
  und `ue_trafo` (einpolig, EN-Baukasten nach 06-09-01), ausgewählt über „Trafo v0.1“:
  `python3 tools/auswahl_bauen.py kandidaten-trafo.json build/trafo-auswahl-v0.1.html 'Trafo v0.1' 'Stromlaufplan · Etappe C · Auswahl Steuertrafo' 'slp.trafo.auswahl.v1'`
- Kontaktspiegel unter der Spule (Hauptkontakte 1–2 …, Hilfskontakte Schließer n3–n4,
  dann Öffner n1–n2), genutzte mit `/Blatt.Spalte`; Hauptkontakte im Stromlaufplan
  tragen den Verweis auf die Spule. Befehlsgeber: Schließer 13–14, Öffner 11–12.
- Datenmodell `v.steuerung = { geraete, kreise }`, beschrieben bei `berechneSteuerung()`
  in `src/app-vorlage.html`.
- Meldeleuchten tragen traditionell **-H** (nicht -P wie der Zähler).
- Im Steuerstromkreis ist nur die N-Leitung blau (mit Klemmen und Abzweigpunkten); die
  Leitungen von den Verbrauchern bis zur Klemme bzw. zum Abzweig sind schwarz.
  Im Stromlaufplan bleibt der N-Abgriff zum Steuerstromkreis blau.


Mischweg: Hauptstromkreis bleibt generiert; Steuerstromkreise mit einem
**Strompfad-Editor im Raster** (wie ein Kontaktplan): oben L, unten N, senkrechte Pfade
mit festen Plätzen, Zeichen aus einer Palette antippen, parallele Zweige; jeder Kontakt
gehört zu einem Gerät, dadurch Kontaktspiegel, Querverweise (Spule ↔ Hauptkontakte ↔
Hilfskontakte), Warnungen (zu wenige Hilfskontakte) und Klemmen automatisch. Danach
**Vorlagen** (Stromstoß mit n Tastern, Selbsthaltung Ein/Aus/Not-Aus, Treppenlicht,
Hand-0-Automatik …) als Schnellstart. Später evtl. kleine Korrekturen im fertigen Plan als
gespeicherte Abweichungen.

- Geteilte Ansicht für iPad quer/Desktop: links Eingabe, rechts das Planblatt als
  Vorschau; iPad hoch: Vorschau ausklappbar unter der Eingabe. Bedienung mit Finger,
  Pencil und Maus; am Desktop Tastenkürzel (Entf, Rückgängig, Kopieren, Pfeiltasten).
- Steuerspannung je Schaltgerät wählbar: vom Schutzorgan des eigenen Abgangs
  (Voreinstellung) oder eigener Steuer-LS.
- Befehlsgeber/Kontakte der Bibliothek v1.4: Taster Schließer/Öffner, Schalter
  handbetätigt, Wahlschalter Hand-0-Automatik, Not-Aus, Dämmerungsschalter, Bewegungs-
  und Präsenzmelder, Endschalter Schließer/Öffner, Hilfsschließer/-öffner,
  Zeitrelais-Spulen (ein-, aus-, ein- und ausschaltverzögert), verzögerte Kontakte,
  Meldeleuchte. Nicht gewünscht: Zeitschaltuhr, Thermostat, externer Kontakt, eigene
  einpolige Übersichtszeichen. Offen geblieben: Drehschalter rastend, Zeitrelais
  allgemein (Multifunktion).
- Zeitrelais auch als eigenständiges Gerät (z. B. Treppenlichtzeitschalter: verzögerter
  Kontakt im Abgang, Spule im Steuerstromkreis).
- Steuerleitungen zu Tastern/Meldern laufen bei vorhandener Klemmleiste über -X1 und
  stehen im Klemmenplan.

## Etappe D – Plan-Editor (abgestimmt 29.10.2026, umgesetzt bis D4 v1.20; Oberfläche ab v1.21 neu, siehe Etappe E)

Der ganze Plan wird über die grafische Oberfläche bearbeitet; die Anordnung bleibt automatisch
(kein freies Platzieren), die bisherigen Bildschirme bleiben parallel, der Startbildschirm
bleibt, der Weg zum Plan ist kurz („Plan bearbeiten“ auf dem Start und oben im Verteiler).
- D1 v1.17: Bildschirm `editor` – Blätter eines Verteilers mit Antippflächen (`PLAN.blaetter(…,
  { ziele: true })`, nur dort: data-ziel `e:` Einspeisung, `k:` Abgang/Gruppe, `s:` SPD, `kr:`
  Steuerstromkreis), Eigenschaften-Leiste = eingebetteter Bildschirm (`eingebettet()`), Zoom.
  Löschen im Editor hebt nur die Auswahl auf (`fertig()`).
- D2 v1.18: Palette (neue Teile mit Voreinstellungen, `editorNeu()`), Einfügemarken „+“
  (`vor:`/`nach:`/`in:` nur mit `ziele`, sichtbar, solange ein Werkzeug gewählt ist), Verschieben
  im selben Zweig, Kopieren/Ausschneiden/Einfügen (neue Kennungen, Unterverteiler nicht doppelt
  gespeist), Löschen; Rückgängig/Wiederholen über das ganze Projekt in `sichern()` (50 Stände,
  Änderungen innerhalb 0,8 s zählen als ein Schritt).
- D3 v1.19: Steuerstromkreise direkt im Blatt – Antippflächen je Platz `pl:pfad:zeile` (Zeile 6 =
  Verbraucher), Reiter „Abgänge“/„Steuerung“ mit den beiden Paletten, Platz-Aktionen
  (`platzAktion()` über `platzSel()`), Vorlagen; der Raster-Bildschirm ist entfallen (Jean,
  29.10.2026), Wege zu einem Kreis führen über `imPlan()` in den Editor.
- D4 v1.20: Ziehen – Abgänge/Gruppen auf Marke „+“ oder Abgang (dahinter), Kontakte auf Plätze
  (belegt: tauschen); Maus ab 6 px Bewegung, Finger/Pencil nach 0,35 s Halten (sonst Wischen =
  Blättern; `touchmove` wird nur während des Ziehens unterdrückt). Tasten: ←/→ Abgang wählen,
  Alt+←/→ verschieben, +/− Zoom, ? Übersicht (`tastenHilfe()`).

## Etappe E – Bedienung neu (Jean 29.10.2026: „alles darf neu gedacht werden, nur das Planlayout bleibt“)

- v1.20.1: Ausschneiden/Einfügen verschiebt samt Steuerstromkreis (Kennungen bleiben); Kopieren legt
  die Kreise mit neuen Befehlsgebern an (`ablageSetzen()`, `ablageHolen()`).
- v1.22: kurze Auswahlwerte als Raster (`.wahl.raster`).
- v1.21 Arbeitsfläche: Editor als Vollbild-Raster `.ed` (Kopfleiste, Palette `.edpal`, Blätter
  `.edflaeche`, Eigenschaften `.edeigen`, Fußleiste); ab < 1000 px Palette als Streifen und Eigenschaften
  als Fach von unten. Startbildschirm: Verteilerkarten öffnen direkt den Editor. Im Editor lenkt
  `geh()` über `editorGeh()` alle Bildschirme in die Eigenschaften-Leiste um (Auswahl-Arten `k: kr: pl:
  e: s: kopf: st: g: p:`, null = Verteiler; `b.pz` = Zurück in der Leiste). `waehle()` ändert die Auswahl
  ohne die Blätter neu zu erzeugen; `zeichne()` hält Ausschnitt und Zoom (`b.sx/sy`, `b.zoom` in % der
  Blattbreite). Marken „+“ immer sichtbar (Einfügemenü mit Anzahl, `leer:` im leeren Verteiler,
  Schriftfeld `p:`), Kontextleiste `kontextNeu()`. Rückgängig mit Namen (`aenderung(name)` vor
  `sichern()`). `wahlFeld()`/`menue()` öffnen am angetippten Feld (`anker`), `textFeld()` bearbeitet in
  der Zeile; Esc schließt Fenster (`fensterStapel`).

## Etappe F – Freies Zeichnen im Raster (Konzept des UX-Teams, von Jean am 04.11.2026 freigegeben: „alles umsetzen“)

Konzeptseite: https://claude.ai/artifact/3f424j71BufBZFxsTu1Cif. Entscheidungen (Empfehlungen übernommen):
Automatik bleibt Grundlage, Handarbeit wird als Abweichung je Verteiler gespeichert (`v.layout`), ohne
Abweichungen bleibt jeder Plan bitgleich; kein Umschalter Auto/Frei – frei gesetzte Teile tragen eine
Stecknadel, „Automatik anwenden“ setzt zurück; Ebenen Anordnen (Lage/Leiterweg, Logik unverändert),
Verbinden (echte Verbindungen mit Prüfung, F5), Beschriften (Text/Rahmen ohne Logik); Raster Spalte / 5 mm /
2,5 mm, verschoben wird in ganzen Schritten gegenüber der Generatorlage; gemeinsame Endhöhe wird Fanglinie;
automatische Nachbarn rücken nach; Kennzeichen bleiben in Baumreihenfolge; Signalfarbe Violett (Editor-
Overlay fest `#6a35e8`, nie im Druck). -B statt -S für Melder: freigegeben am 04.11.2026, umgesetzt in v1.33.
- F0 v1.23: Zeichen-Cache `qz()` in plan.js, `PLAN.blaetter(…, { nur: vid })` für den Editor,
  `PROJEKT_VERSION`/`migriere()`, Farbtokens (`--akzent` Violett, `--ov` Overlay), dunkler Modus der Oberfläche.
- F1 v1.24: Szene in plan.js (`szeneStart/szeneEnde`, `teil(key)`, `teilPort()`): Teile `k:<id>/f|q|x|xd`,
  `k:<gruppe>/f`, `s:<vid>`, `e:<vid>/<feld>` mit Elementen und Anschlüssen; Leiter = Linien 0,25 mm außerhalb
  der Teile mit Leiterart. Blätter tragen `szene` und `anker` (erster Abgang bzw. `e:`). Editor: `teilFlaechen()`
  legt `rect.teil[data-ziel=t:<key>]` über die Geräte, aktiv nur im gewählten Abgang.
- F2 v1.25: `v.layout = { spalten, umbruch, lage }` (`lay()`, `layoutBereinigen()` in `sichern()`, `automatik()`,
  `vonHand()`), `planeVerteiler()` liest Wunschspalte/Umbruch; Ziehen eines Abgangs auf freie Fläche setzt die
  Spalte um die gezogene Strecke (`spalteUnter()`); Ablage nimmt die Vorgaben mit (`layoutDazu()`); `nadeln()`.
- F3 v1.26: `lageAnwenden()` in plan.js (vor dem Schriftfeld): Teile per `transform` versetzen, Leiter an
  ihren Anschlüssen folgen (gerade oder Knick `RASTER·(1+Rang)` vor dem Gerät, Rang nach x bzw. Zugrichtung).
  Editor: `teilZiehen()` (Vorschau, Hilfslinien), `teilSchieben()`, Pfeiltasten, `prueflisteBerechnen()`.
- F4 v1.27: Leiter tragen Schlüssel `<ort>#<n>` (`mitOrt()`), Punkte werden mitgeschrieben; `v.layout.wege`
  `{ n, senk }`, `wegeAnwenden()` (Querstücke, nicht auf Schienen; Punkte neu nach ≥ 3 Linien). Editor:
  `leiterFlaechen()` (`line.leiterziel`, `w:<schlüssel>`), `netzVon()`/`netzHalo()`, `wegSchieben()`, `wegZiehen()`.
- F5 v1.28: `v.layout.zusatz` (Leiter/Text/Rahmen, Blatt über `anker`, auf dem ersten Blatt auch solche mit
  verschwundenem Anker), `zusatzZeichnen()` in plan.js mit Punkten und Netzprüfung → `blatt.pruef`. Editor:
  Werkzeuge `zleiter|ztext|zrahmen` (`zeichnenKlick()`, `fang()`, `zeichenVorschau()`), Auswahl `z:<id>`.
- F6 v1.29: Mehrfachauswahl `b.sel = 'm:'`, `b.mehr = [t:…, z:…]` (`mehrWaehlen()`, `rahmenStart/…Ende()`, Werkzeug
  `zauswahl`), `gruppeZumZiehen()`/`gruppeSchieben()`, Zusatz-Elemente im Editor mit `data-zusatz`, `lupeZeigen()`,
  Pencil-Hover `data-hover`.
- F7 v1.30: `abgangAufBlatt()` (Reihenfolge + Wunschspalte), `blattFesthalten()` setzt Spalten aller Abgänge
  und Umbrüche am Blattanfang/-ende, merkt `v.layout.fest[anker]`.
- F8 v1.31: Teile `kr:<kreis>/pl:<pfad>:<zeile>` im Steuerstromkreis (Kontaktspiegel bleibt fest); `lageAnwenden()`
  hält das Mittelstück eines Leiters in seiner Flucht und versetzt nur die Enden; abgetrennte Abzweige →
  `SZ.hinweise` → `blatt.pruef`. Editor: Platz wählen → Kontextleiste „Frei“ → Teil `t:kr:…`.
  Noch offen: Drehen von Zeichen (erst mit frei gesetzten neuen Zeichen sinnvoll), Fach-Erweiterungen.
- Auswahl „Wallbox v0.1“ (Etappe G3, Jean 04.11.2026: Steckbuchsen im Kasten `wallbox_buchsen` → Bibliothek v1.9): Kasten mit Text, Kasten mit Steckdose 11-13-01, Steckbuchsen im Kasten:
  `python3 tools/auswahl_bauen.py kandidaten-wallbox.json build/wallbox-auswahl-v0.1.html 'Wallbox v0.1' 'Stromlaufplan · Etappe G · Auswahl Wallbox' 'slp.wallbox.auswahl.v1'`
- Auswahl „Erweiterung v0.2“ (Jean hat am 04.11.2026 ausgewählt → Bibliothek v1.7, App v1.32; Zeichen noch ohne
  Verwendung im Plan; ersetzt v0.1 nach Plausibilitätsprüfung): gepaarte Karten (Öffner/Schließer/Wechsler
  derselben Art) bieten Familien A/B/C an gleicher Stelle, die sich nur in der Funktion unterscheiden; Familie A
  aus dem EN-Baukasten (`geraet_betaetigter_kontakt`, `geraet_maschine` u. a.), Polabstand 20, Anschlüsse im Raster:
  `python3 tools/auswahl_bauen.py kandidaten-erweiterung.json build/erweiterung-auswahl-v0.2.html 'Erweiterung v0.2' 'Stromlaufplan · Fach-Erweiterungen · Auswahl neuer Zeichen' 'slp.erweiterung.auswahl.v2'`
- Auswahl „Erweiterung v0.1“ (29 Karten: Generator, Netzumschalter, PV, Wechselrichter, Batterie, Motoren,
  Motorschutz, Überlastrelais und Kontakte, Umrichter, Wechsler, Schwimmer, Schlüsselschalter, Klingel/Gong/
  Summer/Hupe/Türöffner/Klingeltrafo, Netzteil, Diode, Funkenstrecke, Schirm, Erdungsschiene); wartet auf Jean:
  `python3 tools/auswahl_bauen.py kandidaten-erweiterung.json build/erweiterung-auswahl-v0.1.html 'Erweiterung v0.1' 'Stromlaufplan · Fach-Erweiterungen · Auswahl neuer Zeichen' 'slp.erweiterung.auswahl.v1'`

## Etappe G – PV, Speicher, Wallbox (abgestimmt 04.11.2026, Jean: „Alles ja“)

Reihenfolge G1 PV v1.34, G2 Speicher v1.35, G3 Wallbox v1.36 (nach Auswahl „Wallbox v0.1“). Kennzeichen: Wechselrichter -T,
PV-Generator und Batterie -G, Wallbox -E, DC-Freischalter -Q. Wechselrichter dreiphasig ohne eigenes Auswahlblatt aus
dem Baukasten (`geraet_wechselrichter`, gleiche Zeichnung, AC oben).
- G1 v1.34: `k.ziel.anschluss = 'pv'`, `k.pv = { phasen, kwp, dc, zaehler, wr/gen/dcq/p: { bmk } }` (`pvVon()`, `pvNeu()`,
  `pvZeilen()`); im Plan unter Schutzorgan/Zähler/Klemmen der Wechselrichter, darunter DC-Freischalter und PV-Generator,
  der mit der Steckdosenunterkante abschließt (`pvHoehe()`, DC-Leiter schwarz); Teile `k:<id>/t|dc|g|p`.
- G2 v1.35: Hybrid `k.pv.speicher = { kwh, bat }` (Zeichen `wr*_hybrid`, Batterie an DC 3/4), AC-gekoppelt
  `k.ziel.anschluss = 'speicher'`, `k.speicher = { phasen, kwh, wr, bat }` (`speicherVon()`, `speicherNeu()`,
  `speicherZeilen()`); `batterie()` in plan.js: oberer Anschluss = kurze Platte (−), Plus von unten; Teil `k:<id>/bat`.
- G3 v1.36: `k.ziel.anschluss = 'wallbox'`, `k.wallbox = { kw, rdc }` (`wallboxNeu()`), immer dreiphasig, Kennzeichen -E;
  Zeichen `wallbox` (Unterkante des Kastens = Steckdosenunterkante, `WALLBOX_H`); Warnungen: eigener FI je Ladepunkt,
  ohne DC-Fehlerstromerkennung FI Typ B; im Übersichtsplan `ue_steckdose`. Offen (optional): Lastmanagement/Rundsteuer-Kontakt.

## Etappe M – Motoren (abgestimmt 04.11.2026, Jean: „Alles ja“)

Entscheidungen: Motorschutzschalter -Q (81346-2), Überlastrelais -F; Drehstrommotor ohne N (L1 L2 L3 PE, Leitung
4-adrig), N nur beim Wechselstrommotor; Überlastrelais-Öffner 95–96 automatisch in den Spulenpfad (Warnung, wenn er
fehlt); Stern-Dreieck mit zwei Leitungen -W (U1 V1 W1 PE / U2 V2 W2); Wendeschaltung und Stern-Dreieck werden gebraucht.
Teilschritte: M1 v1.37 Direktstart, M2 v1.38 Schütz + Überlastrelais, M3 v1.39 Frequenzumrichter, M4 v1.40 Wende-
und Stern-Dreieck-Schaltung, M5 v1.41 Pumpe mit Schwimmerschalter.
- M1 v1.37: `k.ziel.anschluss = 'motor'`, `k.motor = { art: '3' | '1', kw, strom }` (`motorVon()`, `motorNeu()`),
  `a.ohneN` → `abgangArten()` L1 L2 L3 PE; Zeichen `motor3` bzw. `motor1` mit `motorFarben()`, Unterkante = Steckdosen-
  unterkante (`MOTOR_H`); `GERAETE.motorschutz3` (`kz: 'Q'`, `bereich`, `bmkDx`), `MSS_BEREICH`; Übersicht `ue_leistung`.
- M2 v1.38: `k.schalt.ol = { bereich, bmk }` → `a.ol`; Kontaktplätze `{ g: abgang, z: 'oe_thermisch' | 's_thermisch' }`
  (Art 'ol', 95–96 / 97–98) und `{ g, z: 'mss_s' | 'mss_oe' }` (Art 'ms', Zeichen über `ST_BILD`, Anzahl `k.geraet.hks/hko`);
  `olEinsetzen()`/`olEntfernen()`; `a.olKont` für die Verweise am Überlastrelais; Vorlage `motor`. Motorabgang ohne N:
  kein Abgriff, Warnung (Steuerspannung über Steuer-LS/Steuertrafo).
- M3 v1.39: `k.motor.fu = { bmk }` → `a.fu` (nur Drehstrommotor), Zeichen `umrichter3` vor den Klemmen (Teil `k:<id>/fu`);
  `GESCHIRMT` (2YSLCY-J, NYCWY) → `schirm()` in plan.js (Zeichen `schirm` oben und gedreht unten, gestreckt).
- M4 v1.40: `k.motor.schaltung = 'wende' | 'sd'` (`schaltungSetzen()`), Zusatzschütze als `e.abgaenge['<id>~2'|'<id>~3']`
  (`a.zusatz`, Rollen `SCHALT_ROLLEN`, Daten `k.motor.q2/q3/w2`); `knoten()` löst `~n` auf; plan.js `zeichneWende()`,
  `zeichneSternDreieck()`, `zusatzKontakte()`, Motor `motor6` mit U2 V2 W2 von unten (`SD_H`); Zweige mit `zweig.an`
  (Elternpfad) für die Verriegelung; Vorlagen `wende`, `sterndreieck` (Zeitrelais -K einschaltverzögert, 5 s).
- M5 v1.41: Schwimmerschalter `s_schwimmer`, `oe_schwimmer`, `w_schwimmer` als Befehlsgeber -B; Wechsler-Plätze tragen
  `z: 's_…' | 'oe_…'` (`platzSetzen()` fragt die Seite), Anschlüsse 11–14 bzw. 11–12; Vorlage `pumpe`. Trockenlaufschutz
  als Schließer (unbetätigt = Schwimmer unten = trocken = offen) – im Vorschlag stand irrtümlich „Öffner“.

## Etappe P – Prüfbericht v1.41 (Jean 04.11.2026: „Alle ja“)

Prüfung aller Plankombinationen durch Layout, Zeichen-Design und Schaltplantechnik (Bericht:
https://claude.ai/artifact/WDc2vNc4wqF6Lbrgqv4UFS). Freigegeben, in dieser Reihenfolge:
- E1 Fehler beheben: Überlastrelais am Wechselstrommotor nur im Außenleiter, Stern-Dreieck-Abgriff zwischen Netzschütz
  und Überlastrelais, Kontaktspiegel mit Spalte je Pol, Abgriff nennt alle Kreise, Steuerstromkreis-Texte auf die
  Spalte begrenzt (umbrechen, höchstens 85 % stauchen), Hand-0-Automatik je Kontakt „Hand“/„Auto“, Stern-Dreieck
  Leitungen in einer Zeile, Steuertrafo ohne Platzhaltertext.
- E2 Warnungen (ändern keinen Plan): TN-C hinter getrenntem N/PE, PEN < 10 mm², ungeerdeter Steuerkreis, Hinweis vor
  dem Drucken bei unvollständigen Kreisen.
- E3 Auswahlblatt „Angleichung v0.1“ (alt/neu): FI aus der LS-Klinge, Klingenregel (kurz = Schutzorgane, lang =
  Schalt-/Steuerglieder), Schließer Form 1 ohne Drehpunkt-Kreis, Motorschutzschalter aus der LS-Familie, LS 3-polig mit
  Wirkverbindung, Stromstoß-Spule 40×20, einheitliche Kontaktkennzeichen, Wirkverbindung Sicherungstrenner, eine
  Strichelung, einpolige Übersichtszeichen für Motor/PV/Batterie, Kleinigkeiten D13–D15.
  Auswahlblatt (wartet auf Jean): Vorschläge `…_neu`, `ue_motor`, `ue_pv` in `tools/baukasten.py` (`geraet_fi_neu`,
  `geraet_ls_neu`, `geraet_sicherung_neu`, `geraet_kontakt_neu`, `geraet_melder_neu` …):
  `python3 tools/auswahl_bauen.py kandidaten-angleichung.json build/angleichung-auswahl-v0.1.html 'Angleichung v0.1' 'Stromlaufplan · Prüfbericht E3 · Angleichung der Zeichenfamilien' 'slp.angleichung.auswahl.v1'`
  Auswahl v0.1 (Jean 04.11.2026) übernommen in Bibliothek v1.11 / App v1.48; Ausnahmen: Motorschutzschalter „keine passt“,
  Frequenzumrichter bleibt in heutiger Optik („3~“ als Text) und die Wechselrichter sollen daran angepasst werden,
  PV einpolig offen („Warum G?“), Motor einpolig mit mittigem M. Dazu Auswahl v0.2 (`kandidaten-angleichung2.json`):
  `python3 tools/auswahl_bauen.py kandidaten-angleichung2.json build/angleichung-auswahl-v0.2.html 'Angleichung v0.2' 'Stromlaufplan · Prüfbericht E3 · Motorschutzschalter, PV einpolig, Wechselrichter' 'slp.angleichung.auswahl.v2'`
  Klingenregel: kurze LS-Klinge für Schutzorgane, lange EN-Klinge für Schalt- und Steuerglieder.
- E4 Beschriftungsregel in drei Schritten mit Vorher/Nachher zur Abnahme: R1 Oberkante erste Zeile = erste sichtbare
  Stelle des Zeichens, R5 Endgeräte-Grundlinie; R2 links (Ausnahmen IΔ-Kasten darunter, Melder/Schwimmer rechts), R3
  Textende 1,5 mm vor der gezeichneten linken Kante, Fluchtlinie je Spalte im Steuerstromkreis; R4 2,5 mm zwischen
  Geräten, R6 Zeilenfolge, R7 Pfadtexte unten auf einer Grundlinie, 3,4 mm Zeilenabstand, höchstens drei Zeilen.
- E5 Anschlussbezeichnungen überall, vom Generator, waagerecht rechts am Leiter, 1,8 mm.
- E6 fachliche Ergänzungen: Leitungstyp/Aderkennung (ohne PE-Ader NYM-O, Zahlen nur bei Steuerleitungen), vollständiger
  Übersichtsplan, Klemmenplan mit innerem Ziel und Motoranschluss, Umrichter mit PE und Schirmauflage, Verweis am
  Motorschutzschalter, PEN-Darstellung, Primär-LS 2-polig.
- E7 alle Schrift schwarz, auch Feldtitel und Tabellenköpfe.

## Technische Eckwerte

- Zeichen im Maßstab 1 Einheit = 0,25 mm; Polabstand 20 Einheiten (= 5 mm Leiterabstand);
  Anschlüsse im 10er-Raster.
- EN-Baukasten-Regeln: Pole im Abstand 20, Wirkverbindung gestrichelt quer durch die
  Schaltstücke (y = −11,5), Überstromauslöser im Leiter jedes geschützten Pols, FI mit
  Summenstromwandler-Ellipse und IΔ-Kasten links.
- Blattmaße: A4 297×210 (10 Spalten, 6 Zeilen), A3 420×297 (15, 8); Abgänge enden auf
  `F.h − 10 − 20 − 24`; nichts unterhalb `Schriftfeld-Oberkante − 2 mm`.
- Druck: `#druck`-Container, `@page` je Planart (Plan: Format quer, Rand 0; Türzettel A4
  hoch, 14/12 mm).
- Lizenz der Zeichen: QElectroTech-Elementsammlung, CC-BY 3.0 (siehe `LIZENZEN.md`). Der
  Namensnennungshinweis steht auf dem Startbildschirm, auf dem Deckblatt und auf der
  Bibliotheksseite und muss dort bleiben. Ist das Deckblatt abgeschaltet, trägt der
  gedruckte Plan keinen Hinweis.
