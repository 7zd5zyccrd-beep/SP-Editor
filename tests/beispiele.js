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
};
