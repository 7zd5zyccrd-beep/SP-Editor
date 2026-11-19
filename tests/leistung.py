"""Messlauf Leistung (ab v1.85, Etappe Z1): großes Projekt (Voreinstellung 10 Verteiler × 60 Abgänge, 30 Steuerkreise, A4)
im Plan-Editor – Zeiten je Vorgang in ms (Median aus mehreren Läufen, JavaScript samt erzwungenem Layout):
  aenderung    Abgang einfügen im Hauptverteiler (aenderung, sichern, zeichne)
  aenderungUV  dasselbe in einem Unterverteiler
  rueck        Rückgängig
  feldEsc      Textfeld im Fach öffnen und mit Esc schließen (ohne Datenänderung)
  blattMenue   Blatt-Menü öffnen
  verweis      Sprung über einen Querverweis (Doppelklick)
  editorAuf    Editor öffnen
  druck        Druck füllen (#druck), gesamt bis fertig
Aufruf: python3 tests/leistung.py [--geraet desktop|ipad|iphone] [--drossel 4] [--verteiler 10] [--abgaenge 60] [--kreise 30]
        [--laeufe 5] [--app build/stromlaufplan-v1.84.html]
        [--grenze]   prüft die Abnahmegrenzen (Desktop: Änderung ≤ 300 ms, Feld/Esc ≤ 50 ms; iPad gedrosselt: Änderung ≤ 600 ms)"""
import sys, json, pathlib, statistics
from playwright.sync_api import sync_playwright
W = pathlib.Path(__file__).resolve().parent.parent
arg = sys.argv[1:]
def opt(n, d):
    return type(d)(arg[arg.index(n) + 1]) if n in arg else d
APP = pathlib.Path(opt('--app', str(W / 'docs' / 'index.html'))).resolve().as_uri()      # --app: andere Fassung zum Vergleich
GERAET, DROSSEL = opt('--geraet', 'desktop'), opt('--drossel', 1.0)
NV, NA, NK, N = opt('--verteiler', 10), opt('--abgaenge', 60), opt('--kreise', 30), opt('--laeufe', 5)
AUFBAU = """([NV, NA, NK]) => {
  P = neuesProjekt(); Object.assign(P.projekt, { projekt: 'Großprojekt', firma: 'Prüf GmbH' });
  const tools = ['steckdose', 'cee', 'leuchte', 'dose', 'motor', 'steckdose', 'leuchte', 'wallbox', 'pv'];
  for (let i = 0; i < NV; i++) {
    const v = neuerVerteiler('V' + (i + 1)); v.vorsicherung = { zeichen: 'sichlasttrenn3', art: 'gG', nenn: '63' }; v.zaehler = { zeichen: 'zaehler3' }; v.klemmen = 'leiste';
    P.verteiler.push(v);
    let g = null;
    for (let j = 0; j < NA; j++) {
      if (j % 8 === 0) { g = neueGruppe(); v.knoten.push(g); }
      const a = editorNeu(v, tools[j % tools.length]); a.ziel.ort = 'Raum ' + j;
      if (['steckdose', 'leuchte'].includes(tools[j % tools.length]) && g && g.kinder.length < 6) g.kinder.push(a); else v.knoten.push(a);
    }
    if (i > 0) { const q = P.verteiler[0].knoten.find(k => k.typ === 'abgang' && !k.speist); if (q) { q.speist = v.id; q.ziel.anschluss = 'fest'; } }
  }
  let n = 0;
  for (const v of P.verteiler) alleKnoten(v, k => { if (n >= NK || k.typ !== 'abgang' || k.speist || k.steuer) return; if (!['leuchte', 'motor'].includes(k.ziel.anschluss)) return;
    k.schalt = neuesSchalt(k.ziel.anschluss === 'leuchte' ? 'stromstoss' : 'schuetz'); const kr = kreisAnlegen(v, k);
    vorlageEinsetzen(v, kr, k.ziel.anschluss === 'leuchte' ? 'taster' : 'selbst', { n: 3, meldung: true }); n++; });
  aenderung('Aufbau'); sichern();
  return { kreise: n, abgaenge: P.verteiler.reduce((s, v) => { let m = 0; alleKnoten(v, k => { if (k.typ === 'abgang') m++; }); return s + m; }, 0) };
}"""
# Zeit eines Vorgangs samt Layout (getBoundingClientRect erzwingt Stil und Layout der neuen Blätter)
MISS = """async name => { const L = () => document.body.getBoundingClientRect();
  const t0 = performance.now(); let r;
  if (name === 'aenderung' || name === 'aenderungUV') { const v = ED.v; v.knoten.push(editorNeu(v, 'steckdose')); aenderung('Abgang einfügen'); sichern(); zeichne(); }
  else if (name === 'rueck') projektRueck(false);
  else if (name === 'feldEsc') { const z = [...ED.eigen.querySelectorAll('button.zeile[data-text]')][0]; z.click(); L();
    const i = ED.eigen.querySelector('.zeile.bearbeiten input'); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); }
  else if (name === 'blattMenue') { ED.blattKnopf.click(); L(); r = document.querySelectorAll('.fenster .menue button').length; }
  else if (name === 'verweis') { verweisSpringen(ED.v, { nr: ED.liste[ED.liste.length - 1].nr, sp: 1 }); }
  else if (name === 'editorAuf') { stapel = [{ s: 'start' }, { s: 'editor', vid: window.__vid }]; zeichne(); }
  else if (name === 'druck') { if (typeof druckFuellenStuecke === 'function') await druckFuellenStuecke(); else druckFuellen(); r = document.querySelectorAll('#druck svg').length; }
  L(); const t = performance.now() - t0;
  if (name === 'blattMenue') { const s = fensterStapel[fensterStapel.length - 1]; if (s) s(false); }
  return [t, r]; }"""
GERAETE = {'desktop': {'viewport': {'width': 1440, 'height': 900}}}
with sync_playwright() as p:
    if GERAET == 'ipad': GERAETE['ipad'] = p.devices['iPad Pro 11']
    if GERAET == 'iphone': GERAETE['iphone'] = p.devices['iPhone 14']
    b = p.chromium.launch(); ctx = b.new_context(**GERAETE[GERAET]); pg = ctx.new_page(); fehler = []
    pg.on('pageerror', lambda e: fehler.append(str(e)))
    pg.goto(APP); pg.wait_for_timeout(300); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(300)
    info = pg.evaluate(AUFBAU, [NV, NA, NK])
    if DROSSEL > 1:
        cdp = ctx.new_cdp_session(pg); cdp.send('Emulation.setCPUThrottlingRate', {'rate': DROSSEL})
    zeiten = {}
    def lauf(name, vid, n=N, vorher=None):
        werte = []
        for _ in range(n):
            pg.evaluate(f"window.__vid = P.verteiler[{vid}].id; if (!ED || ED.v.id !== __vid) {{ stapel = [{{ s: 'start' }}, {{ s: 'editor', vid: __vid }}]; zeichne(); }}")
            if vorher: pg.evaluate(vorher)
            pg.wait_for_timeout(150)
            t, r = pg.evaluate(MISS, name); werte.append(t)
            pg.wait_for_timeout(100)
        zeiten[name] = round(statistics.median(werte))
        return r
    lauf('editorAuf', 0, vorher="stapel = [{ s: 'start' }]; zeichne()")
    lauf('aenderung', 0)
    lauf('rueck', 0)
    lauf('aenderungUV', min(4, NV - 1))
    lauf('feldEsc', 0, vorher="waehle('k:' + P.verteiler[0].knoten.find(k => k.typ === 'abgang').id)")
    nMenue = lauf('blattMenue', 0)
    lauf('verweis', 0)
    nDruck = lauf('druck', 0, n=1)
    ergebnis = {'geraet': GERAET, 'drossel': DROSSEL, 'verteiler': NV, **info, 'menueEintraege': nMenue, 'druckSeiten': nDruck, 'zeitenMs': zeiten, 'fehler': fehler}
    print(json.dumps(ergebnis, ensure_ascii=False, indent=1))
    b.close()
    if '--grenze' in arg:
        g = {'aenderung': 600 if DROSSEL > 1 else 300, 'aenderungUV': 600 if DROSSEL > 1 else 300}
        if DROSSEL <= 1: g['feldEsc'] = 50
        zu = {n: (zeiten[n], m) for n, m in g.items() if zeiten[n] > m}
        print('Grenzen:', 'eingehalten' if not zu and not fehler else f'überschritten {zu} {fehler}')
        sys.exit(1 if zu or fehler else 0)
