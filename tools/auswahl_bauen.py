"""Baut ein Auswahlblatt (Musterblatt) für neue Zeichen. Aufruf:
  python3 tools/auswahl_bauen.py kandidaten-steuerung.json build/steuerung-auswahl-v0.3.html 'Steuerung v0.3' 'Untertitel' 'speicher.schluessel'
Die Kandidatendatei liegt in bibliothek/. Ursprünglich:
Baut das Musterblatt: bettet die Sammlungszeichen unverändert ein und
ergänzt die Zeichen aus dem EN-Baukasten (tools/baukasten.py)."""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import baukasten
from pfade import SAMMLUNG, SRC, BIB, WURZEL, sammlung_pruefen
sammlung_pruefen()

basis = SAMMLUNG
kand = json.loads((BIB / sys.argv[1]).read_text())
bau = baukasten.alle()
fehlt = []
for k in kand:
    k['zeichen'] = []
    for d in k.pop('dateien'):
        z = {'zusatz': d.get('zusatz', ''), 'en': bool(d.get('en'))}
        if 'bau' in d:
            b = bau[d['bau']]
            z.update(pfad='EN-Baukasten/' + d['bau'], xml=b['xml'], quellen=b['quellen'], bem=b['bem'])
        else:
            f = basis / d['pfad']
            if not f.exists():
                fehlt.append(d['pfad']); continue
            z.update(pfad='10_electric/' + d['pfad'], xml=f.read_text(encoding='utf-8'))
        k['zeichen'].append(z)
if fehlt:
    sys.exit('Fehlt: ' + ', '.join(fehlt))
html = (SRC / 'auswahl-vorlage.html').read_text()
html = html.replace('/*RENDERER*/', (SRC / 'qet-render.js').read_text())
if len(sys.argv) > 3:     # Fassung, Untertitel, Speicherschlüssel
    html = html.replace("const FASSUNG = 'v0.3';", f"const FASSUNG = '{sys.argv[3]}';")
    html = html.replace('Stromlaufplan · Etappe 1 · Auswahl der Schaltzeichen', sys.argv[4])
    html = html.replace("'slp.bibliothek.auswahl.v3'", f"'{sys.argv[5]}'")
html = html.replace('/*DATEN*/', json.dumps(kand, ensure_ascii=False).replace('</', '<\\/'))
aus = WURZEL / sys.argv[2]; aus.parent.mkdir(parents=True, exist_ok=True)
aus.write_text(html, encoding='utf-8')
print(aus, round(len(html.encode()) / 1024), 'KB,', sum(len(k['zeichen']) for k in kand), 'Zeichen')
