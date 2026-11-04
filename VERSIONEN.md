# Versionen

## App (stromlaufplan)

| Fassung | Inhalt |
|---|---|
| v1.33.1 | Endschalter (Schließer/Öffner) mit Kennzeichen -B |
| v1.33 | Melder (Dämmerung, Bewegung, Präsenz) mit Kennzeichen -B nach DIN EN IEC 81346-2:2019 statt -S |
| v1.32 | Bibliothek v1.7 mit den Fach-Erweiterungen (noch ohne Verwendung) |
| v1.31 | Etappe F8: Kontakte und Verbraucher im Steuerstromkreis frei im Raster; Leiter mit Abzweigen behalten ihre Flucht; abgetrennte Abzweige in der Prüfliste; Beispiel `steuerfrei` |
| v1.30 | Etappe F7: Abgänge über Blattgrenzen ziehen, „Blatt festhalten“ |
| v1.29 | Etappe F6: Mehrfachauswahl (Rahmen, Umschalt+Tippen), gemeinsames Verschieben, Zusätze ziehen, Lupe beim Ziehen mit dem Finger, Pencil-Hover |
| v1.28 | Etappe F5: freie Leiter mit Netzprüfung (Kurzschluss, offenes Ende), Texte, strichpunktierte Rahmen; Werkzeuge in der Palette „Zeichnen“; Beispiel `zusatz` |
| v1.27 | Etappe F4: Leiterstücke antippen (Netz hinterlegt), parallel versetzen (Ziehen, Pfeiltasten), Abzweigstellen wandern samt Verbindungspunkt |
| v1.26 | Etappe F3: Geräte frei im 2,5-mm-Raster (Ziehen, Pfeiltasten), Leiter folgen mit gestaffeltem Knick, Hilfslinien, Prüfliste in der Fußleiste |
| v1.25 | Etappe F2: Abgänge in freie Spalten ziehen (Lücke davor), neues Blatt ab einem Abgang, Stecknadel, „Automatik anwenden“; Projektfassung 2 mit `v.layout`; Beispiel `layout` |
| v1.24 | Etappe F1: Szene je Blatt (Geräte mit Anschlüssen, Leiter mit Leiterart), Plan bitgleich; Geräte eines gewählten Abgangs einzeln antippbar |
| v1.23 | Etappe F0: Zeichen-Cache (Plan 3–4× schneller), Editor erzeugt nur den offenen Verteiler, Prüfung der Projektfassung beim Öffnen, Designsystem mit Farbtokens, Signalfarbe Violett, dunkler Modus der Oberfläche |
| v1.22 | Kurze Auswahlwerte (Nennstrom, Kennlinie, Querschnitt …) als Raster zum schnellen Antippen; Feinschliff Palette und schmale Kopfleiste |
| v1.21 | Neue Arbeitsfläche: Plan-Editor über den ganzen Bildschirm (Kopfleiste, Palette mit Gruppen, Eigenschaften-Leiste bzw. Fach von unten, Fußleiste mit Blattwahl und Zoom), Marken „+“ mit Einfügemenü und Anzahl, Kontextleiste, benanntes Rückgängig, alle Eingaben im Editor, Auswahl am Feld und Text in der Zeile, Startbildschirm mit Verteilerkarten |
| v1.20.1 | Fehlerbehebung: Ausschneiden/Einfügen im Plan-Editor verschiebt das Teil samt Steuerstromkreis; Kopieren legt die Steuerstromkreise mit an |
| v1.20 | Etappe D4: Ziehen im Plan-Editor (Abgänge auf Marken, Kontakte auf Plätze; Finger/Pencil nach kurzem Halten), Tastenkürzel ←/→, Alt+←/→, +/−, Übersicht der Kürzel |
| v1.19 | Etappe D3: Steuerstromkreise direkt im Plan-Editor (Reiter „Steuerung“, Plätze im Blatt antippen, Zweige, Vorlagen); Raster-Bildschirm entfällt |
| v1.18 | Etappe D2: Plan-Editor – Palette und Einfügemarken, Verschieben, Kopieren/Ausschneiden/Einfügen, Löschen; Rückgängig/Wiederholen über das ganze Projekt; Tastenkürzel |
| v1.17 | Etappe D1: Plan-Editor – Teile im Planblatt antippen, Eigenschaften daneben ändern, Zoom; „Plan bearbeiten“ auf dem Startbildschirm und im Verteiler |
| v1.16 | Steuertrafo als dritte Quelle der Steuerspannung (Primär-LS 230 V oder 400 V, Trafo -T, Sekundär-LS, 0 V geerdet/ungeerdet; Leitungen „24 V“/„0 V“); Bibliothek v1.6 |
| v1.15 | Bibliothek v1.5 mit dem Steuertrafo (noch ohne Verwendung) |
| v1.14 | Etappe C4: Vorlagen – Taster parallel (Stromstoß, Treppenlicht), Selbsthaltung Ein/Aus, mit Not-Aus, mit/ohne Betriebsmeldung, Hand-0-Automatik; Befehlsgeber-Anschlüsse je Gerät fortlaufend |
| v1.13 | Etappe C3: Warnungen; Feldgeräte über -X1 (zwei Klemmen je Kontakt, Leitung -W, Klemmenplan); eigenständiges Zeitrelais -K mit verzögerten Kontakten und Kontaktspiegel; Kreise ohne Schaltgerät (Meldeleuchte, Zeitrelais) |
| v1.12 | Etappe C2b: Raster-Editor für Steuerstromkreise – Palette, Raster mit Pfaden und Zweigen, Werkzeugleiste, Rückgängig/Wiederholen, Tastenkürzel (Entf, Strg+Z/Y, Strg+C/V, Pfeile, Alt+↑/↓, Esc); geteilte Ansicht mit Vorschau des Blatts |
| v1.11 | Etappe C2a: Eingabe der Steuerstromkreise in Bildschirmen – Steuerspannung/Quelle/Klemmen je Verteiler, Kreise mit Pfaden, Plätzen, Verbraucher und Zweigen, Befehlsgeber und Meldeleuchten, Steuer-LS im Abgangsbaum; Kreis entsteht mit der Wahl des Schaltgeräts |
| v1.10 | Etappe C1b: Steuerspannung je Verteiler wählbar – je Abgang, gemeinsam durchgeschliffen oder über gebrückte Klemmen (-X1 oder eigene Leiste -X0 mit eigenem Klemmenplan); Quelle Abgang oder Steuer-LS; je Kreis eigener Abgriff möglich; im Steuerstromkreis nur die N-Leitung blau |
| v1.9 | Etappe C1: Blatt „Steuerstromkreis“ je Verteiler (6 Kontaktplätze + Verbraucher je Pfad, Zweige, Kontaktspiegel, Querverweise), Abgriff der Steuerspannung im Abgang, Kennzeichen -S und Meldeleuchte -H; Eingabe vorerst nur über das Beispiel `steuerung` |
| v1.8 | Namensnennung der QElectroTech-Schaltzeichen (CC BY 3.0) auf dem Startbildschirm und dem Deckblatt |
| v1.7 | Schaltgeräte je Abgang (Schütz, Stromstoßschalter, Zeitrelais), Kennzeichen -Q bzw. -K, N mitschalten, Ausstattung an Hilfskontakten; Hauptkontakte im Stromlaufplan, Schützzeichen im Übersichtsschaltplan, Herkunft im Klemmenplan, Zusatz im Türzettel; Verdichtung nur bei Platzmangel |
| v1.6 | Bibliothek v1.4 mit den Zeichen für Steuerstromkreise (noch ohne Verwendung) |
| v1.5 | Klemmenplan -X1 je Verteiler (Aderfarben br/sw/gr/bl/gnge), abschaltbar; N-Trennklemme oder N-Klemme je Verteiler, auch im Stromlaufplan |
| v1.4 | Endklemmen und offene Enden schließen exakt mit der Unterkante der Steckdosen ab (Stromlauf- und Übersichtsschaltplan) |
| v1.3 | Übersichtsschaltplan einpolig je Verteiler, abschaltbar; einpolige Zeichen (Bibliothek v1.3) |
| v1.2 | Deckblatt und Inhaltsverzeichnis, abschaltbar |
| v1.1 | Türzettel (Sicherungsübersicht) je Verteiler, A4 hoch |
| v1.0 | alle Linien in Leiterstärke; Verbindungspunkte überall, wo ≥ 3 Linien treffen |
| v0.9 | Untersammelschienen 0,25 mm |
| v0.8 | Endklemmen der Anschlussdose auf Höhe der übrigen Abgangsenden |
| v0.7 | Geräteanschlussdose (Endklemmen, -X2 …) und Leuchte (-E …); Bibliothek v1.2 |
| v0.6 | alle Abgänge enden unten auf einer Höhe; SPD: PE-Seite grün |
| v0.5 | Schriftfeld als 20-mm-Streifen über die ganze Breite |
| v0.4 | keine Leiter übereinander in Gruppen, Untersammelschienen nur so lang wie nötig, gleiche Endhöhe je Reihe |
| v0.3 | Etappe 4: Generator – Planansicht, A4/A3, Druck/PDF, Einspeisungsblatt, Gruppen, Querverweise, Blattnummern |
| v0.2 | Abgangsklemmen je Verteiler (Voreinstellung ohne), je Abgang abweichend |
| v0.1 | Etappe 3: Datenmodell und Eingabe (mehrere Verteiler, Kennzeichen, Phasenverteilung) |

## Bibliothek

| Fassung | Inhalt |
|---|---|
| v1.7 | Fach-Erweiterungen nach Auswahl „Erweiterung v0.2“ (29 Zeichen): Erzeugung und Speicher, Motoren, Überlastrelais-Kontakte, Schwimmer- und Schlüsselschalter (je gleiche Familie für Schließer/Öffner/Wechsler), Klingel/Gong/Summer/Hupe, Türöffner, Diode, Funkenstrecke, Schirm, Erdungsschiene (Anschlüsse ins Raster gelegt) |
| v1.6 | Transformator einpolig (`ue_trafo`) im EN-Baukasten nachgebaut: Form 1 nach 06-09-01, Maßstab der einpoligen Zeichen, ohne Text |
| v1.5 | Steuertrafo nach Auswahl „Trafo v0.1“: Transformator mit getrennten Wicklungen (allpolig), Transformator mit zwei Wicklungen (einpolig, EN 60617 06-09-01) |
| v1.4 | Steuerstromkreise nach Auswahl „Steuerung v0.2“: Befehlsgeber, Hilfskontakte, Zeitrelais-Spulen, verzögerte Kontakte, Meldeleuchte |
| v1.3 | einpolige Zeichen für den Übersichtsschaltplan |
| v1.2 | Leuchte |
| v1.1 | FI/LS 3P+N |
| v1.0 | feste Bibliothek nach der Auswahl aus dem Musterblatt v0.3 |

## Auswahlblätter und Vorstufen

- Zeichenbibliothek (Musterblatt) v0.1–v0.3: Auswahl der Grundzeichen; v0.2 nach Bedeutung geordnet, v0.3 mit EN-Baukasten.
- Steuerung v0.1–v0.2: Auswahl der Steuerungszeichen; v0.2 eine Bedeutung je Karte.
- Trafo v0.1: Auswahl des Steuertrafos (4 Karten aus der Sammlung, `bibliothek/kandidaten-trafo.json`), ausgewählt: allpolig `transformator_1f_2`, einpolig EN 06-09-01 → Bibliothek v1.5.
- Erweiterung v0.1–v0.2: Fach-Erweiterungen (`bibliothek/kandidaten-erweiterung.json`); v0.2 nach Plausibilitätsprüfung mit gleichen Familien auf gepaarten Karten → Bibliothek v1.7.
- Blattrahmen v0.1–v0.5: Prototyp für Rahmen und Schriftfeld (in die App übernommen).

Ältere Einzeldateien liegen nicht im Repository; die Geschichte beginnt mit v1.8.
