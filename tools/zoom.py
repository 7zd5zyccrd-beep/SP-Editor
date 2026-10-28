"""Einzelne Zeichen groß rendern: python3 -I zoom.py aus.png datei..."""
import sys, pathlib
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from pfade import SRC, SAMMLUNG
js = (SRC / 'qet-render.js').read_text()
teile = []
for f in sys.argv[2:]:
    x = pathlib.Path(f).read_text(encoding='utf-8').replace('`','')
    teile.append((pathlib.Path(f).name, x))
html = "<!doctype html><meta charset=utf-8><body style='margin:6px;font:13px Arial'><div id=g style='display:flex;flex-wrap:wrap;gap:8px'></div><script>"+js+"""
const D=%s; D.forEach(([n,x])=>{const c=document.createElement('div');c.style.border='1px solid #ccc';
const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('width',360);s.setAttribute('height',300);c.appendChild(s);
const r=QET.zeichne(x,{terminals:true,labels:false});s.appendChild(r.g);document.getElementById('g').appendChild(c);
const b=r.g.getBBox();s.setAttribute('viewBox',(b.x-4)+' '+(b.y-4)+' '+(b.width+8)+' '+(b.height+8));
c.appendChild(document.createTextNode(n));});</script>""" % __import__('json').dumps(teile)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width':1150,'height':700})
    pg.set_content(html); pg.wait_for_timeout(200); pg.screenshot(path=sys.argv[1], full_page=True); b.close()
