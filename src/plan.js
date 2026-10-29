/* Generator: zeichnet aus dem Datenmodell die Blätter des Stromlaufplans.
   Maße in mm auf dem Blatt; Zeichen der Bibliothek im Maßstab 1 Einheit = 0,25 mm.
   Regeln (Etappe 4):
     - je Verteiler ein Einspeisungsblatt; ist die Einspeisung sehr kurz
       (höchstens Vorsicherung ODER Hauptschalter, kein Zähler), steht sie
       oben links auf dem ersten Abgangsblatt, sofern dann alles Platz hat
     - Abgangsblätter: Sammelschienen oben, links kommender, rechts gehender
       Querverweis; Spalte 1 und die letzte Spalte bleiben dafür frei
     - jeder Abgang belegt ganze Spalten; Gruppen mit Untersammelschiene
       werden nicht geteilt
     - nichts läuft ins Schriftfeld (Streifen über die ganze Breite); sonst beginnt ein neues Blatt
     - Blattnummern durchgehend über das Projekt
     - davor (abschaltbar) Deckblatt und Inhaltsverzeichnis, ab v1.2
     - am Ende (abschaltbar) der Klemmenplan der Klemmleiste -X1 je Verteiler, ab v1.5
     - danach (abschaltbar) der Übersichtsschaltplan, einpolig, ab v1.3:
       je Verteiler ein Abschnitt, Abgänge im halben Spaltenraster, Leiterzahl
       als Schrägstrich mit Zahl, Beschriftung unten senkrecht
     - hinter dem Stromlaufplan je Verteiler (falls vorhanden) die Steuerstromkreise,
       ab v1.9: ein Kreis je Schaltgerät, ein Pfad je Spalte, Kontaktspiegel unter der Spule;
       ab v1.10 wahlweise mit gemeinsamer L-/N-Leitung (durchgeschliffen oder gebrückte Klemmen)
     - Leiterfarben: N blau, PE grün; Schrift immer schwarz */
const PLAN = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const E = 0.25;
  const FORMATE = { A4: { w: 297, h: 210, sp: 10, ze: 6 }, A3: { w: 420, h: 297, sp: 15, ze: 8 } };
  const RAND_L = 20, RAND = 10, SF_H = 20, SF_FIRMA = 70;   // Schriftfeld: Höhe, Breite des Firmenfelds
  const FARBE = { N: '#1f5fd6', PE: '#1a8a3a', PEN: '#1a8a3a' };
  const POLE = { ls1: 1, ls3: 3, fils1n: 2, fils3n: 4, sich1: 1, sich3: 3, fi2: 2, fi4: 4, sichtrenn3: 3,
    sichlasttrenn3: 3, lasttrenn3: 3, trenn3: 3, leistung3: 3, zaehler3: 4, zaehler1: 2, spd4: 4, spd2: 2 };
  const LINKS = 14;        // Platz links vom ersten Leiter eines Pfades (Kennzeichen)
  const ABSTAND = 5;       // Leiterabstand = Polabstand
  const VOR_GERAET = 10;
  // Abschluss der Abgänge: Steckdose (und Leuchte) reichen 7,5 mm unter ihren
  // Anschluss; Endklemme und offenes Ende enden genau auf dieser Unterkante
  const UNTERKANTE = 7.5, END_TIEFE = 3.125;   // END_TIEFE: Anschluss bis Unterkante der Endklemme   // von der untersten Schiene bis zum oberen Geräteanschluss
  let ZEICHEN = {};

  // ---- Grundelemente ------------------------------------------------------
  function el(tag, a = {}, eltern) {
    const e = document.createElementNS(NS, tag);
    for (const k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]);
    if (eltern) eltern.appendChild(e);
    return e;
  }
  function text(g, x, y, t, groesse, anker = 'start', extra = {}) {
    const e = el('text', Object.assign({ x, y, 'font-size': groesse, 'text-anchor': anker,
      'font-family': 'Arial, Helvetica, Liberation Sans, sans-serif', fill: '#000' }, extra), g);
    e.textContent = t; return e;
  }
  function linie(g, x1, y1, x2, y2, w = 0.35, farbe = '#000') {
    return el('line', { x1, y1, x2, y2, stroke: farbe, 'stroke-width': w, 'stroke-linecap': 'square' }, g);
  }
  const farbe = art => FARBE[art] || '#000';
  const leiter = (g, x1, y1, x2, y2, art) => linie(g, x1, y1, x2, y2, 0.25, farbe(art));
  const punkt = (g, x, y, art) => el('circle', { cx: x, cy: y, r: 0.6, fill: farbe(art) }, g);
  // Text auf eine Breite begrenzen (wirkt erst, wenn das Blatt im Dokument hängt)
  const zuBegrenzen = [];
  function passend(t, max) { zuBegrenzen.push([t, max]); }
  function begrenzen() {
    while (zuBegrenzen.length) {
      const [t, max] = zuBegrenzen.pop();
      try { if (t.getComputedTextLength() > max) { t.setAttribute('textLength', max); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); } } catch (e) {}
    }
  }
  function datumDE(iso) { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : (iso || ''); }
  function bmk(g, x, y, kenn, zeilen = []) {   // links neben dem Gerät, rechtsbündig
    if (kenn) text(g, x, y, kenn, 2.5, 'end', { 'font-weight': 'bold' });
    zeilen.filter(Boolean).forEach((z, i) => text(g, x, y + 3.2 + 2.8 * i, z, 2.2, 'end'));
  }

  // ---- Rahmen und Schriftfeld (wie Blattrahmen v0.5) ----------------------
  function rahmen(g, F) {
    const x0 = RAND_L, y0 = RAND, x1 = F.w - RAND, y1 = F.h - RAND;
    el('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, fill: 'none', stroke: '#000', 'stroke-width': 0.7 }, g);
    const sb = (x1 - x0) / F.sp, zh = (y1 - y0) / F.ze;
    for (let i = 0; i < F.sp; i++) {
      const x = x0 + i * sb;
      if (i > 0) { linie(g, x, y0, x, y0 - 5); linie(g, x, y1, x, y1 + 5); }
      text(g, x + sb / 2, y0 - 3.3, String(i + 1), 3.5, 'middle');
      text(g, x + sb / 2, y1 + 6.8, String(i + 1), 3.5, 'middle');
    }
    const buchst = 'ABCDEFGHKLMN';
    for (let j = 0; j < F.ze; j++) {
      const y = y0 + j * zh;
      if (j > 0) { linie(g, x0, y, x0 - 5, y); linie(g, x1, y, x1 + 5, y); }
      text(g, x0 - 3.5, y + zh / 2 + 1.2, buchst[j], 3.5, 'middle');
      text(g, x1 + 5, y + zh / 2 + 1.2, buchst[j], 3.5, 'middle');
    }
    return { sb, x0, y0, x1, y1 };
  }
  // Schriftfeld als Streifen über die ganze Breite (20 mm hoch): links Firma
  // und Anschrift, rechts zwei Zeilen zu je 10 mm. Bewusste Abweichung von
  // DIN EN ISO 7200 (höchstens 180 mm breit) zugunsten voller Zeichenhöhe.
  function schriftfeld(g, F, f) {
    const x0 = RAND_L, x1 = F.w - RAND, y1 = F.h - RAND, y0 = y1 - SF_H, ym = y0 + SF_H / 2;
    el('rect', { x: x0, y: y0, width: x1 - x0, height: SF_H, fill: '#fff', stroke: '#000', 'stroke-width': 0.7 }, g);
    const xa = x0 + SF_FIRMA, wr = x1 - xa;
    linie(g, xa, y0, xa, y1); linie(g, xa, ym, x1, ym);
    const feld = (x, y, w, titel, wert) => {
      text(g, x + 1.2, y + 2.6, titel, 1.8, 'start', { fill: '#444' });
      passend(text(g, x + 1.2, y + SF_H / 2 - 1.7, wert || '', 3.5), w - 2.4);
    };
    const reihe = (y, felder) => {      // felder: [Titel, Wert, Anteil]
      let x = xa;
      felder.forEach(([t, w, anteil], i) => {
        const b = wr * anteil;
        if (i) linie(g, x, y, x, y + SF_H / 2);
        feld(x, y, b, t, w); x += b;
      });
    };
    reihe(y0, [['Projekt', f.projekt, 0.5], ['Dokumenttitel', f.titel, 0.3], ['Verteiler', f.verteiler, 0.2]]);
    reihe(ym, [['Zeichnungsnummer', f.nummer, 0.3], ['Revision', f.rev, 0.1], ['Ausgabedatum', datumDE(f.datum), 0.18],
               ['Erstellt durch', f.ersteller, 0.27], ['Blatt', `${f.blatt} / ${f.blaetter}`, 0.15]]);
    text(g, x0 + 1.2, y0 + 2.6, 'Rechtlicher Eigentümer', 1.8, 'start', { fill: '#444' });
    passend(text(g, x0 + 2.5, y0 + 10, f.firma || '', 4.5, 'start', { 'font-weight': 'bold' }), SF_FIRMA - 5);
    passend(text(g, x0 + 2.5, y0 + 15.5, f.anschrift || '', 2.5), SF_FIRMA - 5);
  }

  // ---- Zeichen setzen und einfärben ---------------------------------------
  function xAusdehnung(e) {
    const n = k => parseFloat(e.getAttribute(k));
    switch (e.tagName) {
      case 'line': return [Math.min(n('x1'), n('x2')), Math.max(n('x1'), n('x2'))];
      case 'polyline': case 'polygon': {
        const xs = e.getAttribute('points').trim().split(/\s+/).map(p => parseFloat(p.split(',')[0]));
        return [Math.min(...xs), Math.max(...xs)];
      }
      case 'circle': return [n('cx') - n('r'), n('cx') + n('r')];
      case 'ellipse': return [n('cx') - n('rx'), n('cx') + n('rx')];
      case 'rect': return [n('x'), n('x') + n('width')];
      case 'path': {
        const xs = [];
        for (const m of e.getAttribute('d').matchAll(/([MA])([^MA]*)/g)) {
          const z = m[2].trim().split(/[\s,]+/).map(parseFloat);
          if (m[1] === 'M') xs.push(z[0]); else for (let i = 0; i + 6 < z.length; i += 7) xs.push(z[i + 5]);
        }
        return xs.length ? [Math.min(...xs), Math.max(...xs)] : null;
      }
    }
    return null;
  }
  function polfarben(gZ, pole, ganz) {
    for (const e of Array.from(gZ.children)) {
      if (e.tagName === 'text') continue;
      let f;
      if (ganz) f = FARBE[ganz];
      else { const a = xAusdehnung(e); if (!a) continue; const p = pole.find(p => a[0] >= p.x - 9 && a[1] <= p.x + 9); f = p && FARBE[p.art]; }
      if (!f) continue;
      if (e.getAttribute('stroke') && e.getAttribute('stroke') !== 'none') e.setAttribute('stroke', f);
      const fill = e.getAttribute('fill'); if (fill && fill !== 'none' && fill !== '#fff') e.setAttribute('fill', f);
    }
  }
  // setzt Zeichen kennung so, dass sein erster oberer Anschluss (oder anker) auf (x, y) liegt
  function setze(g, kennung, x, y, anker = null, arten = null, staerke = 1, nachher = null) {
    const r = QET.zeichne(ZEICHEN[kennung].xml, { labels: false });
    const a = anker ? r.anschluesse.find(anker) : r.anschluesse.filter(t => t.richtung === 'n').sort((p, q) => p.x - q.x)[0];
    const tx = x - a.x * E, ty = y - a.y * E;
    if (staerke !== 1) for (const e of r.g.querySelectorAll('[stroke-width]')) e.setAttribute('stroke-width', parseFloat(e.getAttribute('stroke-width')) * staerke);
    if (typeof arten === 'string') polfarben(r.g, null, arten);
    else if (arten) polfarben(r.g, r.anschluesse.filter(t => t.richtung === 'n').sort((p, q) => p.x - q.x).map((t, i) => ({ x: t.x, art: arten[i] })));
    if (nachher) nachher(r.g);
    el('g', { transform: `translate(${tx} ${ty}) scale(${E})` }, g).appendChild(r.g);
    return r.anschluesse.map(t => ({ x: tx + t.x * E, y: ty + t.y * E, richtung: t.richtung }));
  }
  // Kennzeichen links neben dem Gerät; bei Geräten mit IΔ-Kasten links unter
  // dem Gerät, weil daneben Kasten und Wirkverbindung liegen. Gibt das neue
  // untere Ende zurück.
  function kennzeichen(g, z, x0, yG, yUnten, kenn, zeilen) {
    if (GERAETE[z] && GERAETE[z].fi) {
      bmk(g, x0 - 1.5, yUnten + 3, kenn, zeilen);
      return yUnten + 3 + 2.8 * zeilen.length + 1;
    }
    bmk(g, x0 - 5, yG + 1, kenn, zeilen);
    return yUnten;
  }
  const unten = ans => ans.filter(t => t.richtung === 's').sort((p, q) => p.x - q.x);
  function hoehe(kennung) {   // Abstand oberer bis unterer Anschluss in mm
    const r = QET.zeichne(ZEICHEN[kennung].xml, { labels: false });
    const n = r.anschluesse.filter(t => t.richtung === 'n'), s = r.anschluesse.filter(t => t.richtung === 's');
    return (Math.max(...s.map(t => t.y)) - Math.min(...n.map(t => t.y))) * E;
  }

  // ---- Leiter eines Verteilers --------------------------------------------
  function schienenNamen(v) {
    if (v.leiter === '1NPE') return v.netzform === 'TN-C' ? ['L1', 'PEN'] : ['L1', 'N', 'PE'];
    return v.netzform === 'TN-C' ? ['L1', 'L2', 'L3', 'PEN'] : ['L1', 'L2', 'L3', 'N', 'PE'];
  }
  const anzeige = (name, v) => (v.leiter === '1NPE' && name === 'L1') ? 'L' : name;
  function quelle(art, bars) {      // welche Schiene speist einen Leiter dieser Art?
    if (art === 'L') art = 'L1';
    if (bars[art] !== undefined) return art;
    if ((art === 'N' || art === 'PE') && bars.PEN !== undefined) return 'PEN';
    if (/^L[123]$/.test(art) && bars.L1 !== undefined) return 'L1';
    return art;
  }
  function bemZeilen(g) {
    if (!g || !g.zeichen) return [];
    const d = GERAETE[g.zeichen], z = [];
    if (d.sicherung) z.push(`${g.art || 'gG'} ${g.nenn || '?'} A`);
    else if (d.kennlinie) z.push(`${g.kennlinie || 'B'} ${g.nenn || '?'} A`);
    else if (g.nenn && !d.ohneNenn) z.push(`${g.nenn} A`);
    if (d.fi) z.push(`${g.idn || '30'} mA Typ ${g.fityp || 'A'}`);
    return z;
  }

  // ---- Platzbedarf ----------------------------------------------------------
  function spaltenFuer(nLeiter, R) { return Math.max(1, Math.ceil((LINKS + (nLeiter - 1) * ABSTAND + 2) / R.sb)); }
  function abgangArten(k, a, v) {
    if (a.drei) return ['L1', 'L2', 'L3', 'N', 'PE'];
    const ph = (a.phase.t === 'L' || !a.phase.t) ? 'L1' : a.phase.t;
    if (k.trafo && k.trafo.prim === '400') return ['L1', 'L2'];
    return k.steuer ? [ph, 'N'] : [ph, 'N', 'PE'];
  }
  // greift ein Steuerstromkreis seine Spannung im Abgang ab, braucht der Abgang
  // rechts Platz für die gehenden Querverweise (rund drei Leiterabstände)
  function abgangSpalten(k, a, v, R) { return spaltenFuer(abgangArten(k, a, v).length + (a.abgriff ? 3 : 0), R); }

  // ---- Abgang zeichnen --------------------------------------------------------
  // xSp: linke Kante der ersten Spalte; bars: {art: y}; yG: Höhe des oberen Geräteanschlusses.
  // yEnde: Höhe, auf der Steckdose bzw. Leitungsende sitzen (zum Angleichen aller
  // Abgänge einer Reihe); tap: wird statt eines Verbindungspunkts aufgerufen
  // (für Untersammelschienen, die erst danach ihre Länge kennen).
  // Gibt { unten, natur } zurück: unteres Ende und die eigene, unangeglichene Endhöhe.
  function zeichneAbgang(g, ctx, v, k, a, xSp, bars, yG, breite, yEnde = null, tap = null) {
    if (k.trafo) return zeichneTrafo(g, ctx, v, k, a, xSp, bars, yG, breite, tap);
    const arten = abgangArten(k, a, v);
    const x0 = xSp + LINKS, xs = arten.map((_, i) => x0 + ABSTAND * i);
    const z = k.geraet.zeichen, pole = z ? POLE[z] : 0;
    const enden = arten.map(() => yG);
    // Abgriffe an den Schienen
    arten.forEach((art, i) => { const q = quelle(art, bars); const yq = bars[q]; enden[i] = yq;
      if (tap) tap(art, xs[i], yq); else punkt(g, xs[i], yq, art); });
    let cursor = yG;
    if (pole) {
      arten.slice(0, pole).forEach((art, i) => { leiter(g, xs[i], enden[i], xs[i], yG, art); });
      const t = unten(setze(g, z, x0, yG, null, arten.slice(0, pole)));
      t.forEach((p, i) => { if (i < pole) enden[i] = p.y; });
      cursor = Math.max(...t.map(p => p.y));
      cursor = kennzeichen(g, z, x0, yG, cursor, a.f && a.f.t, bemZeilen(k.geraet));
    }
    const bis = (y) => { arten.forEach((art, i) => { if (enden[i] < y) leiter(g, xs[i], enden[i], xs[i], y, art); enden[i] = y; }); };
    // hinter FI-Geräten steht deren Beschriftung unter dem Gerät: dort etwas Abstand lassen
    let yS = cursor + (z && GERAETE[z] && GERAETE[z].fi ? 3 : 0);
    // Abgriff der Steuerspannung hinter dem Schutzorgan (Etappe C): L (erster Außenleiter)
    // am oberen Anschluss des Schaltgeräts, N 3 mm tiefer (noch in dessen Anschlussstrich),
    // je mit gehendem Querverweis nach rechts zum Steuerstromkreis
    if (a.abgriff) {
      const y1 = Math.max(yS, cursor + 2), iN = arten.indexOf('N'), xr = xs[xs.length - 1] + 4;
      const ziel = ctx.steuer && ctx.steuer.kreise[a.abgriff], ref = ziel ? `/${ziel.blatt}.${ziel.spalte}` : '';
      // Steuer-LS: L und N enden im Abgriff (Ecke, kein Verbindungspunkt)
      if (k.steuer) { leiter(g, xs[0], enden[0], xs[0], y1, arten[0]); leiter(g, xs[iN], enden[iN], xs[iN], y1 + 3, 'N'); }
      [[0, y1], [iN, y1 + 3]].forEach(([i, y]) => {
        if (!k.steuer) punkt(g, xs[i], y, arten[i]);
        leiter(g, xs[i], y, xr, y, arten[i]);
        setze(g, 'qv_gehend', xr, y, t => t.richtung === 'w', arten[i]);
        text(g, xr + 4.5, y + 0.9, ref, 2.2);
      });
      yS = y1;
      if (k.steuer) {
        const ty = y1 + 9;
        passend(text(g, x0 + ABSTAND / 2, ty, k.ziel.bez || 'Steuerspannung', 2.5, 'middle', { 'font-weight': 'bold' }), breite - 2);
        return { unten: ty + 2, natur: y1 + 6 };
      }
      if (!a.schalt) { bis(y1 + 3); cursor = y1 + 3; }
    }
    const spule = ctx.steuer && ctx.steuer.spulen[k.id];
    if (a.schalt) cursor = zeichneSchaltglieder(g, a, arten, xs, enden, yS, bis, spule ? `/${spule.blatt}.${spule.spalte}` : '');
    if (a.klemmen) {
      const ky = cursor + (a.schalt ? 1 : 6); bis(ky);
      // N als N-Trennklemme (Grundeinstellung) oder als normale Klemme
      const trenn = art => art === 'N' && v.nKlemme !== 'normal';
      arten.forEach((art, i) => setze(g, trenn(art) ? 'trennklemme' : 'klemme', xs[i], ky, null, art));
      arten.forEach((art, i) => enden[i] = ky + (trenn(art) ? 10 : 5));
      bmk(g, x0 - 2, ky + 3, a.klemmen.bmk, [`${a.klemmen.von}–${a.klemmen.bis}`]);
      cursor = ky + (arten.some(trenn) ? 10 : 5);
    }
    const natur = cursor + 6;
    const ye = Math.max(natur, yEnde || 0);
    const ende = k.speist ? 'fest' : k.ziel.anschluss;
    if (ende === 'steckdose3' || ende === 'steckdose5') {
      bis(ye);
      setze(g, arten.length === 5 ? 'steckdose5' : 'steckdose3', x0, ye, null, arten);
      bmk(g, x0 - 2, ye + 3, a.xd.t);
    } else if (ende === 'dose') {      // Geräteanschlussdose: je Leiter eine Endklemme,
      const yk = ye + UNTERKANTE - END_TIEFE;   // Unterkante wie die Steckdose
      bis(yk);
      arten.forEach((art, i) => setze(g, 'endklemme', xs[i], yk, null, art));
      bmk(g, x0 - 2, yk + 3.3, a.xd.t);
    } else if (ende === 'leuchte') {   // Lampe zwischen L und N, PE an das Gehäuse
      arten.forEach((art, i) => { if (art !== 'PE' && enden[i] < ye) leiter(g, xs[i], enden[i], xs[i], ye, art); });
      const iL = 0, iN = arten.indexOf('N'), iPE = arten.indexOf('PE');
      setze(g, 'leuchte', xs[iL], ye, null, [arten[iL], 'N']);
      if (iN !== 1) leiter(g, xs[iN], ye, xs[iN], ye, 'N');
      const xm = xs[iL] + 2.5, yu = ye + 7.5;      // Mitte und Unterkante des Lampenkreises
      leiter(g, xs[iPE], enden[iPE], xs[iPE], yu + 1.5, 'PE');
      leiter(g, xs[iPE], yu + 1.5, xm, yu + 1.5, 'PE'); leiter(g, xm, yu + 1.5, xm, yu, 'PE');
      bmk(g, x0 - 2, ye + 3, a.xd.t);
    } else bis(ye + UNTERKANTE);  // offenes Ende auf Höhe der Steckdosenunterkante
    cursor = ye + 8;
    // Beschriftung unter dem Pfad
    const mx = x0 + ABSTAND * (arten.length - 1) / 2, max = breite - 2;
    let ty = cursor + 4.5;
    if (k.speist) {
      const u = ctx.verteiler[k.speist];
      passend(text(g, mx, ty, `→ ${u ? u.name : 'Verteiler'}${u ? ` /${u.blatt}.${u.spalte}` : ''}`, 2.5, 'middle', { 'font-weight': 'bold' }), max);
      ty += 3.6;
    } else if (k.ziel.bez) { passend(text(g, mx, ty, k.ziel.bez, 2.5, 'middle', { 'font-weight': 'bold' }), max); ty += 3.4; }
    if (k.ziel.ort) { passend(text(g, mx, ty, k.ziel.ort, 2.2, 'middle'), max); ty += 3.2; }
    passend(text(g, mx, ty, `${a.w.t} ${k.leitung.typ || 'NYM-J'} ${arten.length}×${k.leitung.quer || '?'}`, 2.2, 'middle'), max);
    return { unten: ty + 2, natur };
  }
  // Hauptkontakte eines Schaltgeräts (Schütz, Stromstoßschalter, Zeitrelais) unter
  // dem Schutzorgan: je geschaltetem Leiter ein Schaltglied, Wirkverbindung quer
  // durch die Schaltstücke; Kennzeichen links daneben. Gibt das neue untere Ende zurück.
  const SG_KONTAKT = { schuetz: 'schuetz1', stromstoss: 'hilfs_s' };
  const ZR_KONTAKT = { aus: 'k_s_aus', ein: 'k_s_ein', einaus: 'k_s_einaus' };
  function zeichneSchaltglieder(g, a, arten, xs, enden, cursor, bis, spuleRef = '') {
    const sg = a.schalt, n = sg.pole.length, top = cursor;   // oberer Anschlussstrich = Verbindung zum Schutzorgan
    bis(top);
    const kenn = sg.typ === 'zeitrelais' ? ZR_KONTAKT[sg.zr.fkt] || 'k_s_aus' : SG_KONTAKT[sg.typ];
    let unten = top;
    for (let i = 0; i < n; i++) {
      const t = setze(g, kenn, xs[i], top, null, arten[i]);
      const u = t.find(p => p.richtung === 's'); enden[i] = u.y; unten = Math.max(unten, u.y);
    }
    // Wirkverbindung durch die Schaltstücke (11,5 Einheiten über der Kontaktmitte)
    const yW = top + (40 - 11.5) * E;
    if (n > 1) el('line', { x1: xs[0] - 1, y1: yW, x2: xs[n - 1] - 1, y2: yW, stroke: '#000', 'stroke-width': 0.25, 'stroke-dasharray': '1.2 0.8' }, g);
    const zeile2 = sg.typ === 'zeitrelais' ? (sg.zr.zeit ? `t = ${sg.zr.zeit}` : '') : sg.typ === 'stromstoss' ? 'Stromstoß' : '';
    // spuleRef: Lage der Spule im Steuerstromkreis; beim Zeitrelais dann links am Verzögerungszeichen vorbei
    bmk(g, xs[0] - (spuleRef && sg.typ === 'zeitrelais' ? 12 : 5), top + 1, sg.bmk.t, [zeile2, spuleRef]);
    // nicht geschaltete Leiter (N, PE) laufen durch
    arten.forEach((art, i) => { if (i >= n && enden[i] < unten) { leiter(g, xs[i], enden[i], xs[i], unten, art); enden[i] = unten; } });
    return unten;
  }
  // Steuertrafo (ab v1.16): Primär-LS (230 V: auf L, N läuft durch; 400 V: auf L1 und L2),
  // Trafo -T, Sekundär-LS auf der Spannungsseite, Rückleitung „0 V“ wahlweise an PE geerdet;
  // darunter der Abgriff mit gehenden Querverweisen zum Steuerstromkreis
  function zeichneTrafo(g, ctx, v, k, a, xSp, bars, yG, breite, tap) {
    const T = k.trafo, prim = abgangArten(k, a, v), x0 = xSp + LINKS, xs = [x0, x0 + ABSTAND, x0 + 2 * ABSTAND];
    prim.forEach((art, i) => { const yq = bars[quelle(art, bars)]; if (tap) tap(art, xs[i], yq); else punkt(g, xs[i], yq, art); leiter(g, xs[i], yq, xs[i], yG, art); });
    const z = k.geraet.zeichen || 'ls1', pole = POLE[z] || 1;
    const enden = [yG, yG];
    if (pole >= 2) unten(setze(g, z, x0, yG, null, prim)).forEach((p, i) => { if (i < 2) enden[i] = p.y; });
    else {
      enden[0] = unten(setze(g, z, x0, yG, null, [prim[0]]))[0].y;
      // zweiter Außenleiter: zweites Schaltglied daneben (wie der LS 3-polig der Bibliothek ohne eigene Kopplungslinie)
      if (T.prim === '400') enden[1] = unten(setze(g, z, xs[1], yG, null, [prim[1]]))[0].y;
    }
    let cursor = kennzeichen(g, z, x0, yG, Math.max(...enden), a.f && a.f.t, bemZeilen(k.geraet));
    // Trafo
    const yT = cursor + 4;
    prim.forEach((art, i) => leiter(g, xs[i], enden[i], xs[i], yT, art));
    const tt = unten(setze(g, 'trafo', x0, yT));
    const yS = Math.max(...tt.map(p => p.y));
    bmk(g, x0 - 5, yT + 1, a.t && a.t.t, [`${T.prim}/${T.sek} V`, T.va ? `${T.va} VA` : '']);
    // Rückleitung 0 V, geerdet: PE von der Schiene rechts herunter
    const yE = yS + 3;
    if (T.erde && bars.PE !== undefined || T.erde && bars.PEN !== undefined) {
      const yPe = bars[quelle('PE', bars)];
      if (tap) tap('PE', xs[2], yPe); else punkt(g, xs[2], yPe, 'PE');
      leiter(g, xs[2], yPe, xs[2], yE, 'PE'); leiter(g, xs[2], yE, xs[1], yE, 'PE'); punkt(g, xs[1], yE, 'PE');
    }
    // Sekundär-LS auf der Spannungsseite
    const zl = (T.ls && T.ls.zeichen) || 'ls1', ySL = yE + 4;
    leiter(g, xs[0], yS, xs[0], ySL, 'M');
    const ts = unten(setze(g, zl, x0, ySL));
    cursor = kennzeichen(g, zl, x0, ySL, ts[0].y, a.f2 && a.f2.t, bemZeilen(T.ls));
    // Abgriff: Spannung und 0 V mit gehendem Querverweis, Leitungen enden dort (Ecke)
    const y1 = cursor + 2, xr = xs[2] + 4;
    const ziel = ctx.steuer && ctx.steuer.kreise[a.abgriff], ref = ziel ? `/${ziel.blatt}.${ziel.spalte}` : '';
    leiter(g, xs[0], ts[0].y, xs[0], y1, 'M'); leiter(g, xs[1], yS, xs[1], y1 + 3, 'M');
    if (a.abgriff) [[0, y1], [1, y1 + 3]].forEach(([i, y]) => {
      leiter(g, xs[i], y, xr, y, 'M');
      setze(g, 'qv_gehend', xr, y, t => t.richtung === 'w');
      text(g, xr + 4.5, y + 0.9, ref, 2.2);
    });
    const ty = y1 + 9;
    passend(text(g, x0 + ABSTAND / 2, ty, `${k.ziel.bez || 'Steuertrafo'} ${T.sek} V`, 2.5, 'middle', { 'font-weight': 'bold' }), breite - 2);
    return { unten: ty + 2, natur: y1 + 6 };
  }
  // eigene Endhöhe eines Abgangs, ohne etwas zu zeichnen
  function naturEnde(ctx, v, k, a, bars, yG) {
    return zeichneAbgang(el('g'), ctx, v, k, a, 0, bars, yG, 100).natur;
  }

  // ---- Gruppe zeichnen ---------------------------------------------------------
  function gruppenArten(grp, e) {
    const z = grp.geraet.zeichen, pg = POLE[z];
    if (pg === 4) return ['L1', 'L2', 'L3', 'N'];
    if (pg === 3) return ['L1', 'L2', 'L3'];
    const ph = e.gruppenPhase && e.gruppenPhase[grp.id] ? e.gruppenPhase[grp.id].t : 'L1';
    return [ph, 'N'];
  }
  // Leiter, die das Gruppengerät nicht schaltet, werden rechts daneben
  // heruntergeführt und bilden mit eigene Untersammelschienen (immer PE,
  // N nur, wenn das Gerät ihn nicht schaltet).
  function gruppenZufuehrung(arten) { return (arten.includes('N') ? [] : ['N']).concat(['PE']); }
  function gruppenLeiterzahl(grp, e) { const a = gruppenArten(grp, e); return a.length + gruppenZufuehrung(a).length; }

  // Passen die Abgänge einer Gruppe nicht über die feste Endhöhe (z. B. mit
  // Schaltgerät und Klemmen), werden die Abstände unter dem Gruppengerät enger.
  let gruppenNatur = 0;      // eigene Endhöhe der zuletzt gezeichneten Gruppe
  function zeichneGruppe(g, ctx, v, e, grp, xSp, bars, yG, breiteSp, R, yEndeFest = null, eng = null) {
    if (eng === null && yEndeFest) {
      zeichneGruppe(el('g'), ctx, v, e, grp, xSp, bars, yG, breiteSp, R, null, false);
      eng = gruppenNatur > yEndeFest;
    }
    const arten = gruppenArten(grp, e), zu = gruppenZufuehrung(arten);
    const x0 = xSp + LINKS, xs = arten.map((_, i) => x0 + ABSTAND * i);
    arten.forEach((art, i) => { const yq = bars[quelle(art, bars)]; punkt(g, xs[i], yq, art); leiter(g, xs[i], yq, xs[i], yG, art); });
    const t = unten(setze(g, grp.geraet.zeichen, x0, yG, null, arten));
    const yU0 = kennzeichen(g, grp.geraet.zeichen, x0, yG, Math.max(...t.map(p => p.y)), e.geraete[grp.id].t, bemZeilen(grp.geraet)) + (eng ? 3 : 6);
    const alle = arten.concat(zu);
    const unterBars = Object.assign({}, bars), ys = {}, bereich = {};
    alle.forEach((art, i) => { ys[art] = yU0 + ABSTAND * i; unterBars[art] = ys[art]; bereich[art] = []; });
    // Gerät -> Untersammelschiene
    arten.forEach((art, i) => { leiter(g, t[i].x, t[i].y, t[i].x, ys[art], art); bereich[art].push({ x: t[i].x, oben: true }); });
    // Zuführung N/PE rechts neben dem Gerät von der Hauptschiene
    zu.forEach((art, j) => {
      const x = x0 + ABSTAND * (arten.length + j), yq = bars[quelle(art, bars)];
      punkt(g, x, yq, art); leiter(g, x, yq, x, ys[art], art); bereich[art].push({ x, oben: true });
    });
    // FI 2-polig: alle Außenleiter der Abgänge kommen von seiner einen Untersammelschiene
    if (arten.length === 2) ['L1', 'L2', 'L3'].forEach(l => { unterBars[l] = ys[arten[0]]; });
    const artVonY = y => alle.find(a => ys[a] === y);
    const tap = (art, x, y) => { const ua = artVonY(y); if (ua) bereich[ua].push({ x, oben: false }); else punkt(g, x, y, art); };
    const yK = yU0 + ABSTAND * (alle.length - 1) + (eng ? 5 : VOR_GERAET);
    letzteGruppeYK = yK;
    const kinder = grp.kinder.filter(k => k.typ === 'abgang');
    gruppenNatur = Math.max(0, ...kinder.map(k => naturEnde(ctx, v, k, e.abgaenge[k.id], unterBars, yK)));
    const yEnde = yEndeFest || gruppenNatur;
    let x = xSp, unterst = yK;
    for (const k of kinder) {
      const a = e.abgaenge[k.id], w = abgangSpalten(k, a, v, R);
      unterst = Math.max(unterst, zeichneAbgang(g, ctx, v, k, a, x, unterBars, yK, w * R.sb, yEnde, tap).unten);
      x += w * R.sb;
    }
    // Untersammelschienen nur von der ersten bis zur letzten Verbindung.
    // Verbindungspunkt überall, wo drei oder mehr Linien zusammentreffen
    // (Schiene nach links/rechts, Leiter nach oben/unten); an einer Ecke nicht.
    alle.forEach(art => {
      const an = bereich[art]; if (!an.length) return;
      const xsA = an.map(p => p.x), lo = Math.min(...xsA), hi = Math.max(...xsA), y = ys[art];
      if (hi > lo) linie(g, lo, y, hi, y, 0.25, farbe(art));   // Untersammelschiene in Leiterstärke
      const gleich = (a, b) => Math.abs(a - b) < 0.01;
      [...new Set(xsA.map(x => x.toFixed(2)))].map(Number).forEach(xp => {
        const hier = an.filter(p => gleich(p.x, xp));
        const linien = (xp > lo + 0.01 ? 1 : 0) + (xp < hi - 0.01 ? 1 : 0)
          + (hier.some(p => p.oben) ? 1 : 0) + (hier.some(p => !p.oben) ? 1 : 0);
        if (linien >= 3) punkt(g, xp, y, art);
      });
    });
    return unterst;
  }

  // ---- Überspannungsschutz als erster Pfad an den Schienen -----------------
  function zeichneSpd(g, v, e, xSp, bars, yG) {
    const z = v.spd.zeichen;
    const arten = z === 'spd4' ? ['L1', 'L2', 'L3', 'N'] : ['L1', 'N'];
    const x0 = xSp + LINKS, xs = arten.map((_, i) => x0 + ABSTAND * i);
    arten.forEach((art, i) => { const yq = bars[quelle(art, bars)]; punkt(g, xs[i], yq, art); leiter(g, xs[i], yq, xs[i], yG, art); });
    // alles unterhalb der Ableiter (deren untere Anschlüsse, Querverbindung,
    // Stich zum PE-Anschluss) liegt auf PE und wird grün
    const peSeite = gz => { for (const el2 of gz.querySelectorAll('line')) {
      if (Math.min(+el2.getAttribute('y1'), +el2.getAttribute('y2')) >= 10 - 1e-6) el2.setAttribute('stroke', FARBE.PE); } };
    const t = setze(g, z, x0, yG, null, arten, 1, peSeite);
    const pe = t.find(p => p.richtung === 's');
    // PE des Ableiters nach rechts und hoch auf die PE- bzw. PEN-Schiene
    const xr = xs[xs.length - 1] + ABSTAND, yPe = bars[quelle('PE', bars)];
    leiter(g, pe.x, pe.y, pe.x, pe.y + 4, 'PE'); leiter(g, pe.x, pe.y + 4, xr, pe.y + 4, 'PE');
    leiter(g, xr, pe.y + 4, xr, yPe, 'PE'); punkt(g, xr, yPe, 'PE');
    bmk(g, x0 - 5, yG + 1, e.kopf.spd.t, []);
    return pe.y + 8;
  }

  // ---- Sammelschienen ---------------------------------------------------------
  function zeichneSchienen(g, v, y0, xStarts, xEnde, kommend, gehend, mitNamen) {
    const namen = schienenNamen(v), bars = {};
    namen.forEach((n, i) => {
      const y = y0 + ABSTAND * i, xs = Array.isArray(xStarts) ? xStarts[i] : xStarts;
      linie(g, xs, y, xEnde, y, 0.25, farbe(n));
      bars[n] = y;
      if (mitNamen) text(g, RAND_L + 1.5, y + 0.9, anzeige(n, v), 2.5);
      if (kommend) { setze(g, 'qv_kommend', xs, y, t => t.richtung === 'e', n); }
      if (gehend) { setze(g, 'qv_gehend', xEnde, y, t => t.richtung === 'w', n); text(g, xEnde + 4.5, y + 0.9, gehend, 2.2); }
    });
    if (kommend) text(g, (Array.isArray(xStarts) ? xStarts[0] : xStarts), y0 - 2.2, kommend, 2.2, 'end');
    return bars;
  }

  // ---- Einspeisung ----------------------------------------------------------
  // zeichnet die Leiter von oben durch Vorsicherung, Zähler, Hauptschalter;
  // gibt die x-Lage der Leiter und das untere Ende zurück
  function zeichneEinspeisung(g, v, e, xSp, yOben, herkunft) {
    const pen = v.netzform !== 'TN-S';
    let namen = v.leiter === '1NPE' ? (pen ? ['L1', 'PEN'] : ['L1', 'N', 'PE']) : (pen ? ['L1', 'L2', 'L3', 'PEN'] : ['L1', 'L2', 'L3', 'N', 'PE']);
    const x0 = xSp + LINKS;
    let xs = namen.map((_, i) => x0 + ABSTAND * i);
    passend(text(g, x0 - 2, yOben, herkunft, 2.5, 'start', { 'font-weight': 'bold' }), 80);
    namen.forEach((n, i) => text(g, xs[i], yOben + 4, anzeige(n, v), 1.9, 'middle'));
    let enden = namen.map(() => yOben + 5.5), cursor = yOben + 5.5;
    for (const feld of ['vorsicherung', 'zaehler', 'hauptschalter']) {
      const gz = v[feld].zeichen; if (!gz) continue;
      const pole = Math.min(POLE[gz], namen.length), top = cursor + 5;
      namen.forEach((n, i) => { leiter(g, xs[i], enden[i], xs[i], top, n); enden[i] = top; });
      const t = unten(setze(g, gz, x0, top, null, namen.slice(0, pole)));
      t.forEach((p, i) => { if (i < pole) enden[i] = p.y; });
      bmk(g, x0 - 5, top + 1, e.kopf[feld].t, feld === 'zaehler' ? [] : bemZeilen(v[feld]));
      cursor = Math.max(...t.map(p => p.y));
    }
    // TN-C-S: PEN wird hier in N und PE aufgeteilt
    if (v.netzform === 'TN-C-S') {
      const i = namen.indexOf('PEN'), ys = cursor + 4;
      leiter(g, xs[i], enden[i], xs[i], ys, 'PEN');
      punkt(g, xs[i], ys, 'PE');
      leiter(g, xs[i], ys, xs[i] + ABSTAND, ys, 'PE');
      text(g, xs[i] + ABSTAND + 1, ys - 1, 'PEN → N + PE', 1.9);
      namen = namen.slice(0, i).concat(['N', 'PE']);
      xs = xs.concat([xs[i] + ABSTAND]);
      enden = enden.slice(0, i).concat([ys, ys]);
      cursor = ys;
    }
    return { namen, xs, enden, cursor };
  }
  function einspeisungsHoehe(v) {
    let h = 5.5;
    for (const feld of ['vorsicherung', 'zaehler', 'hauptschalter']) if (v[feld].zeichen) h += 5 + hoehe(v[feld].zeichen);
    if (v.netzform === 'TN-C-S') h += 4;
    return h;
  }

  // ---- Blattplanung -------------------------------------------------------
  function planeVerteiler(v, e, F, R, probe) {
    const items = [];
    if (v.spd.zeichen) items.push({ art: 'spd', w: spaltenFuer(v.spd.zeichen === 'spd4' ? 5 : 3, R) });
    for (const k of v.knoten) {
      if (k.typ === 'abgang') items.push({ art: 'abgang', k, w: abgangSpalten(k, e.abgaenge[k.id], v, R) });
      else {
        const sum = k.kinder.filter(c => c.typ === 'abgang').reduce((s, c) => s + abgangSpalten(c, e.abgaenge[c.id], v, R), 0);
        items.push({ art: 'gruppe', k, w: Math.max(sum, spaltenFuer(gruppenLeiterzahl(k, e), R)) });
      }
    }
    const kurz = !v.zaehler.zeichen && [v.vorsicherung.zeichen, v.hauptschalter.zeichen].filter(Boolean).length <= 1 && v.netzform !== 'TN-C-S';
    const sfTop = F.h - RAND - SF_H;
    const cSF = 1;                                        // das Schriftfeld liegt unter allen Spalten
    const letzte = F.sp - 1;                              // letzte nutzbare Spalte
    const nb = schienenNamen(v).length;
    const tiefe = (it, y0) => probe(it, y0);             // unterstes y eines Pfades bei Schienen auf y0
    const versuche = (kombiniert) => {
      const blaetter = [];
      const yKomb = 12 + einspeisungsHoehe(v) + 8;
      let bl = kombiniert ? { art: 'kombiniert', y0: yKomb, items: [] } : null;
      if (!kombiniert) blaetter.push({ art: 'einspeisung', items: [] });
      let col = 3;
      const neu = () => { bl = { art: 'abgang', y0: 22, items: [] }; blaetter.push(bl); col = 2; };
      if (bl) blaetter.push(bl); else neu();
      for (const it of items) {
        let versucht = 0;
        for (;;) {
          const passtBreite = col + it.w - 1 <= letzte;
          const imSF = col + it.w - 1 >= cSF;
          const ok = passtBreite && (!imSF || tiefe(it, bl.y0) <= sfTop - 2);
          if (ok || (versucht && col === 2)) break;
          if (bl.art === 'kombiniert' && bl.items.length === 0 && !passtBreite) return null;
          neu(); versucht++;
          if (versucht > 2) break;
        }
        it.col = col; bl.items.push(Object.assign({}, it)); col += it.w;
      }
      // ein kombiniertes Blatt ohne einen einzigen Pfad wäre sinnlos
      if (kombiniert && items.length && !blaetter[0].items.length) return null;
      return blaetter;
    };
    return (kurz && versuche(true)) || versuche(false);
  }


  // ---- Übersichtsschaltplan (einpolig) --------------------------------------
  const UE = { ls1: 'ls1', ls3: 'ls1', fils1n: 'ue_fils', fils3n: 'ue_fils', sich1: 'sich1', sich3: 'sich1',
    fi2: 'ue_fi', fi4: 'ue_fi', sichtrenn3: 'sichtrenn1', sichlasttrenn3: 'sichlasttrenn1', lasttrenn3: 'ue_lasttrenn',
    trenn3: 'ue_trenn', leistung3: 'ue_leistung', zaehler3: 'ue_zaehler', zaehler1: 'ue_zaehler', spd4: 'ue_spd', spd2: 'ue_spd' };
  const UE_FEED_X = 24;      // Einspeisung: Abstand vom linken Rahmen
  // Leiterzahl: kurzer Schrägstrich über der Linie, Zahl rechts daneben
  function leiterzahl(g, x, y, n) {
    linie(g, x - 1.4, y + 1.4, x + 1.4, y - 1.4, 0.25);
    text(g, x + 1.7, y - 0.6, String(n), 2.2);
  }
  function ueBmk(g, x, y, kenn, zeilen, max) {   // rechtsbündig bis x, auf max begrenzt
    if (kenn) passend(text(g, x, y, kenn, 2.5, 'end', { 'font-weight': 'bold' }), max);
    zeilen.filter(Boolean).forEach((z, i) => passend(text(g, x, y + 3.2 + 2.8 * i, z, 2.2, 'end'), max));
  }
  // Gerät einpolig setzen; Kennzeichen links daneben, bei FI-Geräten links darunter.
  // Gibt das untere Ende (einschließlich Beschriftung unter dem Gerät) zurück.
  function ueGeraet(g, z, x, y, kenn, zeilen, P) {
    const t = setze(g, UE[z], x, y);
    const u = Math.max(...t.filter(p => p.richtung === 's').map(p => p.y), y);
    if (GERAETE[z] && GERAETE[z].fi) { ueBmk(g, x - 1.5, u + 3, kenn, zeilen, P - 3); return { unten: u, frei: u + 3 + 2.8 * zeilen.length + 1 }; }
    ueBmk(g, x - 4.5, y + 2, kenn, zeilen, P - 5.5);
    return { unten: u, frei: u };
  }
  // Ende eines Abgangs: Anschlusszeichen und senkrechte Beschriftung bis vor das Schriftfeld
  function ueEnde(g, ctx, v, k, a, x, yE, ySF) {
    const ende = k.speist ? 'fest' : k.ziel.anschluss;
    if (ende === 'steckdose3' || ende === 'steckdose5') setze(g, 'ue_steckdose', x, yE);
    else if (ende === 'dose') { linie(g, x, yE, x, yE + UNTERKANTE - END_TIEFE, 0.25); setze(g, 'endklemme', x, yE + UNTERKANTE - END_TIEFE); }
    else if (ende === 'leuchte') setze(g, 'ue_leuchte', x, yE);
    else linie(g, x, yE, x, yE + UNTERKANTE, 0.25);
    if (a.xd && a.xd.t && ende !== 'fest') text(g, x - 2.2, yE + 3.6, a.xd.t, 2.2, 'end');
    const yL = yE + 9.5, max = ySF - 2 - yL;
    const senk = (dx, t, gr, fett) => passend(text(g, x + dx, yL, t, gr, 'end',
      Object.assign({ transform: `rotate(-90 ${x + dx} ${yL})` }, fett ? { 'font-weight': 'bold' } : {})), max);
    const n = abgangArten(k, a, v).length;
    if (k.speist) {
      const u = ctx.ue[k.speist];
      senk(-2.2, `→ ${u ? u.name : 'Verteiler'}${u ? ` /${u.blatt}.${u.spalte}` : ''}`, 2.2, true);
    } else senk(-2.2, k.ziel.bez || '', 2.5, true);
    senk(0.9, k.trafo ? `${k.trafo.prim}/${k.trafo.sek} V` : k.ziel.ort || '', 2.2);
    if (!k.steuer) senk(3.9, `${a.w.t} ${k.leitung.typ || 'NYM-J'} ${n}×${k.leitung.quer || '?'}`, 2.2);
  }
  // ein Abgang an einer Schiene auf ySrc: Gerät auf yG, Ende auf yE.
  // Gibt das untere Ende vor der Ableitung zum Ende zurück.
  function ueAbgang(g, ctx, v, e, k, x, ySrc, yG, yE, ySF, P, punktZeigen = true, eng = false) {
    const a = e.abgaenge[k.id];
    if (punktZeigen) punkt(g, x, ySrc);
    let y = ySrc;
    if (!a.drei && a.phase.t) text(g, x + 1, ySrc + 3.6, a.phase.t, 2);
    if (k.geraet.zeichen) {
      linie(g, x, y, x, yG, 0.25);
      const r = ueGeraet(g, k.geraet.zeichen, x, yG, a.f && a.f.t, bemZeilen(k.geraet), P);
      y = r.unten; var frei = r.frei;
    } else var frei = y;
    if (k.trafo) {      // Steuertrafo: Trafo einpolig, darunter der Sekundär-LS
      const top = Math.max(frei, y) + 3;
      linie(g, x, y, x, top, 0.25);
      const t = setze(g, 'ue_trafo', x, top);
      ueBmk(g, x - 6.5, top + 4, a.t && a.t.t, [`${k.trafo.prim}/${k.trafo.sek} V`], P - 7.5);
      y = Math.max(...t.filter(p => p.richtung === 's').map(p => p.y));
      const ls = k.trafo.ls && k.trafo.ls.zeichen || 'ls1', top2 = y + 2.5;
      linie(g, x, y, x, top2, 0.25);
      const r2 = ueGeraet(g, ls, x, top2, a.f2 && a.f2.t, bemZeilen(k.trafo.ls), P);
      y = r2.unten; frei = r2.frei;
    }
    if (a.schalt) {     // Schaltgerät einpolig mit dem Schützzeichen
      const top = Math.max(frei, y) + (eng && frei <= y ? 0.5 : 3);   // unter einer FI-Beschriftung bleibt Abstand
      linie(g, x, y, x, top, 0.25);
      const t = setze(g, 'schuetz1', x, top);
      ueBmk(g, x - 4.5, top + 2, a.schalt.bmk.t, [], P - 5.5);
      y = Math.max(...t.filter(p => p.richtung === 's').map(p => p.y)); frei = y;
    }
    if (yE !== null) {
      linie(g, x, y, x, yE, 0.25);
      leiterzahl(g, x, Math.max(Math.max(frei, y) + 4, yE - 4.5), abgangArten(k, a, v).length);
      ueEnde(g, ctx, v, k, a, x, yE, ySF);
    }
    return Math.max(frei, y) + 7;    // Platz für die Leiterzahl
  }
  function ueGruppe(g, ctx, v, e, grp, x, ySrc, yG, yE, ySF, P, eng = false, nachbar = 1) {
    const kinder = grp.kinder.filter(k => k.typ === 'abgang');
    punkt(g, x, ySrc); linie(g, x, ySrc, x, yG, 0.25);
    const gp = e.gruppenPhase[grp.id];
    if (gp) text(g, x + 1, ySrc + 3.6, gp.t, 2);
    let r;
    if (eng) {          // knapp: Beschriftung rechts neben das Gruppengerät, dort ist bis zum nächsten Pfad frei
      const t = setze(g, UE[grp.geraet.zeichen], x, yG), u = Math.max(...t.filter(p => p.richtung === 's').map(p => p.y));
      const zl = bemZeilen(grp.geraet), y0 = u - 2.8 * zl.length - 1.5, max = P * nachbar - 4;
      passend(text(g, x + 2.5, y0, e.geraete[grp.id].t, 2.5, 'start', { 'font-weight': 'bold' }), max);
      zl.forEach((z, i) => passend(text(g, x + 2.5, y0 + 3.2 + 2.8 * i, z, 2.2, 'start'), max));
      r = { unten: u, frei: u };
    } else r = ueGeraet(g, grp.geraet.zeichen, x, yG, e.geraete[grp.id].t, bemZeilen(grp.geraet), P);
    const yU = r.frei + 1.5, yK = yU + 4.5;
    linie(g, x, r.unten, x, yU, 0.25);
    if (kinder.length > 1) linie(g, x, yU, x + P * (kinder.length - 1), yU, 0.25);
    let tief = yK;
    kinder.forEach((k, i) => {
      const xi = x + P * i;
      // Punkt, wo drei Linien treffen: am ersten Kind (oben, unten, rechts) und in der Mitte
      if (kinder.length > 1 && i < kinder.length - 1) punkt(g, xi, yU);
      const a = e.abgaenge[k.id], ph = a.phase.t; a.phase.t = '';      // Phase steht an der Gruppe bzw. am Kind selbst
      tief = Math.max(tief, ueAbgang(g, ctx, v, e, k, xi, yU, yK, yE, ySF, P, false, eng));
      a.phase.t = ph;
      if (!gp && !a.drei && ph) text(g, xi + 1, yU + 3.6, ph, 2);
    });
    return tief;
  }
  function ueSpd(g, e, v, x, ySrc, yG, P) {
    punkt(g, x, ySrc); linie(g, x, ySrc, x, yG, 0.25);
    return ueGeraet(g, v.spd.zeichen, x, yG, e.kopf.spd.t, [], P).unten + 4;
  }
  function ueBreite(it) { return it.art === 'gruppe' ? Math.max(1, it.k.kinder.filter(k => k.typ === 'abgang').length) : 1; }
  // Einspeisung einpolig von oben bis zur Schiene; gibt die Schienenhöhe zurück
  function ueEinspeisung(g, v, e, x, herkunft, P) {
    const pen = v.netzform !== 'TN-S';
    const n0 = v.leiter === '1NPE' ? (pen ? 2 : 3) : (pen ? 4 : 5);
    if (g) passend(text(g, x - 8, RAND + 5, herkunft, 2.5, 'start', { 'font-weight': 'bold' }), 90);
    let y = RAND + 7;
    if (g) leiterzahl(g, x, y + 2, n0);
    y += 3;
    for (const feld of ['vorsicherung', 'zaehler', 'hauptschalter']) {
      const z = v[feld].zeichen; if (!z) continue;
      const top = y + 2.5;
      if (g) { linie(g, x, y, x, top, 0.25);
        y = ueGeraet(g, z, x, top, e.kopf[feld].t, feld === 'zaehler' ? [] : bemZeilen(v[feld]), UE_FEED_X).unten; }
      else y = top + hoehe(UE[z]);
    }
    if (v.netzform === 'TN-C-S') {
      if (g) { linie(g, x, y, x, y + 6, 0.25); punkt(g, x, y + 2.5);
        text(g, x - 2, y + 3.2, 'PEN → N + PE', 2, 'end'); leiterzahl(g, x, y + 4.6, v.leiter === '1NPE' ? 3 : 5); }
      y += 6;
    }
    const yS = y + 4;
    if (g) linie(g, x, y, x, yS, 0.25);
    return yS;
  }
  // Blattplanung des Übersichtsschaltplans je Verteiler: Pfade nebeneinander im
  // halben Spaltenraster; eine Gruppe wird nicht geteilt.
  function ueplane(v, e, F, R) {
    const P = R.sb / 2, items = [];
    if (v.spd.zeichen) items.push({ art: 'spd' });
    v.knoten.forEach(k => items.push({ art: k.typ === 'abgang' ? 'abgang' : 'gruppe', k }));
    const xF = R.x0 + UE_FEED_X, xMax = R.x1 - 16;
    const blaetter = []; let bl = null, x;
    const neu = (erst) => { bl = { erst, items: [] }; blaetter.push(bl); x = erst ? xF + P : R.x0 + 8 + P; };
    neu(true);
    for (const it of items) {
      const w = ueBreite(it);
      if (x + P * (w - 1) > xMax && bl.items.length) neu(false);
      bl.items.push(Object.assign({ x }, it)); x += P * w;
    }
    return blaetter;
  }
  function ueZeichne(g, ctx, v, e, F, R, b, i, n, herkunft, blattNr) {
    const P = R.sb / 2, xF = R.x0 + UE_FEED_X, ySF = F.h - RAND - SF_H, xEnde = R.x1 - 12;
    const yS = ueEinspeisung(i === 0 ? g : null, v, e, xF, herkunft, P);
    const yG = yS + 6;
    // 1. Probe: wie tief reichen die Geräte? danach die gemeinsame Endhöhe
    const tiefe = eng => { const probe = el('g'); let tief = yG;
      for (const it of b.items) {
        if (it.art === 'spd') continue;
        tief = Math.max(tief, it.art === 'abgang' ? ueAbgang(probe, ctx, v, e, it.k, it.x, yS, yG, null, ySF, P, true, eng)
          : ueGruppe(probe, ctx, v, e, it.k, it.x, yS, yG, null, ySF, P, eng, ueBreite(it)));
      }
      return tief; };
    // reicht der Platz für die senkrechte Beschriftung nicht (unter 21 mm), wird verdichtet
    let tief = tiefe(false); const eng = ySF - 2 - (Math.max(ySF - 36, tief) + 9.5) < 21;
    if (eng) tief = tiefe(true);
    const yE = Math.max(ySF - 36, tief);
    // Schiene
    const x0 = i === 0 ? xF : R.x0 + 8;
    linie(g, x0, yS, xEnde, yS, 0.25);
    const namen = schienenNamen(v).map(nm => anzeige(nm, v)).join(' ');
    text(g, xEnde - 1, yS - 1.5, namen, 2, 'end');
    if (i > 0) { setze(g, 'qv_kommend', x0, yS, t => t.richtung === 'e'); text(g, x0 - 3, yS - 2.2, `/${blattNr - 1}.${F.sp}`, 2.2, 'start'); }
    if (i < n - 1) { setze(g, 'qv_gehend', xEnde, yS, t => t.richtung === 'w'); text(g, xEnde + 4.5, yS + 0.9, `/${blattNr + 1}.1`, 2.2); }
    for (const it of b.items) {
      if (it.art === 'spd') ueSpd(g, e, v, it.x, yS, yG, P);
      else if (it.art === 'abgang') ueAbgang(g, ctx, v, e, it.k, it.x, yS, yG, yE, ySF, P, true, eng);
      else ueGruppe(g, ctx, v, e, it.k, it.x, yS, yG, yE, ySF, P, eng, ueBreite(it));
    }
  }


  // ---- Klemmenplan (Klemmleiste -X1 im Verteiler) ---------------------------
  const ADER = { L: 'br', L1: 'br', L2: 'sw', L3: 'gr', N: 'bl', PE: 'gnge', PEN: 'gnge' };   // DIN VDE, deutsche Kürzel
  const KL_Y0 = 30, KL_ZH = 5;
  // Zeilen der Klemmleiste, je Abgang ein Block
  function klemmenBloecke(v, e) {
    const bloecke = [], tnc = v.netzform === 'TN-C';
    const fiN = z => ['fils1n', 'fils3n', 'fi2', 'fi4'].includes(z);
    const ausgang = (z, kenn, l, ph) => {          // Anschluss unten am Gerät
      if (!z || !kenn) return null;
      if (l === 'PE') return null;
      if (l === 'N') return fiN(z) ? `${kenn}:N` : null;
      const i = GERAETE[z].pole === 1 ? 0 : ({ L1: 0, L2: 1, L3: 2 }[ph] || 0);
      return `${kenn}:${2 * (i + 1)}`;
    };
    const schiene = (l, ph) => 'Schiene ' + (tnc && (l === 'N' || l === 'PE') ? 'PEN' : l === 'L' ? (v.leiter === '1NPE' ? 'L' : ph) : l);
    const abgang = (k, grp) => {
      const a = e.abgaenge[k.id]; if (!a || !a.klemmen) return;
      const zeilen = a.leiter.map((l, i) => {
        const ph = l === 'L' ? (a.phase.t && a.phase.t !== 'L' ? a.phase.t : 'L1') : l;
        const si = a.schalt ? a.schalt.pole.indexOf(l) : -1;
        const intern = (si >= 0 ? `${a.schalt.bmk.t}:${2 * (si + 1)}` : null)
          || ausgang(k.geraet.zeichen, a.f && a.f.t, l, ph)
          || (grp && ausgang(grp.geraet.zeichen, e.geraete[grp.id] && e.geraete[grp.id].t, l, ph))
          || schiene(l, ph);
        const art = l === 'PE' ? 'Schutzleiterklemme' : l === 'N' ? (v.nKlemme === 'normal' ? 'N-Klemme' : 'N-Trennklemme') : 'Durchgangsklemme';
        const anzeige = l === 'L' ? (v.leiter === '1NPE' ? 'L' : ph) : (tnc && (l === 'N' || l === 'PE') ? 'PEN' : l);
        const ader = a.drei ? ADER[l] : ADER[l === 'L' ? 'L' : l];
        const ziel = k.speist ? `→ ${(hilfK.name(k.speist)) || 'Verteiler'}` : [a.xd && a.xd.t, k.ziel.bez, k.ziel.ort].filter(Boolean).join(' ');
        return [String(a.klemmen.von + i), anzeige, art, intern, `${a.w.t} ${k.leitung.typ || 'NYM-J'} ${a.leiter.length}×${k.leitung.quer || '?'}`, ader, ziel];
      });
      bloecke.push({ kenn: a.f ? a.f.t : '', zeilen });
    };
    v.knoten.forEach(k => k.typ === 'abgang' ? abgang(k, null) : k.kinder.forEach(c => c.typ === 'abgang' && abgang(c, k)));
    bloecke.forEach(b => b.leiste = '-X1');
    // gebrückte Klemmen der gemeinsamen Steuerspannung (ab v1.10): eine Reihe L, eine Reihe N;
    // die erste Klemme jeder Reihe kommt von der Quelle, die übrigen über die Brücke
    const gem = e.steuer && e.steuer.gemeinsam, kl = gem && gem.klemmen;
    if (kl) {
      const q = e.abgaenge[gem.quelle], qk = stKnoten(v, gem.quelle), qu = stQuelle(v, e, gem.quelle), lName = stLeiter(v, q), ziel = {};
      const grp = v.knoten.find(g => g.typ === 'gruppe' && g.kinder.includes(qk));     // Quelle in einer Gruppe?
      v.steuerung.kreise.filter(kr => gem.kreise.includes(kr.id)).forEach(kr => {
        const sg = kr.pfade.map(pf => pf.verbraucher && e.abgaenge[pf.verbraucher.g]).find(x => x && x.schalt);
        kr.pfade.forEach(pf => ziel[pf.id] = 'Steuerstromkreis' + (sg ? ' ' + sg.schalt.bmk.t : ''));
      });
      const reihe = (nrn, l) => Object.entries(nrn).sort((x, y) => x[1] - y[1]).map(([pid, nr], i) => {
        const ll = l === 'N' ? 'N' : 'L';
        if (qk.trafo) {        // Steuertrafo: L vom Sekundär-LS, 0 V vom Trafo
          const intern = i ? 'Brücke' : ll === 'N' ? `${q.t.t}:0V` : `${q.f2.t}:2`;
          return [String(nr), ll === 'N' ? qu.nName : qu.lName, 'Durchgangsklemme, gebrückt', intern, '', '', ziel[pid] || ''];
        }
        const intern = i ? 'Brücke' : (ausgang(qk.geraet.zeichen, q.f && q.f.t, ll, lName)
          || (grp && ausgang(grp.geraet.zeichen, e.geraete[grp.id] && e.geraete[grp.id].t, ll, lName)) || schiene(ll, lName));
        const art = l === 'N' ? (v.nKlemme === 'normal' ? 'N-Klemme' : 'N-Trennklemme') : 'Durchgangsklemme';
        return [String(nr), l === 'N' ? 'N' : lName, art + ', gebrückt', intern, '', '', ziel[pid] || ''];
      });
      bloecke.push({ kenn: '', leiste: kl.bmk, zeilen: reihe(kl.l, 'L') }, { kenn: '', leiste: kl.bmk, zeilen: reihe(kl.n, 'N') });
    }
    // Feldgeräte der Steuerstromkreise (ab v1.13): je Kontakt bzw. Meldeleuchte zwei Klemmen
    const sf = e.steuer || {}, ader = {};
    (sf.feldListe || []).forEach(f => {
      const g = v.steuerung.geraete.find(x => x.id === f.gid), kz = (sf.geraete[f.gid] || {}).t || '', nrn = sf.feld[f.key];
      const kr = v.steuerung.kreise.find(x => x.id === f.kr);
      const sg = kr && kr.pfade.map(pf => pf.verbraucher && e.abgaenge[pf.verbraucher.g]).find(x => x && x.schalt);
      const ml = f.z === 'meldeleuchte', an = ml ? ['X1', 'X2'] : (sf.kontakte[f.key] || {}).an || (/_oe|notaus/.test(f.z) ? ['11', '12'] : ['13', '14']);
      const lt = sf.leitung[f.gid], le = g.leitung || {}, leitung = lt ? `${lt.w.t} ${le.typ || 'NYM-J'} ${lt.adern}×${le.quer || '1,5'}` : '';
      const zeilen = nrn.map((nr, i) => {
        ader[f.gid] = (ader[f.gid] || 0) + 1;
        return [String(nr), ml && i ? 'N' : '', ml && i ? (v.nKlemme === 'normal' ? 'N-Klemme' : 'N-Trennklemme') : 'Durchgangsklemme',
          'Steuerstromkreis' + (sg ? ' ' + sg.schalt.bmk.t : ''), leitung, String(ader[f.gid]),
          `${kz}:${an[i]} ${[g.bez, g.ort].filter(Boolean).join(', ')}`.trim()];
      });
      bloecke.push({ kenn: kz, leiste: '-X1', zeilen });
    });
    return bloecke;
  }
  let hilfK = { name: () => '' };
  // Blöcke auf Blätter verteilen; ein Abgang wird nicht geteilt
  function klemmenBlaetter(bloecke, F) {
    const max = Math.floor((F.h - RAND - SF_H - 4 - KL_Y0 - KL_ZH) / KL_ZH);
    const bl = []; let cur = null, n = 0;
    for (const b of bloecke) {
      if (!cur || n + b.zeilen.length > max) { cur = []; bl.push(cur); n = 0; }
      cur.push(b); n += b.zeilen.length;
    }
    return bl;
  }
  function zeichneKlemmenplan(g, F, v, bloecke, teil, teile, leiste = '-X1') {
    const x0 = RAND_L, x1 = F.w - RAND, w = x1 - x0 - 20, xa = x0 + 10;
    text(g, xa, RAND + 13, `Klemmenplan ${leiste} · ${v.name}` + (teile > 1 ? ` (${teil + 1}/${teile})` : ''), 6, 'start', { 'font-weight': 'bold' });
    const sp = [['Klemme', 0.07], ['Leiter', 0.07], ['Klemmenart', 0.15], ['intern', 0.12], ['Leitung', 0.2], ['Ader', 0.07], ['Ziel', 0.32]];
    const xs = []; let x = xa; sp.forEach(([, a]) => { xs.push(x); x += w * a; });
    const zeile = (yy, werte, kopf) => werte.forEach((t, i) =>
      passend(text(g, xs[i] + 1, yy - 1.5, t, kopf ? 2.5 : 3, 'start', kopf ? { fill: '#444' } : {}), w * sp[i][1] - 2.5));
    zeile(KL_Y0 + KL_ZH, sp.map(s => s[0]), true);
    linie(g, xa, KL_Y0 + KL_ZH, xa + w, KL_Y0 + KL_ZH, 0.5);
    let y = KL_Y0 + KL_ZH;
    bloecke.forEach((b, bi) => {
      b.zeilen.forEach((z, i) => {
        y += KL_ZH; zeile(y, z, false);
        const letzte = i === b.zeilen.length - 1;
        linie(g, xa, y, xa + w, y, letzte ? 0.35 : 0.18, letzte ? '#000' : '#aaa');
      });
    });
  }

  // ---- Steuerstromkreise (Etappe C) ---------------------------------------
  // Je Schaltgerät ein Kreis, jeder Pfad belegt eine Spalte des Rahmens. Oben L,
  // unten N als Schienen über die Pfade des Kreises, links mit kommendem
  // Querverweis vom Abgriff im Abgang. Je Pfad 6 Kontaktplätze und darunter ein
  // Verbraucherplatz (Spule, Meldeleuchte); unter der N-Schiene der Kontaktspiegel.
  const ST_PL = 6, ST_H = 16;                       // Kontaktplätze, Platzhöhe in mm
  const ST_YL = RAND + 16;                          // L-Schiene
  const stB = i => ST_YL + 3 + i * ST_H;            // obere Grenze von Platz i
  const ST_YV = stB(ST_PL) + 2, ST_YN = ST_YV + 16; // oberer Anschluss des Verbrauchers, N-Schiene
  const SPULE = { schuetz: 'spule', stromstoss: 'stromstoss' };
  const spulenZeichen = sg => sg.typ === 'zeitrelais' ? 'spule_' + ((sg.zr && sg.zr.fkt) || 'aus') : SPULE[sg.typ];
  // Platz links (Kennzeichen) und rechts (Anschlussnummern) vom Leiter in mm.
  // Der Rahmen der Definition ist bei Baukasten-Zeichen breiter als die Zeichnung,
  // daher links höchstens 11 mm; rechts liegt bei Kontakten nichts außer dem Leiter.
  const ST_RECHTS = { spule: 6.5, spule_ein: 6.5, spule_aus: 6.5, spule_einaus: 6.5, stromstoss: 4, meldeleuchte: 3 };
  function seiten(kennung) {
    const x = ZEICHEN[kennung].xml, hs = /hotspot_x="([\d.]+)"/.exec(x);
    const li = kennung === 'meldeleuchte' ? 3 : hs ? Math.min(+hs[1] * E, 11) : 5;
    return [li, ST_RECHTS[kennung] || 1.4];
  }
  const ST_LINKS = 19;                              // Pfad in der Spalte: Platz links für Kennzeichen und Text
  const stKnoten = (v, kid) => { let r = null; const such = l => l.forEach(k => { if (k.id === kid) r = k; if (k.kinder) such(k.kinder); }); such(v.knoten); return r; };
  // Kreise auf Blätter verteilen; ein Kreis wird nicht geteilt. Bei gemeinsamer
  // Steuerspannung stehen die daran hängenden Kreise vorn, Kreise mit eigenem Abgriff dahinter.
  function stPlane(v, F, e) {
    const gem = e.steuer && e.steuer.gemeinsam, istGem = kr => !!gem && gem.kreise.includes(kr.id);
    const alle = ((v.steuerung && v.steuerung.kreise) || []).filter(kr => kr.pfade.length && e.steuer && e.steuer.aktiv[kr.id]);
    const kreise = alle.filter(istGem).concat(alle.filter(kr => !istGem(kr)));
    const bl = []; let cur = null, col = 1;
    for (const kr of kreise) {
      const w = kr.pfade.length;
      if (!cur || (col + w - 1 > F.sp && cur.kreise.length)) { cur = { kreise: [] }; bl.push(cur); col = 1; }
      cur.kreise.push({ kr, col, gem: istGem(kr) }); col += w;
    }
    return bl;
  }
  // Lage aller Spulen, Kontakte und Kreise für die Querverweise; '*' ist der Anfang
  // der gemeinsamen Steuerspannung
  function stLagen(p, st) {
    p.st.forEach((b, i) => b.kreise.forEach(({ kr, col, gem }) => {
      st.kreise[kr.id] = { blatt: p.stStart + i, spalte: col };
      if (gem && !st.kreise['*']) st.kreise['*'] = { blatt: p.stStart + i, spalte: 1 };
      kr.pfade.forEach((pf, j) => {
        const lg = { blatt: p.stStart + i, spalte: col + j };
        pf.plaetze.forEach((pl, n) => { if (pl) st.kontakte[pf.id + ':' + n] = lg; });
        if (pf.verbraucher) st.spulen[pf.verbraucher.g] = lg;
      });
    }));
  }
  // Name des Außenleiters, den ein Abgang als Steuerspannung liefert
  const stLeiter = (v, a) => !a ? 'L' : v.leiter === '1NPE' ? 'L' : a.drei ? 'L1' : (a.phase.t || 'L1');
  // Leiter der Steuerspannung einer Quelle: beim Steuertrafo „24 V“ und „0 V“ (schwarz, kein N),
  // Schutzorgan ist dann der Sekundär-LS
  function stQuelle(v, e, kid) {
    const a = kid && e.abgaenge[kid], k = kid && stKnoten(v, kid);
    if (k && k.trafo) return { a, lName: `${k.trafo.sek} V`, nArt: 'M', nName: '0 V', f: a && a.f2 };
    return { a, lName: stLeiter(v, a), nArt: 'N', nName: 'N', f: a && a.f };
  }
  // Lage der L- und N-Leitung: bei gebrückten Klemmen liegt die gemeinsame Leitung
  // eine Klemmenhöhe (5 mm) über bzw. unter dem Pfad
  const ST_KL = 5;
  function stSchienen(bruecke) { return { yL: bruecke ? ST_YL - ST_KL : ST_YL, yN: bruecke ? ST_YN + ST_KL : ST_YN }; }

  // ein Blatt Steuerstromkreise
  function stBlatt(g, ctx, v, e, b, R, F, blattNr, letztesGem) {
    const segs = [];
    const lt = (x1, y1, x2, y2, art, unsichtbar) => {
      if (Math.abs(x1 - x2) + Math.abs(y1 - y2) < 0.01) return;
      if (!unsichtbar) leiter(g, x1, y1, x2, y2, art);
      segs.push({ x1, y1, x2, y2, art });
    };
    const gem = e.steuer && e.steuer.gemeinsam;
    const anG = { L: [], N: [] };                    // Anschlüsse an die gemeinsame Leitung
    b.kreise.forEach(({ kr, col, gem: g1 }) => stKreis(g, ctx, v, e, kr, col, R, lt, g1 ? gem : null, anG));
    // gemeinsame L- und N-Leitung über die Kreise; geht es auf dem nächsten Blatt
    // weiter, bis an den rechten Rand mit gehendem Querverweis
    if (b.kreise.some(k => k.gem)) {
      const { yL, yN } = stSchienen(gem.art === 'bruecke');
      const qu = stQuelle(v, e, gem.quelle), lName = qu.lName, xA = R.x0 + 7, la = ctx.lage[gem.quelle];
      const erstes = ctx.steuer.kreise['*'] && ctx.steuer.kreise['*'].blatt === blattNr;
      const weiter = blattNr < letztesGem, xE = R.x1 - 12;
      [[yL, lName, anG.L], [yN, qu.nArt, anG.N]].forEach(([y, art, an]) => {
        lt(xA, y, weiter ? xE : Math.max(...an), y, art);
        setze(g, 'qv_kommend', xA, y, t => t.richtung === 'e', art);
        if (weiter) { setze(g, 'qv_gehend', xE, y, t => t.richtung === 'w', art); text(g, xE + 4.5, y + 0.9, `/${blattNr + 1}.1`, 2.2); }
      });
      const ref = erstes ? (la ? `/${la.blatt}.${la.spalte}` : '') : `/${blattNr - 1}.${F.sp}`;
      text(g, xA - 4.5, yL - 1.6, [lName, erstes && qu.f ? qu.f.t : '', ref].filter(Boolean).join(' '), 2.2);
      text(g, xA - 4.5, yN + 3.4, [qu.nName, ref].join(' '), 2.2);
    }
    // Verbindungspunkte, wo drei oder mehr Linien zusammentreffen
    const nah = (p, q) => Math.abs(p - q) < 0.01;
    const pkt = [];
    segs.forEach(s => [[s.x1, s.y1], [s.x2, s.y2]].forEach(([px, py]) => { if (!pkt.some(q => nah(q[0], px) && nah(q[1], py))) pkt.push([px, py, s.art]); }));
    pkt.forEach(([px, py, art]) => {
      let n = 0, mitN = false;    // Farbe des Punkts: N, wenn eine N-Leitung beteiligt ist
      segs.forEach(s => {
        const ende = (nah(s.x1, px) && nah(s.y1, py)) || (nah(s.x2, px) && nah(s.y2, py));
        const innen = !ende && (nah(s.x1, s.x2) ? nah(s.x1, px) && py > Math.min(s.y1, s.y2) && py < Math.max(s.y1, s.y2)
          : nah(s.y1, s.y2) && nah(s.y1, py) && px > Math.min(s.x1, s.x2) && px < Math.max(s.x1, s.x2));
        n += ende ? 1 : innen ? 2 : 0;
        if ((ende || innen) && s.art === 'N') mitN = true;
      });
      if (n >= 3) punkt(g, px, py, mitN ? 'N' : art);
    });
  }
  // ein Kreis; lt zeichnet Leitungen (für die Verbindungspunkte gesammelt). gem: gemeinsame
  // Steuerspannung, dann ohne eigene Schienen, Anschlüsse in anG (bei Brücke über Klemmen)
  function stKreis(g, ctx, v, e, kr, col, R, lt, gem, anG) {
    const pf = kr.pfade, xs = pf.map((_, j) => R.x0 + (col - 1 + j) * R.sb + ST_LINKS);
    const xA = R.x0 + (col - 1) * R.sb + 7;        // Schienenanfang (kommender Querverweis)
    const haupt = pf.map((_, j) => { let h = j; while (h > 0 && pf[h].zweig) h--; return h; });
    const zweig = j => j > 0 && pf[j].zweig ? pf[j].zweig : null;
    // Quelle: eigener Abgriff im Abgang oder gemeinsame Steuerspannung
    const kid = gem ? gem.quelle : kr.quelle && kr.quelle.art === 'abgang' ? kr.quelle.kid : null;
    const qu = stQuelle(v, e, kid), la = kid && ctx.lage[kid];
    const ref = la ? `/${la.blatt}.${la.spalte}` : '';
    const lName = qu.lName, nArt = qu.nArt;
    const st = e.steuer || { geraete: {}, kontakte: {} }, kl = gem && gem.klemmen;
    const { yN } = stSchienen(!!kl);
    // Überschrift: Schaltgerät und Abgang
    const sgK = pf.map(p => p.verbraucher && e.abgaenge[p.verbraucher.g]).find(x => x && x.schalt);
    const k = sgK ? stKnoten(v, pf.find(p => p.verbraucher && e.abgaenge[p.verbraucher.g] === sgK).verbraucher.g) : kr.quelle && stKnoten(v, kr.quelle.kid);
    const gerVon = id => (v.steuerung.geraete || []).find(d => d.id === id);
    const vG = !sgK && pf.map(p => p.verbraucher && gerVon(p.verbraucher.g)).find(Boolean);   // Kreis ohne Schaltgerät
    const titel = kr.name || (sgK && k ? [k.ziel.bez, k.ziel.ort].filter(Boolean).join(' ') : vG ? [vG.bez, vG.ort].filter(Boolean).join(' ') : '');
    passend(text(g, xA - 4, RAND + 6, [sgK ? sgK.schalt.bmk.t : vG && st.geraete[vG.id] ? st.geraete[vG.id].t : '', titel].filter(Boolean).join(' '), 2.5, 'start', { 'font-weight': 'bold' }),
      pf.length * R.sb - 4);     // nicht in den nächsten Kreis hinein
    const anN = pf.map((p, j) => !zweig(j) || zweig(j).bis >= ST_PL);
    if (!gem) {
      // eigene Schienen bis zum letzten angeschlossenen Pfad
      const xLe = Math.max(...xs.filter((_, j) => !zweig(j))), xNe = Math.max(...xs.filter((_, j) => anN[j]));
      lt(xA, ST_YL, xLe, ST_YL, lName); lt(xA, ST_YN, xNe, ST_YN, nArt);
      setze(g, 'qv_kommend', xA, ST_YL, t => t.richtung === 'e', lName);
      setze(g, 'qv_kommend', xA, ST_YN, t => t.richtung === 'e', nArt);
      text(g, xA - 4.5, ST_YL - 1.6, [lName, qu.f ? qu.f.t : '', ref].filter(Boolean).join(' '), 2.2);
      text(g, xA - 4.5, ST_YN + 3.4, [qu.nName, ref].filter(Boolean).join(' '), 2.2);
    }
    // Anschluss an die gemeinsame Leitung: durchgeschliffen direkt, sonst über eine Klemme
    const klemme = (x, yOben, nr, art, erste) => {
      // N-Klemme: blau erst ab dem Klemmpunkt, der obere Anschlussstrich gehört zur schwarzen Leitung
      const oben = gz => { if (art === 'N') for (const l of gz.querySelectorAll('line'))
        if (Math.max(+l.getAttribute('y1'), +l.getAttribute('y2')) <= 0) l.setAttribute('stroke', '#000'); };
      setze(g, 'klemme', x, yOben, null, art, 1, oben);
      lt(x, yOben, x, yOben + ST_KL, art, true);   // für die Verbindungspunkte
      text(g, x + 1.8, yOben + 3.3, String(nr), 1.8);
      if (erste) text(g, x - 2, yOben + 3.5, kl.bmk, 2.5, 'end', { 'font-weight': 'bold' });
    };
    // Klemme eines Feldgeräts auf -X1: kleiner Kreis im Leiter, Nummer links daneben
    const feldKlemme = (x, y, nr, rechts = false) => {     // rechts: am Verbraucher, links steht dort dessen Beschriftung
      el('circle', { cx: x, cy: y, r: 0.625, fill: '#fff', stroke: '#000', 'stroke-width': 0.25 }, g);
      text(g, x + (rechts ? 1.1 : -1.1), y + 0.7, `X1:${nr}`, 1.8, rechts ? 'start' : 'end');
    };
    const leitungText = gid => st.leitung && st.leitung[gid] ? st.leitung[gid].w.t : '';
    pf.forEach((p, j) => {
      const x = xs[j], zw = zweig(j);
      const von = zw ? zw.von : 0, bis = zw ? zw.bis : ST_PL;
      let y = zw ? stB(von) : ST_YL;
      if (zw) lt(xs[haupt[j]], y, x, y, lName);
      else if (gem) {
        anG.L.push(x);
        if (kl) klemme(x, ST_YL - ST_KL, kl.l[p.id], lName, !anG.L.slice(0, -1).length);
      }
      for (let i = von; i <= Math.min(bis, ST_PL - 1); i++) {
        const pl = p.plaetze[i]; if (!pl) continue;
        const sa = e.abgaenge[pl.g], ger = !sa && gerVon(pl.g);
        const z = pl.z || (ger && ger.zeichen); if (!z || !ZEICHEN[z]) continue;
        const top = stB(i) + 0.5; lt(x, y, x, top, lName);
        const t = setze(g, z, x, top);
        const u = t.filter(q => q.richtung === 's').sort((p1, p2) => Math.abs(p1.x - x) - Math.abs(p2.x - x))[0];
        y = u ? u.y : top + 15;
        const [li, re] = seiten(z), kn = st.kontakte[p.id + ':' + i];
        let an;
        const relais = sa && sa.schalt ? sa.schalt.bmk.t : ger && ger.zeichen === 'zeitrelais' && st.geraete[ger.id] ? st.geraete[ger.id].t : null;
        if (relais) {            // Kontakt eines Schaltgeräts oder eigenständigen Zeitrelais mit Verweis auf die Spule
          const sp = ctx.steuer.spulen[pl.g];
          bmk(g, x - li - 1, top + 5, relais, [sp ? `/${sp.blatt}.${sp.spalte}` : '']);
          an = kn ? kn.an : ['', ''];
        } else {
          const kz = ger && st.geraete[ger.id] ? st.geraete[ger.id].t : '', zl = ger ? [ger.bez, ger.ort, st.feld && st.feld[p.id + ':' + i] ? leitungText(ger.id) : ''] : [];
          if (/^(daemmerung|bewegung|praesenz)$/.test(z)) {     // Melder: links sitzt der Sensorkasten, Beschriftung rechts
            text(g, x + 2.5, top + 6, kz, 2.5, 'start', { 'font-weight': 'bold' });
            zl.filter(Boolean).forEach((s, n) => text(g, x + 2.5, top + 9.2 + 2.8 * n, s, 2.2, 'start'));
          } else bmk(g, x - li - 1, top + 5, kz, zl);
          an = kn ? kn.an : /_oe|notaus/.test(z) ? ['11', '12'] : ['13', '14'];
        }
        text(g, x + re + 0.8, top + 2.2, an[0], 1.8); text(g, x + re + 0.8, y - 0.6, an[1], 1.8);
        const fk = st.feld && st.feld[p.id + ':' + i];
        if (fk) { feldKlemme(x, top + 1.2, fk[0]); feldKlemme(x, y - 1.2, fk[1]); }
      }
      if (bis >= ST_PL) {
        const vb = p.verbraucher, sa = vb && e.abgaenge[vb.g];
        const ger = vb && !sa && gerVon(vb.g);
        const zr = ger && ger.zeichen === 'zeitrelais';         // eigenständiges Zeitrelais
        const z = sa && sa.schalt ? spulenZeichen(sa.schalt) : zr ? 'spule_' + (ger.fkt || 'aus') : ger ? ger.zeichen : null;
        if (z && ZEICHEN[z]) {
          lt(x, y, x, ST_YV, lName);
          const t = setze(g, z, x, ST_YV);
          const u = t.find(q => q.richtung === 's'); y = u ? u.y : ST_YV + 10;
          const [li, re] = seiten(z);
          if (sa) {
            const sg = sa.schalt;
            bmk(g, x - li - 1, ST_YV + 4, sg.bmk.t, [sg.typ === 'zeitrelais' && sg.zr.zeit ? `t = ${sg.zr.zeit}` : '']);
            stSpiegel(g, ctx, e, vb.g, x, yN + 4);
          } else if (zr) {
            bmk(g, x - li - 1, ST_YV + 4, st.geraete[ger.id] ? st.geraete[ger.id].t : '', [ger.zeit ? `t = ${ger.zeit}` : '']);
            stSpiegel(g, ctx, e, vb.g, x, yN + 4, ger);
          } else bmk(g, x - li - 1, ST_YV + 4, ger && st.geraete[ger.id] ? st.geraete[ger.id].t : '', ger ? [ger.bez, ger.ort, st.feld && st.feld[p.id + ':v'] ? leitungText(ger.id) : ''] : []);
          text(g, x + re + 0.8, ST_YV + 2.2, sa || zr ? 'A1' : 'X1', 1.8); text(g, x + re + 0.8, y - 0.6, sa || zr ? 'A2' : 'X2', 1.8);
          const fk = st.feld && st.feld[p.id + ':v'];
          if (fk) { feldKlemme(x, ST_YV - 1.6, fk[0], true); feldKlemme(x, y + 1.6, fk[1], true); }
        }
        // Leitung vom Verbraucher bis zum Abzweig bzw. zur Klemme schwarz; blau ist nur die N-Leitung
        lt(x, y, x, ST_YN, lName);
        if (gem) { anG.N.push(x); if (kl) klemme(x, ST_YN, kl.n[p.id], nArt, anG.N.length === 1); }
      } else {
        const yb = stB(bis + 1);
        lt(x, y, x, yb, lName); lt(x, yb, xs[haupt[j]], yb, lName);
      }
    });
  }
  // Kontaktspiegel unter der Spule: Hauptkontakte, dann alle Hilfskontakte der
  // Ausstattung; genutzte mit Querverweis, ungenutzte ohne
  // ger: eigenständiges Zeitrelais (ohne Hauptkontakte, nur verzögerte Kontakte)
  function stSpiegel(g, ctx, e, kid, x, y, ger = null) {
    const sg = ger ? { pole: [], hs: ger.hs === undefined ? 1 : ger.hs, ho: ger.ho || 0 } : e.abgaenge[kid].schalt;
    const la = ctx.lage[kid], gen = (e.steuer.genutzt || {})[kid] || { s: [], o: [] };
    const lageText = key => { const l = ctx.steuer.kontakte[key]; return l ? `/${l.blatt}.${l.spalte}` : ''; };
    const haupt = sg.pole.map((_, i) => [`${2 * i + 1}–${2 * i + 2}`, la ? `/${la.blatt}.${la.spalte}` : '']);
    // verzögert (Zeitrelais): Schließer n7–n8, Öffner n5–n6; sonst Hilfskontakte n3–n4, n1–n2
    const vz = key => key ? !!(e.steuer.kontakte[key] || {}).vz : !!ger;
    const hilf = [];
    for (let n = 1; n <= sg.hs; n++) { const k = gen.s[n - 1]; hilf.push([vz(k) ? `${n}7–${n}8` : `${n}3–${n}4`, k ? lageText(k) : '']); }
    for (let n = 1; n <= sg.ho; n++) { const k = gen.o[n - 1], o = sg.hs + n; hilf.push([vz(k) ? `${o}5–${o}6` : `${o}1–${o}2`, k ? lageText(k) : '']); }
    let yy = y + 2.4;
    const zeile = ([nr, r]) => { text(g, x - 1, yy, nr, 2, 'end'); if (r) text(g, x + 1, yy, r, 2); yy += 2.8; };
    haupt.forEach(zeile);
    if (hilf.length) { if (haupt.length) { linie(g, x - 7, yy - 1.6, x + 7, yy - 1.6, 0.18); yy += 0.6; } hilf.forEach(zeile); }
    linie(g, x, y, x, yy - 1.8, 0.18);
  }

  // ---- Deckblatt und Inhaltsverzeichnis -----------------------------------
  const INH_Y0 = 30, INH_ZH = 6;     // erste Tabellenzeile (Kopf) und Zeilenhöhe in mm
  function zeichneDeckblatt(g, F, P, namen) {
    const f = P.projekt, s = F.w / 297, x0 = RAND_L, x1 = F.w - RAND, cx = (x0 + x1) / 2;
    const y0 = RAND, y1 = F.h - RAND - SF_H, hh = y1 - y0, breit = (x1 - x0) - 30;
    const y = t => y0 + hh * t;
    if (f.firma) passend(text(g, cx, y(0.16), f.firma, 4.5 * s, 'middle', { 'font-weight': 'bold' }), breit);
    passend(text(g, cx, y(0.33), f.projekt || 'Projekt', 10 * s, 'middle', { 'font-weight': 'bold' }), breit);
    passend(text(g, cx, y(0.44), f.titel || 'Stromlaufplan', 7 * s, 'middle'), breit);
    passend(text(g, cx, y(0.53), (namen.length > 1 ? 'Verteiler: ' : 'Verteiler ') + namen.join(' · '), 4.5 * s, 'middle'), breit);
    linie(g, cx - 60 * s, y(0.59), cx + 60 * s, y(0.59));
    const daten = [['Firma', f.firma], ['Anschrift', f.anschrift], ['Erstellt durch', f.ersteller], ['Ausgabedatum', datumDE(f.datum)],
                   ['Zeichnungsnummer', f.nummer], ['Revision', f.rev]].filter(d => d[1]);
    const xl = cx - 55 * s, xw = cx - 12 * s, zh = 6.2 * s;
    daten.forEach(([t, w], i) => {
      const yy = y(0.66) + i * zh;
      text(g, xl, yy, t, 3 * s, 'start', { fill: '#444' });
      passend(text(g, xw, yy, w, 3.5 * s), cx + 70 * s - xw);
    });
    // Namensnennung nach CC BY 3.0 für die verwendeten Schaltzeichen
    passend(text(g, cx, y1 - 3, 'Schaltzeichen: Elementsammlung von QElectroTech (The QElectroTech team und Mitwirkende), '
      + 'lizenziert unter CC BY 3.0 (creativecommons.org/licenses/by/3.0); teils daraus zusammengesetzt.', 2 * s, 'middle'), breit);
  }
  function zeichneInhalt(g, F, P, eintraege, teil, teile) {
    const x0 = RAND_L, x1 = F.w - RAND, w = x1 - x0 - 20, xa = x0 + 10;
    text(g, xa, RAND + 13, 'Inhaltsverzeichnis' + (teile > 1 ? ` (${teil + 1}/${teile})` : ''), 6, 'start', { 'font-weight': 'bold' });
    const spalten = [['Blatt', 0.1], ['Verteiler', 0.25], ['Inhalt', 0.53], ['Revision', 0.12]];
    const xs = []; let x = xa; spalten.forEach(([, a]) => { xs.push(x); x += w * a; });
    const zeile = (yy, werte, kopf) => werte.forEach((t, i) => {
      const max = w * spalten[i][1] - 3;
      passend(text(g, xs[i] + 1, yy - 1.8, t, kopf ? 2.5 : 3.2, 'start', kopf ? { fill: '#444' } : {}), max);
    });
    zeile(INH_Y0 + INH_ZH, spalten.map(s => s[0]), true);
    linie(g, xa, INH_Y0 + INH_ZH, xa + w, INH_Y0 + INH_ZH, 0.5);
    eintraege.forEach((e, i) => {
      const yy = INH_Y0 + INH_ZH * (i + 2);
      zeile(yy, [String(e.nr), e.verteiler, e.inhalt, P.projekt.rev || ''], false);
      linie(g, xa, yy, xa + w, yy, 0.25, '#999');
    });
  }

  // ---- Blätter zeichnen ---------------------------------------------------
  // opt.ziele (ab v1.17, Plan-Editor): unsichtbare Antippflächen mit data-ziel über
  // Einspeisung (e:), Abgängen und Gruppen (k:), Überspannungsschutz (s:) und Steuerstromkreisen (kr:)
  const ziel = (g, x, y, w, h, id) => el('rect', { x, y, width: w, height: h, fill: 'transparent', class: 'ziel', 'data-ziel': id }, g);
  // Einfügemarke „+“ (ab v1.18): vor:id / nach:id an einem Abgang bzw. einer Gruppe, in:id in einer leeren Gruppe
  function marke(g, x, y, id) {
    const m = el('g', { class: 'marke', 'data-ziel': id }, g);
    el('circle', { cx: x, cy: y, r: 6, fill: 'transparent', class: 'treffer' }, m);     // Trefferfläche (ab v1.21)
    el('circle', { cx: x, cy: y, r: 3.2, fill: '#fff', stroke: '#1f5fbf', 'stroke-width': 0.45 }, m);
    linie(m, x - 1.8, y, x + 1.8, y, 0.5, '#1f5fbf'); linie(m, x, y - 1.8, x, y + 1.8, 0.5, '#1f5fbf');
  }
  let letzteGruppeYK = 0;   // Oberkante der Abgänge in der zuletzt gezeichneten Gruppe
  function blaetter(P, BIB, hilf, opt = {}) {
    ZEICHEN = Object.fromEntries(BIB.zeichen.map(z => [z.kennung, z]));
    const F = FORMATE[P.projekt.format || 'A4'];
    const R = rahmen(el('g'), F);
    // 1. Durchgang: Blätter je Verteiler planen (Probezeichnen für die Tiefe)
    const plaene = P.verteiler.map(v => {
      const e = hilf.berechne(v);
      const probe = (it, y0) => {
        const g = el('g'); const bars = {}; schienenNamen(v).forEach((n, i) => bars[n] = y0 + ABSTAND * i);
        const yG = y0 + ABSTAND * (schienenNamen(v).length - 1) + VOR_GERAET;
        const ctx = { verteiler: {} };
        if (it.art === 'spd') return zeichneSpd(g, v, e, 0, bars, yG);
        if (it.art === 'abgang') return zeichneAbgang(g, ctx, v, it.k, e.abgaenge[it.k.id], 0, bars, yG, it.w * R.sb).unten;
        return zeichneGruppe(g, ctx, v, e, it.k, 0, bars, yG, it.w, R, F.h - RAND - SF_H - 24);
      };
      return { v, e, blaetter: planeVerteiler(v, e, F, R, probe), st: stPlane(v, F, e) };
    });
    zuBegrenzen.length = 0;      // Texte aus dem Probezeichnen verwerfen
    // Blattnummern durchgehend; Einspeisungsspalte jedes Verteilers für Querverweise
    // Deckblatt und Inhaltsverzeichnis vorneweg (P.projekt.deckblatt === false schaltet ab)
    const mitVorn = P.projekt.deckblatt !== false && plaene.length > 0;
    // Übersichtsschaltplan je Verteiler planen
    const mitUe = P.projekt.uebersicht !== false;
    plaene.forEach(p => { p.ue = mitUe ? ueplane(p.v, p.e, F, R) : []; });
    const ueZahl = plaene.reduce((s, p) => s + p.ue.length, 0);
    // Klemmenplan je Verteiler mit Klemmleiste
    const mitKl = P.projekt.klemmenplan !== false;
    hilfK = { name: id => (P.verteiler.find(x => x.id === id) || {}).name };
    // je Klemmleiste (-X1, ggf. eigene Leiste der Steuerspannung) eigene Blätter
    plaene.forEach(p => {
      p.kl = [];
      if (!mitKl) return;
      const alle = klemmenBloecke(p.v, p.e);
      [...new Set(alle.map(b => b.leiste))].forEach(leiste => klemmenBlaetter(alle.filter(b => b.leiste === leiste), F)
        .forEach((bl, i, arr) => p.kl.push({ leiste, bloecke: bl, teil: i, teile: arr.length })));
    });
    const klZahl = plaene.reduce((s, p) => s + p.kl.length, 0);
    const planZahl = ueZahl + klZahl + plaene.reduce((s, p) => s + p.blaetter.length + p.st.length, 0);
    const zProBlatt = Math.floor((F.h - RAND - SF_H - 4 - INH_Y0 - INH_ZH) / INH_ZH);
    let nInhalt = 0;
    if (mitVorn) { nInhalt = 1; while (Math.ceil((planZahl + 1 + nInhalt) / zProBlatt) > nInhalt) nInhalt++; }
    const vorn = mitVorn ? 1 + nInhalt : 0;
    let nr = vorn; const ctx = { verteiler: {}, ue: {} };
    const spalteVon = x => Math.min(F.sp, Math.floor((x - R.x0) / R.sb) + 1);
    const lageUe = {};
    for (const p of plaene) {
      p.ueStart = nr + 1; nr += p.ue.length;
      if (!p.ue.length) continue;
      ctx.ue[p.v.id] = { name: p.v.name, blatt: p.ueStart, spalte: spalteVon(R.x0 + UE_FEED_X) };
      p.ue.forEach((b, i) => b.items.forEach(it => {
        if (it.art === 'abgang') lageUe[it.k.id] = { blatt: p.ueStart + i, spalte: spalteVon(it.x) };
        if (it.art === 'gruppe') it.k.kinder.filter(k => k.typ === 'abgang').forEach((k, j) =>
          lageUe[k.id] = { blatt: p.ueStart + i, spalte: spalteVon(it.x + R.sb / 2 * j) });
      }));
    }
    for (const p of plaene) {
      p.start = nr + 1; nr += p.blaetter.length;
      ctx.verteiler[p.v.id] = { name: p.v.name, blatt: p.start, spalte: p.blaetter[0].art === 'einspeisung' ? 2 : 1 };
      p.stStart = nr + 1; nr += p.st.length;     // Steuerstromkreise direkt hinter dem Stromlaufplan des Verteilers
    }
    for (const p of plaene) { p.klStart = nr + 1; nr += p.kl.length; }
    const gesamt = nr;
    // Lage der Abgänge (für Querverweise vom Unterverteiler zurück)
    const lage = {};
    plaene.forEach(p => p.blaetter.forEach((b, i) => b.items.forEach(it => {
      if (it.art === 'abgang') lage[it.k.id] = { blatt: p.start + i, spalte: it.col };
      if (it.art === 'gruppe') { let c = it.col; it.k.kinder.forEach(k => { if (k.typ !== 'abgang') return; lage[k.id] = { blatt: p.start + i, spalte: c };
        c += abgangSpalten(k, p.e.abgaenge[k.id], p.v, R); }); }
    })));
    ctx.lage = lage; ctx.steuer = { kreise: {}, kontakte: {}, spulen: {} };
    plaene.forEach(p => stLagen(p, ctx.steuer));
    // 2. Durchgang: zeichnen
    const aus = [];
    const neuesBlatt = () => {
      const svg = el('svg', { viewBox: `0 0 ${F.w} ${F.h}`, width: `${F.w}mm`, height: `${F.h}mm` });
      el('rect', { x: 0, y: 0, width: F.w, height: F.h, fill: '#fff' }, svg);
      const g = el('g', {}, svg); rahmen(g, F); return { svg, g };
    };
    if (mitVorn) {
      // Inhalt je Planblatt: Einspeisung und Bereich der Kennzeichen
      const eintraege = [{ nr: 1, verteiler: '', inhalt: 'Deckblatt' }];
      for (let i = 0; i < nInhalt; i++) eintraege.push({ nr: 2 + i, verteiler: '', inhalt: 'Inhaltsverzeichnis' });
      plaene.forEach(p => p.ue.forEach((b, i) => eintraege.push({ nr: p.ueStart + i, verteiler: p.v.name,
        inhalt: 'Übersichtsschaltplan' + (i ? ' (Fortsetzung)' : '') })));
      plaene.forEach(p => p.blaetter.forEach((b, i) => {
        const kz = []; let spd = '';
        b.items.forEach(it => {
          if (it.art === 'spd') spd = 'Überspannungsschutz' + (p.e.kopf.spd ? ' ' + p.e.kopf.spd.t : '');
          else if (it.art === 'abgang') { const f = p.e.abgaenge[it.k.id].f; if (f) kz.push(f.t); }
          else { if (p.e.geraete[it.k.id]) kz.push(p.e.geraete[it.k.id].t);
            it.k.kinder.forEach(c => { const a = p.e.abgaenge[c.id]; if (a && a.f) kz.push(a.f.t); }); }
        });
        const ber = kz.length ? ' ' + (kz.length > 1 ? `${kz[0]} … ${kz[kz.length - 1]}` : kz[0]) : '';
        const teile = [];
        if (b.art !== 'abgang') teile.push('Einspeisung');
        if (spd) teile.push(spd);
        if (kz.length) teile.push('Abgänge' + ber);
        eintraege.push({ nr: p.start + i, verteiler: p.v.name, inhalt: teile.join(', ') });
      }));
      plaene.forEach(p => p.st.forEach((b, i) => {
        const kz = b.kreise.map(({ kr }) => { const pf = kr.pfade.find(x => x.verbraucher && p.e.abgaenge[x.verbraucher.g] && p.e.abgaenge[x.verbraucher.g].schalt);
          if (pf) return p.e.abgaenge[pf.verbraucher.g].schalt.bmk.t;
          const pg = kr.pfade.find(x => x.verbraucher && p.e.steuer.geraete[x.verbraucher.g]);
          return pg ? p.e.steuer.geraete[pg.verbraucher.g].t : null; }).filter(Boolean);
        eintraege.push({ nr: p.stStart + i, verteiler: p.v.name, inhalt: 'Steuerstromkreis' + (kz.length ? ' ' + kz.join(', ') : '') });
      }));
      plaene.forEach(p => p.kl.forEach((b, i) => eintraege.push({ nr: p.klStart + i, verteiler: p.v.name,
        inhalt: 'Klemmenplan ' + b.leiste + (b.teil ? ' (Fortsetzung)' : '') })));
      eintraege.sort((x, y) => x.nr - y.nr);
      const { svg, g } = neuesBlatt();
      zeichneDeckblatt(g, F, P, plaene.map(p => p.v.name));
      schriftfeld(g, F, Object.assign({}, P.projekt, { verteiler: '', blatt: 1, blaetter: gesamt }));
      aus.push({ svg, verteiler: '', titel: 'Deckblatt', nr: 1, art: 'deckblatt' });
      for (let i = 0; i < nInhalt; i++) {
        const { svg, g } = neuesBlatt();
        zeichneInhalt(g, F, P, eintraege.slice(i * zProBlatt, (i + 1) * zProBlatt), i, nInhalt);
        schriftfeld(g, F, Object.assign({}, P.projekt, { verteiler: '', blatt: 2 + i, blaetter: gesamt }));
        aus.push({ svg, verteiler: '', titel: 'Inhaltsverzeichnis', nr: 2 + i, art: 'inhalt' });
      }
    }
    for (const p of plaene) {
      const { v, e } = p, sp = hilf.speisenderAbgang(v.id);
      let herkunft = `Netz ${v.netzform}, ${v.leiter === '3NPE' ? '3/N/PE' : '1/N/PE'}`;
      if (sp) { const l = lageUe[sp.k.id], fz = hilf.berechne(sp.v).abgaenge[sp.k.id].f; herkunft = `von ${sp.v.name}${fz ? ' ' + fz.t : ''}${l ? ` /${l.blatt}.${l.spalte}` : ''}`; }
      p.ue.forEach((b, i) => {
        const blattNr = p.ueStart + i, { svg, g } = neuesBlatt();
        ueZeichne(g, ctx, v, e, F, R, b, i, p.ue.length, herkunft, blattNr);
        schriftfeld(g, F, Object.assign({}, P.projekt, { titel: 'Übersichtsschaltplan', verteiler: v.name, blatt: blattNr, blaetter: gesamt }));
        aus.push({ svg, verteiler: v.name, titel: v.name, nr: blattNr, art: 'uebersicht' });
      });
    }
    for (const p of plaene) {
      const { v, e } = p;
      const sp = hilf.speisenderAbgang(v.id);
      let herkunft = `Netz ${v.netzform}, ${v.leiter === '3NPE' ? '3/N/PE' : '1/N/PE'}`;
      if (sp) { const l = lage[sp.k.id], fz = hilf.berechne(sp.v).abgaenge[sp.k.id].f; herkunft = `von ${sp.v.name}${fz ? ' ' + fz.t : ''}${l ? ` /${l.blatt}.${l.spalte}` : ''}`; }
      p.blaetter.forEach((b, i) => {
        const blattNr = p.start + i, naechstes = i + 1 < p.blaetter.length ? `/${blattNr + 1}.1` : null;
        const { svg, g } = neuesBlatt();
        const xEnde = R.x1 - 12;
        let bars;
        if (b.art === 'einspeisung') {
          const ein = zeichneEinspeisung(g, v, e, R.x0 + R.sb, 16, herkunft);
          const y0 = ein.cursor + 10;
          if (opt.ziele) ziel(g, R.x0, RAND, 3 * R.sb, y0 - RAND, 'e:' + v.id);
          ein.namen.forEach((n, j) => leiter(g, ein.xs[j], ein.enden[j], ein.xs[j], y0 + ABSTAND * j, n));
          zeichneSchienen(g, v, y0, ein.xs, xEnde, null, naechstes, false);
        } else {
          if (b.art === 'kombiniert') {
            const ein = zeichneEinspeisung(g, v, e, R.x0, 14, herkunft);
            ein.namen.forEach((n, j) => leiter(g, ein.xs[j], ein.enden[j], ein.xs[j], b.y0 + ABSTAND * j, n));
            if (opt.ziele) ziel(g, R.x0, RAND, R.sb, b.y0 - RAND, 'e:' + v.id);
            bars = zeichneSchienen(g, v, b.y0, ein.xs, xEnde, null, naechstes, false);
          } else {
            const vorher = `/${blattNr - 1}.${F.sp}`;   // gehender Querverweis des Vorblatts steht in der letzten Spalte
            bars = zeichneSchienen(g, v, b.y0, R.x0 + 15.25, xEnde, vorher, naechstes, true);
          }
          const yG = b.y0 + ABSTAND * (schienenNamen(v).length - 1) + VOR_GERAET;
          // alle Abgänge direkt an den Schienen enden auf gleicher Höhe
          // alle Abgänge enden ganz unten auf einer festen Höhe über dem Schriftfeld
          // (Platz für Steckdose und drei Zeilen Beschriftung)
          const yEnde = F.h - RAND - SF_H - 24;
          for (const it of b.items) {
            const xSp = R.x0 + (it.col - 1) * R.sb;
            if (it.art === 'spd') zeichneSpd(g, v, e, xSp, bars, yG);
            else if (it.art === 'abgang') zeichneAbgang(g, ctx, v, it.k, e.abgaenge[it.k.id], xSp, bars, yG, it.w * R.sb, yEnde);
            else zeichneGruppe(g, ctx, v, e, it.k, xSp, bars, yG, it.w, R, yEnde);
            if (opt.ziele && it.art !== 'spd') {          // Einfügemarken über den Schienen, links und rechts des Teils
              const ym = b.y0 - 5;
              if (it === b.items.find(x => x.art !== 'spd')) marke(g, xSp, ym, 'vor:' + it.k.id);
              marke(g, xSp + it.w * R.sb, ym, 'nach:' + it.k.id);
            }
            if (opt.ziele) {
              const yo = b.y0 + ABSTAND * schienenNamen(v).length, hh = F.h - RAND - SF_H - 2 - yo;
              if (it.art === 'spd') ziel(g, xSp, yo, it.w * R.sb, hh, 's:' + v.id);
              else ziel(g, xSp, yo, it.w * R.sb, hh, 'k:' + it.k.id);
              if (it.art === 'gruppe') {     // Abgänge der Gruppe unterhalb der Untersammelschienen
                let x = xSp; const yk = letzteGruppeYK - 2, kinder = it.k.kinder.filter(c => c.typ === 'abgang');
                kinder.forEach(c => { const w = abgangSpalten(c, e.abgaenge[c.id], v, R) * R.sb;
                  ziel(g, x, yk, w, F.h - RAND - SF_H - 2 - yk, 'k:' + c.id); x += w; });
                // Einfügemarken in der Gruppe, knapp über ihren Abgängen
                x = xSp;
                if (!kinder.length) marke(g, xSp + R.sb / 2, yk - 3, 'in:' + it.k.id);
                kinder.forEach((c, j) => { if (!j) marke(g, x, yk - 3, 'vor:' + c.id);
                  x += abgangSpalten(c, e.abgaenge[c.id], v, R) * R.sb; marke(g, x, yk - 3, 'nach:' + c.id); });
              }
            }
          }
        }
        if (opt.ziele && b.art !== 'einspeisung' && i === p.blaetter.findIndex(x => x.art !== 'einspeisung') && !v.knoten.length)
          marke(g, R.x0 + (b.art === 'kombiniert' ? 1.5 : 0.5) * R.sb, b.y0 - 5, 'leer:' + v.id);      // leerer Verteiler (ab v1.21)
        schriftfeld(g, F, Object.assign({}, P.projekt, { verteiler: v.name, blatt: blattNr, blaetter: gesamt }));
        if (opt.ziele) ziel(g, RAND_L, F.h - RAND - SF_H, F.w - RAND - RAND_L, SF_H, 'p:');
        aus.push({ svg, verteiler: v.name, titel: v.name, nr: blattNr, art: b.art });
      });
      p.st.forEach((b, i) => {
        const blattNr = p.stStart + i, { svg, g } = neuesBlatt();
        stBlatt(g, ctx, v, e, b, R, F, blattNr, p.stStart + Math.max(0, ...p.st.map((x, j) => x.kreise.some(k => k.gem) ? j : -1)));
        if (opt.ziele) b.kreise.forEach(({ kr, col }) => {
          ziel(g, R.x0 + (col - 1) * R.sb, RAND, kr.pfade.length * R.sb, F.h - RAND - SF_H - 2 - RAND, 'kr:' + kr.id);
          // je Pfad die Plätze 1–6 und der Verbraucherplatz (pl:pfad:zeile, Zeile 6 = Verbraucher)
          kr.pfade.forEach((pf, j) => { const x = R.x0 + (col - 1 + j) * R.sb;
            for (let i = 0; i < ST_PL; i++) ziel(g, x, stB(i), R.sb, ST_H, `pl:${pf.id}:${i}`);
            ziel(g, x, stB(ST_PL), R.sb, ST_YN - stB(ST_PL), `pl:${pf.id}:${ST_PL}`); });
        });
        schriftfeld(g, F, Object.assign({}, P.projekt, { titel: 'Steuerstromkreis', verteiler: v.name, blatt: blattNr, blaetter: gesamt }));
        if (opt.ziele) ziel(g, RAND_L, F.h - RAND - SF_H, F.w - RAND - RAND_L, SF_H, 'p:');
        aus.push({ svg, verteiler: v.name, titel: v.name, nr: blattNr, art: 'steuerung', kreise: b.kreise.map(x => x.kr.id) });
      });
    }
    for (const p of plaene) p.kl.forEach((b, i) => {
      const blattNr = p.klStart + i, { svg, g } = neuesBlatt();
      zeichneKlemmenplan(g, F, p.v, b.bloecke, b.teil, b.teile, b.leiste);
      schriftfeld(g, F, Object.assign({}, P.projekt, { titel: 'Klemmenplan', verteiler: p.v.name, blatt: blattNr, blaetter: gesamt }));
      aus.push({ svg, verteiler: p.v.name, titel: p.v.name, nr: blattNr, art: 'klemmen' });
    });
    return { blaetter: aus, format: P.projekt.format || 'A4', begrenzen };
  }
  return { blaetter };
})();
