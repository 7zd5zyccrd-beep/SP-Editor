# SP-Editor – Stromlaufplan

Web-App für Stromlaufpläne von Elektroverteilern: Eingabe von Einspeisung, Schutzorganen,
Gruppen und Abgängen; daraus entstehen Deckblatt, Inhaltsverzeichnis,
Übersichtsschaltplan (einpolig), Stromlaufplan (allpolig), Klemmenplan und Türzettel –
zum Drucken oder als PDF.

- **App:** `docs/index.html` (eine Datei, läuft offline im Browser; über GitHub Pages
  aus dem Ordner `docs/` veröffentlichen).
- **Zeichenbibliothek:** `docs/bibliothek.html`.
- **Bauen:** `python3 tools/app_bauen.py v1.11`
- **Prüfen:** `python3 tests/pruefen.py --vergleich`

Arbeitsweise, Festlegungen und Planung stehen in `CLAUDE.md`, die Versionen in
`VERSIONEN.md`.
