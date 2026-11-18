#!/usr/bin/env python3
"""Prüfteil Speicher (ab v1.70, Etappe Q1 „Datensicherheit im Gerät“).

Vier Fälle am Desktop (1440×900), je in einem frischen Browserkontext:
  1. abgeschnittener Stand → Fenster „… ist beschädigt“, Rohdaten bleiben unverändert, auch nach einer Änderung;
     „Letzten guten Stand laden“ öffnet den Stand aus IndexedDB als neues Projekt
  2. Speicher voll → „Nicht gespeichert“ bleibt in der Fußleiste stehen, neues Projekt wird nicht angelegt,
     nach Freigabe wieder „Gespeichert“
  3. zwei Seiten im selben Kontext → die zweite wird schreibgeschützt, keine Änderung geht verloren
  4. Esc ohne Änderung → Zeitstempel `geaendert` unverändert
Ab v1.76 (Etappe X-A „Versionsstände, Papierkorb, Sammelsicherung“):
  5. Versionsstände: Stand beim Öffnen jeder Sitzung und letzter Stand des Tages in IndexedDB („staende“), höchstens 10;
     Wiederherstellen ergibt das bitgleiche Projekt und ist ein Rückgängig-Schritt
  6. Papierkorb: Löschen verschiebt (Daten bleiben), Wiederherstellen holt zurück, nach 30 Tagen endgültig; ein anderes
     Fenster mit dem gelöschten Projekt wird schreibgeschützt
  7. Sammeldatei: „Alle als Datei sichern“ → .slp-sammlung.json, im frischen Browser öffnen, einzeln wählbar, bitgleich

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


STAENDE = "pid => staendeLesen(pid).then(l => l.map(x => ({ art: x.art, zeit: x.zeit, text: x.text })))"


def fall5(b):
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); errs = []
    pg = seite(ctx, errs)
    pg.evaluate('beispielOeffnen()'); pg.wait_for_timeout(600)
    pid = pg.evaluate('projektId')
    erst = pg.evaluate('verlauf.stand')
    l = pg.evaluate(STAENDE, pid)
    pruefe(len(l) == 1 and l[0]['art'] == 'sitzung', f'Fall 5: neues Projekt – erster Stand gemerkt {[x["art"] for x in l]}')
    aendern(pg, 'Sitzung 1 GmbH')
    stand1 = pg.evaluate('verlauf.stand')
    pg.reload(); pg.wait_for_timeout(600)                       # pagehide schreibt den Tagesstand sofort
    aendern(pg, 'Sitzung 2 GmbH')
    pg.evaluate('gutJetzt()'); pg.wait_for_timeout(300)
    l = pg.evaluate(STAENDE, pid)
    texte = [x['text'] for x in l]
    pruefe(stand1 in texte and any(x['art'] == 'sitzung' and x['text'] == stand1 for x in l), 'Fall 5: Stand beim Öffnen der zweiten Sitzung gemerkt')
    pruefe(pg.evaluate('verlauf.stand') in texte, 'Fall 5: letzter Stand des Tages gemerkt')
    pruefe(len(set(texte)) == len(texte), 'Fall 5: kein Stand doppelt')
    # höchstens 10 Stände
    pg.evaluate("""async pid => { for (let i = 0; i < 14; i++) await staendeMerken(pid, JSON.stringify(Object.assign(JSON.parse(verlauf.stand), { nr: i })), 'sitzung',
      new Date(Date.now() - (20 - i) * 86400000).toISOString()); }""", pid)
    n = len(pg.evaluate(STAENDE, pid))
    pruefe(n == 10, f'Fall 5: höchstens 10 Stände ({n})')
    # Versionen-Fenster aus dem Hauptmenü, Wiederherstellen bitgleich und als Rückgängig-Schritt
    pg.evaluate("geh({ s: 'start' })"); pg.wait_for_timeout(200)
    pg.locator('button', has_text='Menü').first.click(); pg.wait_for_timeout(250)
    pg.locator('.fenster .menue button', has_text='Versionen').click(); pg.wait_for_timeout(1200)
    zeilen = pg.locator('.fenster .vzeile').count()
    pruefe(zeilen == 10, f'Fall 5: Versionen-Fenster mit 10 Ständen ({zeilen})')
    pruefe(pg.locator('.fenster .vbl', has_text='Blätter').count() >= 1 and 'Blätter …' not in pg.inner_text('.fenster'), 'Fall 5: Blattzahl je Stand')
    pg.screenshot(path=str(W / 'build' / 'speicher_5.png'))
    pg.evaluate("while (fensterStapel.length) fensterStapel.at(-1)(false)")
    l = pg.evaluate(STAENDE, pid); ziel = next(x for x in l if x['text'] == stand1)
    vorher = pg.evaluate('verlauf.stand'); nz = pg.evaluate('verlauf.zurueck.length')
    pg.evaluate("([pid, z]) => staendeLesen(pid).then(l => versionWiederherstellen(pid, l.find(x => x.zeit === z)))", [pid, ziel['zeit']]); pg.wait_for_timeout(300)
    pruefe(pg.evaluate('JSON.stringify(P)') == stand1, 'Fall 5: Wiederherstellen ergibt das bitgleiche Projekt')
    pruefe(pg.evaluate("localStorage.getItem('slp.projekt.' + projektId)") == stand1, 'Fall 5: wiederhergestellter Stand gespeichert')
    pruefe(pg.evaluate('verlauf.zurueck.length') == nz + 1, 'Fall 5: Wiederherstellen ist ein Rückgängig-Schritt')
    pg.evaluate('projektRueck(false)'); pg.wait_for_timeout(200)
    pruefe(pg.evaluate('JSON.stringify(P)') == vorher, 'Fall 5: Rückgängig holt den Stand davor zurück')
    pruefe(erst != stand1, 'Fall 5: (Probe) Stände unterscheiden sich')
    pruefe(not errs, f'Fall 5: keine Skriptfehler {errs}')
    ctx.close()


def fall6(b):
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); errs = []
    pg = seite(ctx, errs)
    pg.evaluate('beispielOeffnen()'); pg.wait_for_timeout(500)
    pg.evaluate("() => { const d = neuesProjekt(); d.projekt.projekt = 'Zweites'; projektAnlegen(d, 'Neues Projekt'); }"); pg.wait_for_timeout(300)
    zweit = pg.evaluate('projektId'); text = pg.evaluate('verlauf.stand')
    pg.evaluate("projektOeffnen(projekte.find(x => x.name !== 'Zweites').id)"); pg.wait_for_timeout(300)
    andere = seite(ctx, errs)                                    # zweites Fenster mit dem Projekt, das gleich gelöscht wird
    andere.evaluate("projektOeffnen(projekte.find(x => x.name === 'Zweites').id)"); andere.wait_for_timeout(300)
    pg.evaluate("geh({ s: 'projekte' })"); pg.wait_for_timeout(300)
    pg.locator('.pzeile', has_text='Zweites').locator('.pmehr').click(); pg.wait_for_timeout(200)
    pg.locator('.fenster .menue button', has_text='Löschen').click(); pg.wait_for_timeout(200)
    pg.locator('.fenster .knopf.rot', has_text='Löschen').click(); pg.wait_for_timeout(400)
    pruefe(pg.evaluate('projekte.length') == 1 and pg.evaluate("papierkorbLesen().map(x => x.id)") == [zweit], 'Fall 6: Löschen verschiebt in den Papierkorb')
    pruefe(pg.evaluate("k => localStorage.getItem(k)", 'slp.projekt.' + zweit) == text, 'Fall 6: Daten bleiben im Papierkorb unverändert')
    pruefe(pg.locator('h2', has_text='Papierkorb (1)').count() == 1 and pg.locator('.korb .pzeile', has_text='Zweites').count() == 1, 'Fall 6: Projektliste zeigt den Papierkorb')
    pg.screenshot(path=str(W / 'build' / 'speicher_6.png'))
    pruefe(andere.evaluate('!!(schreibschutz && schreibschutz.geloescht)') and andere.locator('#leseband').is_visible(), 'Fall 6: anderes Fenster schreibgeschützt („gelöscht“)')
    pg.locator('.korb .pwieder').click(); pg.wait_for_timeout(300)
    pruefe(pg.evaluate("projekte.some(x => x.id === '%s')" % zweit) and not pg.evaluate('papierkorbLesen().length'), 'Fall 6: Wiederherstellen holt das Projekt zurück')
    pg.evaluate("projektOeffnen('%s')" % zweit); pg.wait_for_timeout(200)
    pruefe(pg.evaluate('verlauf.stand') == text, 'Fall 6: wiederhergestelltes Projekt bitgleich')
    # „Hier weiterarbeiten“ im anderen Fenster nach dem Löschen holt es ebenfalls zurück
    pg.evaluate("projektOeffnen(projekte.find(x => x.id !== '%s').id)" % zweit); pg.wait_for_timeout(200)
    pg.evaluate("geh({ s: 'projekte' })"); pg.wait_for_timeout(200)
    pg.evaluate("projektLoeschen('%s', 'Zweites')" % zweit); pg.wait_for_timeout(100)
    pg.locator('.fenster .knopf.rot', has_text='Löschen').click(); pg.wait_for_timeout(400)
    andere.locator('#leseband button', has_text='Hier weiterarbeiten').click(); andere.wait_for_timeout(400)
    pruefe(andere.evaluate("JSON.parse(localStorage.getItem('slp.projekte.v1')).some(x => x.id === '%s')" % zweit) and not andere.evaluate('papierkorbLesen().length'),
           'Fall 6: „Hier weiterarbeiten“ holt das gelöschte Projekt in die Liste zurück')
    andere.close()
    # nach 30 Tagen endgültig
    pg.evaluate("projektLoeschen('%s', 'Zweites')" % zweit); pg.wait_for_timeout(100)
    pg.locator('.fenster .knopf.rot', has_text='Löschen').click(); pg.wait_for_timeout(300)
    pg.evaluate("() => { const l = papierkorbLesen(); l[0].geloescht = new Date(Date.now() - 31 * 86400000).toISOString(); papierkorbSchreiben(l); }")
    pg.reload(); pg.wait_for_timeout(600)
    pruefe(not pg.evaluate('papierkorbLesen().length') and pg.evaluate("k => localStorage.getItem(k)", 'slp.projekt.' + zweit) is None, 'Fall 6: nach 30 Tagen endgültig gelöscht')
    pruefe(pg.evaluate(STAENDE, zweit) == [], 'Fall 6: Versionsstände mit gelöscht')
    pruefe(not errs, f'Fall 6: keine Skriptfehler {errs}')
    ctx.close()


def fall7(b):
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, accept_downloads=True); errs = []
    pg = seite(ctx, errs)
    pg.add_script_tag(content=BSP)
    texte = {}
    for n in ('grund', 'steuerung', 'motor'):
        pg.evaluate("n => { const d = neuesProjekt(); d.projekt.projekt = n; projektAnlegen(d, 'Neu'); BEISPIELE[n](); P.projekt.projekt = 'Sammel ' + n; aenderung('x'); sichern(); }", n)
        pg.wait_for_timeout(200)
        texte[pg.evaluate('projektName(P)')] = pg.evaluate('verlauf.stand')
    pg.evaluate("geh({ s: 'projekte' })"); pg.wait_for_timeout(300)
    with pg.expect_download() as dl:
        pg.locator('button', has_text='Alle als Datei sichern').click()
    d = dl.value; name = d.suggested_filename
    pfad = W / 'build' / 'sammlung.slp-sammlung.json'; d.save_as(str(pfad))
    import json, re
    s = json.loads(pfad.read_text())
    pruefe(re.match(r'^\d\d-\d\d-\d\d Alle Projekte\.slp-sammlung\.json$', name) is not None, f'Fall 7: Dateiname „{name}“')
    pruefe(s.get('format') == 'slp-sammlung' and len(s['projekte']) == len(texte), f'Fall 7: Sammeldatei mit {len(s.get("projekte", []))} Projekten')
    pruefe(all(pg.evaluate('projekte.every(x => x.export)') for _ in [0]), 'Fall 7: alle Projekte gelten als gesichert')
    # frischer Browser: öffnen, eines abwählen
    ctx2 = b.new_context(viewport={'width': 1440, 'height': 900}); err2 = []
    q = seite(ctx2, err2)
    q.set_input_files('#datei', str(pfad)); q.wait_for_timeout(1500)
    pruefe(q.locator('.fenster .sammelwahl input[type=checkbox]').count() == 3, 'Fall 7: Projekte einzeln wählbar')
    q.screenshot(path=str(W / 'build' / 'speicher_7.png'))
    q.locator('.fenster .sammelwahl label', has_text='Sammel motor').locator('input').uncheck()
    q.locator('.fenster .knopf', has_text='Als weitere Projekte').click(); q.wait_for_timeout(500)
    namen = q.evaluate("projekte.map(x => x.name)")
    pruefe(sorted(namen) == ['Sammel grund', 'Sammel steuerung'], f'Fall 7: gewählte Projekte übernommen {namen}')
    gleich = all(q.evaluate("n => localStorage.getItem('slp.projekt.' + projekte.find(x => x.name === n).id)", n) == texte[n] for n in ['Sammel grund', 'Sammel steuerung'])
    pruefe(gleich, 'Fall 7: hin und zurück bitgleich')
    # noch einmal: Gleichnamige ersetzen bzw. als weitere
    q.set_input_files('#datei', str(pfad)); q.wait_for_timeout(1500)
    q.locator('.fenster .knopf', has_text='Gleichnamige ersetzen').click(); q.wait_for_timeout(500)
    pruefe(sorted(q.evaluate("projekte.map(x => x.name)")) == ['Sammel grund', 'Sammel motor', 'Sammel steuerung'], 'Fall 7: Gleichnamige ersetzt, neues dazu')
    q.set_input_files('#datei', str(pfad)); q.wait_for_timeout(1500)
    q.locator('.fenster .knopf', has_text='Als weitere Projekte').click(); q.wait_for_timeout(500)
    pruefe(q.evaluate("projekte.length") == 6 and q.evaluate("projekte.some(x => x.name === 'Sammel grund (2)')"), 'Fall 7: als weitere mit „ (2)“')
    pruefe(not errs and not err2, f'Fall 7: keine Skriptfehler {errs + err2}')
    ctx2.close(); ctx.close()


with sync_playwright() as p:
    b = p.chromium.launch()
    for f in (fall1, fall2, fall3, fall4, fall5, fall6, fall7):
        try:
            f(b)
        except Exception as e:
            pruefe(False, f'{f.__name__}: {e}')
    b.close()
print('Speicher:', 'alles in Ordnung' if not fehler else f'{len(fehler)} Fehler')
sys.exit(1 if fehler else 0)
