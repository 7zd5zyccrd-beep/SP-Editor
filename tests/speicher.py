#!/usr/bin/env python3
"""Prüfteil Speicher (ab v1.70, Etappe Q1 „Datensicherheit im Gerät“).

Vier Fälle am Desktop (1440×900), je in einem frischen Browserkontext:
  1. abgeschnittener Stand → Fenster „… ist beschädigt“, Rohdaten bleiben unverändert, auch nach einer Änderung;
     „Letzten guten Stand laden“ öffnet den Stand aus IndexedDB als neues Projekt
  2. Speicher voll → „Nicht gespeichert“ bleibt in der Fußleiste stehen, neues Projekt wird nicht angelegt,
     nach Freigabe wieder „Gespeichert“
  3. zwei Seiten im selben Kontext → die zweite wird schreibgeschützt, keine Änderung geht verloren
  4. Esc ohne Änderung → Zeitstempel `geaendert` unverändert

Aufruf: python3 tests/speicher.py   (Rückgabe 1 bei einem Fehler)
"""
import pathlib, sys
from playwright.sync_api import sync_playwright

W = pathlib.Path(__file__).resolve().parent.parent
APP = (W / 'docs' / 'index.html').as_uri()
BSP = (W / 'tests' / 'beispiele.js').read_text()
fehler = []


def pruefe(bed, text):
    print(('ok    ' if bed else 'FEHLER ') + text)
    if not bed:
        fehler.append(text)


def seite(ctx, errs):
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(APP)
    pg.wait_for_timeout(400)
    return pg


def aendern(pg, name):
    pg.evaluate("n => { P.projekt.firma = n; aenderung('Firma'); sichern(); }", name)
    pg.wait_for_timeout(150)


def fall1(b):
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); errs = []
    pg = seite(ctx, errs)
    pg.evaluate('beispielOeffnen()'); pg.wait_for_timeout(600)      # schreibt sofort einen guten Stand nach IndexedDB
    pid = pg.evaluate('projektId'); schl = 'slp.projekt.' + pid
    roh = pg.evaluate('k => localStorage.getItem(k)', schl)
    kaputt = roh[:-40]
    pg.evaluate('([k, t]) => localStorage.setItem(k, t)', [schl, kaputt])
    pg.reload(); pg.wait_for_timeout(1200)
    titel = pg.locator('.fenster h3').all_inner_texts()
    pruefe(any('beschädigt' in t for t in titel), f'Fall 1: Fenster „beschädigt“ ({titel})')
    pruefe(pg.evaluate('projektId') != pid, 'Fall 1: neues Projekt unter neuer Kennung')
    pruefe(pg.evaluate('k => localStorage.getItem(k)', schl) == kaputt, 'Fall 1: Rohdaten unverändert nach dem Start')
    kopien = pg.evaluate("p => Object.keys(localStorage).filter(k => k.startsWith('slp.defekt.' + p + '.')).map(k => localStorage.getItem(k))", pid)
    pruefe(kopien == [kaputt], 'Fall 1: Kopie unter slp.defekt.<id>.<Zeit>')
    knoepfe = pg.locator('.fenster .fuss button').all_inner_texts()
    pruefe('Letzten guten Stand laden' in knoepfe and 'Rohdaten als Datei sichern' in knoepfe and 'Anderes Projekt öffnen' in knoepfe,
           f'Fall 1: Knöpfe {knoepfe}')
    pg.screenshot(path=str(W / 'build' / 'speicher_1.png'))
    # eine Änderung im neuen Projekt lässt die Rohdaten stehen
    pg.locator('.fenster .fuss button', has_text='Letzten guten Stand laden').click(); pg.wait_for_timeout(500)
    pruefe(pg.evaluate('P.verteiler.length') > 0, 'Fall 1: letzter guter Stand geladen')
    aendern(pg, 'Neu GmbH')
    pruefe(pg.evaluate('k => localStorage.getItem(k)', schl) == kaputt, 'Fall 1: Rohdaten unverändert nach einer Änderung')
    pruefe(pg.evaluate('projektId') != pid, 'Fall 1: gerettet unter neuer Kennung')
    # Neuladen: das gerettete Projekt ist da; die Liste nennt das beschädigte „beschädigt“
    pg.reload(); pg.wait_for_timeout(800)
    pruefe(pg.evaluate('P.projekt.firma') == 'Neu GmbH', 'Fall 1: gerettetes Projekt nach dem Neuladen geöffnet')
    pg.evaluate("stapel = [{ s: 'start' }, { s: 'projekte' }]; zeichne()"); pg.wait_for_timeout(300)
    pruefe('beschädigt' in pg.locator('main').inner_text(), 'Fall 1: Projektliste zeigt „beschädigt“')
    pruefe(not errs, f'Fall 1: keine Skriptfehler {errs}')
    ctx.close()


VOLL = """() => { const o = Storage.prototype.setItem; window.__voll = true;
  Storage.prototype.setItem = function (k, v) { if (window.__voll && String(k).startsWith('slp.')) throw new DOMException('voll', 'QuotaExceededError'); return o.call(this, k, v); }; }"""


def fall2(b):
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); errs = []
    pg = seite(ctx, errs)
    pg.evaluate('beispielOeffnen()'); pg.wait_for_timeout(800)
    zeit = pg.evaluate('projekte.find(q => q.id === projektId).geaendert')
    anzahl = pg.evaluate('projekte.length')
    pg.evaluate(VOLL)
    aendern(pg, 'Voll GmbH')
    st = pg.locator('.standtext').inner_text()
    pruefe('Nicht gespeichert' in st and 'Gespeichert' not in st.replace('Nicht gespeichert', ''), f'Fall 2: Fußleiste „{st}“')
    pruefe(pg.evaluate('projekte.find(q => q.id === projektId).geaendert') == zeit, 'Fall 2: Zeitstempel nicht vorgerückt')
    pg.screenshot(path=str(W / 'build' / 'speicher_2.png'))
    pg.wait_for_timeout(7000)
    st = pg.locator('.standtext').inner_text()
    pruefe('Nicht gespeichert' in st, f'Fall 2: nach 7 s weiter „{st}“')
    pruefe(pg.locator('#meldung.an').count() == 1, 'Fall 2: Meldung mit Knopf bleibt stehen')
    ok = pg.evaluate("() => { const d = neuesProjekt(); d.projekt.projekt = 'Neu bei vollem Speicher'; return projektAnlegen(d, 'Neues Projekt'); }")
    pruefe(ok is False and pg.evaluate('projekte.length') == anzahl and pg.evaluate('P.projekt.firma') == 'Voll GmbH',
           'Fall 2: neues Projekt bei vollem Speicher nicht angelegt, bisheriges bleibt offen')
    pg.evaluate('window.__voll = false')
    aendern(pg, 'Frei GmbH')
    st = pg.locator('.standtext').inner_text()
    pruefe('Gespeichert' in st and 'Nicht' not in st, f'Fall 2: nach Freigabe „{st}“')
    pg.reload(); pg.wait_for_timeout(600)
    pruefe(pg.evaluate('P.projekt.firma') == 'Frei GmbH', 'Fall 2: Stand nach dem Neuladen da')
    pruefe(not errs, f'Fall 2: keine Skriptfehler {errs}')
    ctx.close()


def fall3(b):
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); errs = []
    a = seite(ctx, errs)
    a.evaluate('beispielOeffnen()'); a.wait_for_timeout(600)
    bb = seite(ctx, errs)
    pruefe(a.evaluate('projektId') == bb.evaluate('projektId'), 'Fall 3: beide Seiten mit demselben Projekt')
    a.evaluate("P.verteiler[0].name = 'HV aus A'; aenderung('Name'); sichern()"); a.wait_for_timeout(400)
    pruefe(bb.evaluate('!!schreibschutz') and bb.locator('#leseband').is_visible(), 'Fall 3: zweite Seite schreibgeschützt mit Band')
    pruefe(not a.evaluate('!!schreibschutz'), 'Fall 3: schreibende Seite nicht geschützt')
    aendern(bb, 'B verworfen'); bb.wait_for_timeout(200)
    pruefe(bb.evaluate('P.projekt.firma') != 'B verworfen', 'Fall 3: Änderung in der geschützten Seite wird nicht übernommen')
    pruefe(a.evaluate("JSON.parse(localStorage.getItem('slp.projekt.' + projektId)).verteiler[0].name") == 'HV aus A',
           'Fall 3: Stand aus A bleibt gespeichert')
    bb.evaluate("geh({ s: 'editor', vid: P.verteiler[0].id })"); bb.wait_for_timeout(500)
    bb.screenshot(path=str(W / 'build' / 'speicher_3.png'))
    # Band liegt über dem Editor, nicht über Kopfleiste, Palette oder Fach
    lage = bb.evaluate("""() => { const b = document.getElementById('leseband').getBoundingClientRect(), r = s => document.querySelector(s).getBoundingClientRect();
      return { band: b.bottom, kopf: r('.edkopf').top, pal: r('.edpal').top, eigen: r('.edeigen').top }; }""")
    pruefe(lage['band'] <= min(lage['kopf'], lage['pal'], lage['eigen']) + 0.5, f'Fall 3: Band ohne Überdeckung {lage}')
    bb.locator('#leseband button', has_text='Hier weiterarbeiten').click(); bb.wait_for_timeout(400)
    pruefe(bb.evaluate('P.verteiler[0].name') == 'HV aus A' and not bb.evaluate('!!schreibschutz'), 'Fall 3: „Hier weiterarbeiten“ lädt den Stand aus A')
    aendern(bb, 'Firma aus B'); bb.wait_for_timeout(400)
    pruefe(a.evaluate('!!schreibschutz'), 'Fall 3: nun ist die erste Seite geschützt')
    c = seite(ctx, errs)
    pruefe(c.evaluate('P.verteiler[0].name') == 'HV aus A' and c.evaluate('P.projekt.firma') == 'Firma aus B',
           'Fall 3: neue Seite hat beide Änderungen')
    # Projektliste: ein in B angelegtes Projekt bleibt, wenn A danach schreibt
    c.close()
    bb.evaluate("() => { const d = neuesProjekt(); d.projekt.projekt = 'Aus B'; projektAnlegen(d, 'Neues Projekt'); }"); bb.wait_for_timeout(300)
    a.locator('#leseband button', has_text='Hier weiterarbeiten').click(); a.wait_for_timeout(300)
    aendern(a, 'Firma aus A'); a.wait_for_timeout(300)
    namen = a.evaluate("JSON.parse(localStorage.getItem('slp.projekte.v1')).map(x => x.name)")
    pruefe('Aus B' in namen, f'Fall 3: Projekt aus B bleibt in der Liste {namen}')
    pruefe(not errs, f'Fall 3: keine Skriptfehler {errs}')
    ctx.close()


def fall4(b):
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); errs = []
    pg = seite(ctx, errs)
    pg.add_script_tag(content=BSP)
    pg.evaluate("BEISPIELE.grund(); exportStand('export')"); pg.wait_for_timeout(300)
    zust = "() => { const x = projekte.find(q => q.id === projektId); return [x.geaendert, x.geaendertSeitExport || null, verlauf.zurueck.length]; }"
    pg.reload(); pg.wait_for_timeout(500)
    vor = pg.evaluate(zust)
    pg.locator('.vkarte').first.click(); pg.wait_for_timeout(600)
    pg.locator('rect.ziel[data-ziel^="k:"]').nth(2).dispatch_event('click'); pg.wait_for_timeout(300)
    pg.locator('.edeigen .zeile').nth(1).click(); pg.wait_for_timeout(200)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.evaluate('sichern()')
    nach = pg.evaluate(zust)
    pruefe(vor == nach, f'Fall 4: Esc ohne Änderung ändert nichts {vor} → {nach}')
    pruefe(pg.evaluate('P.version') == pg.evaluate('PROJEKT_VERSION') and pg.evaluate('P.app') == pg.evaluate("FASSUNG.replace(/^v/, '')"),
           'Fall 4: version und app vermerkt')
    pruefe(not errs, f'Fall 4: keine Skriptfehler {errs}')
    ctx.close()


with sync_playwright() as p:
    b = p.chromium.launch()
    for f in (fall1, fall2, fall3, fall4):
        try:
            f(b)
        except Exception as e:
            pruefe(False, f'{f.__name__}: {e}')
    b.close()
print('Speicher:', 'alles in Ordnung' if not fehler else f'{len(fehler)} Fehler')
sys.exit(1 if fehler else 0)
