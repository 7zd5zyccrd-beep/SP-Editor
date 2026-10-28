"""Prüft die gebaute App (docs/index.html) mit den Beispielprojekten:
- keine Skriptfehler, Blattliste je Beispiel
- alle Abgänge enden auf einer Höhe (Unterkante der Steckdosen), Leuchten ausgenommen
- Blätter als PNG und der Druck als PDF nach build/pruefung/
- mit --vergleich: SVG aller Blätter gegen tests/referenz.json (bitgleich);
  mit --referenz: Referenz neu schreiben (nur nach einer gewollten Änderung!)
Aufruf: python3 tests/pruefen.py [--vergleich | --referenz]"""
import sys, json, hashlib, pathlib
from playwright.sync_api import sync_playwright
W = pathlib.Path(__file__).resolve().parent.parent
APP = W / 'docs' / 'index.html'; AUS = W / 'build' / 'pruefung'; REF = W / 'tests' / 'referenz.json'
AUS.mkdir(parents=True, exist_ok=True)
BSP = (W / 'tests' / 'beispiele.js').read_text()
modus = sys.argv[1] if len(sys.argv) > 1 else ''
hashes, fehler = {}, []
with sync_playwright() as p:
    b = p.chromium.launch()
    for name in ['grund', 'klemmen', 'schalt', 'steuerung']:
        pg = b.new_page(viewport={'width': 1100, 'height': 900}, device_scale_factor=2)
        pg.on('pageerror', lambda e, n=name: fehler.append(f'{n}: {e}'))
        pg.goto(APP.as_uri()); pg.wait_for_timeout(300)
        pg.add_script_tag(content=BSP); pg.evaluate(f'BEISPIELE.{name}()')
        # Datum festhalten, damit der Vergleich nicht vom Tag abhängt
        pg.evaluate("P.projekt.datum = '2026-10-24'")
        svgs = pg.evaluate("PLAN.blaetter(P, BIB, { berechne, speisenderAbgang }).blaetter.map(b => [b.nr + ' ' + b.titel + ' ' + b.art, b.svg.outerHTML])")
        hashes[name] = [[t, hashlib.md5(s.encode()).hexdigest()] for t, s in svgs]
        print(name, ':', ', '.join(t for t, _ in svgs))
        pg.evaluate("stapel = [{ s: 'plan' }]; zeichne()"); pg.wait_for_timeout(800)
        n = pg.locator('.blattkarte svg').count()
        for i in range(n): pg.locator('.blattkarte svg').nth(i).screenshot(path=str(AUS / f'{name}_{i + 1}.png'))
        # Unterkante: tiefster Punkt je Pfad im Band über dem Schriftfeld (nur Stromlaufplan- und Übersichtsblätter)
        unten = pg.evaluate("""() => [...document.querySelectorAll('.blattkarte')].map(k => {
            const svg = k.querySelector('svg'), R = svg.getBoundingClientRect(), kx = 297 / R.width, ys = {};
            svg.querySelectorAll('line,path,circle,ellipse,polyline,polygon').forEach(e => { const r = e.getBoundingClientRect();
              const y = (r.bottom - R.top) * kx, x = Math.round(((r.left + r.right) / 2 - R.left) * kx);
              if (y > 120 && y < 178 && x > 30 && x < 285) ys[x] = Math.max(ys[x] || 0, y); });
            return [k.querySelector('.bt').innerText.replace(/\\n/g, ' '), Object.values(ys).map(y => +y.toFixed(2))]; })""")
        for t, ys in unten:
            if ys and ('Übersicht' in t or t.count('·') and 'Klemmen' not in t and 'Steuer' not in t and 'Deckblatt' not in t and 'Inhalt' not in t):
                werte = sorted(set(ys)); haupt = max(set(ys), key=ys.count)
                ab = [y for y in werte if y > haupt + 0.01 and y - haupt not in (1.5,)]
                if any(y - haupt > 2 for y in ab): fehler.append(f'{name} {t}: Pfad endet tiefer als die Steckdosen ({haupt} mm): {ab}')
        pg.evaluate("window.print = () => {}; drucken()"); pg.wait_for_timeout(300)
        pg.emulate_media(media='print'); pg.pdf(path=str(AUS / f'{name}.pdf'), prefer_css_page_size=True); pg.emulate_media(media='screen')
        pg.close()
    b.close()
if modus == '--referenz':
    REF.write_text(json.dumps(hashes, ensure_ascii=False, indent=1)); print('Referenz geschrieben:', REF)
elif modus == '--vergleich':
    ref = json.loads(REF.read_text())
    for name, liste in hashes.items():
        r = ref.get(name, [])
        if [t for t, _ in r] != [t for t, _ in liste]: fehler.append(f'{name}: andere Blattliste als die Referenz')
        for (t, h), (_, h0) in zip(liste, r):
            if h != h0: fehler.append(f'{name}: Blatt {t} weicht von der Referenz ab')
print('Ausgabe:', AUS)
if fehler:
    print('FEHLER:'); [print(' -', f) for f in fehler]; sys.exit(1)
print('alles in Ordnung')
