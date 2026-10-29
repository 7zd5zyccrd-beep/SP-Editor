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
    for name in ['grund', 'klemmen', 'schalt', 'steuerung', 'gemeinsam', 'bruecke', 'bruecke0', 'eingabe', 'zeitrelais', 'vorlagen', 'trafo', 'trafo400']:
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
        # alle Eingabebildschirme des ersten Verteilers einmal aufbauen (Skriptfehler fallen auf)
        fehler += [f'{name}: Bildschirm {x}' for x in pg.evaluate("""() => { const v = P.verteiler[0], st = v.steuerung || {}, aus = [];
            const seiten = [{ s: 'verteiler', vid: v.id }, { s: 'steuerung', vid: v.id }, { s: 'editor', vid: v.id }];
            // Plan-Editor: jedes Teil einmal gewählt
            const zs = new Set(); PLAN.blaetter(P, BIB, { berechne, speisenderAbgang }, { ziele: true }).blaetter.forEach(bl =>
              bl.svg.querySelectorAll('[data-ziel]').forEach(r => zs.add(r.dataset.ziel)));
            zs.forEach(z => seiten.push({ s: 'editor', vid: v.id, sel: z }));
            (st.kreise || []).forEach(kr => seiten.push({ s: 'kreis', vid: v.id, krid: kr.id }));
            (st.geraete || []).forEach(g => seiten.push({ s: 'sgeraet', vid: v.id, gid: g.id }));
            alleKnoten(v, k => { if (k.typ === 'abgang') seiten.push({ s: 'abgang', vid: v.id, kid: k.id }); });
            for (const s of seiten) { try { stapel = [{ s: 'start' }, s]; zeichne(); } catch (e) { aus.push(JSON.stringify(s) + ': ' + e.message); } }
            stapel = [{ s: 'start' }]; zeichne(); return aus; }""")]
        if name == 'grund':
            # Plan-Editor per Klick: Abgang im Blatt antippen → Eigenschaften mit Schutzorgan
            pg.evaluate("stapel = [{ s: 'start' }]; zeichne()")
            pg.locator('button.zeile', has_text='Plan bearbeiten').first.click(); pg.wait_for_timeout(300)
            pg.locator('rect.ziel[data-ziel^="k:"]').nth(1).dispatch_event('click'); pg.wait_for_timeout(300)
            if not pg.locator('.eigen', has_text='Schutzorgan').count(): fehler.append('grund: Plan-Editor – Eigenschaften nach Antippen fehlen')
            pg.screenshot(path=str(AUS / 'grund_editor.png'), full_page=False)
            # Einfügen: Werkzeug Leuchte, Marke „+“ hinter dem ersten Abgang, dann Strg+Z
            n0 = pg.evaluate("(() => { let n = 0; alleKnoten(P.verteiler[0], () => n++); return n; })()")
            pg.locator('.werkzeug', has_text='Leuchte').click(); pg.wait_for_timeout(300)
            pg.locator('g.marke[data-ziel^="nach:"]').first.dispatch_event('click'); pg.wait_for_timeout(300)
            n1 = pg.evaluate("(() => { let n = 0; alleKnoten(P.verteiler[0], () => n++); return n; })()")
            if n1 != n0 + 1: fehler.append(f'grund: Plan-Editor – Einfügen ergab {n0} → {n1}')
            pg.keyboard.press('Control+z'); pg.wait_for_timeout(300)
            n2 = pg.evaluate("(() => { let n = 0; alleKnoten(P.verteiler[0], () => n++); return n; })()")
            if n2 != n0: fehler.append(f'grund: Plan-Editor – Strg+Z ergab {n2} statt {n0}')
            # Ziehen mit der Maus: ersten Abgang (Gruppe -F3) hinter den letzten Abgang ziehen
            pg.evaluate("stapel = [{ s: 'start' }, { s: 'editor', vid: P.verteiler[0].id }]; zeichne()"); pg.wait_for_timeout(300)
            erst = pg.evaluate("P.verteiler[0].knoten[0].id"); letzt = pg.evaluate("P.verteiler[0].knoten.at(-1).id")
            q = pg.locator(f'rect.ziel[data-ziel="k:{erst}"]').first; q.scroll_into_view_if_needed(); bx = q.bounding_box()
            pg.mouse.move(bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] / 2); pg.mouse.down()
            pg.mouse.move(bx['x'] + bx['width'] / 2 + 12, bx['y'] + bx['height'] / 2 + 4); pg.wait_for_timeout(100)
            mk = pg.locator(f'g.marke[data-ziel="nach:{letzt}"]').first; mk.scroll_into_view_if_needed(); mb = mk.bounding_box()
            pg.mouse.move(mb['x'] + mb['width'] / 2, mb['y'] + mb['height'] / 2, steps=5); pg.mouse.up(); pg.wait_for_timeout(300)
            if pg.evaluate("P.verteiler[0].knoten.at(-1).id") != erst: fehler.append('grund: Plan-Editor – Ziehen hat den Abgang nicht verschoben')
            pg.evaluate("BEISPIELE.grund(); P.projekt.datum = '2026-10-24'")
            pg.evaluate("stapel = [{ s: 'start' }]; zeichne()")
        if name == 'eingabe':
            # Platz per Klick belegen: Kreis -Q4, Platz 3 → Taster Schließer → neues Gerät „Mitte“
            pg.evaluate("""() => { const v = P.verteiler[0], kr = v.steuerung.kreise.find(k => k.pfade.length > 1);
                stapel = [{ s: 'start' }, { s: 'kreis', vid: v.id, krid: kr.id }]; zeichne(); }""")
            pg.locator('button.zeile', has_text='Platz 3').first.click()
            pg.locator('.wahl button', has_text='Taster Schließer').click(); pg.wait_for_timeout(100)
            pg.locator('.wahl button', has_text='+ neu').click(); pg.wait_for_timeout(100)
            pg.locator('.fenster input').fill('Mitte'); pg.keyboard.press('Enter'); pg.wait_for_timeout(100)
            ok = pg.evaluate("""() => { const v = P.verteiler[0], kr = v.steuerung.kreise.find(k => k.pfade.length > 1), pl = kr.pfade[0].plaetze[2];
                const g = pl && v.steuerung.geraete.find(x => x.id === pl.g); return !!g && g.zeichen === 'taster_s' && g.bez === 'Mitte'; }""")
            if not ok: fehler.append('eingabe: Platz per Klick belegen hat nicht geklappt')
            # Plan-Editor, Steuerung: Werkzeug Taster Schließer, Platz 4 im ersten Pfad, neues Gerät „Blatt“; dann Entf und Strg+Z
            pg.evaluate("""() => { const v = P.verteiler[0], kr = v.steuerung.kreise.find(k => k.pfade.length > 1);
                window.KR = kr.id; window.PF = kr.pfade[0].id; imPlan(v, kr); }""")
            pg.wait_for_timeout(300)
            pg.locator('.werkzeug', has_text='Taster Schließer').click(); pg.wait_for_timeout(200)
            zel = lambda: pg.locator(f'rect.ziel[data-ziel="pl:{pg.evaluate("PF")}:3"]')
            zel().dispatch_event('click'); pg.wait_for_timeout(200)
            pg.locator('.wahl button', has_text='+ neu').click(); pg.wait_for_timeout(100)
            pg.locator('.fenster input').fill('Blatt'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
            platz = """() => { const v = P.verteiler[0], kr = v.steuerung.kreise.find(k => k.id === KR), pl = kr.pfade[0].plaetze[3];
                const g = pl && v.steuerung.geraete.find(x => x.id === pl.g); return g ? g.bez : null; }"""
            if pg.evaluate(platz) != 'Blatt': fehler.append('eingabe: Plan-Editor – Platz belegen hat nicht geklappt')
            pg.keyboard.press('Escape'); pg.wait_for_timeout(100); zel().dispatch_event('click'); pg.wait_for_timeout(200)
            pg.keyboard.press('Delete'); pg.wait_for_timeout(200)
            if pg.evaluate(platz) is not None: fehler.append('eingabe: Plan-Editor – Entf hat den Platz nicht geleert')
            pg.keyboard.press('Control+z'); pg.wait_for_timeout(200)
            if pg.evaluate(platz) != 'Blatt': fehler.append('eingabe: Plan-Editor – Strg+Z hat nicht wiederhergestellt')
            # Vorlage per Klick aus der Platz-Leiste: Taster parallel, 2 Taster, Ersetzen bestätigen
            zel().dispatch_event('click'); pg.wait_for_timeout(200)
            pg.locator('.eigen .leiste button', has_text='Vorlage').click(); pg.wait_for_timeout(150)
            pg.locator('.wahl button', has_text='Taster parallel').click(); pg.wait_for_timeout(150)
            pg.locator('.wahl button', has_text='2 Taster').click(); pg.wait_for_timeout(150)
            pg.locator('.fenster .knopf.rot').click(); pg.wait_for_timeout(200)
            n = pg.evaluate("""() => { const kr = P.verteiler[0].steuerung.kreise.find(k => k.id === KR);
                return kr.pfade.length + ':' + kr.pfade.filter(p => p.plaetze[0]).length; }""")
            if n != '2:2': fehler.append(f'eingabe: Vorlage per Klick ergab {n}')
            pg.screenshot(path=str(AUS / 'eingabe_editor.png'), full_page=False)
            pg.evaluate("BEISPIELE.eingabe(); P.projekt.datum = '2026-10-24'")
        if name == 'steuerung':
            # Ausschneiden/Einfügen verschiebt (Steuerstromkreis bleibt), Kopieren legt einen eigenen Kreis an (ab v1.20.1)
            r = pg.evaluate("""() => { const v = P.verteiler[0], e = berechne(v), b = { s: 'editor', vid: v.id };
                const k = schaltAbgaenge(v, e)[0], kr0 = kreisVon(v, k.id), n0 = v.steuerung.kreise.length;
                const ziel = v.knoten.at(-1).id === k.id ? v.knoten[0].id : v.knoten.at(-1).id;
                b.sel = 'k:' + k.id; editorAktion(v, b, 'ausschneiden'); b.tool = 'ablage'; editorEinfuegen(v, b, 'nach:' + ziel);
                const ok1 = !!knoten(v, k.id) && kreisVon(v, k.id) === kr0 && v.steuerung.kreise.length === n0 && Object.keys(berechne(v).steuer.aktiv).includes(kr0.id);
                b.sel = 'k:' + k.id; editorAktion(v, b, 'kopieren'); b.tool = 'ablage'; editorEinfuegen(v, b, 'nach:' + k.id);
                const neu = knoten(v, b.sel.slice(2)).k, kr1 = kreisVon(v, neu.id);
                const ok2 = neu.id !== k.id && !!kr1 && kr1 !== kr0 && v.steuerung.kreise.length === n0 + 1;
                return [ok1, ok2]; }""")
            if not r[0]: fehler.append('steuerung: Ausschneiden/Einfügen hat den Steuerstromkreis verloren')
            if not r[1]: fehler.append('steuerung: Kopieren/Einfügen hat keinen eigenen Steuerstromkreis angelegt')
            pg.evaluate("BEISPIELE.steuerung(); P.projekt.datum = '2026-10-24'")
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
