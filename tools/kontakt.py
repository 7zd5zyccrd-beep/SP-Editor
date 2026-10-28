"""Kontaktbogen: rendert alle .elmt in den angegebenen Ordnern in ein Raster
und speichert einen Screenshot. Aufruf: python3 -I kontakt.py ausgabe.png ordner..."""
import sys, json, pathlib
from playwright.sync_api import sync_playwright

aus = sys.argv[1]
dateien = []
for d in sys.argv[2:]:
    p = pathlib.Path(d)
    dateien += sorted(p.rglob('*.elmt')) if p.is_dir() else [p]
basis = SAMMLUNG.parent
daten = [{'pfad': str(f.relative_to(basis)) if f.is_relative_to(basis) else f.name,
          'xml': f.read_text(encoding='utf-8', errors='replace')} for f in dateien]
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from pfade import SRC, SAMMLUNG
js = (SRC / 'qet-render.js').read_text()
html = """<!doctype html><meta charset=utf-8><style>
body{font:11px Arial;margin:8px;background:#fff}
.g{display:grid;grid-template-columns:repeat(6,180px);gap:6px}
.c{border:1px solid #ccc;padding:3px}
.c svg{width:172px;height:130px;display:block}
.k{font-size:9px;color:#555;word-break:break-all}.d{font-weight:bold;font-size:10px}
</style><div class=g id=g></div><script>""" + js + """
const D=""" + json.dumps(daten) + """;
const G=document.getElementById('g');
D.forEach((d,i)=>{const c=document.createElement('div');c.className='c';
 const s=document.createElementNS('http://www.w3.org/2000/svg','svg');c.appendChild(s);
 const r=QET.zeichne(d.xml,{terminals:true});s.appendChild(r.g);
 G.appendChild(c);
 const b=r.g.getBBox();const m=6;
 s.setAttribute('viewBox',`${b.x-m} ${b.y-m} ${b.width+2*m} ${b.height+2*m}`);
 const t=document.createElement('div');t.innerHTML='<span class=d>#'+i+' '+QET.name(d.xml)+'</span><div class=k>'+d.pfad.split('/').slice(-2).join('/')+'</div>';c.appendChild(t);});
</script>"""
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1130, 'height': 800})
    pg.set_content(html)
    pg.wait_for_timeout(300)
    pg.screenshot(path=aus, full_page=True)
    b.close()
print(len(daten), 'Zeichen ->', aus)
