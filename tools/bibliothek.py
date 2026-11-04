"""Schreibt die feste Bibliothek (Jeans Auswahl vom 24.10.2026) als JSON und
als Ansichtsseite. Aufruf: python3 -I bibliothek.py bibliothek-v1.3.html"""
import json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import baukasten
from pfade import SAMMLUNG, SRC, BIB, DOCS, BUILD, sammlung_pruefen

FASSUNG = 'v1.11'
STAND = '2026-11-04'

# (Gruppe, Kennung, Bedeutung, Quelle, neu?)
# Quelle: Pfad in der Sammlung oder 'bau:<Schlüssel>' für den EN-Baukasten
AUSWAHL = [
 ('Einspeisung', 'netz_tns',      'Netz 3/N/PE (TN-S)',            '10_allpole/110_network_supplies/src_3p_pe_n.elmt', False),
 ('Einspeisung', 'netz_tnc',      'Netz 3/PEN (TN-C)',             '10_allpole/110_network_supplies/src_3p_pen.elmt', False),
 ('Einspeisung', 'netz_1n',       'Netz 1/N/PE',                   '10_allpole/110_network_supplies/src_1p_pe_n.elmt', False),
 ('Einspeisung', 'tnc_tns',       'Übergang TN-C auf TN-S',        '10_allpole/110_network_supplies/src_tnc_tns.elmt', False),
 ('Einspeisung', 'erde',          'Erde',                          'bau:erde_raster', False),
 ('Einspeisung', 'schutzerde',    'Schutzerde',                    'bau:schutzerde_de', False),
 ('Einspeisung', 'masse',         'Masse',                         '91_en_60617/en_60617_02/en_60617_02_15/en_60617_02_15_04.elmt', False),
 ('Einspeisung', 'zaehler3',      'Zähler 3-phasig',               'bau:zaehler3', False),
 ('Einspeisung', 'zaehler1',      'Zähler 1-phasig',               'bau:zaehler1', False),
 ('Trennen und Schalten', 'trenn3',     'Trennschalter 3-polig',     'bau:trenn3', False),
 ('Trennen und Schalten', 'lasttrenn3', 'Lasttrennschalter 3-polig', 'bau:lasttrenn3_neu', True),
 ('Trennen und Schalten', 'leistung3',  'Leistungsschalter 3-polig', 'bau:leistung3', False),
 ('Trennen und Schalten', 'schuetz1',   'Schütz – Hauptkontakte 1-polig', 'bau:schuetz1', False),
 ('Trennen und Schalten', 'schuetz2',   'Schütz – Hauptkontakte 2-polig', 'bau:schuetz2', False),
 ('Trennen und Schalten', 'schuetz3',   'Schütz – Hauptkontakte 3-polig', 'bau:schuetz3', False),
 ('Trennen und Schalten', 'schuetz4',   'Schütz – Hauptkontakte 4-polig', 'bau:schuetz4', False),
 ('Trennen und Schalten', 'spule',      'Schützspule',               '91_en_60617/en_60617_07/en_60617_07_15/en_60617_07_15_01.elmt', False),
 ('Trennen und Schalten', 'stromstoss', 'Stromstoßschalter (Spule)', 'bau:stromstoss_neu', True),
 ('Sicherungen', 'sich1',          'Sicherung 1-polig',             '91_en_60617/en_60617_07/en_60617_07_21/en_60617_07_21_01.elmt', False),
 ('Sicherungen', 'sich3',          'Drei Sicherungen',              'bau:sich3', False),
 ('Sicherungen', 'sichtrenn1',     'Sicherungstrennschalter 1-polig', 'bau:sichtrenn1_neu', True),
 ('Sicherungen', 'sichtrenn3',     'Sicherungstrennschalter 3-polig', 'bau:sichtrenn3_neu', True),
 ('Sicherungen', 'sichlasttrenn1', 'Sicherungslasttrennschalter 1-polig', 'bau:sichlasttrenn1_neu', True),
 ('Sicherungen', 'sichlasttrenn3', 'Sicherungslasttrennschalter 3-polig (NH-Leiste)', 'bau:sichlasttrenn3_neu', True),
 ('Sicherungen', 'spd2',           'Überspannungsschutz-Gerät 1/N', 'bau:spd2', False),
 ('Sicherungen', 'spd4',           'Überspannungsschutz-Gerät 3/N', 'bau:spd4', False),
 ('Sicherungen', 'ableiter',       'Überspannungsableiter einzeln', '91_en_60617/en_60617_07/en_60617_07_22/en_60617_07_22_03.elmt', False),
 ('Fehlerstromschutz', 'fi2',      'FI 2-polig',                    'bau:fi2_neu', True),
 ('Fehlerstromschutz', 'fi4',      'FI 4-polig',                    'bau:fi4_neu', True),
 ('Fehlerstromschutz', 'fils1n',   'FI/LS 1P+N',                    'bau:fils1n_de', False),
 ('Fehlerstromschutz', 'fils3n',   'FI/LS 3P+N (4-polig)',          'bau:fils3n_de', False),
 ('Leitungsschutz', 'ls1',         'LS 1-polig',                    'bau:ls1_neu', True),
 ('Leitungsschutz', 'ls3',         'LS 3-polig',                    'bau:ls3_neu', True),
 ('Klemmen und Verbindungen', 'klemme',       'Durchgangsklemme',          'bau:klemme', False),
 ('Klemmen und Verbindungen', 'klemme_abzw',  'Klemme mit Abzweig',        'bau:klemme_abzw', False),
 ('Klemmen und Verbindungen', 'klemme_abzw2', 'Klemme mit zwei Abzweigen', 'bau:klemme_abzw2', False),
 ('Klemmen und Verbindungen', 'endklemme',    'Endklemme',                 'bau:endklemme', False),
 ('Klemmen und Verbindungen', 'doppelstock',  'Doppelstockklemme',         '10_allpole/130_terminals_terminal_strips/bornedouble.elmt', False),
 ('Klemmen und Verbindungen', 'trennklemme',  'Trennklemme',               'bau:trennklemme_neu', True),
 ('Klemmen und Verbindungen', 'klemmleiste5', 'Klemmleiste 3P+N+PE',       'bau:klemmleiste5', False),
 ('Klemmen und Verbindungen', 'qv_kommend',   'Querverweis kommend',       '10_allpole/100_folio_referencing/01coming_arrow.elmt', False),
 ('Klemmen und Verbindungen', 'qv_gehend',    'Querverweis gehend',        '10_allpole/100_folio_referencing/02going_arrow.elmt', False),
 ('Abgänge', 'steckdose3',  'Steckdose 1/N/PE (Schuko, CEE 3-polig)', 'bau:steckdose3', False),
 ('Abgänge', 'steckdose5',  'Steckdose 3/N/PE (CEE 5-polig)',         'bau:steckdose5', False),
 ('Abgänge', 'leuchte',     'Leuchte',                                'bau:leuchte', False),
 ('Übersicht (einpolig)', 'ue_trenn',     'Trennschalter einpolig',       'bau:ue_trenn', False),
 ('Übersicht (einpolig)', 'ue_lasttrenn', 'Lasttrennschalter einpolig',   'bau:ue_lasttrenn_neu', True),
 ('Übersicht (einpolig)', 'ue_leistung',  'Leistungsschalter einpolig',   'bau:ue_leistung', False),
 ('Übersicht (einpolig)', 'ue_fi',        'FI einpolig',                  'bau:ue_fi_neu', True),
 ('Übersicht (einpolig)', 'ue_fils',      'FI/LS einpolig',               'bau:ue_fils', False),
 ('Übersicht (einpolig)', 'ue_zaehler',   'Zähler einpolig',              'bau:ue_zaehler', False),
 ('Übersicht (einpolig)', 'ue_spd',       'Überspannungsschutz einpolig', 'bau:ue_spd', False),
 ('Übersicht (einpolig)', 'ue_steckdose', 'Steckdose einpolig',           'bau:ue_steckdose', False),
 ('Übersicht (einpolig)', 'ue_leuchte',   'Leuchte einpolig',             'bau:ue_leuchte', False),
 ('Steuerung – Befehlsgeber', 'taster_s',      'Taster (Schließer)',                  '91_en_60617/en_60617_07/en_60617_07_07/en_60617_07_07_02.elmt', False),
 ('Steuerung – Befehlsgeber', 'taster_oe',     'Taster (Öffner, Aus-Taster)',         'bau:taster_oe', False),
 ('Steuerung – Befehlsgeber', 'schalter_hand', 'Schalter handbetätigt (Lichtschalter)', '91_en_60617/en_60617_07/en_60617_07_07/en_60617_07_07_01.elmt', False),
 ('Steuerung – Befehlsgeber', 'hand0auto',     'Wahlschalter Hand-0-Automatik',       'bau:hand0auto', False),
 ('Steuerung – Befehlsgeber', 'notaus',        'Not-Aus (Pilzdrucktaster, Öffner)',   '91_en_60617/en_60617_07/en_60617_07_07/en_60617_07_07_06.elmt', False),
 ('Steuerung – Befehlsgeber', 'daemmerung',    'Dämmerungsschalter (Kontakt)',        'bau:daemmerung_neu', True),
 ('Steuerung – Befehlsgeber', 'bewegung',      'Bewegungsmelder (Kontakt)',           'bau:bewegung_neu', True),
 ('Steuerung – Befehlsgeber', 'praesenz',      'Präsenzmelder (Kontakt)',             'bau:praesenz_neu', True),
 ('Steuerung – Befehlsgeber', 'endschalter_s', 'Endschalter, Schließer',              '91_en_60617/en_60617_07/en_60617_07_08/en_60617_07_08_01.elmt', False),
 ('Steuerung – Befehlsgeber', 'endschalter_oe','Endschalter, Öffner',                 '91_en_60617/en_60617_07/en_60617_07_08/en_60617_07_08_02.elmt', False),
 ('Steuerung – Hilfskontakte', 'hilfs_s',      'Hilfsschließer (13/14)',              'bau:hilfs_s_neu', True),
 ('Steuerung – Hilfskontakte', 'hilfs_oe',     'Hilfsöffner (21/22)',                 '91_en_60617/en_60617_07/en_60617_07_02/en_60617_07_02_03.elmt', False),
 ('Steuerung – Zeitrelais', 'spule_ein',       'Spule einschaltverzögert',            '91_en_60617/en_60617_07/en_60617_07_15/en_60617_07_15_08.elmt', False),
 ('Steuerung – Zeitrelais', 'spule_aus',       'Spule ausschaltverzögert',            '91_en_60617/en_60617_07/en_60617_07_15/en_60617_07_15_07.elmt', False),
 ('Steuerung – Zeitrelais', 'spule_einaus',    'Spule ein- und ausschaltverzögert',   '91_en_60617/en_60617_07/en_60617_07_15/en_60617_07_15_09.elmt', False),
 ('Steuerung – Zeitrelais', 'k_s_ein',         'Schließer einschaltverzögert',        '91_en_60617/en_60617_07/en_60617_07_05/en_60617_07_05_01.elmt', False),
 ('Steuerung – Zeitrelais', 'k_s_aus',         'Schließer ausschaltverzögert',        '91_en_60617/en_60617_07/en_60617_07_05/en_60617_07_05_02.elmt', False),
 ('Steuerung – Zeitrelais', 'k_oe_ein',        'Öffner einschaltverzögert',           '91_en_60617/en_60617_07/en_60617_07_05/en_60617_07_05_03.elmt', False),
 ('Steuerung – Zeitrelais', 'k_oe_aus',        'Öffner ausschaltverzögert',           '91_en_60617/en_60617_07/en_60617_07_05/en_60617_07_05_04.elmt', False),
 ('Steuerung – Zeitrelais', 'k_s_einaus',      'Schließer ein- und ausschaltverzögert', '91_en_60617/en_60617_07/en_60617_07_05/en_60617_07_05_05.elmt', False),
 ('Melden', 'meldeleuchte',                    'Meldeleuchte',                        'bau:meldeleuchte', False),
 ('Steuertrafo', 'trafo',                    'Transformator mit getrennten Wicklungen', '10_allpole/330_transformers_power_supplies/10_transformers/transformator_1f_2.elmt', False),
 ('Steuertrafo', 'ue_trafo',                 'Transformator mit zwei Wicklungen (einpolig)', 'bau:ue_trafo', False),
 ('Erzeugung und Speicher', 'generator3', 'Generator Drehstrom mit PE',       'bau:generator3_pe', True),
 ('Erzeugung und Speicher', 'pv',         'PV-Generator (Photovoltaik)',      'bau:pv', True),
 ('Erzeugung und Speicher', 'wechselrichter', 'Wechselrichter DC/AC',         'bau:wechselrichter', True),
 ('Erzeugung und Speicher', 'batterie',   'Batterie / Speicher',              'bau:batterie', True),
 ('Erzeugung und Speicher', 'netzumschalter', 'Netzumschalter (Zweiwegeschalter, einpolig)', '91_en_60617/en_60617_07/en_60617_07_13/en_60617_07_13_07.elmt', True),
 ('Erzeugung und Speicher', 'netzteil',   'Netzteil AC/DC',                   'bau:netzteil', True),
 ('Motoren', 'motor3',          'Motor Drehstrom mit PE (3 Anschlüsse)',      'bau:motor3_pe', True),
 ('Motoren', 'motor6',          'Motor Drehstrom mit PE (6 Anschlüsse, Stern-Dreieck)', 'bau:motor6_pe', True),
 ('Motoren', 'motor1',          'Motor Wechselstrom mit PE',                  'bau:motor1_pe', True),
 ('Motoren', 'motorschutz3',    'Motorschutzschalter 3-polig',                '10_allpole/200_fuses_protective_gears/12_magneto_thermal_circuit_breakers/fa4202_disjoncteur_moteur_3p.elmt', True),
 ('Motoren', 'ueberlast3',      'Überlastrelais 3-polig (Hauptkreis)',        'bau:ueberlast3', True),
 ('Motoren', 'ueberlast1',      'Überlastrelais 1-polig (Wechselstrommotor)', 'bau:ueberlast1', True),
 ('Motoren', 'umrichter3',      'Frequenzumrichter',                          'bau:umrichter3', True),
 ('Steuerung – Hilfskontakte', 'oe_thermisch', 'Überlastrelais-Öffner (95/96)',  'bau:oe_thermisch', True),
 ('Steuerung – Hilfskontakte', 's_thermisch',  'Überlastrelais-Schließer (97/98)', 'bau:s_thermisch', True),
 ('Steuerung – Hilfskontakte', 'wechsler',     'Wechsler',                       '91_en_60617/en_60617_07/en_60617_07_02/en_60617_07_02_04.elmt', True),
 ('Steuerung – Befehlsgeber', 's_schwimmer',   'Schwimmerschalter, Schließer',   'bau:s_schwimmer', True),
 ('Steuerung – Befehlsgeber', 'oe_schwimmer',  'Schwimmerschalter, Öffner',      'bau:oe_schwimmer', True),
 ('Steuerung – Befehlsgeber', 'w_schwimmer',   'Schwimmerschalter, Wechsler',    'bau:w_schwimmer', True),
 ('Steuerung – Befehlsgeber', 's_schluessel',  'Schlüsselschalter, Schließer',   'bau:s_schluessel', True),
 ('Steuerung – Befehlsgeber', 'oe_schluessel', 'Schlüsselschalter, Öffner',      'bau:oe_schluessel', True),
 ('Melden', 'klingel',          'Klingel (Wecker)',                           '91_en_60617/en_60617_08/en_60617_08_10/en_60617_08_10_06.elmt', True),
 ('Melden', 'gong',             'Gong (Einschlagwecker)',                     '91_en_60617/en_60617_08/en_60617_08_10/en_60617_08_10_08.elmt', True),
 ('Melden', 'summer',           'Summer',                                     '91_en_60617/en_60617_08/en_60617_08_10/en_60617_08_10_10.elmt', True),
 ('Melden', 'hupe',             'Hupe',                                       '91_en_60617/en_60617_08/en_60617_08_10/en_60617_08_10_05.elmt', True),
 ('Melden', 'tueroeffner',      'Türöffner',                                  'bau:tueroeffner', True),
 ('Sonstiges', 'diode',         'Diode',                                      '10_allpole/395_electronics_semiconductors/11_diodes/diode.elmt', True),
 ('Sonstiges', 'funkenstrecke', 'Funkenstrecke (N–PE, 3+1-Schaltung)',        '91_en_60617/en_60617_07/en_60617_07_22/en_60617_07_22_01.elmt', True),
 ('Sonstiges', 'schirm',        'Schirm (Abschirmung)',                       '91_en_60617/en_60617_02/en_60617_02_01/en_60617_02_01_07.elmt', True),
 ('Sonstiges', 'erdungsschiene','Erdungsschiene / Potentialausgleich',        'bau:erdungsschiene', True),
 ('Erzeugung und Speicher', 'pv_oben',    'PV-Generator, Anschlüsse oben',   'bau:pv_oben', True),
 ('Erzeugung und Speicher', 'wr1',        'Wechselrichter 1/N/PE (AC oben)',  'bau:wr1', True),
 ('Erzeugung und Speicher', 'wr3',        'Wechselrichter 3/N/PE (AC oben)',  'bau:wr3', True),
 ('Erzeugung und Speicher', 'wr1_hybrid', 'Hybrid-Wechselrichter 1/N/PE (PV und Batterie)', 'bau:wr1_hybrid', True),
 ('Erzeugung und Speicher', 'wr3_hybrid', 'Hybrid-Wechselrichter 3/N/PE (PV und Batterie)', 'bau:wr3_hybrid', True),
 ('Trennen und Schalten', 'lasttrenn2',   'Lasttrennschalter 2-polig (DC-Freischalter)', 'bau:lasttrenn2_neu', True),
 ('Erzeugung und Speicher', 'wallbox', 'Wallbox (Ladestation 3/N/PE)', 'bau:wallbox_buchsen', True),
 ('Übersicht (einpolig)', 'ue_motor',     'Motor einpolig',               'bau:ue_motor', True),
 ('Übersicht (einpolig)', 'ue_wr',        'Wechselrichter einpolig',      'bau:ue_wr', True),
 ('Übersicht (einpolig)', 'ue_umrichter', 'Frequenzumrichter einpolig',   'bau:ue_umrichter', True),
]
def daten():
    bau = baukasten.alle()
    aus = []
    for gruppe, kenn, name, quelle, neu in AUSWAHL:
        if quelle.startswith('bau:'):
            b = bau[quelle[4:]]
            aus.append(dict(gruppe=gruppe, kennung=kenn, name=name, herkunft='EN-Baukasten' if 'Sammlung' not in ' '.join(b['quellen']) else 'zusammengesetzt',
                            quellen=b['quellen'], bem=b['bem'], neu=neu, xml=b['xml']))
        else:
            f = SAMMLUNG / quelle
            xml = f.read_text(encoding='utf-8')
            bem = 'unverändert'
            # Platzhaltertexte der Sammlung (z. B. „_“ im Trafo) würden im Plan als Zeichen erscheinen (ab v1.10)
            ohne = re.sub(r'\s*<text\b[^>]*\btext="_"[^>]*/>', '', xml)
            if ohne != xml: xml, bem = ohne, 'Platzhaltertext „_“ entfernt'
            aus.append(dict(gruppe=gruppe, kennung=kenn, name=name,
                            herkunft='EN-Satz' if quelle.startswith('91_en') else 'Sammlung',
                            quellen=[quelle.split('/')[-1]], bem=bem, neu=neu, xml=xml))
    return aus

if __name__ == '__main__':
    sammlung_pruefen()
    d = daten()
    obj = {'fassung': FASSUNG, 'stand': STAND, 'zeichen': d}
    (BIB / 'bibliothek.json').write_text(json.dumps(obj, ensure_ascii=False))
    html = (SRC / 'bibliothek-vorlage.html').read_text()
    html = html.replace('/*RENDERER*/', (SRC / 'qet-render.js').read_text()).replace('/*FASSUNG*/', FASSUNG)
    html = html.replace('/*DATEN*/', json.dumps(obj, ensure_ascii=False).replace('</', '<\\/'))
    DOCS.mkdir(exist_ok=True); BUILD.mkdir(exist_ok=True)
    (DOCS / 'bibliothek.html').write_text(html, encoding='utf-8')
    (BUILD / f'bibliothek-{FASSUNG}.html').write_text(html, encoding='utf-8')
    print(BIB / 'bibliothek.json', len(d), 'Zeichen, Fassung', FASSUNG)
