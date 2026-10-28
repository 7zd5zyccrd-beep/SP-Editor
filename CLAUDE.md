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
  -XD Steckdosen, -E Leuchten, -W Leitungen; für Steuerstromkreise vorgesehen: -S Taster,
  Schalter, Melder; -H Meldeleuchten.

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

## Etappe C – Steuerstromkreise (abgestimmt, in Arbeit)

**Detailvorschlag (abgestimmt 28.10.2026)** – Teil-Etappen je mit eigener Version:
C1 v1.9 Blatt „Steuerstromkreis“ aus dem Datenmodell, Eingabe zunächst nur über das
Beispiel `steuerung` (Aussehen festlegen); C1b v1.10 Steuerspannung wählbar (Beispiele
`gemeinsam`, `bruecke`, `bruecke0`); C2 v1.11 Strompfad-Editor mit geteilter Ansicht
(dann auch Eingabe des Steuer-LS); C3 v1.12 Warnungen, Klemmen über -X1, Leitungen -W,
eigenständiges Zeitrelais; C4 v1.13 Vorlagen.
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
- Steuertrafo als dritte Quelle später; Zeichen dafür zuerst über ein Auswahlblatt
  (in der Bibliothek v1.4 gibt es keinen Trafo).
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
