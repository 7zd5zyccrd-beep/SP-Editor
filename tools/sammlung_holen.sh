#!/bin/sh
# Holt die QElectroTech-Elementsammlung (CC-BY 3.0) nach quelle/ – nur nötig,
# um die Bibliothek neu zu bauen oder neue Zeichen auszuwählen.
# Stand der bisherigen Auswahl: Commit 5b0c8c7 (22.10.2026); Trafo v0.1 aus 14a4727 (28.10.2026),
# die übrigen Zeichen sind dort unverändert.
set -e
cd "$(dirname "$0")/.."
mkdir -p quelle
if [ -d quelle/qelectrotech-elements ]; then
  git -C quelle/qelectrotech-elements pull --ff-only
else
  git clone --depth 1 https://github.com/qelectrotech/qelectrotech-elements.git quelle/qelectrotech-elements
fi
