"""Gemeinsame Pfade. Die QElectroTech-Sammlung wird nur für den Bau der
Bibliothek und der Auswahlblätter gebraucht (tools/sammlung_holen.sh);
die App selbst baut allein aus bibliothek/bibliothek.json."""
import os, pathlib
WURZEL = pathlib.Path(__file__).resolve().parent.parent
SRC = WURZEL / 'src'
BIB = WURZEL / 'bibliothek'
DOCS = WURZEL / 'docs'
BUILD = WURZEL / 'build'          # versionierte Einzeldateien zum Weitergeben (nicht im Repository)
SAMMLUNG = pathlib.Path(os.environ.get('SLP_SAMMLUNG', WURZEL / 'quelle' / 'qelectrotech-elements' / '10_electric'))

def sammlung_pruefen():
    if not SAMMLUNG.exists():
        raise SystemExit(f'QElectroTech-Sammlung fehlt unter {SAMMLUNG} – erst tools/sammlung_holen.sh ausführen.')
