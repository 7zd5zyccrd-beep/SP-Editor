"""Baut die App als eine HTML-Datei: Vorlage + Bibliothek + Übersetzer + Generator.
Aufruf: python3 tools/app_bauen.py v1.7
Ergebnis: docs/index.html (GitHub Pages) und build/stromlaufplan-v1.7.html"""
import json, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from pfade import SRC, BIB, DOCS, BUILD

fassung = sys.argv[1]
bib = json.loads((BIB / 'bibliothek.json').read_text())
daten = json.dumps(bib, ensure_ascii=False).replace('</', '<\\/')
t = (SRC / 'app-vorlage.html').read_text()
t = t.replace('/*BIBLIOTHEK*/', daten).replace('/*RENDERER*/', (SRC / 'qet-render.js').read_text())
t = t.replace('/*PLAN*/', (SRC / 'plan.js').read_text()).replace('/*FASSUNG*/', fassung)
DOCS.mkdir(exist_ok=True); BUILD.mkdir(exist_ok=True)
(DOCS / 'index.html').write_text(t)
aus = BUILD / f'stromlaufplan-{fassung}.html'; aus.write_text(t)
print(DOCS / 'index.html', '+', aus, round(len(t.encode()) / 1024), 'KB, Bibliothek', bib['fassung'])
