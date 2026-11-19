"""Baut die App als eine HTML-Datei: Vorlage + Bibliothek + Übersetzer + Generator.
Aufruf: python3 tools/app_bauen.py v1.7
Ergebnis: docs/index.html (GitHub Pages) und build/stromlaufplan-v1.7.html"""
import json, re, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from pfade import SRC, BIB, DOCS, BUILD

fassung = sys.argv[1]
bib = json.loads((BIB / 'bibliothek.json').read_text())
daten = json.dumps(bib, ensure_ascii=False).replace('</', '<\\/')
# Beispielprojekt (ab v1.54): „grund“ aus tests/beispiele.js wird als „Beispiel ansehen“ eingebettet
from pfade import WURZEL
bsp = (WURZEL / 'tests' / 'beispiele.js').read_text()
m = re.search(r"\n  grund: \(\)=>\{\n(.*?)\},\n  // wie grund", bsp, re.S)
if not m: sys.exit('Beispiel „grund“ in tests/beispiele.js nicht gefunden')
t = (SRC / 'app-vorlage.html').read_text()
# Build-Prüfungen (ab v1.86, Q54/X29): Platzhalter genau einmal (FASSUNG zweimal: Kopf und Konstante), kein „</script“ in den
# eingesetzten Teilen, Fassung im Kopf der Vorlage und in VERSIONEN.md
fehler = []
if not re.fullmatch(r'v\d+\.\d+(\.\d+)?', fassung): fehler.append(f'Fassung „{fassung}“ hat nicht die Form v1.xx')
for ph, n in (('BIBLIOTHEK', 1), ('RENDERER', 1), ('PLAN', 1), ('BEISPIEL', 1), ('FASSUNG', 2)):
    if t.count(f'/*{ph}*/') != n: fehler.append(f'Platzhalter /*{ph}*/ steht {t.count(f"/*{ph}*/")}× in der Vorlage (erwartet {n}×)')
teile = {'qet-render.js': (SRC / 'qet-render.js').read_text(), 'plan.js': (SRC / 'plan.js').read_text(), 'Beispiel grund': m.group(1).replace('</', '<\\/'), 'Bibliothek': daten}
for name, inhalt in teile.items():
    if re.search(r'</script', inhalt, re.I): fehler.append(f'„</script“ in {name} – würde das Skript beenden')
    for ph in ('BIBLIOTHEK', 'RENDERER', 'PLAN', 'BEISPIEL', 'FASSUNG'):
        if f'/*{ph}*/' in inhalt: fehler.append(f'Platzhalter /*{ph}*/ in {name}')
kopf = t[t.find('<!-- Stromlaufplan'):]; kopf = kopf[:kopf.find('-->')]
if not re.search(rf'^\s+{re.escape(fassung)}:', kopf, re.M): fehler.append(f'kein Versionseintrag „{fassung}:“ im Kopf von src/app-vorlage.html')
if not re.search(rf'^\| {re.escape(fassung)} \|', (WURZEL / 'VERSIONEN.md').read_text(), re.M): fehler.append(f'kein Eintrag „| {fassung} |“ in VERSIONEN.md')
if fehler: sys.exit('Build abgebrochen:\n- ' + '\n- '.join(fehler))
t = t.replace('/*BIBLIOTHEK*/', daten).replace('/*RENDERER*/', teile['qet-render.js'])
t = t.replace('/*PLAN*/', teile['plan.js']).replace('/*FASSUNG*/', fassung)
t = t.replace('/*BEISPIEL*/', teile['Beispiel grund'])
if len(re.findall(r'<script\b', t, re.I)) != len(re.findall(r'</script>', t, re.I)): sys.exit('Build abgebrochen: <script> und </script> passen nicht zusammen')
DOCS.mkdir(exist_ok=True); BUILD.mkdir(exist_ok=True)
(DOCS / 'index.html').write_text(t)
aus = BUILD / f'stromlaufplan-{fassung}.html'; aus.write_text(t)
print(DOCS / 'index.html', '+', aus, round(len(t.encode()) / 1024), 'KB, Bibliothek', bib['fassung'])
