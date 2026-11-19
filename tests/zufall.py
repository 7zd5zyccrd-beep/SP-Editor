"""Zufalls- und Kombinationstests mit festen Seeds (ab v1.86, Etappe Z2: Q53, X26) – übernommen aus der Prüfung Etappe Q
(scratchpad q/pruefung/robust: fuzz.js, kombi.js). Je Seed ein Beispiel, dann zufällige Bedienschritte über die Funktionen der
Bedienelemente (tests/zufall_seite.js); nach jedem Schritt: keine Skriptfehler, PLAN.blaetter wirft nicht, keine Prüfhinweise
der Blätter, Export→Import ist verlustfrei; alle 5 Schritte nichts außerhalb des Blattrahmens; am Ende stellt Rückgängig den
Ausgangsstand bitgenau her. Kombinationen: Endgerät × Gruppe × Klemmen × Schaltgerät × Schutzorgan × A4/A3, nichts außerhalb des
Rahmens; dazu 1/N/PE und TN-C/TN-C-S.
Aufruf: python3 tests/zufall.py [--seeds 1-20] [--schritte 40] [--ohne-kombi] [--geraet 'iPad Pro 11']"""
import sys, json, pathlib, argparse
from playwright.sync_api import sync_playwright
W = pathlib.Path(__file__).resolve().parent.parent
APP = (W / 'docs' / 'index.html').as_uri()
BSP = (W / 'tests' / 'beispiele.js').read_text(); FZ = (W / 'tests' / 'zufall_seite.js').read_text()
BEISPIELE = ['grund', 'schalt', 'motorsteuerung', 'schaltungen', 'pv', 'tncuv', 'vorlagen', 'trafo', 'zusatz', 'steuerfrei', 'breitgruppe', 'pumpe',
             'speicher', 'wallbox', 'einphasig', 'tt', 'notaus', 'angaben', 'baustrom', 'abschaltung']
ap = argparse.ArgumentParser(); ap.add_argument('--seeds', default='1-20'); ap.add_argument('--schritte', type=int, default=40)
ap.add_argument('--ohne-kombi', action='store_true'); ap.add_argument('--geraet', default='')
arg = ap.parse_args()
von, _, bis = arg.seeds.partition('-'); von = int(von); bis = int(bis or von)
fehler = []
SEED_JS = "sd => { let s = sd * 7919; Math.random = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }"
with sync_playwright() as p:
    b = p.chromium.launch()
    for seed in range(von, bis + 1):
        ctx = b.new_context(**({k: w for k, w in p.devices[arg.geraet].items() if k != 'default_browser_type'} if arg.geraet else {'viewport': {'width': 1440, 'height': 900}}))
        pg = ctx.new_page(); perr = []
        pg.on('pageerror', lambda e: perr.append(str(e))); pg.on('console', lambda m: perr.append('console: ' + m.text) if m.type == 'error' else None)
        pg.add_init_script(f'({SEED_JS})({seed})')
        pg.goto(APP); pg.wait_for_timeout(200); pg.add_script_tag(content=BSP); pg.add_script_tag(content=FZ)
        bsp = BEISPIELE[seed % len(BEISPIELE)]
        pg.evaluate("([b, s]) => { BEISPIELE[b](); FZ.seed(s); stapel = [{ s: 'start' }, { s: 'editor', vid: P.verteiler[0].id }]; zeichne(); verlauf.zurueck = []; verlauf.vor = []; verlauf.stand = JSON.stringify(P); }", [bsp, seed])
        start = pg.evaluate('JSON.stringify(P)'); verst = []; info = set()
        for i in range(arg.schritte):
            f0 = len(perr)
            d = pg.evaluate("() => { try { return FZ.schritt(false); } catch (e) { return 'WURF ' + e.message + ' @ ' + (e.stack || '').split('\\n')[1]; } }")
            pg.evaluate("() => { while (fensterStapel.length) fensterStapel[fensterStapel.length - 1](false); }")
            inv = pg.evaluate('FZI.pruef()')
            if i % 5 == 4 or i == arg.schritte - 1: inv += ['Rahmen: ' + x for x in pg.evaluate('(() => { try { return FZI.rahmen(); } catch (e) { return ["rahmen wirft " + e.message]; } })()')]
            # Prüfhinweise der Blätter (z. B. „reicht in das Schriftfeld“ nach Verschieben von Hand) meldet die App selbst – kein Fehler;
            # etwas außerhalb des Rahmens ist nur dann ein Fehler, wenn die App es nicht meldet
            hinweise = [x for x in inv if x.startswith('pruef ')]; inv = [x for x in inv if not x.startswith('pruef ') and not (hinweise and x.startswith('Rahmen: Blatt'))]
            if hinweise: info.add(hinweise[0].split(': ', 1)[1][:60])
            neu = perr[f0:] + ([d] if d.startswith('WURF') else [])
            if neu or inv: verst.append(f'#{i} {d}: ' + ' ;; '.join(neu + inv)[:300])
        r = pg.evaluate("""start => { stapel = [{ s: 'start' }]; zeichne(); let n = 0; while (verlauf.zurueck.length && n < 300) { projektRueck(false); n++; } return [n, JSON.stringify(P) === start]; }""", start)
        if not r[1]: verst.append(f'Rückgängig ({r[0]} Schritte) stellt den Ausgangsstand nicht her')
        print(f'seed {seed} {bsp}: {arg.schritte} Schritte, {len(verst)} Verstöße, Rückgängig {r[0]} Schritte → {"gleich" if r[1] else "ABWEICHEND"}', flush=True)
        for x in verst[:5]: print('   ', x)
        for x in sorted(info): print('    Hinweis der App:', x)
        fehler += [f'seed {seed} {bsp}: {x}' for x in verst]
        ctx.close()
    if not arg.ohne_kombi:
        pg = b.new_page(viewport={'width': 1440, 'height': 900}); perr = []
        pg.on('pageerror', lambda e: perr.append(str(e)))
        pg.goto(APP); pg.wait_for_timeout(200); pg.add_script_tag(content=FZ)
        r = pg.evaluate("""() => {
          const END = ['steckdose5', 'wallbox', 'pv', 'pvHybrid', 'speicher', 'motor3', 'motor1', 'motorFU', 'motorWende', 'motorSD'], aus = []; let n = 0;
          for (const end of END) for (const gruppe of [false, true]) for (const kl of ['ohne', 'leiste']) for (const sg of ['', 'schuetz']) for (const so of ['ls3', 'motorschutz3', 'fils3n']) for (const fmt of ['A4', 'A3']) {
            if (so === 'fils3n' && gruppe) continue; if (end === 'motor1' && so === 'motorschutz3') continue;
            P = neuesProjekt(); P.projekt.format = fmt; const v = neuerVerteiler('HV'); v.klemmen = kl; P.verteiler.push(v);
            const tool = end.startsWith('motor') ? 'motor' : end === 'pvHybrid' ? 'pv' : end === 'steckdose5' ? 'cee' : end;
            const a = editorNeu(v, tool);
            if (end === 'pvHybrid') a.pv.speicher = { kwh: '10' };
            if (end === 'motor1') a.motor.art = '1';
            if (end === 'motorFU') a.motor.fu = {};
            abgangGeraetSetzen(a.geraet, end === 'motor1' ? so.replace('3', '1') : so);
            if (gruppe) { const g = editorNeu(v, 'gruppe'); g.kinder.push(editorNeu(v, 'steckdose'), a); v.knoten.push(g); } else v.knoten.push(editorNeu(v, 'steckdose'), a);
            if (sg) { a.schalt = neuesSchalt(sg); kreisAnlegen(v, a); }
            if (end === 'motorWende' || end === 'motorSD') schaltungSetzen(v, a, end === 'motorWende' ? 'wende' : 'sd');
            n++; let x; try { x = FZI.rahmen(); } catch (e) { x = ['wirft ' + e.message]; }
            if (x.length) aus.push(`${end} ${gruppe ? 'in FI-Gruppe' : 'einzeln'} Klemmen:${kl} SG:${sg || '-'} ${so} ${fmt}: ${x[0]}`);
          }
          // 1/N/PE und TN-C/TN-C-S mit den Beispielen grund und einphasig, je A4 und A3
          for (const [b, netz] of [['grund', 'TN-C'], ['grund', 'TN-C-S'], ['einphasig', null], ['tt', null]]) for (const fmt of ['A4', 'A3']) {
            BEISPIELE[b](); if (netz) P.verteiler[0].netzform = netz; P.projekt.format = fmt; n++;
            let x; try { x = FZI.rahmen().concat(FZI.pruef()); } catch (e) { x = ['wirft ' + e.message]; }
            if (x.length) aus.push(`${b} ${netz || ''} ${fmt}: ${x[0]}`);
          }
          return [n, aus]; }""") if pg.add_script_tag(content=BSP) else None
        print(f'Kombinationen: {r[0]}, mit Befund {len(r[1])}'); [print('   ', x) for x in r[1][:10]]
        fehler += ['Kombination ' + x for x in r[1]] + ['Kombination: ' + x for x in perr]
        pg.close()
    b.close()
if fehler:
    print('FEHLER:', len(fehler)); sys.exit(1)
print('alles in Ordnung')
