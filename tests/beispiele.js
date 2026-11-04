// Beispielprojekte für die Prüfungen. Jede Funktion baut P neu auf und zeichnet.
// Läuft im Kontext der fertigen App (docs/index.html).
window.BEISPIELE = {
  // Halle 3: HV (NH, Zähler, SPD, FI-Gruppe, CEE, Herd, Abgang zur UV, 4 × FI/LS) und UV Werkstatt
  grund: ()=>{
 P = neuesProjekt(); Object.assign(P.projekt, {firma:'Musterfirma Elektro GmbH', anschrift:'Musterstraße 1, 12345 Musterstadt', projekt:'Halle 3', ersteller:'Jean', nummer:'SLP-0001'});
 const hv = neuerVerteiler('HV'); hv.vorsicherung = {zeichen:'sichlasttrenn3', art:'gG', nenn:'63'}; hv.zaehler = {zeichen:'zaehler3'}; hv.spd = {zeichen:'spd4'};
 const g = neueGruppe(); g.geraet = {zeichen:'fi4', nenn:'40', idn:'30', fityp:'A'};
 [['Steckdosen','Büro'],['Licht','Büro'],['Steckdosen','Flur'],['Licht','Flur']].forEach(([b,o])=>{const a=neuerAbgang(); a.ziel.bez=b; a.ziel.ort=o; if(b==='Licht'){a.ziel.anschluss='leuchte'; a.leitung.quer='1,5'; a.geraet.nenn='10';} g.kinder.push(a);});
 hv.knoten.push(g);
 const cee = neuerAbgang(); cee.ziel={bez:'CEE 32 A', ort:'Werkstatt', anschluss:'steckdose5'}; cee.geraet={zeichen:'fils3n', kennlinie:'C', nenn:'32', idn:'30', fityp:'A'}; cee.leitung.quer='6'; hv.knoten.push(cee);
 const herd = neuerAbgang(); herd.ziel={bez:'Herd', ort:'Küche', anschluss:'dose'}; herd.geraet={zeichen:'ls3', kennlinie:'B', nenn:'16'}; hv.knoten.push(herd);
 const uvA = neuerAbgang(); uvA.geraet={zeichen:'ls3', kennlinie:'C', nenn:'32'}; uvA.ziel={bez:'', ort:'Werkstatt', anschluss:'fest'}; uvA.leitung.quer='6'; hv.knoten.push(uvA);
 for (let i=0;i<4;i++){const a=neuerAbgang(); a.ziel.bez='Steckdosen'; a.ziel.ort='Lager '+(i+1); a.geraet={zeichen:'fils1n', kennlinie:'B', nenn:'16', idn:'30', fityp:'A'}; hv.knoten.push(a);}
 const uv = neuerVerteiler('UV Werkstatt'); uv.hauptschalter={zeichen:'lasttrenn3', nenn:'40'}; uvA.speist = uv.id;
 const g2 = neueGruppe(); g2.geraet={zeichen:'fi2', nenn:'40', idn:'30', fityp:'A'};
 ['Werkbank','Licht'].forEach(b=>{const a=neuerAbgang(); a.ziel.bez=b; a.ziel.ort='Werkstatt'; if(b==='Licht'){a.ziel.anschluss='fest'; a.leitung.quer='1,5'; a.geraet.nenn='10';} g2.kinder.push(a);}); uv.knoten.push(g2);
 const s=neuerAbgang(); s.ziel={bez:'Kreissäge', ort:'Werkstatt', anschluss:'steckdose5'}; s.geraet={zeichen:'ls3', kennlinie:'C', nenn:'16'}; uv.knoten.push(s);
 P.verteiler.push(hv, uv); sichern(); stapel=[{s:'start'}]; zeichne(); },
  // wie grund, dazu Klemmleiste -X1 in der HV (CEE ohne Klemmen), UV mit normaler N-Klemme und Kreissäge über -X1
  klemmen: () => { BEISPIELE.grund(); const [hv, uv] = P.verteiler; hv.klemmen = 'leiste';
    hv.knoten.find(k => k.ziel && k.ziel.bez === 'CEE 32 A').klemmen = 'nein';
    uv.nKlemme = 'normal'; uv.knoten.find(k => k.ziel && k.ziel.bez === 'Kreissäge').klemmen = 'ja'; sichern(); zeichne(); },
  // wie grund mit Klemmleiste, dazu Schaltgeräte: Stromstoß (Licht Büro), Schütz CEE mit N, Schütz Herd, Zeitrelais Lager 1
  schalt: () => { BEISPIELE.grund(); const [hv] = P.verteiler; hv.klemmen = 'leiste';
    const ab = bez => { let r; alleKnoten(hv, k => { if (!r && k.typ === 'abgang' && (k.ziel.bez + ' ' + k.ziel.ort) === bez) r = k; }); return r; };
    ab('Licht Büro').schalt = neuesSchalt('stromstoss');
    const cee = ab('CEE 32 A Werkstatt'); cee.schalt = neuesSchalt('schuetz'); cee.schalt.nMit = true;
    ab('Herd Küche').schalt = neuesSchalt('schuetz');
    ab('Steckdosen Lager 1').schalt = neuesSchalt('zeitrelais'); sichern(); zeichne(); },
  // wie schalt, dazu Steuerstromkreise (Etappe C): Stromstoß mit drei Tastern (Licht Büro),
  // Selbsthaltung mit Not-Aus/Aus/Ein und Betriebsmeldung (CEE), Zeitrelais mit Taster (Lager 1)
  steuerung: () => { BEISPIELE.schalt(); const [hv] = P.verteiler;
    const ab = bez => { let r; alleKnoten(hv, k => { if (!r && k.typ === 'abgang' && (k.ziel.bez + ' ' + k.ziel.ort) === bez) r = k; }); return r; };
    const licht = ab('Licht Büro'), cee = ab('CEE 32 A Werkstatt'), lager = ab('Steckdosen Lager 1');
    cee.schalt.hs = 2;
    const ger = (zeichen, bez, ort) => { const g = { id: id(), zeichen, bez, ort }; hv.steuerung.geraete.push(g); return g.id; };
    const leer = () => [null, null, null, null, null, null];
    const pfad = (plaetze, verbraucher, zweig = null) => { const pl = leer(); plaetze.forEach((x, i) => pl[i] = x); return { id: id(), zweig, plaetze: pl, verbraucher }; };
    hv.steuerung = { geraete: [], kreise: [] };
    const t1 = ger('taster_s', 'Tür', 'Büro'), t2 = ger('taster_s', 'Fenster', 'Büro'), t3 = ger('taster_s', 'Flur', 'Flur');
    hv.steuerung.kreise.push({ id: id(), quelle: { art: 'abgang', kid: licht.id }, pfade: [
      pfad([{ g: t1 }], { g: licht.id }), pfad([{ g: t2 }], null, { von: 0, bis: 0 }), pfad([{ g: t3 }], null, { von: 0, bis: 0 })] });
    const na = ger('notaus', 'Not-Aus', 'Werkstatt'), aus = ger('taster_oe', 'Aus', 'Werkstatt'), ein = ger('taster_s', 'Ein', 'Werkstatt');
    const hl = ger('meldeleuchte', 'Betrieb', 'Tür HV');
    hv.steuerung.kreise.push({ id: id(), quelle: { art: 'abgang', kid: cee.id }, pfade: [
      pfad([{ g: na }, { g: aus }, { g: ein }], { g: cee.id }), pfad([null, null, { g: cee.id, z: 'hilfs_s' }], null, { von: 2, bis: 2 }),
      pfad([{ g: cee.id, z: 'hilfs_s' }], { g: hl })] });
    const tl = ger('taster_s', 'Licht', 'Lager 1');
    hv.steuerung.kreise.push({ id: id(), quelle: { art: 'abgang', kid: lager.id }, pfade: [pfad([{ g: tl }], { g: lager.id })] });
    sichern(); zeichne(); },
  // wie steuerung, gemeinsame Steuerspannung durchgeschliffen vom Steuer-LS; das Zeitrelais
  // behält seinen eigenen Abgriff
  gemeinsam: () => { BEISPIELE.steuerung(); const [hv] = P.verteiler;
    const sls = neuerSteuerLs(); hv.knoten.push(sls);
    hv.steuerung.spannung = { art: 'durch', quelle: sls.id };
    hv.steuerung.kreise[2].eigen = true; sichern(); zeichne(); },
  // wie steuerung, gemeinsame Steuerspannung aus dem Abgang Licht Büro über gebrückte Klemmen auf -X1
  bruecke: () => { BEISPIELE.steuerung(); const [hv] = P.verteiler;
    hv.steuerung.spannung = { art: 'bruecke', quelle: hv.steuerung.kreise[0].quelle.kid, leiste: 'X1' }; sichern(); zeichne(); },
  // wie steuerung, Steuer-LS und gebrückte Klemmen auf eigener Leiste -X0
  bruecke0: () => { BEISPIELE.steuerung(); const [hv] = P.verteiler;
    const sls = neuerSteuerLs(); hv.knoten.push(sls);
    hv.steuerung.spannung = { art: 'bruecke', quelle: sls.id, leiste: 'eigen' }; sichern(); zeichne(); },
  // wie schalt, Kreise so angelegt wie über die Eingabe (v1.11): je Schaltgerät ein Kreis mit der
  // Spule; Herd mit Aus/Ein und Selbsthaltung; gemeinsame Steuerspannung vom Steuer-LS, durchgeschliffen
  eingabe: () => { BEISPIELE.schalt(); const [hv] = P.verteiler, e = berechne(hv);
    schaltAbgaenge(hv, e).forEach(k => kreisAnlegen(hv, k));
    const herd = schaltAbgaenge(hv, e).find(k => k.ziel.bez === 'Herd'), kr = kreisVon(hv, herd.id);
    const aus = neuesSteuerGeraet(hv, 'taster_oe'), ein = neuesSteuerGeraet(hv, 'taster_s');
    aus.bez = 'Aus'; aus.ort = 'Küche'; ein.bez = 'Ein'; ein.ort = 'Küche';
    kr.pfade[0].plaetze[0] = { g: aus.id }; kr.pfade[0].plaetze[1] = { g: ein.id };
    const zw = neuerPfad(null, { von: 1, bis: 1 }); zw.plaetze[1] = { g: herd.id, z: 'hilfs_s' }; kr.pfade.push(zw);
    const sls = neuerSteuerLs(); hv.knoten.push(sls); stDaten(hv).spannung = { art: 'durch', quelle: sls.id };
    sichern(); zeichne(); },
  // C3 (v1.13): Treppenlicht mit eigenständigem Zeitrelais -K2 (zwei Taster), dessen verzögerter
  // Kontakt den Schütz von Licht Flur schaltet; Kreis nur mit Meldeleuchte im Feld; Taster über -X1
  zeitrelais: () => { BEISPIELE.schalt(); const [hv] = P.verteiler;
    const flur = (() => { let r; alleKnoten(hv, k => { if (k.typ === 'abgang' && k.ziel.bez === 'Licht' && k.ziel.ort === 'Flur') r = k; }); return r; })();
    flur.schalt = neuesSchalt('schuetz'); flur.schalt.hs = 0;
    const krQ = kreisAnlegen(hv, flur);
    const zr = neuesSteuerGeraet(hv, 'zeitrelais'); zr.bez = 'Treppenlicht'; zr.zeit = '2 min';
    krQ.pfade[0].plaetze[0] = { g: zr.id, z: 'k_s_aus' };
    const kT = kreisOhneSchaltgeraet(hv); kT.quelle = { art: 'abgang', kid: flur.id };
    const t1 = neuesSteuerGeraet(hv, 'taster_s'), t2 = neuesSteuerGeraet(hv, 'taster_s');
    Object.assign(t1, { bez: 'Treppe EG', ort: 'Flur' }); Object.assign(t2, { bez: 'Treppe OG', ort: 'Flur' });
    kT.pfade[0].plaetze[0] = { g: t1.id }; kT.pfade[0].verbraucher = { g: zr.id };
    const zw = neuerPfad(null, { von: 0, bis: 0 }); zw.plaetze[0] = { g: t2.id }; kT.pfade.push(zw);
    const kM = kreisOhneSchaltgeraet(hv); kM.quelle = { art: 'abgang', kid: flur.id };
    const h1 = neuesSteuerGeraet(hv, 'meldeleuchte'); Object.assign(h1, { bez: 'Spannung', ort: 'Flur', feld: true });
    kM.pfade[0].verbraucher = { g: h1.id };
    sichern(); zeichne(); },
  // C4 (v1.14): Kreise aus Vorlagen – Stromstoß mit 3 Tastern (Licht Büro), Selbsthaltung mit Not-Aus und
  // Betriebsmeldung (CEE), Hand-0-Automatik mit Dämmerungsschalter (Herd), Treppenlicht mit 2 Tastern (Lager 1)
  vorlagen: () => { BEISPIELE.schalt(); const [hv] = P.verteiler, e = berechne(hv);
    const kr = bez => { const k = schaltAbgaenge(hv, e).find(k => abgangName(k) === bez); return kreisAnlegen(hv, k); };
    vorlageEinsetzen(hv, kr('Licht Büro'), 'taster', { n: 3 });
    vorlageEinsetzen(hv, kr('CEE 32 A Werkstatt'), 'selbstnot', { notaus: true, meldung: true });
    vorlageEinsetzen(hv, kr('Herd Küche'), 'hand0auto', { melder: 'daemmerung' });
    vorlageEinsetzen(hv, kr('Steckdosen Lager 1'), 'taster', { n: 2 });
    sichern(); zeichne(); },
  // v1.16: wie vorlagen, gemeinsame Steuerspannung durchgeschliffen vom Steuertrafo 230/24 V, 0 V geerdet
  trafo: () => { BEISPIELE.vorlagen(); const [hv] = P.verteiler;
    const t = neuerSteuerTrafo(); hv.knoten.push(t); stDaten(hv).spannung = { art: 'durch', quelle: t.id }; sichern(); zeichne(); },
  // v1.16: wie steuerung, Steuertrafo 400/230 V ungeerdet, gebrückte Klemmen auf -X1
  trafo400: () => { BEISPIELE.steuerung(); const [hv] = P.verteiler;
    const t = neuerSteuerTrafo(); Object.assign(t.trafo, { prim: '400', sek: '230', va: '250', erde: false }); t.trafo.ls.nenn = '4'; hv.knoten.push(t);
    hv.steuerung.spannung = { art: 'bruecke', quelle: t.id, leiste: 'X1' }; sichern(); zeichne(); },
  // ab v1.25: Vorgaben von Hand – Herd in Spalte 7 (Lücke davor), neues Blatt ab Lager 1; ab v1.26 dazu verschobene Geräte
  layout: () => { BEISPIELE.grund(); const [hv] = P.verteiler, L = lay(hv);
    L.spalten[hv.knoten[2].id] = 7; L.umbruch[hv.knoten[4].id] = true;
    const g = hv.knoten[0]; L.lage['k:' + g.id + '/f'] = [-2, 0]; L.lage['k:' + g.kinder[0].id + '/xd'] = [2, -4]; L.lage['k:' + hv.knoten[1].id + '/f'] = [0, 3];
    // ab v1.27: PE-Zuführung der FI-Gruppe 7,5 mm weiter links (Abzweig auf der PE-Schiene wandert mit)
    const sz = PLAN.blaetter(P, BIB, { berechne, speisenderAbgang }).blaetter.find(b => b.szene && b.szene.teile['k:' + g.id + '/f']).szene;
    const pe = sz.leiter.filter(l => l.key && l.key.startsWith('k:' + g.id + '#') && l.art === 'PE' && Math.abs(l.x1 - l.x2) < .01).sort((a, b) => Math.min(a.y1, a.y2) - Math.min(b.y1, b.y2))[0];
    L.wege[pe.key] = { n: -3, senk: true };
    sichern(); zeichne(); },
  // ab v1.28: Zusätze von Hand in der UV – PE-Brücke zwischen zwei PE-Punkten, Text, strichpunktierter Rahmen
  zusatz: () => { BEISPIELE.grund(); const [, uv] = P.verteiler, L = lay(uv);
    const anker = 'k:' + uv.knoten[0].id;
    L.zusatz = [
      { id: 'z1', art: 'rahmen', blatt: anker, a: [212.5, 75], b: [272.5, 140], t: 'Reserve Wallbox' },
      { id: 'z2', art: 'text', blatt: anker, a: [215, 150], t: 'Platz für Lastmanagement', g: 2.5 },
      { id: 'z3', art: 'leiter', blatt: anker, a: [245, 65.5], b: [245, 110], leiter: 'PE', knick: 'vh' } ];
    sichern(); zeichne(); },
  // ab v1.31: Kontakt und Spule im Steuerstromkreis frei verschoben (Abzweig des Parallelzweigs bleibt angeschlossen)
  // Etappe G1: HV mit PV-Anlage 3/N/PE (9,8 kWp, Erzeugungszähler, DC-Freischalter, über -X1),
  // UV mit PV-Anlage einphasig ohne DC-Freischalter
  pv: () => { BEISPIELE.grund(); const [hv, uv] = P.verteiler; hv.klemmen = 'leiste';
    const a = neuerAbgang(); a.ziel = { bez: 'PV-Anlage', ort: 'Dach', anschluss: 'pv' }; a.geraet = { zeichen: 'ls3', kennlinie: 'B', nenn: '20' }; a.leitung.quer = '4';
    a.pv = { phasen: '3', kwp: '9,8', dc: true, zaehler: true }; hv.knoten.splice(2, 0, a);
    const b = neuerAbgang(); b.ziel = { bez: 'PV Carport', ort: 'Carport', anschluss: 'pv' }; b.geraet = { zeichen: 'ls1', kennlinie: 'B', nenn: '16' };
    b.pv = { phasen: '1', kwp: '3', dc: false, zaehler: false }; uv.knoten.push(b); sichern(); zeichne(); },
  // Etappe G2: wie pv, PV-Anlage der HV mit Speicher am Hybrid-Wechselrichter (10 kWh), dazu in der UV
  // ein Batteriespeicher AC-gekoppelt (einphasig, 5 kWh)
  speicher: () => { BEISPIELE.pv(); const [hv, uv] = P.verteiler;
    hv.knoten.find(k => k.ziel && k.ziel.anschluss === 'pv').pv.speicher = { kwh: '10' };
    const s = neuerAbgang(); s.ziel = { bez: 'Speicher', ort: 'Keller', anschluss: 'speicher' }; s.geraet = { zeichen: 'ls1', kennlinie: 'B', nenn: '16' }; s.leitung.quer = '4';
    s.speicher = { phasen: '1', kwh: '5' }; uv.knoten.push(s); sichern(); zeichne(); },
  // Etappe G3: HV mit Wallbox 11 kW (FI/LS Typ A, DC-Fehlerstromerkennung in der Wallbox) über -X1,
  // UV mit Wallbox 22 kW ohne DC-Fehlerstromerkennung (FI/LS Typ B)
  wallbox: () => { BEISPIELE.grund(); const [hv, uv] = P.verteiler; hv.klemmen = 'leiste';
    const a = neuerAbgang(); a.ziel = { bez: 'Wallbox', ort: 'Garage', anschluss: 'wallbox' }; a.wallbox = { kw: '11', rdc: true };
    a.geraet = { zeichen: 'fils3n', kennlinie: 'B', nenn: '16', idn: '30', fityp: 'A' }; a.leitung.quer = '6'; hv.knoten.splice(2, 0, a);
    const b = neuerAbgang(); b.ziel = { bez: 'Wallbox', ort: 'Hof', anschluss: 'wallbox' }; b.wallbox = { kw: '22', rdc: false };
    b.geraet = { zeichen: 'fils3n', kennlinie: 'B', nenn: '32', idn: '30', fityp: 'B' }; b.leitung.quer = '10'; uv.knoten.push(b); sichern(); zeichne(); },
  // Etappe M1: HV mit Drehstrommotor 4 kW am Motorschutzschalter (über -X1), UV mit Wechselstrommotor 0,75 kW am LS
  motor: () => { BEISPIELE.grund(); const [hv, uv] = P.verteiler; hv.klemmen = 'leiste';
    const a = neuerAbgang(); a.ziel = { bez: 'Lüfter', ort: 'Halle', anschluss: 'motor' }; a.motor = { art: '3', kw: '4', strom: '8,2' };
    a.geraet = { zeichen: 'motorschutz3', bereich: '6,3–10' }; a.leitung.quer = '2,5'; hv.knoten.splice(2, 0, a);
    const b = neuerAbgang(); b.ziel = { bez: 'Pumpe', ort: 'Keller', anschluss: 'motor' }; b.motor = { art: '1', kw: '0,75' };
    b.geraet = { zeichen: 'ls1', kennlinie: 'C', nenn: '10' }; b.leitung.quer = '1,5'; uv.knoten.push(b); sichern(); zeichne(); },
  // Etappe M2: wie motor; Lüfter mit Schütz, Hilfsschalter des Motorschutzschalters in Reihe (Selbsthaltung mit Betrieb),
  // dazu Förderband mit LS, Schütz und Überlastrelais (Vorlage Motor Ein/Aus mit Störung); Steuerspannung über Steuer-LS
  motorsteuerung: () => { BEISPIELE.motor(); const [hv] = P.verteiler;
    const sls = neuerSteuerLs(); hv.knoten.push(sls); stDaten(hv).spannung = { art: 'durch', quelle: sls.id };
    const l = hv.knoten.find(k => k.ziel && k.ziel.bez === 'Lüfter'); l.geraet.hks = 1; l.schalt = neuesSchalt('schuetz');
    let kr = kreisAnlegen(hv, l); vorlageEinsetzen(hv, kr, 'selbst', { meldung: true }); kr.pfade[0].plaetze[5] = { g: l.id, z: 'mss_s' };
    const f = neuerAbgang(); f.ziel = { bez: 'Förderband', ort: 'Halle', anschluss: 'motor' }; f.motor = { art: '3', kw: '1,5', strom: '3,6' };
    f.geraet = { zeichen: 'ls3', kennlinie: 'C', nenn: '10' }; f.leitung.quer = '1,5'; f.schalt = neuesSchalt('schuetz'); f.schalt.ol = { bereich: '2,5–4' };
    hv.knoten.splice(3, 0, f);
    kr = kreisAnlegen(hv, f); vorlageEinsetzen(hv, kr, 'motor', { meldung: true, stoerung: true }); sichern(); zeichne(); },
  // Etappe M3: wie motor, Lüfter über Frequenzumrichter mit geschirmter Motorleitung 2YSLCY-J
  umrichter: () => { BEISPIELE.motor(); const [hv] = P.verteiler;
    const l = hv.knoten.find(k => k.ziel && k.ziel.bez === 'Lüfter'); l.motor.fu = {}; l.geraet = { zeichen: 'ls3', kennlinie: 'C', nenn: '16' };
    l.leitung.typ = '2YSLCY-J'; sichern(); zeichne(); },
  // Etappe M4: wie motorsteuerung; Förderband als Wendeschaltung, dazu Kompressor 11 kW Stern-Dreieck (je mit Überlastrelais)
  schaltungen: () => { BEISPIELE.motorsteuerung(); const [hv] = P.verteiler;
    const f = hv.knoten.find(k => k.ziel && k.ziel.bez === 'Förderband'); schaltungSetzen(hv, f, 'wende');
    const c = neuerAbgang(); c.ziel = { bez: 'Kompressor', ort: 'Halle', anschluss: 'motor' }; c.motor = { art: '3', kw: '11', strom: '21' };
    c.geraet = { zeichen: 'ls3', kennlinie: 'C', nenn: '32' }; c.leitung.quer = '4'; hv.knoten.splice(4, 0, c);
    schaltungSetzen(hv, c, 'sd'); c.schalt.ol = { bereich: '9–14' }; sichern(); zeichne(); },
  // Etappe M5: wie motor; Pumpe Keller (Wechselstrom) mit Schütz und Überlastrelais, Vorlage Pumpe mit Trockenlaufschutz;
  // dazu im Kreis ein Schwimmer-Wechsler (Öffnerseite) für die Meldeleuchte „Niveau hoch“
  pumpe: () => { BEISPIELE.motor(); const [, uv] = P.verteiler;
    const pu = uv.knoten.find(k => k.ziel && k.ziel.bez === 'Pumpe'); pu.schalt = neuesSchalt('schuetz'); pu.schalt.ol = { bereich: '4–6,3' };
    const kr = kreisAnlegen(uv, pu); vorlageEinsetzen(uv, kr, 'pumpe', { trocken: true });
    const w = neuesSteuerGeraet(uv, 'w_schwimmer'); w.bez = 'Niveau hoch'; const h = neuesSteuerGeraet(uv, 'meldeleuchte'); h.bez = 'Niveau hoch';
    const pm = neuerPfad({ g: h.id }); pm.plaetze[0] = { g: w.id, z: 's_schwimmer' }; kr.pfade.push(pm); sichern(); zeichne(); },
  steuerfrei: () => { BEISPIELE.steuerung(); const [hv] = P.verteiler, kr = hv.steuerung.kreise.find(k => k.pfade.length > 1), L = lay(hv);
    L.lage['kr:' + kr.id + '/pl:' + kr.pfade[0].id + ':0'] = [2, 0]; L.lage['kr:' + kr.id + '/pl:' + kr.pfade[0].id + ':6'] = [2, 0];
    sichern(); zeichne(); },
};
