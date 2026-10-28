"""Schreibt die feste Bibliothek (Jeans Auswahl vom 24.10.2026) als JSON und
als Ansichtsseite. Aufruf: python3 -I bibliothek.py bibliothek-v1.3.html"""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import baukasten
from pfade import SAMMLUNG, SRC, BIB, DOCS, BUILD, sammlung_pruefen

FASSUNG = 'v1.4'
STAND = '2026-10-28'

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
 ('Trennen und Schalten', 'lasttrenn3', 'Lasttrennschalter 3-polig', 'bau:lasttrenn3', False),
 ('Trennen und Schalten', 'leistung3',  'Leistungsschalter 3-polig', 'bau:leistung3', False),
 ('Trennen und Schalten', 'schuetz1',   'Schütz – Hauptkontakte 1-polig', 'bau:schuetz1', False),
 ('Trennen und Schalten', 'schuetz2',   'Schütz – Hauptkontakte 2-polig', 'bau:schuetz2', False),
 ('Trennen und Schalten', 'schuetz3',   'Schütz – Hauptkontakte 3-polig', 'bau:schuetz3', False),
 ('Trennen und Schalten', 'schuetz4',   'Schütz – Hauptkontakte 4-polig', 'bau:schuetz4', False),
 ('Trennen und Schalten', 'spule',      'Schützspule',               '91_en_60617/en_60617_07/en_60617_07_15/en_60617_07_15_01.elmt', False),
 ('Trennen und Schalten', 'stromstoss', 'Stromstoßschalter (Spule)', '10_allpole/310_relays_contactors_contacts/01_coils/telerupteur.elmt', False),
 ('Sicherungen', 'sich1',          'Sicherung 1-polig',             '91_en_60617/en_60617_07/en_60617_07_21/en_60617_07_21_01.elmt', False),
 ('Sicherungen', 'sich3',          'Drei Sicherungen',              'bau:sich3', False),
 ('Sicherungen', 'sichtrenn1',     'Sicherungstrennschalter 1-polig', '91_en_60617/en_60617_07/en_60617_07_21/en_60617_07_21_08.elmt', False),
 ('Sicherungen', 'sichtrenn3',     'Sicherungstrennschalter 3-polig', 'bau:sichtrenn3', False),
 ('Sicherungen', 'sichlasttrenn1', 'Sicherungslasttrennschalter 1-polig', '91_en_60617/en_60617_07/en_60617_07_21/en_60617_07_21_09.elmt', False),
 ('Sicherungen', 'sichlasttrenn3', 'Sicherungslasttrennschalter 3-polig (NH-Leiste)', 'bau:sichlasttrenn3', False),
 ('Sicherungen', 'spd2',           'Überspannungsschutz-Gerät 1/N', 'bau:spd2', False),
 ('Sicherungen', 'spd4',           'Überspannungsschutz-Gerät 3/N', 'bau:spd4', False),
 ('Sicherungen', 'ableiter',       'Überspannungsableiter einzeln', '91_en_60617/en_60617_07/en_60617_07_22/en_60617_07_22_03.elmt', False),
 ('Fehlerstromschutz', 'fi2',      'FI 2-polig',                    'bau:fi2', False),
 ('Fehlerstromschutz', 'fi4',      'FI 4-polig',                    'bau:fi4', False),
 ('Fehlerstromschutz', 'fils1n',   'FI/LS 1P+N',                    'bau:fils1n_de', False),
 ('Fehlerstromschutz', 'fils3n',   'FI/LS 3P+N (4-polig)',          'bau:fils3n_de', False),
 ('Leitungsschutz', 'ls1',         'LS 1-polig',                    '10_allpole/200_fuses_protective_gears/11_circuit_breakers/disjonct_m_1f.elmt', False),
 ('Leitungsschutz', 'ls3',         'LS 3-polig',                    '10_allpole/200_fuses_protective_gears/11_circuit_breakers/disjonct_m_3f.elmt', False),
 ('Klemmen und Verbindungen', 'klemme',       'Durchgangsklemme',          'bau:klemme', False),
 ('Klemmen und Verbindungen', 'klemme_abzw',  'Klemme mit Abzweig',        'bau:klemme_abzw', False),
 ('Klemmen und Verbindungen', 'klemme_abzw2', 'Klemme mit zwei Abzweigen', 'bau:klemme_abzw2', False),
 ('Klemmen und Verbindungen', 'endklemme',    'Endklemme',                 'bau:endklemme', False),
 ('Klemmen und Verbindungen', 'doppelstock',  'Doppelstockklemme',         '10_allpole/130_terminals_terminal_strips/bornedouble.elmt', False),
 ('Klemmen und Verbindungen', 'trennklemme',  'Trennklemme',               'bau:trennklemme', False),
 ('Klemmen und Verbindungen', 'klemmleiste5', 'Klemmleiste 3P+N+PE',       'bau:klemmleiste5', False),
 ('Klemmen und Verbindungen', 'qv_kommend',   'Querverweis kommend',       '10_allpole/100_folio_referencing/01coming_arrow.elmt', False),
 ('Klemmen und Verbindungen', 'qv_gehend',    'Querverweis gehend',        '10_allpole/100_folio_referencing/02going_arrow.elmt', False),
 ('Abgänge', 'steckdose3',  'Steckdose 1/N/PE (Schuko, CEE 3-polig)', 'bau:steckdose3', False),
 ('Abgänge', 'steckdose5',  'Steckdose 3/N/PE (CEE 5-polig)',         'bau:steckdose5', False),
 ('Abgänge', 'leuchte',     'Leuchte',                                'bau:leuchte', False),
 ('Übersicht (einpolig)', 'ue_trenn',     'Trennschalter einpolig',       'bau:ue_trenn', False),
 ('Übersicht (einpolig)', 'ue_lasttrenn', 'Lasttrennschalter einpolig',   'bau:ue_lasttrenn', False),
 ('Übersicht (einpolig)', 'ue_leistung',  'Leistungsschalter einpolig',   'bau:ue_leistung', False),
 ('Übersicht (einpolig)', 'ue_fi',        'FI einpolig',                  'bau:ue_fi', False),
 ('Übersicht (einpolig)', 'ue_fils',      'FI/LS einpolig',               'bau:ue_fils', False),
 ('Übersicht (einpolig)', 'ue_zaehler',   'Zähler einpolig',              'bau:ue_zaehler', False),
 ('Übersicht (einpolig)', 'ue_spd',       'Überspannungsschutz einpolig', 'bau:ue_spd', False),
 ('Übersicht (einpolig)', 'ue_steckdose', 'Steckdose einpolig',           'bau:ue_steckdose', False),
 ('Übersicht (einpolig)', 'ue_leuchte',   'Leuchte einpolig',             'bau:ue_leuchte', False),
 ('Steuerung – Befehlsgeber', 'taster_s',      'Taster (Schließer)',                  '91_en_60617/en_60617_07/en_60617_07_07/en_60617_07_07_02.elmt', True),
 ('Steuerung – Befehlsgeber', 'taster_oe',     'Taster (Öffner, Aus-Taster)',         'bau:taster_oe', True),
 ('Steuerung – Befehlsgeber', 'schalter_hand', 'Schalter handbetätigt (Lichtschalter)', '91_en_60617/en_60617_07/en_60617_07_07/en_60617_07_07_01.elmt', True),
 ('Steuerung – Befehlsgeber', 'hand0auto',     'Wahlschalter Hand-0-Automatik',       'bau:hand0auto', True),
 ('Steuerung – Befehlsgeber', 'notaus',        'Not-Aus (Pilzdrucktaster, Öffner)',   '91_en_60617/en_60617_07/en_60617_07_07/en_60617_07_07_06.elmt', True),
 ('Steuerung – Befehlsgeber', 'daemmerung',    'Dämmerungsschalter (Kontakt)',        'bau:daemmerung', True),
 ('Steuerung – Befehlsgeber', 'bewegung',      'Bewegungsmelder (Kontakt)',           'bau:bewegung', True),
 ('Steuerung – Befehlsgeber', 'praesenz',      'Präsenzmelder (Kontakt)',             'bau:praesenz', True),
 ('Steuerung – Befehlsgeber', 'endschalter_s', 'Endschalter, Schließer',              '91_en_60617/en_60617_07/en_60617_07_08/en_60617_07_08_01.elmt', True),
 ('Steuerung – Befehlsgeber', 'endschalter_oe','Endschalter, Öffner',                 '91_en_60617/en_60617_07/en_60617_07_08/en_60617_07_08_02.elmt', True),
 ('Steuerung – Hilfskontakte', 'hilfs_s',      'Hilfsschließer (13/14)',              '91_en_60617/en_60617_07/en_60617_07_02/en_60617_07_02_02.elmt', True),
 ('Steuerung – Hilfskontakte', 'hilfs_oe',     'Hilfsöffner (21/22)',                 '91_en_60617/en_60617_07/en_60617_07_02/en_60617_07_02_03.elmt', True),
 ('Steuerung – Zeitrelais', 'spule_ein',       'Spule einschaltverzögert',            '91_en_60617/en_60617_07/en_60617_07_15/en_60617_07_15_08.elmt', True),
 ('Steuerung – Zeitrelais', 'spule_aus',       'Spule ausschaltverzögert',            '91_en_60617/en_60617_07/en_60617_07_15/en_60617_07_15_07.elmt', True),
 ('Steuerung – Zeitrelais', 'spule_einaus',    'Spule ein- und ausschaltverzögert',   '91_en_60617/en_60617_07/en_60617_07_15/en_60617_07_15_09.elmt', True),
 ('Steuerung – Zeitrelais', 'k_s_ein',         'Schließer einschaltverzögert',        '91_en_60617/en_60617_07/en_60617_07_05/en_60617_07_05_01.elmt', True),
 ('Steuerung – Zeitrelais', 'k_s_aus',         'Schließer ausschaltverzögert',        '91_en_60617/en_60617_07/en_60617_07_05/en_60617_07_05_02.elmt', True),
 ('Steuerung – Zeitrelais', 'k_oe_ein',        'Öffner einschaltverzögert',           '91_en_60617/en_60617_07/en_60617_07_05/en_60617_07_05_03.elmt', True),
 ('Steuerung – Zeitrelais', 'k_oe_aus',        'Öffner ausschaltverzögert',           '91_en_60617/en_60617_07/en_60617_07_05/en_60617_07_05_04.elmt', True),
 ('Steuerung – Zeitrelais', 'k_s_einaus',      'Schließer ein- und ausschaltverzögert', '91_en_60617/en_60617_07/en_60617_07_05/en_60617_07_05_05.elmt', True),
 ('Melden', 'meldeleuchte',                    'Meldeleuchte',                        'bau:meldeleuchte', True),
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
            aus.append(dict(gruppe=gruppe, kennung=kenn, name=name,
                            herkunft='EN-Satz' if quelle.startswith('91_en') else 'Sammlung',
                            quellen=[quelle.split('/')[-1]], bem='unverändert', neu=neu,
                            xml=f.read_text(encoding='utf-8')))
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
