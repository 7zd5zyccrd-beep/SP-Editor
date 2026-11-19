// Zufallsbedienung im Kontext der App (API-Ebene, so wie die Bedienelemente es tun) – ab v1.86 (X26) aus der Prüfung Etappe Q
// übernommen; benutzt von tests/zufall.py. FZ.schritt() führt einen zufälligen Bedienschritt aus, FZI prüft die Invarianten.
window.FZ = (() => {
  let s = 1;
  const r = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const w = a => a[Math.floor(r() * a.length)];
  const ed = () => ED && ED.b, vv = () => ED && ED.v;
  const abg = v => { const l = []; alleKnoten(v, k => l.push(k)); return l; };
  const neuZ = () => { aenderung('FZ'); sichern(); zeichne(); };
  const TOOLS = ['steckdose', 'cee', 'leuchte', 'dose', 'uv', 'gruppe', 'wallbox', 'motor', 'pv', 'speicher', 'steuerls', 'trafo'];
  const ANS = ['steckdose3', 'steckdose5', 'dose', 'leuchte', 'fest', 'pv', 'speicher', 'wallbox', 'motor'];
  const GER = ['ls1', 'ls3', 'fils1n', 'fils3n', 'sich1', 'sich3', 'motorschutz3', 'leistung3'];
  const A = {
    einfuegen() { const v = vv(), b = ed(), ks = abg(v), t = w(TOOLS);
      const m = ks.length ? w(['nach:', 'vor:', 'in:']) + w(ks).id : 'leer:' + v.id;
      let mk = m; if (mk.startsWith('in:') && knoten(v, mk.slice(3)).k.typ !== 'gruppe') mk = 'nach:' + mk.slice(3);
      if (mk.startsWith('in:') && knoten(v, mk.slice(3)).k.kinder.length) mk = 'nach:' + mk.slice(3);
      const n = r() < 0.2 ? 1 + Math.floor(r() * 4) : 1;
      editorEinfuegen(v, b, mk, t, n, t === 'uv' ? 'UVfz' + Math.floor(r() * 1000) : null); return `einfuegen ${t}×${n} @${mk}`; },
    loeschen() { const v = vv(), ks = abg(v); if (!ks.length) return null; const k = w(ks); ed().sel = 'k:' + k.id; editorAktion(v, ed(), 'loeschen'); return 'loeschen ' + k.id; },
    schieben() { const v = vv(), ks = abg(v); if (!ks.length) return null; const k = w(ks); ed().sel = 'k:' + k.id; const x = w(['links', 'rechts']); editorAktion(v, ed(), x); return x + ' ' + k.id; },
    kopierenEinfuegen() { const v = vv(), ks = abg(v); if (!ks.length) return null; const k = w(ks), z = w(ks); ed().sel = 'k:' + k.id; const x = w(['kopieren', 'ausschneiden', 'duplizieren']);
      editorAktion(v, ed(), x); if (x !== 'duplizieren' && editorAblage) { const ks2 = abg(v); ed().sel = ks2.length ? 'k:' + w(ks2).id : null; editorAktion(v, ed(), 'einfuegen'); } return x + '+einfuegen ' + k.id; },
    anschluss() { const v = vv(), ks = abg(v).filter(k => k.typ === 'abgang' && !k.speist && !k.steuer); if (!ks.length) return null; const k = w(ks), a = w(ANS); anschlussSetzen(v, k, a); neuZ(); return `anschluss ${k.id}=${a}`; },
    schutz() { const v = vv(), ks = abg(v).filter(k => k.geraet && !k.steuer); if (!ks.length) return null; const k = w(ks);
      if (k.typ === 'gruppe') { const g = w(WAHL.gruppe), ge = k.geraet; ge.zeichen = g; if (GERAETE[g].kennlinie && !ge.kennlinie) ge.kennlinie = 'C'; if (GERAETE[g].sicherung && !ge.art) ge.art = 'gG'; neuZ(); return `schutzGruppe ${k.id}=${g}`; }
      const g = w(WAHL.abgang); abgangGeraetSetzen(k.geraet, g); neuZ(); return `schutz ${k.id}=${g}`; },
    schalt() { const v = vv(), ks = abg(v).filter(k => k.typ === 'abgang' && !k.steuer); if (!ks.length) return null; const k = w(ks), x = w(['', 'schuetz', 'stromstoss', 'zeitrelais']);
      if (!x) { if (k.schalt) k.schalt.typ = ''; } else if (!k.schalt || !k.schalt.typ) k.schalt = neuesSchalt(x); else k.schalt.typ = x; if (x) kreisAnlegen(v, k); neuZ(); return `schalt ${k.id}=${x}`; },
    motorSchaltung() { const v = vv(), ks = abg(v).filter(k => k.motor); if (!ks.length) return null; const k = w(ks), x = w(['direkt', 'wende', 'sd']);
      if (x !== 'direkt' && k.motor.art === '1') return null; schaltungSetzen(v, k, x); neuZ(); return `motorschaltung ${k.id}=${x}`; },
    ol() { const v = vv(), ks = abg(v).filter(k => k.motor && k.schalt && k.schalt.typ); if (!ks.length) return null; const k = w(ks); if (k.schalt.ol) olEntfernen(v, k); else olEinsetzen(v, k); neuZ(); return 'ol ' + k.id; },
    vorlage() { const v = vv(), st = v.steuerung; if (!st || !st.kreise.length) return null; const kr = w(st.kreise); const vb = (kr.pfade.find(p => p.verbraucher) || {}).verbraucher; if (!vb) return null;
      const e = berechne(v), sa = e.abgaenge[vb.g], kn = knoten(v, String(vb.g).split('~')[0]);
      const motor = !!kn && kn.k.ziel && kn.k.ziel.anschluss === 'motor';
      const ok = ['taster', 'hand0auto', 'pumpe'].concat(sa && sa.schalt ? ['selbst', 'selbstnot'] : [], motor && sa && sa.schalt ? ['motor'] : [], kn && !motor && kn.k.typ === 'abgang' && !kn.k.steuer && !String(vb.g).includes('~') ? ['treppenlicht'] : []);
      const art = w(ok), o = { n: 1 + Math.floor(r() * 5), zeit: '3 min', melder: w(['daemmerung', 'bewegung', 'praesenz', 'endschalter_s']), trocken: r() < .5, meldung: r() < .5, stoerung: r() < .5, notaus: art === 'selbstnot' };
      vorlageEinsetzen(v, kr, art, o); aenderung('Vorlage'); sichern(); zeichne(); return `vorlage ${kr.id}=${art}`; },
    platz() { const v = vv(), st = v.steuerung; if (!st || !st.kreise.length) return null; const kr = w(st.kreise); if (!kr.pfade.length) return null; const p = w(kr.pfade), i = Math.floor(r() * 7);
      const b = ed(); b.sel = `pl:${p.id}:${i}`; const x = w(['loeschen', 'hoch', 'runter', 'zweig', 'anfang', 'ende', 'pfad', 'spalteLoeschen', 'kopieren', 'einfuegen']);
      platzAktion(v, berechne(v), kr, platzSel(b, kr), x); return `platz ${x} ${p.id}:${i}`; },
    platzSetzen() { const v = vv(), st = stDaten(v); if (!st.kreise.length) return null; const kr = w(st.kreise); if (!kr.pfade.length) return null; const p = w(kr.pfade), i = Math.floor(r() * 6);
      const zs = Object.keys(ST_ZEICHEN).filter(z => ST_ZEICHEN[z][1] === 'bg' && !/^w_/.test(z)); const z = w(zs); const g = neuesSteuerGeraet(v, z); platzSetzen(p, i, z, g.id); neuZ(); return `platzSetzen ${z}`; },
    kreisNeu() { const v = vv(); const kr = kreisOhneSchaltgeraet(v); const g = neuesSteuerGeraet(v, w(['meldeleuchte', 'zeitrelais'].filter(z => ST_ZEICHEN[z] || z === 'zeitrelais'))); kr.pfade[0].verbraucher = { g: g.id }; neuZ(); return 'kreisNeu'; },
    gruppeAuf() { const v = vv(), gs = abg(v).filter(k => k.typ === 'gruppe'); if (!gs.length) return null; gruppeAufloesen(v, knoten(v, w(gs).id)); return 'gruppeAuf'; },
    layout() { const v = vv(), b = ed(), ks = v.knoten; if (!ks.length) return null; const k = w(ks); b.sel = 'k:' + k.id; const x = w(['spalteR', 'spalteL', 'umbruch', 'automatik']); editorAktion(v, b, x); return x + ' ' + k.id; },
    teil() { const keys = []; (ED.liste || []).forEach(bl => bl.szene && Object.values(bl.szene.teile).forEach(t => t.box && keys.push(t.key))); if (!keys.length) return null;
      const key = w(keys); teilSchieben(vv(), key, Math.round((r() - .5) * 8), Math.round((r() - .5) * 8)); return 'teil ' + key; },
    mehr() { const v = vv(), b = ed(), ks = abg(v).filter(sammelFaehig); if (ks.length < 2) return null; const sel = ks.filter(() => r() < .4).map(k => 'k:' + k.id); if (sel.length < 2) return null;
      b.sel = 'm:'; b.mehr = sel; b.sammel = true; const x = w(['loeschen', 'duplizieren', 'kopieren', 'ausschneiden']); editorAktion(v, b, x);
      if ((x === 'kopieren' || x === 'ausschneiden') && editorAblage) { const k2 = abg(v); b.sel = k2.length ? 'k:' + w(k2).id : null; b.mehr = null; b.sammel = false; editorAktion(v, b, 'einfuegen'); } return 'mehr ' + x + ' ' + sel.length; },
    verteilerNeu() { if (P.verteiler.length > 6) return null; const v = neuerVerteiler('Vfz' + Math.floor(r() * 1000)); if (r() < .3) v.leiter = '1NPE'; P.verteiler.push(v); aenderung('V'); sichern(); return 'verteilerNeu'; },
    verteilerLoeschen() { if (P.verteiler.length < 2) return null; const v = w(P.verteiler.filter(x => x !== vv())); P.verteiler = P.verteiler.filter(x => x !== v);
      for (const x of P.verteiler) alleKnoten(x, k => { if (k.speist === v.id) k.speist = null; }); aenderung('VL'); sichern(); zeichne(); return 'verteilerLoeschen'; },
    speisen() { const v = vv(), ks = abg(v).filter(k => k.typ === 'abgang' && !k.steuer); const fr = P.verteiler.filter(x => x !== v && !speisenderAbgang(x.id) && !gespeistAus(x.id, v.id)); /* wie die Auswahl im Fach (ab v1.86) */ if (!ks.length || !fr.length) return null;
      const k = w(ks), z = w(fr); k.speist = z.id; k.ziel.anschluss = 'fest'; neuZ(); return `speisen ${k.id}->${z.name}`; },
    verteilerWechsel() { const v = w(P.verteiler); stapel = [{ s: 'start' }, { s: 'editor', vid: v.id }]; zeichne(); return 'wechsel ' + v.name; },
    verteilerEig() { const v = vv(), x = w(['leiter', 'netz', 'klemmen', 'steuerart', 'kopf']);
      if (x === 'leiter') v.leiter = v.leiter === '1NPE' ? '3NPE' : '1NPE';
      if (x === 'netz') v.netzform = w(['TN-S', 'TN-C', 'TN-C-S']);
      if (x === 'klemmen') v.klemmen = w(['ohne', 'leiste']);
      if (x === 'kopf') { v.vorsicherung = r() < .5 ? { zeichen: 'sichlasttrenn3', art: 'gG', nenn: '63' } : { zeichen: '' }; v.zaehler = r() < .5 ? { zeichen: 'zaehler3' } : { zeichen: '' }; v.hauptschalter = r() < .5 ? { zeichen: 'lasttrenn3', nenn: '63' } : { zeichen: '' }; }
      if (x === 'steuerart') { const st = stDaten(v), sp = st.spannung = st.spannung || {}; sp.art = w(['abgang', 'durch', 'bruecke']);
        const q = []; alleKnoten(v, k => { if (k.typ === 'abgang' && !k.speist) q.push(k.id); }); sp.quelle = q.length && r() < .7 ? w(q) : (r() < .5 ? null : sp.quelle); if (r() < .3) sp.leiste = w(['X1', 'eigen']); }
      neuZ(); return 'verteilerEig ' + x; },
    // ab v1.86 (X14, X15, X32): optionale Angaben setzen bzw. entfernen
    angaben() { const v = vv(), x = w(['spd', 'zaehler', 'spule']);
      if (x === 'spd') { if (!v.spd.zeichen) return null; if (r() < .3) delete v.spd.typ; else v.spd.typ = w(SPD_TYPEN); }
      if (x === 'zaehler') { if (!v.zaehler.zeichen) return null; if (r() < .3) delete v.zaehler.art; else v.zaehler.art = w(ZAEHLER_ARTEN)[0]; }
      if (x === 'spule') { const ks = abg(v).filter(k => k.schalt && k.schalt.typ); if (!ks.length) return null; const k = w(ks); if (r() < .3) delete k.schalt.spule; else k.schalt.spule = w(SPULEN); }
      neuZ(); return 'angaben ' + x; },
    rueck() { if (r() < .5) projektRueck(false); else projektRueck(true); return 'rueck/vor'; },
  };
  const GEW = { einfuegen: 8, loeschen: 4, schieben: 3, kopierenEinfuegen: 3, anschluss: 4, schutz: 3, schalt: 4, motorSchaltung: 2, ol: 1, vorlage: 3, platz: 4, platzSetzen: 2, kreisNeu: 1,
    gruppeAuf: 1, layout: 2, teil: 2, mehr: 2, verteilerNeu: 1, verteilerLoeschen: 1, speisen: 1, verteilerWechsel: 1, verteilerEig: 2, angaben: 1, rueck: 0 };
  const namen = Object.keys(GEW).flatMap(n => Array(GEW[n]).fill(n));
  return {
    seed(x) { s = x; },
    schritt(mitRueck) { for (let t = 0; t < 20; t++) { const n = mitRueck && r() < .08 ? 'rueck' : w(namen); const d = A[n](); if (d) return d; } return 'nichts'; },
    tu(n) { return A[n](); },
  };
})();
// Invarianten
window.FZI = {
  pruef() {
    const aus = [];
    let res; try { res = PLAN.blaetter(P, BIB, { berechne, speisenderAbgang }); } catch (e) { return ['PLAN.blaetter wirft: ' + e.message]; }
    res.blaetter.forEach(bl => (bl.pruef || []).forEach(x => aus.push(`pruef Blatt ${bl.nr}: ${x.t}`)));
    try { const k = JSON.parse(JSON.stringify(P)); const rep = pruefeProjekt(k); if (rep.length) aus.push('pruefeProjekt repariert eigenen Stand: ' + rep.slice(0, 3).join(' | '));
      migriere(k); if (JSON.stringify(k) !== JSON.stringify(P)) aus.push('Export→Import nicht identisch'); } catch (e) { aus.push('pruefeProjekt wirft: ' + e.message); }
    const fb = document.getElementById('fehlerband'); if (fb && fb.style.display === 'block') aus.push('Fehlerband: ' + fb.textContent);
    return aus;
  },
  // nichts außerhalb des Rahmens (wie tests/pruefen.py), auf frisch erzeugten Blättern
  rahmen() {
    const res = PLAN.blaetter(P, BIB, { berechne, speisenderAbgang }), host = document.createElement('div'); host.style.cssText = 'position:absolute;left:0;top:0;width:1188px;'; document.body.append(host);
    const aus = [];
    res.blaetter.forEach(bl => { const svg = bl.svg; svg.style.width = '1188px'; svg.style.height = 'auto'; host.append(svg); });
    res.begrenzen();
    res.blaetter.forEach(bl => { const svg = bl.svg;
      const W = svg.viewBox.baseVal.width, H = svg.viewBox.baseVal.height, R = svg.getBoundingClientRect(), kx = W / R.width, g = svg.querySelector(':scope > g'); if (!g) return;
      [...g.children].slice(W > 300 ? 89 : 61).forEach(e => { if (e.tagName === 'rect') return; const r = e.getBoundingClientRect(); if (!r.width && !r.height) return;
        const x0 = (r.left - R.left) * kx, x1 = (r.right - R.left) * kx, y0 = (r.top - R.top) * kx, y1 = (r.bottom - R.top) * kx;
        if (x0 < 20 - 0.3 || x1 > W - 10 + 0.3 || y0 < 10 - 0.3 || y1 > H - 10 + 0.3) aus.push(`Blatt ${bl.nr} ${bl.titel}: ${e.tagName} „${(e.textContent || '').slice(0, 25)}“ ${[x0, y0, x1, y1].map(v => v.toFixed(1)).join('/')}`); }); });
    host.remove(); return [...new Set(aus)].slice(0, 8);
  },
};
