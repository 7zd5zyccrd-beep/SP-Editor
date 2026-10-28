"""EN-Baukasten: setzt Geräte aus den EN-60617-Elementen der QElectroTech-
Sammlung zusammen. Die Grundzeichen werden unverändert übernommen und nur
verschoben (bzw. um 90° gedreht); das Ergebnis ist wieder ein QET-Element
(XML), damit derselbe Übersetzer es zeichnet.

Regeln (Vorschlag, v0.3):
  R1  Pole liegen im Polabstand 20, erster Pol bei x = 0.
  R2  Mehrpolige Geräte: einpoliges Grundzeichen je Pol, verbunden durch die
      Wirkverbindung (02-12-01, gestrichelt) quer durch die Schaltglieder.
  R3  Überstromschutz: thermische (02-08-01) und elektromagnetische Wirkung
      (02-08-02) im Leiter jedes geschützten Pols, unter dem Schaltglied.
      Ungeschützte Pole (N) laufen dort glatt durch.
  R4  Fehlerstromschutz: Summenstromwandler als Ellipse um alle Leiter
      (abgeleitet aus Stromwandler 06-09-10), Auslöser als Kasten mit IΔ
      (abgeleitet aus Messrelais 07-16-01), Wirkverbindung zu den Schaltgliedern.
  R5  Anschlusspunkte immer im 10er-Raster; Leiter enden oben und unten.
"""
import pathlib, re, sys, uuid
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from pfade import SAMMLUNG, sammlung_pruefen
import xml.etree.ElementTree as ET

EN = SAMMLUNG / '91_en_60617'
STIL = 'line-style:normal;line-weight:normal;filling:none;color:black'
STIL_WV = 'line-style:dashed;line-weight:normal;filling:none;color:black'

_cache = {}
def en(id_):
    if id_ not in _cache:
        sammlung_pruefen()
        # EN-Nummer (z.B. '07_13_05') oder Pfad in der Sammlung ('10_allpole/...')
        f = (EN.parent / id_) if '/' in id_ else next(EN.rglob(f'en_60617_{id_}.elmt'))
        _cache[id_] = ET.parse(f).getroot()
    return _cache[id_]

def _rot(x, y, r):
    for _ in range(r % 4):
        x, y = -y, x          # 90° im Uhrzeigersinn (Bildschirm, y nach unten)
    return x, y

ORI = ['n', 'e', 's', 'w']

class Bau:
    def __init__(self, name):
        self.name = name
        self.teile = []        # XML-Strings
        self.quellen = []      # (EN-Nummer, Bemerkung)
        self.anschl = []

    def _q(self, id_, bem=''):
        id_ = id_.split('/')[-1].replace('.elmt', '') if '/' in id_ else id_
        if (id_, bem) not in self.quellen:
            self.quellen.append((id_, bem))

    def setze(self, id_, dx=0, dy=0, r=0, anschluesse=True, ohne=(), korr=None, bem='', ohne_tags=()):
        """Fügt EN-Element id_ verschoben (und gedreht) ein."""
        self._q(id_, bem)
        for e in en(id_).find('description'):
            if e.tag in ('dynamic_text', 'input') or e.tag in ohne_tags:
                continue
            if e.tag == 'terminal':
                if not anschluesse:
                    continue
                x, y = _rot(float(e.get('x')), float(e.get('y')), r)
                x, y = x + dx, y + dy
                if (x, y) in ohne:
                    continue
                o = ORI[(ORI.index(e.get('orientation', 'n')) + r) % 4]
                self.anschluss(x, y, o)
                continue
            a = dict(e.attrib)
            if korr:
                korr(e.tag, a)
            self.teile.append(self._form(e.tag, a, dx, dy, r))

    def _form(self, tag, a, dx, dy, r):
        f = lambda v: f'{v:g}'
        if tag == 'line':
            x1, y1 = _rot(float(a['x1']), float(a['y1']), r); x2, y2 = _rot(float(a['x2']), float(a['y2']), r)
            a.update(x1=f(x1 + dx), y1=f(y1 + dy), x2=f(x2 + dx), y2=f(y2 + dy))
        elif tag in ('rect', 'ellipse', 'arc'):
            x, y, w, h = (float(a[k]) for k in ('x', 'y', 'width', 'height'))
            pts = [_rot(px, py, r) for px, py in ((x, y), (x + w, y + h))]
            xs, ys = [p[0] for p in pts], [p[1] for p in pts]
            a.update(x=f(min(xs) + dx), y=f(min(ys) + dy), width=f(max(xs) - min(xs)), height=f(max(ys) - min(ys)))
            if tag == 'arc':
                a['start'] = f((float(a['start']) - 90 * r) % 360)
        elif tag == 'circle':
            d = float(a['diameter']); x, y = float(a['x']) + d / 2, float(a['y']) + d / 2
            x, y = _rot(x, y, r); a.update(x=f(x - d / 2 + dx), y=f(y - d / 2 + dy))
        elif tag == 'polygon':
            i = 1
            while f'x{i}' in a:
                x, y = _rot(float(a[f'x{i}']), float(a[f'y{i}']), r)
                a[f'x{i}'], a[f'y{i}'] = f(x + dx), f(y + dy); i += 1
        elif tag == 'text':
            x, y = _rot(float(a['x']), float(a['y']), r); a.update(x=f(x + dx), y=f(y + dy))
        attrs = ' '.join(f'{k}="{_esc(v)}"' for k, v in a.items())
        return f'<{tag} {attrs}/>'

    # eigene Hilfslinien im Stil der Sammlung
    def linie(self, x1, y1, x2, y2, stil=STIL):
        self.teile.append(f'<line x1="{x1:g}" y1="{y1:g}" x2="{x2:g}" y2="{y2:g}" end1="none" end2="none" length1="1.5" length2="1.5" style="{stil}" antialias="false"/>')
    def wv(self, x1, y1, x2, y2):
        self._q('02_12_01', 'Wirkverbindung')
        self.linie(x1, y1, x2, y2, STIL_WV)
    def ellipse(self, x, y, w, h):
        self.teile.append(f'<ellipse x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" style="{STIL}" antialias="true"/>')
    def rect(self, x, y, w, h):
        self.teile.append(f'<rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" rx="0" ry="0" style="{STIL}" antialias="false"/>')
    def text(self, x, y, t, size=9):
        self.teile.append(f'<text x="{x:g}" y="{y:g}" text="{_esc(t)}" rotation="0" font="Liberation Sans,{size},-1,5,50,0,0,0,0,0,Regular" color="#000000"/>')
    def anschluss(self, x, y, o):
        self.anschl.append((x, y, o))

    def xml(self):
        # feste UUIDs aus Name und Lage, damit ein Neubau der Bibliothek keine Änderungen erzeugt
        fest = lambda t: uuid.uuid5(uuid.NAMESPACE_URL, f'slp/{self.name}/{t}')
        terms = ''.join(f'<terminal uuid="{{{fest(f"{x:g},{y:g},{o}")}}}" name="" x="{x:g}" y="{y:g}" orientation="{o}" type="Generic"/>'
                        for x, y, o in self.anschl)
        quellen = ', '.join(_qname(q) + (f' ({b})' if b else '') for q, b in self.quellen)
        return (f'<definition version="0.100.0" type="element" link_type="simple" width="100" height="100" hotspot_x="50" hotspot_y="50">'
                f'<uuid uuid="{{{fest("element")}}}"/><names><name lang="de">{_esc(self.name)}</name></names>'
                f'<informations>EN-Baukasten aus der Elementsammlung von QElectroTech (CC-BY 3.0). Bausteine: {_esc(quellen)}</informations>'
                f'<description>{"".join(self.teile)}{terms}</description></definition>')

def _qname(q):
    return ('EN 60617 ' + q.replace('_', '-')) if re.fullmatch(r'\d\d_\d\d_\d\d\w?', q) else 'Sammlung ' + q

def _esc(s):
    return str(s).replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;')

# --- Grundzeichen der Schaltglieder -----------------------------------------
# Schaltglieder 07-13-xx: Anschluss oben y=-40, unten y=+20, Schaltstück
# von (0,0) nach (-8,-23); Mitte des Schaltstücks bei y = -11.5.
KONTAKT = {'schalter': '07_13_01', 'schuetz': '07_13_02', 'leistung': '07_13_05',
           'trenn': '07_13_06', 'lasttrenn': '07_13_08'}
WV_Y = -11.5
def _wv_x(y):          # x des Schaltstücks auf Höhe y (relativ zum Pol)
    return -8 * (-y) / 23

def kontakte(b, art, n, schutz=None, unten=20):
    """n Pole eines Schaltglieds; schutz = Liste je Pol True/False (R3).
    Gibt die y-Koordinate des unteren Leiterendes zurück."""
    for i in range(n):
        b.setze(KONTAKT[art], dx=20 * i, anschluesse=False)
        b.anschluss(20 * i, -40, 'n')
    if n > 1:
        b.wv(_wv_x(WV_Y), WV_Y, 20 * (n - 1) + _wv_x(WV_Y), WV_Y)
    if schutz:
        for i, s in enumerate(schutz):
            if s:
                b.setze('02_08_01', dx=20 * i, dy=30, anschluesse=False, bem='thermisch')
                b.setze('02_08_02', dx=20 * i, dy=50, anschluesse=False, bem='elektromagnetisch')
            else:
                b.linie(20 * i, 20, 20 * i, 60)
        unten = 60
    return unten

def fehlerstrom(b, n, y0):
    """Summenstromwandler unterhalb y0 und IΔ-Auslöser links (R4).
    Gibt das neue untere Leiterende zurück."""
    b._q('06_09_10', 'Summenstromwandler abgeleitet')
    b._q('07_16_01', 'Auslöser abgeleitet')
    ym = y0 + 15
    for i in range(n):
        b.linie(20 * i, y0, 20 * i, y0 + 30)
    b.ellipse(-8, ym - 6, 20 * (n - 1) + 16, 12)
    b.rect(-42, ym - 9, 24, 18)
    b.text(-38, ym + 4.5, 'IΔ')
    b.linie(-18, ym, -8, ym)
    b.wv(-30, ym - 9, -30, WV_Y)
    b.wv(-30, WV_Y, _wv_x(WV_Y), WV_Y)
    return y0 + 30

def unten_anschliessen(b, n, y):
    for i in range(n):
        b.anschluss(20 * i, y, 's')

# --- Geräte -------------------------------------------------------------
def geraet_kontakt(name, art, n):
    b = Bau(name); y = kontakte(b, art, n); unten_anschliessen(b, n, y); return b

def geraet_ls(name, schutz):
    b = Bau(name); n = len(schutz)
    y = kontakte(b, 'leistung', n, schutz); unten_anschliessen(b, n, y); return b

def geraet_fi(name, art, n, schutz=None):
    b = Bau(name)
    y = kontakte(b, art, n, schutz)
    y = fehlerstrom(b, n, y); unten_anschliessen(b, n, y); return b

def geraet_sicherung(name, id_, n, wv=True, n_trenner=False):
    """Sicherungselemente 07-21-xx: Anschluss oben -30, unten +30."""
    b = Bau(name)
    for i in range(n):
        b.setze(id_, dx=20 * i, anschluesse=False)
        b.anschluss(20 * i, -30, 'n'); b.anschluss(20 * i, 30, 's')
    letzter = n - 1
    if n_trenner:     # N-Pol als Trennschalter, auf gleiche Anschlusshöhe gesetzt
        b.setze('07_13_06', dx=20 * n, dy=10, anschluesse=False, bem='N-Trenner')
        b.anschluss(20 * n, -30, 'n'); b.anschluss(20 * n, 30, 's')
        letzter = n
    if wv and letzter > 0:
        # Schaltstück 07-21-08/09 von (0,10) nach (-5,-10); WV unterhalb der Sicherung
        y = 8; x = -5 * (10 - y) / 20
        xe = 20 * letzter + (_wv_x(y - 10) if n_trenner else x)
        b.wv(x, y, xe, y)
    return b

def geraet_ableiter(name, n):
    """n Überspannungsableiter 07-22-03, unten gemeinsam auf PE."""
    b = Bau(name)
    for i in range(n):
        b.setze('07_22_03', dx=20 * i, anschluesse=False)
        b.anschluss(20 * i, -20, 'n')
    b.linie(0, 20, 20 * (n - 1), 20)
    m = 10 * (n - 1)
    b.linie(m, 20, m, 30); b.anschluss(m, 30, 's')
    return b

def geraet_zaehler(name, n):
    """Wattstundenzähler 08-04-03, Kasten auf n Leiter verbreitert."""
    b = Bau(name)
    b._q('08_04_03', 'Kasten verbreitert')
    w = max(40, 20 * (n - 1) + 20); x0 = 10 * (n - 1) - w / 2
    b.rect(x0, -60, w, 20); b.rect(x0, -40, w, 40)
    b.text(10 * (n - 1) - 8, -16, 'Wh')
    for i in range(n):
        b.linie(20 * i, -70, 20 * i, -60); b.anschluss(20 * i, -70, 'n')
        b.linie(20 * i, 0, 20 * i, 10); b.anschluss(20 * i, 10, 's')
    return b

def _offen(tag, a):    # 03-02-02 ist in der Sammlung gefüllt; Norm: offener Kreis
    if tag == 'ellipse':
        a['style'] = STIL

def geraet_klemme(name, abzweig=(), ende=False):
    b = Bau(name)
    b.setze('03_02_02', anschluesse=False, korr=_offen, bem='Kreis offen nach Norm')
    b.linie(0, -10, 0, -2.5); b.anschluss(0, -10, 'n')
    if not ende:
        b.linie(0, 2.5, 0, 10); b.anschluss(0, 10, 's')
    for s in abzweig:
        d = 1 if s == 'r' else -1
        b.linie(2.5 * d, 0, 10 * d, 0); b.anschluss(10 * d, 0, 'e' if d > 0 else 'w')
    return b

def geraet_klemmleiste(name, n):
    b = Bau(name)
    for i in range(n):
        b.setze('03_02_02', dx=20 * i, anschluesse=False, korr=_offen, bem='Kreis offen nach Norm')
        b.linie(20 * i, -10, 20 * i, -2.5); b.linie(20 * i, 2.5, 20 * i, 10)
        b.anschluss(20 * i, -10, 'n'); b.anschluss(20 * i, 10, 's')
    return b

def geraet_trennklemme(name):
    b = Bau(name)
    # 03-03-17 waagerecht (Anschlüsse -30 und +10) -> 90° gedreht, mittig gesetzt
    b.setze('03_03_17', dy=10, r=1, anschluesse=False)
    b.anschluss(0, -20, 'n'); b.anschluss(0, 20, 's')
    return b

def geraet_steckdose(name, n):
    """n Pole einer Steckbuchse 03-03-01, gedreht: Leiter von oben."""
    b = Bau(name)
    for i in range(n):
        b.setze('03_03_01', dx=20 * i, dy=20, r=1, anschluesse=False)
        b.anschluss(20 * i, -10, 'n')
    return b

def geraet_einzeln(name, id_, korr=None, bem='', dy=0):
    b = Bau(name); b.setze(id_, dy=dy, korr=korr, bem=bem); return b

def _kreis_voll(tag, a):   # 02-15-03: Kreis mit Winkel 0 in der Quelle -> 360
    if tag == 'arc' and float(a.get('angle', '0')) == 0:
        a['angle'] = '360'

TERRE = '10_allpole/110_network_supplies/terre.elmt'
LS_DE = '10_allpole/200_fuses_protective_gears/11_circuit_breakers/disjonct_m_1f.elmt'

def geraet_schutzerde_de():
    """Schutzerde: gewählte Erde (terre) mit eng anliegendem, mittigem Kreis.
    terre um 1 nach unten gesetzt, damit der Anschluss im Raster liegt."""
    b = Bau('Schutzerde')
    b.setze(TERRE, dy=1, anschluesse=False, bem='ins Raster gesetzt')
    b.anschluss(0, -10, 'n')
    b.ellipse(-9, -6, 18, 18)      # Mitte (0,3) = Mitte der drei Erdstriche
    return b

LS3_DE = '10_allpole/200_fuses_protective_gears/11_circuit_breakers/disjonct_m_3f.elmt'

def geraet_fils_de(pole_l=1):
    """FI/LS in der Darstellung des gewählten LS: L-Pole = LS unverändert
    (disjonct_m_1f bzw. disjonct_m_3f), N-Pol = dasselbe Schaltglied ohne
    Auslöser, Wirkverbindung durch alle Schaltstücke, darunter
    Summenstromwandler und IΔ-Kasten links wie beim FI aus dem Baukasten."""
    n = pole_l + 1
    b = Bau('FI/LS 1P+N' if pole_l == 1 else 'FI/LS 3P+N')
    b.setze(LS_DE if pole_l == 1 else LS3_DE, anschluesse=False,
            bem='L-Pol' + ('e' if pole_l > 1 else '') + ', ohne Klemmenziffern', ohne_tags=('text',))
    xn = 20 * pole_l
    # N-Pol: Schaltglied wie im LS (fester Kontakt + Schaltstück), ohne Auslöser
    b.linie(xn, -20, xn, -12)
    b.teile.append(f'<polygon x1="{xn - 5}" y1="-10" x2="{xn}" y2="10" x3="{xn}" y3="20" closed="false" style="{STIL}" antialias="true"/>')
    for i in range(n):
        b.anschluss(20 * i, -20, 'n')
    y0 = 20; ym = y0 + 15
    b._q('06_09_10', 'Summenstromwandler abgeleitet'); b._q('07_16_01', 'Auslöser abgeleitet')
    for i in range(n):
        b.linie(20 * i, y0, 20 * i, y0 + 30)
    b.ellipse(-8, ym - 6, 20 * (n - 1) + 16, 12)
    b.rect(-42, ym - 9, 24, 18); b.text(-38, ym + 4.5, 'IΔ'); b.linie(-18, ym, -8, ym)
    # Wirkverbindung: vom IΔ-Kasten hoch und quer durch alle Schaltstücke (y=-8,
    # oberhalb der LS-Auslöser, unterhalb der festen Kontakte)
    b.wv(-30, ym - 9, -30, -8); b.wv(-30, -8, xn - 4.5, -8)
    for i in range(n):
        b.anschluss(20 * i, 50, 's')
    return b

def geraet_leuchte():
    """Leuchte für den allpoligen Plan: Lampenzeichen 08-10-01 zwischen L und N.
    L kommt links, N rechts an den Kreis; der PE wird im Plan selbst geführt."""
    b = Bau('Leuchte')
    b.setze('08_10_01', dx=10, dy=10)        # Kreis Mitte (10, 0), Radius 10
    b.linie(0, -20, 0, 0); b.anschluss(0, -20, 'n')
    b.linie(20, -20, 20, 0); b.anschluss(20, -20, 'n')
    return b

def geraet_fils_ein():
    """FI/LS einpolig für den Übersichtsschaltplan: der gewählte LS 1-polig,
    darunter Summenstromwandler und IΔ-Kasten wie beim FI/LS 1P+N."""
    b = Bau('FI/LS einpolig')
    b.setze(LS_DE, anschluesse=False, bem='ohne Klemmenziffern', ohne_tags=('text',))
    b.anschluss(0, -20, 'n')
    y0 = 20; ym = y0 + 15
    b._q('06_09_10', 'Summenstromwandler abgeleitet'); b._q('07_16_01', 'Auslöser abgeleitet')
    b.linie(0, y0, 0, y0 + 30)
    b.ellipse(-8, ym - 6, 16, 12)
    b.rect(-42, ym - 9, 24, 18); b.text(-38, ym + 4.5, 'IΔ'); b.linie(-18, ym, -8, ym)
    b.wv(-30, ym - 9, -30, -8); b.wv(-30, -8, -4.5, -8)
    b.anschluss(0, 50, 's')
    return b

def geraet_spd_ein():
    """Überspannungsschutz einpolig: Ableiter 07-22-03, darunter Erde."""
    b = Bau('Überspannungsschutz einpolig')
    b.setze('07_22_03', anschluesse=False); b.anschluss(0, -20, 'n')
    b.linie(0, 20, 0, 30)
    b.setze(TERRE, dy=41, anschluesse=False, bem='Erde wie gewählt')
    return b

def geraet_leuchte_ein():
    """Leuchte einpolig: Lampe 08-10-01, Leitung von oben."""
    b = Bau('Leuchte einpolig')
    b.setze('08_10_01', dy=20)
    b.linie(0, -10, 0, 0); b.anschluss(0, -10, 'n')
    return b

def geraet_ue_schaltgeraet(name, kontakt, spule, kontakt_bem='', rand=20):
    """Einpolig für den Übersichtsschaltplan: Schaltglied im Leiter, Antrieb
    links daneben, Wirkverbindung waagerecht durch das Schaltstück."""
    b = Bau(name)
    b.setze(kontakt, anschluesse=False, bem=kontakt_bem)
    b.anschluss(0, -40, 'n'); b.anschluss(0, 20, 's')
    b.setze(spule, dx=-60, dy=-11.5, anschluesse=False, bem='Antrieb')
    b.wv(-60 + rand, -11.5, _wv_x(WV_Y), WV_Y)      # rand: rechte Kante des Antriebs
    return b

def geraet_betaetigt(name, zeichen):
    """Schließer, betätigt durch ein Gerät (Kasten mit Kennzeichnung links,
    Wirkverbindung zum Schaltstück) – für Melder ohne eigenes Normzeichen."""
    b = Bau(name)
    b.setze('07_02_02', anschluesse=False)
    b.anschluss(0, -40, 'n'); b.anschluss(0, 20, 's')
    b.rect(-50, -21.5, 24, 20); b.text(-48, -7.5, zeichen, 8)
    b.wv(-26, -11.5, _wv_x(WV_Y), WV_Y)
    return b

def geraet_taster_oe():
    """Taster als Öffner: Öffner 07-02-03 mit Druckbetätigung wie 07-07-02."""
    b = Bau('Taster (Öffner)')
    b.setze('07_02_03'); b._q('07_07_02', 'Druckbetätigung übernommen')
    b.wv(-35, -10, 3, -10)
    b.linie(-35, -15, -35, -5); b.linie(-35, -15, -30, -15); b.linie(-35, -5, -30, -5)
    return b

def geraet_hand0auto():
    """Wahlschalter Hand-0-Automatik einpolig: Wechsler mit Mittelstellung
    Aus 07-02-05 (gedreht, Zulauf oben), Handbetätigung wie 07-07-01."""
    b = Bau('Wahlschalter Hand-0-Automatik')
    b.setze('07_02_05', r=2, dy=20, ohne_tags=('text',))
    b._q('07_07_01', 'Handbetätigung übernommen')
    b.wv(-32, 30, -1, 30); b.linie(-32, 25, -32, 35)
    b.text(-18, 70, 'H', 7); b.text(-3, 70, '0', 7); b.text(12, 70, 'A', 7)
    return b

def geraet_meldeleuchte():
    """Meldeleuchte: Lampe 08-10-01 mit Anschluss oben und unten."""
    b = Bau('Meldeleuchte')
    b.setze('08_10_01', dy=10)
    b.linie(0, -20, 0, -10); b.linie(0, 10, 0, 20)
    b.anschluss(0, -20, 'n'); b.anschluss(0, 20, 's')
    return b

BAUTEILE = {
    'meldeleuchte':    (lambda: geraet_meldeleuchte(), 'Lampe 08-10-01 mit Anschlüssen oben und unten'),
    'taster_oe':       (lambda: geraet_taster_oe(), 'Öffner mit Druckbetätigung'),
    'hand0auto':       (lambda: geraet_hand0auto(), 'Wechsler mit Mittelstellung, Handbetätigung'),
    'ue_schuetz':      (lambda: geraet_ue_schaltgeraet('Schütz einpolig', '07_13_02', '07_15_01'), 'Schützkontakt mit Spule links'),
    'ue_stromstoss':   (lambda: geraet_ue_schaltgeraet('Stromstoßschalter einpolig', '07_02_02', '10_allpole/310_relays_contactors_contacts/01_coils/telerupteur.elmt', rand=14), 'Schließer mit Stromstoßspule links'),
    'ue_zeitrelais':   (lambda: geraet_ue_schaltgeraet('Zeitrelais einpolig (Treppenlicht)', '07_05_02', '07_15_07'), 'abfallverzögerter Schließer mit Spule links'),
    'daemmerung':      (lambda: geraet_betaetigt('Dämmerungsschalter', 'lx'), 'Schließer, betätigt durch Lichtsensor'),
    'bewegung':        (lambda: geraet_betaetigt('Bewegungsmelder', 'PIR'), 'Schließer, betätigt durch Melder'),
    'praesenz':        (lambda: geraet_betaetigt('Präsenzmelder', 'PM'), 'Schließer, betätigt durch Melder'),
    'ue_trenn':        (lambda: geraet_kontakt('Trennschalter einpolig', 'trenn', 1), 'für den Übersichtsschaltplan'),
    'ue_lasttrenn':    (lambda: geraet_kontakt('Lasttrennschalter einpolig', 'lasttrenn', 1), 'für den Übersichtsschaltplan'),
    'ue_leistung':     (lambda: geraet_kontakt('Leistungsschalter einpolig', 'leistung', 1), 'für den Übersichtsschaltplan'),
    'ue_fi':           (lambda: geraet_fi('FI einpolig', 'lasttrenn', 1), 'Wandler und IΔ-Kasten wie FI 2/4-polig'),
    'ue_fils':         (lambda: geraet_fils_ein(), 'gewählter LS mit Wandler und IΔ-Kasten'),
    'ue_zaehler':      (lambda: geraet_zaehler('Zähler einpolig', 1), 'Kasten wie Zähler 1-phasig, ein Leiter'),
    'ue_spd':          (lambda: geraet_spd_ein(), 'Ableiter mit Erde'),
    'ue_steckdose':    (lambda: geraet_steckdose('Steckdose einpolig', 1), 'ein Buchsenpol'),
    'ue_leuchte':      (lambda: geraet_leuchte_ein(), 'Lampe 08-10-01, Leitung von oben'),
    'leuchte':         (lambda: geraet_leuchte(), 'Lampe 08-10-01 zwischen L und N'),
    'erde_raster':     (lambda: geraet_einzeln('Erde', TERRE, dy=1, bem='ins Raster gesetzt'), 'Form unverändert, um 1 verschoben (Anschluss im Raster)'),
    'schutzerde_de':   (lambda: geraet_schutzerde_de(), 'Erde wie gewählt, Kreis eng und mittig'),
    'fils1n_de':       (lambda: geraet_fils_de(1), 'in der Darstellung des gewählten LS'),
    'fils3n_de':       (lambda: geraet_fils_de(3), 'in der Darstellung des gewählten LS 3-polig'),
    'erde':            (lambda: geraet_einzeln('Erde', '02_15_01'), ''),
    'schutzerde':      (lambda: geraet_einzeln('Schutzerde', '02_15_03', _kreis_voll, 'Kreis ergänzt', dy=5), 'Kreis fehlt in der Sammlungsdatei (Winkel 0) – ergänzt; Anschluss ins Raster gesetzt'),
    'masse':           (lambda: geraet_einzeln('Masse', '02_15_04'), ''),
    'zaehler1':        (lambda: geraet_zaehler('Zähler 1-phasig', 2), 'Kasten auf zwei Leiter'),
    'zaehler3':        (lambda: geraet_zaehler('Zähler 3-phasig', 4), 'Kasten auf vier Leiter verbreitert'),
    'trenn3':          (lambda: geraet_kontakt('Trennschalter 3-polig', 'trenn', 3), ''),
    'lasttrenn3':      (lambda: geraet_kontakt('Lasttrennschalter 3-polig', 'lasttrenn', 3), ''),
    'lasttrenn4':      (lambda: geraet_kontakt('Lasttrennschalter 4-polig', 'lasttrenn', 4), ''),
    'leistung3':       (lambda: geraet_kontakt('Leistungsschalter 3-polig', 'leistung', 3), ''),
    'schuetz1':        (lambda: geraet_kontakt('Schütz 1-polig', 'schuetz', 1), ''),
    'schuetz2':        (lambda: geraet_kontakt('Schütz 2-polig', 'schuetz', 2), ''),
    'schuetz3':        (lambda: geraet_kontakt('Schütz 3-polig', 'schuetz', 3), ''),
    'schuetz4':        (lambda: geraet_kontakt('Schütz 4-polig', 'schuetz', 4), ''),
    'spule':           (lambda: geraet_einzeln('Spule', '07_15_01'), 'allgemein'),
    'spule_ac':        (lambda: geraet_einzeln('Spule Wechselstrom', '07_15_12'), 'mit Kennzeichen Wechselstrom'),
    'sich1':           (lambda: geraet_einzeln('Sicherung', '07_21_01'), ''),
    'sich3':           (lambda: geraet_sicherung('Drei Sicherungen', '07_21_01', 3, wv=False), ''),
    'sichtrenn3':      (lambda: geraet_sicherung('Sicherungstrennschalter 3-polig', '07_21_08', 3), ''),
    'sichtrenn3n':     (lambda: geraet_sicherung('Sicherungstrennschalter 3-polig + N', '07_21_08', 3, n_trenner=True), 'N-Pol als Trennschalter'),
    'sichlasttrenn3':  (lambda: geraet_sicherung('Sicherungslasttrennschalter 3-polig', '07_21_09', 3), '3-polig aus drei Einpoligen'),
    'spd2':            (lambda: geraet_ableiter('Überspannungsschutz 1/N', 2), 'zwei Ableiter auf PE'),
    'spd4':            (lambda: geraet_ableiter('Überspannungsschutz 3/N', 4), 'vier Ableiter auf PE'),
    'fi2':             (lambda: geraet_fi('FI 2-polig', 'lasttrenn', 2), 'Wandler und IΔ-Kasten abgeleitet'),
    'fi4':             (lambda: geraet_fi('FI 4-polig', 'lasttrenn', 4), 'Wandler und IΔ-Kasten abgeleitet'),
    'filei2':          (lambda: geraet_fi('Fehlerstrom-Leistungsschalter 2-polig', 'leistung', 2), 'Wandler und IΔ-Kasten abgeleitet'),
    'filei4':          (lambda: geraet_fi('Fehlerstrom-Leistungsschalter 4-polig', 'leistung', 4), 'Wandler und IΔ-Kasten abgeleitet'),
    'fils1n':          (lambda: geraet_fi('FI/LS 1P+N', 'leistung', 2, [True, False]), 'Auslöser nur im Außenleiter'),
    'ls1':             (lambda: geraet_ls('LS 1-polig', [True]), 'Auslöser im Leiter'),
    'ls1n':            (lambda: geraet_ls('LS 1P+N', [True, False]), 'Auslöser nur im Außenleiter'),
    'ls2':             (lambda: geraet_ls('LS 2-polig', [True, True]), 'Auslöser in beiden Leitern'),
    'ls3':             (lambda: geraet_ls('LS 3-polig', [True, True, True]), 'Auslöser im Leiter'),
    'ls3n':            (lambda: geraet_ls('LS 3P+N', [True, True, True, False]), 'Auslöser nur in den Außenleitern'),
    'klemme':          (lambda: geraet_klemme('Durchgangsklemme'), 'Kreis offen nach Norm (Sammlung: gefüllt)'),
    'klemme_abzw':     (lambda: geraet_klemme('Klemme mit Abzweig', 'r'), 'Kreis offen nach Norm'),
    'klemme_abzw2':    (lambda: geraet_klemme('Klemme mit zwei Abzweigen', 'lr'), 'Kreis offen nach Norm'),
    'endklemme':       (lambda: geraet_klemme('Endklemme', ende=True), 'Kreis offen nach Norm'),
    'trennklemme':     (lambda: geraet_trennklemme('Trennklemme'), 'Trennstelle 03-03-17, senkrecht gedreht'),
    'klemmleiste5':    (lambda: geraet_klemmleiste('Klemmleiste 3P+N+PE', 5), 'Kreis offen nach Norm'),
    'steckdose3':      (lambda: geraet_steckdose('Steckdose 1/N/PE', 3), 'drei Buchsenpole, senkrecht gedreht'),
    'steckdose5':      (lambda: geraet_steckdose('Steckdose 3/N/PE', 5), 'fünf Buchsenpole, senkrecht gedreht'),
}

def alle():
    aus = {}
    for k, (f, bem) in BAUTEILE.items():
        b = f()
        aus[k] = {'xml': b.xml(), 'bem': bem,
                  'quellen': [_qname(q) + (f' ({x})' if x else '') for q, x in b.quellen]}
    return aus

if __name__ == '__main__':
    for k, v in alle().items():
        ET.fromstring(v['xml'])       # Wohlgeformtheit prüfen
        print(k, '|', '; '.join(v['quellen']))
