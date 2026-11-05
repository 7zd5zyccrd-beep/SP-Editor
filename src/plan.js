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
    sichlasttrenn3: 3, lasttrenn3: 3, trenn3: 3, leistung3: 3, zaehler3: 4, zaehler1: 2, spd4: 4, spd2: 2, lasttrenn2: 2, motorschutz3: 3 };
  const LINKS = 14;        // Platz links vom ersten Leiter eines Pfades (Kennzeichen)
  const ABSTAND = 5;       // Leiterabstand = Polabstand
  const VOR_GERAET = 10;
  // Abschluss der Abgänge: Steckdose (und Leuchte) reichen 7,5 mm unter ihren
  // Anschluss; Endklemme und offenes Ende enden genau auf dieser Unterkante
  const UNTERKANTE = 7.5, END_TIEFE = 3.125;   // END_TIEFE: Anschluss bis Unterkante der Endklemme   // von der untersten Schiene bis zum oberen Geräteanschluss
  let ZEICHEN = {}, ZEICHEN_BIB = null;

  // ---- Grundelemente ------------------------------------------------------
  function el(tag, a = {}, eltern) {
    const e = document.createElementNS(NS, tag);
    for (const k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]);
    if (eltern) { eltern.appendChild(e); if (SZ.teil && eltern === SZ.g) SZ.teil.els.push(e); }
    return e;
  }
  // ---- Szene (ab v1.24) -----------------------------------------------------
  // Beim Zeichnen eines Blatts wird mitgeschrieben, was entsteht: Teile (ein Gerät mit seinen Zeichen,
  // Kennzeichen und Beschriftung, Schlüssel wie k:<abgang>/f) mit ihren Anschlüssen, und die Leiter
  // (Linien 0,25 mm außerhalb der Teile) mit ihrer Leiterart. Das SVG bleibt dabei unverändert.
  // Grundlage für freie Lage (Gummiband), Antippen einzelner Geräte, Netze und Prüfungen.
  // Ab v1.27 tragen Leiter einen Schlüssel aus ihrem Ort (Abgang, Gruppe, Einspeisung) und ihrer Reihenfolge
  // darin (k:<id>#3); Verbindungspunkte werden mitgeschrieben, damit sie beim Umlegen eines Leiters folgen.
  const SZ = { g: null, teil: null, teile: null, leiter: null, punkte: null, ort: null, zaehler: null, hinweise: null };
  function szeneStart(g) { Object.assign(SZ, { g, teil: null, teile: {}, leiter: [], punkte: [], ort: null, zaehler: {}, hinweise: [] }); }
  function szeneEnde() { const s = { teile: SZ.teile, leiter: SZ.leiter, punkte: SZ.punkte }; SZ.g = null; SZ.teil = null; SZ.ort = null; return s; }
  function mitOrt(key, f) { const alt = SZ.ort; SZ.ort = key; try { return f(); } finally { SZ.ort = alt; } }
  function teil(key) { SZ.teil = key && SZ.g ? (SZ.teile[key] = SZ.teile[key] || { key, els: [], ports: [] }) : null; }
  // Lage von Hand anwenden (ab v1.26): verschobene Teile um ganze Rasterschritte (2,5 mm) versetzen;
  // Leiter, die an einem ihrer Anschlüsse enden, folgen – gerade, wenn sie fluchten, sonst mit einem
  // rechtwinkligen Knick kurz vor dem Gerät (mehrpolig gestaffelt, damit sich nichts kreuzt)
  const RASTER = 2.5;
  function lageAnwenden(g, lage) {
    const teile = Object.values(SZ.teile).filter(t => lage[t.key] && (lage[t.key][0] || lage[t.key][1]));
    if (!teile.length) return;
    const nah = (a, b) => Math.abs(a - b) < 0.01, ports = [];
    teile.forEach(t => {
      const dx = lage[t.key][0] * RASTER, dy = lage[t.key][1] * RASTER;
      t.d = [dx, dy];
      t.els.forEach(e => { const tr = e.getAttribute('transform'); e.setAttribute('transform', `translate(${dx} ${dy})` + (tr ? ' ' + tr : '')); });
      t.ports.forEach(p => ports.push({ x: p.x, y: p.y, dx, dy, t }));
      t.ports = t.ports.map(p => ({ x: p.x + dx, y: p.y + dy }));
    });
    const an = (x, y) => ports.find(p => nah(p.x, x) && nah(p.y, y));
    // Leiter mit verschobenen Enden: das Mittelstück bleibt in seiner Flucht (dort hängen Abzweige), je
    // verschobenem Ende entsteht ein rechtwinkliger Versatz kurz vor dem Gerät. Der Abstand des Versatzes
    // wird je Gerät und Seite gestaffelt (Rang nach der Lage quer zur Leitung), damit sich nichts kreuzt.
    const betroffen = [];
    SZ.leiter.slice().forEach(l => {
      const a = an(l.x1, l.y1), b = an(l.x2, l.y2);
      if (a || b) betroffen.push({ l, a, b, senk: nah(l.x1, l.x2), A: [l.x1, l.y1], B: [l.x2, l.y2] });
    });
    // Abzweige im Inneren eines Leiters (Enden anderer Leiter)
    const abzweige = q => SZ.leiter.filter(s => s !== q.l).flatMap(s => [[s.x1, s.y1], [s.x2, s.y2]]).filter(([x, y]) => q.senk
      ? nah(x, q.A[0]) && y > Math.min(q.A[1], q.B[1]) + 0.01 && y < Math.max(q.A[1], q.B[1]) - 0.01
      : nah(y, q.A[1]) && x > Math.min(q.A[0], q.B[0]) + 0.01 && x < Math.max(q.A[0], q.B[0]) - 0.01).map(([x, y]) => q.senk ? y : x);
    const enden = [];
    betroffen.forEach(q => [['a', q.a, q.A, q.B], ['b', q.b, q.B, q.A]].forEach(([w, p, E, O]) => {
      if (!p) return;
      const quer = q.senk ? p.dx : p.dy;
      if (!quer) return;
      enden.push({ q, w, p, s: Math.sign((q.senk ? O[1] - E[1] : O[0] - E[0]) || 1), quer });
    }));
    const gruppen = {};
    enden.forEach(n => { const k = n.p.t.key + (n.q.senk ? 'v' : 'h') + n.s; (gruppen[k] = gruppen[k] || []).push(n); });
    Object.values(gruppen).forEach(ns => {
      ns.sort((u, w) => ((u.q.senk ? u.q.A[0] - w.q.A[0] : u.q.A[1] - w.q.A[1]) * (ns[0].quer >= 0 ? 1 : -1)));
      ns.forEach((n, i) => { n.off = RASTER * (1 + i); });
    });
    betroffen.forEach(q => {
      const dA = q.a ? [q.a.dx, q.a.dy] : [0, 0], dB = q.b ? [q.b.dx, q.b.dy] : [0, 0];
      const A2 = [q.A[0] + dA[0], q.A[1] + dA[1]], B2 = [q.B[0] + dB[0], q.B[1] + dB[1]];
      const i = q.senk ? 0 : 1, j = 1 - i;                     // i: Querlage, j: Längslage
      const fl = q.A[i];                                        // Flucht des Leiters
      if (nah(A2[i], fl) && nah(B2[i], fl)) { setzeLinie(q.l, A2, B2); return; }
      const ab = abzweige(q), s = Math.sign(B2[j] - A2[j]) || 1, lang = Math.abs(B2[j] - A2[j]);
      const versatz = (E, w) => {                               // Längslage des Versatzes an Ende E
        const n = enden.find(x => x.q === q && x.w === w), off0 = n ? n.off : RASTER;
        const nahT = ab.map(y => Math.abs(y - E[j])).filter(d => d > 0.01);
        let off = Math.min(off0, lang / (nah(A2[i], fl) || nah(B2[i], fl) ? 1.5 : 3));
        if (nahT.length) off = Math.min(off, Math.min(...nahT) / 2);
        return E[j] + (w === 'a' ? s : -s) * off;
      };
      const P = (quer, laengs) => q.senk ? [quer, laengs] : [laengs, quer];
      const pfad = [A2];
      if (!nah(A2[i], fl)) { const y = versatz(A2, 'a'); pfad.push(P(A2[i], y), P(fl, y)); }
      if (!nah(B2[i], fl)) { const y = versatz(B2, 'b'); pfad.push(P(fl, y), P(B2[i], y)); }
      pfad.push(B2);
      const pk = pfad.filter((pt, k) => k === 0 || !(nah(pt[0], pfad[k - 1][0]) && nah(pt[1], pfad[k - 1][1])));
      // liegt ein Abzweig nicht mehr auf dem Stück in der Flucht, ist er abgetrennt: in die Prüfliste
      const inFlucht = pk.slice(0, -1).map((p0, k) => [p0, pk[k + 1]]).filter(([u, w]) => nah(u[i], fl) && nah(w[i], fl));
      [...new Set(ab.map(y => +y.toFixed(2)))].forEach(y => { if (!inFlucht.some(([u, w]) => y >= Math.min(u[j], w[j]) - 0.01 && y <= Math.max(u[j], w[j]) + 0.01)) {
        const tk = (q.a || q.b).t.key; SZ.hinweise.push({ teil: tk, art: 'abzweig', t: 'Abzweig vom Leiter abgetrennt – Gerät weniger weit verschieben', p: P(fl, y) }); } });
      const farbe = q.l.el.getAttribute('stroke');
      setzeLinie(q.l, pk[0], pk[1]);
      for (let k = 1; k + 1 < pk.length; k++) linie(g, pk[k][0], pk[k][1], pk[k + 1][0], pk[k + 1][1], 0.25, farbe, q.l.art);
    });
  }
  // Leiterwege von Hand (ab v1.27): ein Leiterstück parallel um n Rasterschritte versetzen; an seinen Enden
  // entstehen kurze Querstücke (liegt ein Ende auf einer Schiene, wandert so die Abzweigstelle), die
  // Verbindungspunkte werden an beiden Stellen neu bestimmt (drei oder mehr Linien → Punkt)
  function wegeAnwenden(g, wege) {
    const nah = (a, b) => Math.abs(a - b) < 0.01;
    const zaehle = (x, y) => SZ.leiter.reduce((n, s) => {
      const ende = (nah(s.x1, x) && nah(s.y1, y)) || (nah(s.x2, x) && nah(s.y2, y));
      const innen = !ende && (nah(s.x1, s.x2) ? nah(s.x1, x) && y > Math.min(s.y1, s.y2) + 0.01 && y < Math.max(s.y1, s.y2) - 0.01
        : nah(s.y1, s.y2) && nah(s.y1, y) && x > Math.min(s.x1, s.x2) + 0.01 && x < Math.max(s.x1, s.x2) - 0.01);
      return n + (ende ? 1 : innen ? 2 : 0); }, 0);
    const pruefe = []; 
    SZ.leiter.slice().forEach(l => {
      const w = l.key && wege[l.key]; if (!w || !w.n) return;
      const senk = nah(l.x1, l.x2); if (w.senk !== undefined && w.senk !== senk) return;   // passt nicht mehr: übergehen
      const d = w.n * RASTER, A = [l.x1, l.y1], B = [l.x2, l.y2];
      const A2 = senk ? [A[0] + d, A[1]] : [A[0], A[1] + d], B2 = senk ? [B[0] + d, B[1]] : [B[0], B[1] + d];
      const farbe = l.el.getAttribute('stroke');
      // liegt das Querstück auf einer durchgehenden Linie (Schiene), wird es nicht gezeichnet: die Abzweigstelle wandert
      const aufLinie = (P, Q) => SZ.leiter.some(s => s !== l && (senk ? nah(s.y1, s.y2) && nah(s.y1, P[1]) && Math.min(s.x1, s.x2) <= Math.min(P[0], Q[0]) + 0.01 && Math.max(s.x1, s.x2) >= Math.max(P[0], Q[0]) - 0.01
        : nah(s.x1, s.x2) && nah(s.x1, P[0]) && Math.min(s.y1, s.y2) <= Math.min(P[1], Q[1]) + 0.01 && Math.max(s.y1, s.y2) >= Math.max(P[1], Q[1]) - 0.01));
      const quer = [aufLinie(A, A2), aufLinie(B, B2)];
      setzeLinie(l, A2, B2);
      if (!quer[0]) linie(g, A[0], A[1], A2[0], A2[1], 0.25, farbe, l.art);
      if (!quer[1]) linie(g, B[0], B[1], B2[0], B2[1], 0.25, farbe, l.art);
      pruefe.push([A, l.art], [A2, l.art], [B, l.art], [B2, l.art]);
    });
    pruefe.forEach(([[x, y], art]) => {
      const n = zaehle(x, y), da = SZ.punkte.find(p => nah(p.x, x) && nah(p.y, y));
      if (n >= 3 && !da) punkt(g, x, y, art);
      if (n < 3 && da) { da.el.remove(); SZ.punkte.splice(SZ.punkte.indexOf(da), 1); }
    });
  }
  // Zusätze von Hand (ab v1.28): freie Leiter (Verbinden), Texte und strichpunktierte Rahmen (Beschriften).
  // z = { id, art: 'leiter'|'text'|'rahmen', blatt: Anker, … }; Leiter rechtwinklig von a nach b (knick 'hv'
  // erst waagerecht, 'vh' erst senkrecht) mit Leiterart; danach Verbindungspunkte und die Netzprüfung:
  // verbindet ein Zusatzleiter verschiedene Leiter (L1/L2/L3/N/PE), ist das ein Kurzschluss; ein Ende, das
  // nichts berührt, ist offen. Ergebnis als Liste von Hinweisen am Blatt.
  function zusatzZeichnen(g, liste, opt) {
    if (!liste.length) return [];
    const nah = (a, b) => Math.abs(a - b) < 0.02, hinweise = [];
    liste.filter(z => z.art === 'rahmen').forEach(z => {
      const x = Math.min(z.a[0], z.b[0]), y = Math.min(z.a[1], z.b[1]), w = Math.abs(z.b[0] - z.a[0]), hh = Math.abs(z.b[1] - z.a[1]);
      const zk = opt.ziele ? { 'data-zusatz': z.id } : {};       // im Editor markiert (Vorschau beim Ziehen)
      el('rect', Object.assign({ x, y, width: w, height: hh, fill: 'none', stroke: '#000', 'stroke-width': 0.35, 'stroke-dasharray': '4 1 0.6 1' }, zk), g);
      if (z.t) text(g, x + 1, y + 3.2, z.t, 2.5, 'start', Object.assign({ 'font-weight': 'bold' }, zk));
      if (opt.ziele) { ziel(g, x - 1, y - 1, w + 2, 2, 'z:' + z.id); ziel(g, x - 1, y + hh - 1, w + 2, 2, 'z:' + z.id);
        ziel(g, x - 1, y - 1, 2, hh + 2, 'z:' + z.id); ziel(g, x + w - 1, y - 1, 2, hh + 2, 'z:' + z.id); }
    });
    liste.filter(z => z.art === 'text').forEach(z => {
      const e = text(g, z.a[0], z.a[1], z.t || 'Text', z.g || 2.5, 'start', Object.assign(z.fett ? { 'font-weight': 'bold' } : {}, opt.ziele ? { 'data-zusatz': z.id } : {}));
      if (opt.ziele) ziel(g, z.a[0] - 1, z.a[1] - (z.g || 2.5) - 0.5, Math.max(8, (z.t || 'Text').length * (z.g || 2.5) * 0.55) + 2, (z.g || 2.5) + 2, 'z:' + z.id);
      return e;
    });
    const neu = [];
    liste.filter(z => z.art === 'leiter').forEach(z => {
      const [A, B] = [z.a, z.b], P = nah(A[0], B[0]) || nah(A[1], B[1]) ? null : z.knick === 'vh' ? [A[0], B[1]] : [B[0], A[1]];
      const pkt = P ? [A, P, B] : [A, B], farbe = FARBE[z.leiter] || '#000', segs = [];
      SZ.ort = 'z:' + z.id;
      for (let i = 0; i + 1 < pkt.length; i++) { const e = linie(g, pkt[i][0], pkt[i][1], pkt[i + 1][0], pkt[i + 1][1], 0.25, farbe, z.leiter || 'L');
        if (opt.ziele) e.setAttribute('data-zusatz', z.id); segs.push(SZ.leiter[SZ.leiter.length - 1]); }
      SZ.ort = null;
      neu.push({ z, segs, pkt });
      if (opt.ziele) pkt.slice(1).forEach((q, i) => el('line', { x1: pkt[i][0], y1: pkt[i][1], x2: q[0], y2: q[1], class: 'ziel zleiter', stroke: 'transparent', 'stroke-width': 2, 'data-ziel': 'z:' + z.id }, g));
    });
    if (!neu.length) return hinweise;
    // Verbindungspunkte an den Enden und Knicken der Zusatzleiter neu bestimmen
    const zaehle = (x, y) => SZ.leiter.reduce((n, s) => {
      const ende = (nah(s.x1, x) && nah(s.y1, y)) || (nah(s.x2, x) && nah(s.y2, y));
      const innen = !ende && (nah(s.x1, s.x2) ? nah(s.x1, x) && y > Math.min(s.y1, s.y2) + 0.02 && y < Math.max(s.y1, s.y2) - 0.02
        : nah(s.y1, s.y2) && nah(s.y1, y) && x > Math.min(s.x1, s.x2) + 0.02 && x < Math.max(s.x1, s.x2) - 0.02);
      return n + (ende ? 1 : innen ? 2 : 0); }, 0);
    neu.forEach(({ z, pkt }) => [pkt[0], pkt[pkt.length - 1]].forEach(([x, y]) => {
      if (zaehle(x, y) >= 3 && !SZ.punkte.some(q => nah(q.x, x) && nah(q.y, y))) punkt(g, x, y, z.leiter || 'L');
    }));
    // Netzprüfung über alle Leiter des Blatts (Enden und Abzweige verbinden, Kreuzungen nicht)
    const L = SZ.leiter, auf = (p, s) => nah(s.x1, s.x2) ? nah(p[0], s.x1) && p[1] >= Math.min(s.y1, s.y2) - 0.02 && p[1] <= Math.max(s.y1, s.y2) + 0.02
      : nah(p[1], s.y1) && p[0] >= Math.min(s.x1, s.x2) - 0.02 && p[0] <= Math.max(s.x1, s.x2) + 0.02;
    const ber = (a, b) => [[a.x1, a.y1], [a.x2, a.y2]].some(p => auf(p, b)) || [[b.x1, b.y1], [b.x2, b.y2]].some(p => auf(p, a));
    const HAUPT = { L1: 'L1', L2: 'L2', L3: 'L3', N: 'N', PE: 'PE' };
    neu.forEach(({ z, segs, pkt }) => {
      const netz = new Set(segs), offen = segs.slice();
      while (offen.length) { const s = offen.pop(); L.forEach(o => { if (!netz.has(o) && ber(s, o)) { netz.add(o); offen.push(o); } }); }
      const arten = new Set([...netz].filter(s => !segs.includes(s)).map(s => s.art === 'PEN' ? null : HAUPT[s.art]).filter(Boolean));
      if (arten.size > 1) hinweise.push({ id: z.id, art: 'kurzschluss', t: `Kurzschluss: der Leiter verbindet ${[...arten].join(' und ')}`, p: pkt[0] });
      [pkt[0], pkt[pkt.length - 1]].forEach(p => { if (!L.some(s => !segs.includes(s) && auf(p, s))) hinweise.push({ id: z.id, art: 'offen', t: 'Offenes Leiterende', p }); });
    });
    if (opt.ziele) hinweise.forEach(h => el('circle', { cx: h.p[0], cy: h.p[1], r: 1.4, fill: 'none', stroke: h.art === 'kurzschluss' ? '#d92d20' : '#c27a0e', 'stroke-width': 0.4, 'stroke-dasharray': h.art === 'offen' ? '0.8 0.5' : null, class: 'zhinweis' }, g));
    return hinweise;
  }
  function setzeLinie(l, A, B) {
    [l.x1, l.y1, l.x2, l.y2] = [A[0], A[1], B[0], B[1]];
    l.el.setAttribute('x1', A[0]); l.el.setAttribute('y1', A[1]); l.el.setAttribute('x2', B[0]); l.el.setAttribute('y2', B[1]);
  }
  function teilPort(g, x, y) { if (SZ.teil && g === SZ.g) SZ.teil.ports.push({ x, y }); }
  function text(g, x, y, t, groesse, anker = 'start', extra = {}) {
    const e = el('text', Object.assign({ x, y, 'font-size': groesse, 'text-anchor': anker,
      'font-family': 'Arial, Helvetica, Liberation Sans, sans-serif', fill: '#000' }, extra), g);
    e.textContent = t; return e;
  }
  function linie(g, x1, y1, x2, y2, w = 0.35, farbe = '#000', art = null) {
    const e = el('line', { x1, y1, x2, y2, stroke: farbe, 'stroke-width': w, 'stroke-linecap': 'square' }, g);
    if (g === SZ.g && !SZ.teil && w === 0.25) SZ.leiter.push({ el: e, x1, y1, x2, y2, art: art || (farbe === FARBE.N ? 'N' : farbe === FARBE.PE ? 'PE' : 'L'),
      key: SZ.ort ? SZ.ort + '#' + (SZ.zaehler[SZ.ort] = (SZ.zaehler[SZ.ort] || 0) + 1) : null });
    return e;
  }
  const farbe = art => FARBE[art] || '#000';
  // PEN (ab v1.46): grün mit blauer Strichelung darüber, damit er sich vom PE unterscheidet
  const leiter = (g, x1, y1, x2, y2, art) => { const e = linie(g, x1, y1, x2, y2, 0.25, farbe(art), art || 'L');
    if (art === 'PEN') el('line', { x1, y1, x2, y2, stroke: FARBE.N, 'stroke-width': 0.25, 'stroke-dasharray': '1 1.2', 'stroke-linecap': 'butt', 'pointer-events': 'none' }, g);
    return e; };
  const punkt = (g, x, y, art) => { const e = el('circle', { cx: x, cy: y, r: 0.6, fill: farbe(art) }, g);
    if (g === SZ.g && !SZ.teil) SZ.punkte.push({ el: e, x, y, art }); return e; };
  // Text auf eine Breite begrenzen (wirkt erst, wenn das Blatt im Dokument hängt)
  const zuBegrenzen = [];
  function passend(t, max) { zuBegrenzen.push([t, max]); }
  // ab v1.54: gibt die Texte zurück, die stärker als auf 85 % gestaucht werden ({ el, text, faktor }, für die Prüfliste im Editor)
  function begrenzen() {
    const gestaucht = [];
    while (zuBegrenzen.length) {
      const [t, max] = zuBegrenzen.pop();
      try { const l = t.getComputedTextLength(); if (l > max) { t.setAttribute('textLength', max); t.setAttribute('lengthAdjust', 'spacingAndGlyphs');
        if (max / l < 0.85) gestaucht.push({ el: t, text: t.textContent, faktor: max / l }); } } catch (e) {}
    }
    return gestaucht;
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
      text(g, x + 1.2, y + 2.6, titel, 1.8, 'start', {});
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
    text(g, x0 + 1.2, y0 + 2.6, 'Rechtlicher Eigentümer', 1.8, 'start', {});
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
  // erste sichtbare Stelle eines Zeichens unter seinem (ersten) oberen Anschluss in mm (ab v1.47, Regel R1):
  // Anschlussleitungen (senkrechte Linien ab einem oberen Anschluss) und Texte (Klemmenziffern) zählen nicht mit
  let SICHT = {};
  function yAusdehnung(e) {
    const n = k => parseFloat(e.getAttribute(k));
    switch (e.tagName) {
      case 'line': return [Math.min(n('y1'), n('y2')), Math.max(n('y1'), n('y2'))];
      case 'polyline': case 'polygon': { const ys = e.getAttribute('points').trim().split(/\s+/).map(p => parseFloat(p.split(',')[1])); return [Math.min(...ys), Math.max(...ys)]; }
      case 'circle': return [n('cy') - n('r'), n('cy') + n('r')];
      case 'ellipse': return [n('cy') - n('ry'), n('cy') + n('ry')];
      case 'rect': return [n('y'), n('y') + n('height')];
      case 'path': { const ys = []; for (const m of e.getAttribute('d').matchAll(/([MA])([^MA]*)/g)) {
        const z = m[2].trim().split(/[\s,]+/).map(parseFloat);
        if (m[1] === 'M') ys.push(z[1]); else for (let i = 0; i + 6 < z.length; i += 7) ys.push(z[i + 6]); }
        return ys.length ? [Math.min(...ys), Math.max(...ys)] : null; }
    }
    return null;
  }
  function sichtOben(kennung) {
    if (SICHT[kennung] !== undefined) return SICHT[kennung];
    const r = qz(kennung), oben = r.anschluesse.filter(t => t.richtung === 'n');
    const a = oben.slice().sort((p, q) => p.x - q.x)[0]; if (!a) return (SICHT[kennung] = 0);
    let min = Infinity;
    r.g.querySelectorAll('line,polyline,polygon,circle,ellipse,rect,path').forEach(e => {
      if (e.tagName === 'line' && e.getAttribute('x1') === e.getAttribute('x2')) {
        const x = parseFloat(e.getAttribute('x1')), y1 = Math.min(parseFloat(e.getAttribute('y1')), parseFloat(e.getAttribute('y2')));
        if (oben.some(t => Math.abs(t.x - x) < 0.01 && Math.abs(t.y - y1) < 0.01)) return;     // Anschlussleitung
      }
      const ya = yAusdehnung(e); if (ya) min = Math.min(min, ya[0]);
    });
    return (SICHT[kennung] = isFinite(min) ? Math.max(0, (min - a.y) * E) : 0);
  }
  // R3 (ab v1.50): Abstand der am weitesten links gezeichneten Stelle vom ersten oberen Anschluss in mm (Texte zählen nicht)
  let SLI = {};
  function sichtLinks(kennung) {
    if (SLI[kennung] !== undefined) return SLI[kennung];
    const r = qz(kennung), a = r.anschluesse.filter(t => t.richtung === 'n').sort((p, q) => p.x - q.x)[0];
    let min = Infinity;
    r.g.querySelectorAll('line,polyline,polygon,circle,ellipse,rect,path').forEach(e => { const xa = xAusdehnung(e); if (xa) min = Math.min(min, xa[0]); });
    return (SLI[kennung] = isFinite(min) && a ? Math.max(0, (a.x - min) * E) : 0);
  }
  // R3: rechtes Ende der Beschriftung links neben einem Zeichen, dessen erster oberer Anschluss bei x liegt
  const R3 = (kennung, x) => x - sichtLinks(kennung) - 1.5;
  // R1: Grundlinie der ersten Beschriftungszeile – Versalhöhe (1,8 mm) unter der ersten sichtbaren Stelle
  const R1 = (kennung, yAnschluss) => yAnschluss + sichtOben(kennung) + 1.8;
  // Unterkante eines Beschriftungsblocks (Kennzeichen mit Grundlinie y, darunter die Zeilen)
  // Anschlussbezeichnungen (ab v1.48, Prüfbericht E5): einheitlich vom Plan, waagerecht rechts am Leiter, 1,8 mm;
  // ports: Anschlüsse aus setze(), oben/unten: Bezeichnungen je Pol von links nach rechts
  function anschlussNr(g, ports, oben, unten) {
    const ob = ports.filter(p => p.richtung === 'n').sort((p, q) => p.x - q.x), un = ports.filter(p => p.richtung === 's').sort((p, q) => p.x - q.x);
    ob.forEach((p, i) => { if (oben[i]) text(g, p.x + 0.8, p.y + 2.2, oben[i], 1.8); });
    un.forEach((p, i) => { if (unten[i]) text(g, p.x + 0.8, p.y - 0.6, unten[i], 1.8); });
  }
  // Pole nach Leiterart: Außenleiter 1/2, 3/4, 5/6 …, N als N (Schutzorgane) bzw. fortlaufend (Schaltglieder)
  const polNr = (arten, nFort = false, ab = 0) => { let k = ab; const o = [], u = [];
    arten.forEach(a => { if (a === 'N' && !nFort) { o.push('N'); u.push('N'); } else { o.push(String(2 * k + 1)); u.push(String(2 * k + 2)); k++; } });
    return [o, u]; };
  const textEnde = (y, zeilen = []) => { const n = zeilen.filter(Boolean).length; return y + (n ? 3.2 + 2.8 * (n - 1) : 0) + 0.6; };
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
  // Zeichen-Cache (ab v1.23): jedes Zeichen wird nur einmal aus dem XML übersetzt, danach geklont
  let ZC = {};
  function qz(kennung) {
    let c = ZC[kennung];
    if (!c) { const r = QET.zeichne(ZEICHEN[kennung].xml, { labels: false }); c = ZC[kennung] = { g: r.g, anschluesse: r.anschluesse }; }
    return { g: c.g.cloneNode(true), anschluesse: c.anschluesse.map(t => Object.assign({}, t)) };
  }
  function setze(g, kennung, x, y, anker = null, arten = null, staerke = 1, nachher = null) {
    const r = qz(kennung);
    const a = anker ? r.anschluesse.find(anker) : r.anschluesse.filter(t => t.richtung === 'n').sort((p, q) => p.x - q.x)[0];
    const tx = x - a.x * E, ty = y - a.y * E;
    if (staerke !== 1) for (const e of r.g.querySelectorAll('[stroke-width]')) e.setAttribute('stroke-width', parseFloat(e.getAttribute('stroke-width')) * staerke);
    if (typeof arten === 'string') polfarben(r.g, null, arten);
    else if (arten) polfarben(r.g, r.anschluesse.filter(t => t.richtung === 'n').sort((p, q) => p.x - q.x).map((t, i) => ({ x: t.x, art: arten[i] })));
    if (nachher) nachher(r.g);
    el('g', { transform: `translate(${tx} ${ty}) scale(${E})` }, g).appendChild(r.g);
    const ports = r.anschluesse.map(t => ({ x: tx + t.x * E, y: ty + t.y * E, richtung: t.richtung }));
    if (SZ.teil && g === SZ.g) ports.forEach(p => SZ.teil.ports.push({ x: p.x, y: p.y }));
    return ports;
  }
  // Kennzeichen links neben dem Gerät; bei Geräten mit IΔ-Kasten links unter
  // dem Gerät, weil daneben Kasten und Wirkverbindung liegen. Gibt das neue
  // untere Ende zurück.
  function kennzeichen(g, z, x0, yG, yUnten, kenn, zeilen) {
    if (GERAETE[z] && GERAETE[z].fi) {
      bmk(g, x0 - 1.5, yUnten + 3, kenn, zeilen);
      return yUnten + 3 + 2.8 * zeilen.length + 1;
    }
    bmk(g, R3(z, x0), R1(z, yG), kenn, zeilen);
    return yUnten;
  }
  const unten = ans => ans.filter(t => t.richtung === 's').sort((p, q) => p.x - q.x);
  function hoehe(kennung) {   // Abstand oberer bis unterer Anschluss in mm
    const r = qz(kennung);
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
    if (art === 'PEN' && bars.PE !== undefined) return 'PE';      // PEN-Zuleitung aus einem Verteiler ohne PEN-Schiene (dort gewarnt)
    if (/^L[123]$/.test(art) && bars.L1 !== undefined) return 'L1';
    return art;
  }
  function bemZeilen(g) {
    if (!g || !g.zeichen) return [];
    const d = GERAETE[g.zeichen], z = [];
    if (d.sicherung) z.push(`${g.art || 'gG'} ${g.nenn || '?'} A`);
    else if (d.kennlinie) z.push(`${g.kennlinie || 'B'} ${g.nenn || '?'} A`);
    else if (d.bereich) z.push(`${g.bereich || '?'} A`);
    else if (g.nenn && !d.ohneNenn) z.push(`${g.nenn} A`);
    if (d.fi) z.push(`${g.idn || '30'} mA Typ ${g.fityp || 'A'}`);
    return z;
  }

  // ---- Platzbedarf ----------------------------------------------------------
  function spaltenFuer(nLeiter, R) { return Math.max(1, Math.ceil((LINKS + (nLeiter - 1) * ABSTAND + 2) / R.sb)); }
  function abgangArten(k, a, v) {
    if (a.ohneN) return ['L1', 'L2', 'L3', 'PE'];      // Drehstrommotor (ab v1.37)
    const ph = (a.phase.t === 'L' || !a.phase.t) ? 'L1' : a.phase.t;
    if (a.pen) return a.drei ? ['L1', 'L2', 'L3', 'PEN'] : [ph, 'PEN'];      // Zuleitung zu einem TN-C(-S)-Unterverteiler (ab v1.52)
    if (a.drei) return ['L1', 'L2', 'L3', 'N', 'PE'];
    if (k.trafo && k.trafo.prim === '400') return ['L1', 'L2'];
    return k.steuer ? [ph, 'N'] : [ph, 'N', 'PE'];
  }
  // greift ein Steuerstromkreis seine Spannung im Abgang ab, braucht der Abgang
  // rechts Platz für die gehenden Querverweise (rund drei Leiterabstände)
  // Wende- und Stern-Dreieck-Schaltung (ab v1.40): Platz für die Zusatzschütze rechts neben PE samt Beschriftung
  function abgangSpalten(k, a, v, R) { return spaltenFuer(abgangArten(k, a, v).length + (a.abgriff ? 3 : 0) + (a.sd ? 12 : a.wende ? 6 : 0), R); }

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
    let cursor = yG, textBis = 0;      // textBis: Unterkante der letzten Beschriftung im Pfad (ab v1.47)
    if (pole) {
      arten.slice(0, pole).forEach((art, i) => { leiter(g, xs[i], enden[i], xs[i], yG, art); });
      teil(`k:${k.id}/f`);
      const tp = setze(g, z, x0, yG, null, arten.slice(0, pole)), t = unten(tp);
      if (!(GERAETE[z] && GERAETE[z].eigeneNr)) anschlussNr(g, tp, ...polNr(arten.slice(0, pole)));
      t.forEach((p, i) => { if (i < pole) enden[i] = p.y; });
      cursor = Math.max(...t.map(p => p.y));
      // Motorschutzschalter (ab v1.46): genutzte Hilfsschalter mit Verweis in den Steuerstromkreis
      const mssRef = !a.mssKont ? [] : [...a.mssKont.s, ...a.mssKont.o].map(key => { const kn = ctx.steuer && ctx.steuer.kontakte[key], an = (a.mssAn || {})[key];
        return kn ? `${an ? an.join('–') + ' ' : ''}/${kn.blatt}.${kn.spalte}` : ''; });
      cursor = kennzeichen(g, z, x0, yG, cursor, a.f && a.f.t, bemZeilen(k.geraet).concat(mssRef.filter(Boolean)));
      teil(null);
    }
    const bis = (y) => { arten.forEach((art, i) => { if (enden[i] < y) leiter(g, xs[i], enden[i], xs[i], y, art); enden[i] = y; }); };
    // hinter FI-Geräten steht deren Beschriftung unter dem Gerät: dort etwas Abstand lassen
    let yS = cursor + (z && GERAETE[z] && GERAETE[z].fi ? 3 : 0);
    // Abgriff der Steuerspannung hinter dem Schutzorgan (Etappe C): L (erster Außenleiter)
    // am oberen Anschluss des Schaltgeräts, N 3 mm tiefer (noch in dessen Anschlussstrich),
    // je mit gehendem Querverweis nach rechts zum Steuerstromkreis
    if (a.abgriff) {
      const y1 = Math.max(yS, cursor + 2), iN = arten.indexOf('N'), xr = xs[xs.length - 1] + 4;
      const ref = abgriffRef(ctx, a);
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
    const spRef = id => { const sp = ctx.steuer && ctx.steuer.spulen[id]; return sp ? `/${sp.blatt}.${sp.spalte}` : ''; };
    if (a.schalt && a.wende) cursor = zeichneWende(g, k, a, arten, xs, enden, yS, bis, spRef);
    else if (a.schalt) {
      cursor = zeichneSchaltglieder(g, a, arten, xs, enden, yS, bis, spule ? `/${spule.blatt}.${spule.spalte}` : '', `k:${k.id}/q`);
      const sg = a.schalt, kS = sg.typ === 'zeitrelais' ? ZR_KONTAKT[sg.zr.fkt] || 'k_s_aus' : SG_KONTAKT[sg.typ];
      textBis = Math.max(textBis, textEnde(R1(kS, yS), [sg.typ === 'zeitrelais' ? sg.zr.zeit : sg.typ === 'stromstoss' ? 'x' : sg.rolle, spule ? 'x' : '']));
    }
    // Stern-Dreieck (ab v1.40): Dreieck-Schütz an den Abgriffen U2←L2, V2←L3, W2←L1, daneben das Stern-Schütz;
    // ab v1.42 zwischen Netzschütz und Überlastrelais abgegriffen (Motorschutz in den Strängen, 0,58 × I_N)
    const sd = a.sd ? zeichneSternDreieck(g, k, a, arten, xs, cursor, bis, spRef) : null;
    if (sd) cursor = sd.cursor;
    // Überlastrelais unter dem Schütz (ab v1.38): thermische Auslöser in den Außenleitern, daneben
    // Kennzeichen, Einstellbereich und die genutzten Kontakte mit Verweis in den Steuerstromkreis
    if (a.ol) {
      const top = cursor + 3, n = Math.min(3, arten.filter(x => /^L/.test(x)).length);
      bis(top);
      teil(`k:${k.id}/ol`);
      // Wechselstrom (ab v1.42): Überlastrelais nur im Außenleiter, N und PE laufen vorbei
      const olZ = n === 3 ? 'ueberlast3' : 'ueberlast1', olP = setze(g, olZ, x0, top, null, arten.slice(0, n)), t = unten(olP);
      anschlussNr(g, olP, ...polNr(arten.slice(0, n)));
      t.forEach((p, i) => { if (i < n) enden[i] = p.y; });
      const lage = key => { const l = ctx.steuer && ctx.steuer.kontakte[key]; return l ? ` /${l.blatt}.${l.spalte}` : ''; };
      const kont = [...((a.olKont || {}).o || []).map(key => '95–96' + lage(key)), ...((a.olKont || {}).s || []).map(key => '97–98' + lage(key))];
      const olZeilen = [a.ol.bereich ? `${a.ol.bereich} A` : '', ...kont];
      bmk(g, R3(olZ, x0), R1(olZ, top), a.ol.bmk.t, olZeilen);
      textBis = Math.max(textBis, textEnde(R1(olZ, top), olZeilen));
      teil(null);
      cursor = Math.max(...t.map(p => p.y));
    }
    // Erzeugungszähler der PV-Anlage (ab v1.34) im Verteiler hinter dem Schutzorgan
    if (a.p) {
      const zz = arten.length === 5 ? 'zaehler3' : 'zaehler1', top = cursor + 4;
      bis(top);
      teil(`k:${k.id}/p`);
      const t = unten(setze(g, zz, x0, top, null, arten.slice(0, POLE[zz])));
      t.forEach((p, i) => { enden[i] = p.y; });
      bmk(g, R3(zz, x0), R1(zz, top), a.p.t, ['Erzeugung']); textBis = Math.max(textBis, textEnde(R1(zz, top), ['Erzeugung']));
      teil(null);
      cursor = Math.max(...t.map(p => p.y));
    }
    // Frequenzumrichter (ab v1.39): im Verteiler vor den Klemmen, PE läuft rechts vorbei
    if (a.fu) {
      const top = cursor + 3;
      bis(top);
      teil(`k:${k.id}/fu`);
      const fuP = setze(g, 'umrichter3', x0, top, null, arten.slice(0, 3)), t = unten(fuP);
      anschlussNr(g, fuP, ['L1', 'L2', 'L3'], ['U', 'V', 'W']);
      t.forEach((p, i) => { if (i < 3) enden[i] = p.y; });
      // PE an den Umrichter (ab v1.46): Abzweig vom vorbeilaufenden PE an die rechte Kastenkante
      const iPE = arten.indexOf('PE');
      if (iPE >= 0) { const yp = top + 10; bis(yp); punkt(g, xs[iPE], yp, 'PE'); leiter(g, xs[iPE], yp, x0 + 12.5, yp, 'PE'); }
      bmk(g, R3('umrichter3', x0), R1('umrichter3', top), a.fu.t); textBis = Math.max(textBis, textEnde(R1('umrichter3', top)));
      teil(null);
      cursor = Math.max(...t.map(p => p.y));
    }
    if (a.klemmen) {
      // die Beschriftung der Klemmen beginnt mindestens 1,5 mm unter der letzten Textzeile darüber (R4, ab v1.47)
      const ky = Math.max(cursor + (a.schalt ? 1 : 6), textBis + 1.5 - sichtOben('klemme')); bis(ky);
      // N als N-Trennklemme (Grundeinstellung) oder als normale Klemme
      const trenn = art => art === 'N' && v.nKlemme !== 'normal';
      teil(`k:${k.id}/x`);
      arten.forEach((art, i) => setze(g, trenn(art) ? 'trennklemme' : 'klemme', xs[i], ky, null, art));
      if (sd) { sd.bis(ky); sd.xs.forEach(x => setze(g, 'klemme', x, ky)); sd.bis(ky + 5, true); }
      arten.forEach((art, i) => enden[i] = ky + (trenn(art) ? 10 : 5));
      bmk(g, R3('klemme', x0), R1('klemme', ky), a.klemmen.bmk, [`${a.klemmen.von}–${a.klemmen.bis}`]);
      teil(null);
      cursor = ky + (arten.some(trenn) ? 10 : 5);
    }
    const ende = k.speist ? 'fest' : k.ziel.anschluss, xd = `k:${k.id}/xd`;
    // PV-Anlage: der PV-Generator schließt unten mit der Steckdosenunterkante ab, darüber
    // DC-Freischalter und Wechselrichter – der Abgang braucht entsprechend mehr Höhe
    const pvDc = ende === 'pv' && (!k.pv || k.pv.dc !== false);
    const feldH = ende === 'pv' ? pvHoehe(pvDc) : ende === 'speicher' ? spHoehe() : ende === 'wallbox' ? WALLBOX_H : ende === 'motor' ? (a.sd ? SD_H : MOTOR_H) : 0;     // Geräte im Feld (ab v1.34)
    const natur = feldH ? cursor + PV_LUECKE + feldH - UNTERKANTE : cursor + 6;
    const ye = Math.max(natur, yEnde || 0);
    if (ende === 'motor' && sd) {  // Stern-Dreieck: Motor mit 6 Anschlüssen, U2 V2 W2 von unten
      const yM = ye + UNTERKANTE - SD_H, yb = yM + 25;
      bis(yM);
      teil(xd);
      anschlussNr(g, setze(g, 'motor6', x0, yM, null, arten, 1, motorFarben), ['U1', 'V1', 'W1', 'PE'], ['U2', 'V2', 'W2']);
      const mo = k.motor || {};
      bmk(g, R3('motor6', x0), R1('motor6', yM), a.xd.t, [mo.kw ? `${mo.kw} kW` : '', mo.strom ? `${mo.strom} A` : '']);
      teil(null);
      sd.xs.forEach((x, i) => { const yr = yb + 1.5 * (3 - i);
        leiter(g, x, sd.enden[i], x, yr, 'L'); leiter(g, x, yr, xs[i], yr, 'L'); leiter(g, xs[i], yr, xs[i], yb, 'L'); });
      teil(xd);
    } else if (ende === 'motor') {        // Motor (ab v1.37): Unterkante des Kreises auf Höhe der Steckdosenunterkante
      const yM = ye + UNTERKANTE - MOTOR_H;
      // geschirmte Leitung: Schirm um die Adern, 10 mm über dem Motor (wenn dort Platz ist)
      if (GESCHIRMT.includes(k.leitung.typ) && yM - 15 > cursor + 2) {
        schirm(g, xs[0] - 2, xs[xs.length - 1] + 2, yM - 15);
        // Schirmauflage (ab v1.46): Schirm oben und unten auf PE
        const iPE = arten.indexOf('PE');
        if (iPE >= 0) { bis(yM - 3); [yM - 15, yM - 5].forEach(y => { punkt(g, xs[iPE], y, 'PE'); leiter(g, xs[iPE], y, xs[iPE] + 2, y, 'PE'); }); }
      }
      bis(yM);
      teil(xd);
      anschlussNr(g, setze(g, arten.length === 4 ? 'motor3' : 'motor1', x0, yM, null, arten, 1, motorFarben), arten.length === 4 ? ['U1', 'V1', 'W1', 'PE'] : ['U1', 'U2', 'PE'], []);
      const mo = k.motor || {};
      const zm = arten.length === 4 ? 'motor3' : 'motor1';
      bmk(g, R3(zm, x0), R1(zm, yM), a.xd.t, [mo.kw ? `${mo.kw} kW` : '', mo.strom ? `${mo.strom} A` : '']);
    } else if (ende === 'wallbox') {      // Wallbox (ab v1.36): Unterkante des Kastens auf Höhe der Steckdosenunterkante
      const yW = ye + UNTERKANTE - WALLBOX_H;
      bis(yW);
      teil(xd);
      setze(g, 'wallbox', x0, yW, null, arten);
      bmk(g, R3('wallbox', x0), R1('wallbox', yW), a.xd.t, [k.wallbox && k.wallbox.kw ? `${k.wallbox.kw} kW` : '']);
    } else if (ende === 'steckdose3' || ende === 'steckdose5') {
      bis(ye);
      teil(xd);
      setze(g, arten.length === 5 ? 'steckdose5' : 'steckdose3', x0, ye, null, arten);
      bmk(g, R3('steckdose3', x0), ye + 3, a.xd.t);
    } else if (ende === 'dose') {      // Geräteanschlussdose: je Leiter eine Endklemme,
      const yk = ye + UNTERKANTE - END_TIEFE;   // Unterkante wie die Steckdose
      bis(yk);
      teil(xd);
      arten.forEach((art, i) => setze(g, 'endklemme', xs[i], yk, null, art));
      bmk(g, R3('endklemme', x0), ye + 3, a.xd.t);      // R5: gemeinsame Grundlinie der kleinen Endgeräte (ab v1.47)
    } else if (ende === 'leuchte') {   // Lampe zwischen L und N, PE an das Gehäuse
      arten.forEach((art, i) => { if (art !== 'PE' && enden[i] < ye) leiter(g, xs[i], enden[i], xs[i], ye, art); });
      const iL = 0, iN = arten.indexOf('N'), iPE = arten.indexOf('PE');
      teil(xd);
      setze(g, 'leuchte', xs[iL], ye, null, [arten[iL], 'N']);
      if (iN !== 1) leiter(g, xs[iN], ye, xs[iN], ye, 'N');
      const xm = xs[iL] + 2.5, yu = ye + 7.5;      // Mitte und Unterkante des Lampenkreises
      teil(null);
      leiter(g, xs[iPE], enden[iPE], xs[iPE], yu + 1.5, 'PE');
      teil(xd); teilPort(g, xs[iPE], yu + 1.5);
      leiter(g, xs[iPE], yu + 1.5, xm, yu + 1.5, 'PE'); leiter(g, xm, yu + 1.5, xm, yu, 'PE');
      bmk(g, R3('leuchte', x0), ye + 3, a.xd.t);
    } else if (ende === 'pv') {
      const yW = ye + UNTERKANTE - pvHoehe(pvDc);
      bis(yW);
      teil(`k:${k.id}/t`);
      const hyb = k.pv && k.pv.speicher;
      const tw = unten(setze(g, (arten.length === 5 ? 'wr3' : 'wr1') + (hyb ? '_hybrid' : ''), x0, yW, null, arten, 1, nurLeitungenFarbig));
      bmk(g, R3('wr1', x0), R1('wr1', yW), a.t.t);
      teil(null);
      // DC-Seite schwarz: Plus links, Minus rechts
      let y = tw[0].y;
      const xp = tw[0].x, xm = tw[1].x;
      const dcBis = y2 => { leiter(g, xp, y, xp, y2, 'DC'); leiter(g, xm, y, xm, y2, 'DC'); y = y2; };
      if (pvDc) {
        dcBis(y + PV_LUECKE);
        teil(`k:${k.id}/dc`);
        const t = unten(setze(g, 'lasttrenn2', xp, y));
        bmk(g, R3('lasttrenn2', xp), R1('lasttrenn2', y), a.dcq.t, ['DC']);
        teil(null);
        y = t[0].y;
      }
      dcBis(y + PV_LUECKE);
      teil(`k:${k.id}/g`);
      setze(g, 'pv_oben', xp, y);
      bmk(g, R3('pv_oben', xp), R1('pv_oben', y), a.g.t, [k.pv && k.pv.kwp ? `${k.pv.kwp} kWp` : '']);
      teil(null);
      // Hybrid-Wechselrichter: Batterie an den rechten DC-Anschlüssen
      if (hyb) batterie(g, tw[2].x, tw[3].x, tw[2].y, `k:${k.id}/bat`, a.bat.t, k.pv.speicher.kwh, true);
    } else if (ende === 'speicher') {
      const yW = ye + UNTERKANTE - spHoehe();
      bis(yW);
      teil(`k:${k.id}/t`);
      const tw = unten(setze(g, arten.length === 5 ? 'wr3' : 'wr1', x0, yW, null, arten, 1, nurLeitungenFarbig));
      bmk(g, R3('wr1', x0), R1('wr1', yW), a.t.t);
      teil(null);
      batterie(g, tw[0].x, tw[1].x, tw[0].y, `k:${k.id}/bat`, a.bat.t, k.speicher && k.speicher.kwh);
    } else { bis(ye + UNTERKANTE); teil(xd); arten.forEach((_, i) => teilPort(g, xs[i], ye + UNTERKANTE)); }  // offenes Ende auf Höhe der Steckdosenunterkante
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
    // Stern-Dreieck (ab v1.42): beide Leitungen in einer Zeile, damit der Abstand zum Schriftfeld bleibt
    passend(text(g, mx, ty, `${a.w.t} ${k.leitung.typ || 'NYM-J'} ${arten.length}×${k.leitung.quer || '?'}` +
      (a.sd ? ` · ${a.w2.t} ${adern(k.leitung.typ, 3).gesamt}×${k.leitung.quer || '?'}` : ''), 2.2, 'middle'), max);
    teil(null);
    return { unten: ty + 2, natur };
  }
  // gehender Verweis eines Abgriffs auf alle Kreise, die er speist (ab v1.42; vorher nur der letzte)
  function abgriffRef(ctx, a) {
    const z = (a.abgriffe || [a.abgriff]).map(id => ctx.steuer && ctx.steuer.kreise[id]).filter(Boolean)
      .sort((p, q) => p.blatt - q.blatt || p.spalte - q.spalte);
    return [...new Set(z.map(x => `/${x.blatt}.${x.spalte}`))].join(' ');
  }
  // Höhe der PV-Anlage vom AC-Anschluss des Wechselrichters bis zur Unterkante des PV-Generators (mm)
  const PV_LUECKE = 2;
  // Wechselrichter: Leiterfarben nur an den AC-Anschlussleitungen oben, nicht an ~ und = im Kasten und nicht auf der DC-Seite
  function nurLeitungenFarbig(gZ) {
    for (const e of Array.from(gZ.children)) {
      if (e.tagName === 'line' && e.getAttribute('x1') === e.getAttribute('x2') && Math.max(+e.getAttribute('y1'), +e.getAttribute('y2')) <= 0) continue;   // AC-Seite oben
      if (e.getAttribute('stroke') && e.getAttribute('stroke') !== 'none') e.setAttribute('stroke', '#000');
    }
  }
  const MOTOR_H = 20;
  const SD_H = 25 + 4.5;   // Motor mit 6 Anschlüssen: oben bis unten 25 mm, darunter die Zuführung von U2 V2 W2      // Motor: Anschluss bis Unterkante des Kreises (80 Einheiten)
  // Motor: Leiterfarben nur an den senkrechten Anschlussleitungen; der kurze PE-Abschnitt zum Kreis bleibt grün
  function motorFarben(gZ) {
    for (const e of Array.from(gZ.children)) {
      const st = e.getAttribute('stroke'); if (!st || st === 'none') continue;
      if (e.tagName === 'line' && e.getAttribute('x1') === e.getAttribute('x2')) continue;
      if (e.tagName === 'line' && e.getAttribute('y1') === e.getAttribute('y2') && +e.getAttribute('y1') === -30) { e.setAttribute('stroke', FARBE.PE); continue; }
      e.setAttribute('stroke', '#000');
    }
  }
  const GESCHIRMT = ['2YSLCY-J', 'NYCWY'];
  // Schirm (EN 02-01-07, gestrichelt) um ein Leiterbündel von xl bis xr, oben bei y, 10 mm hoch:
  // das Zeichen oben und um 180° gedreht unten, in der Breite gestreckt (Strichstärke bleibt)
  function schirm(g, xl, xr, y) {
    const sx = (xr - xl) / (40 * E), cx = (xl + xr) / 2;
    [[y + 2.5, 1], [y + 7.5, -1]].forEach(([ym, d]) => {
      const r = qz('schirm');
      for (const e of r.g.querySelectorAll('line')) if (e.getAttribute('x1') === e.getAttribute('x2'))
        e.setAttribute('stroke-width', parseFloat(e.getAttribute('stroke-width') || 1) / sx);
      el('g', { transform: `translate(${cx} ${ym}) scale(${d * E * sx} ${d * E})` }, g).appendChild(r.g);
    });
  }
  const WALLBOX_H = 15;    // Anschluss bis Unterkante des Kastens (60 Einheiten)
  function spHoehe() { return hoehe('wr1') + PV_LUECKE + hoehe('batterie') + PV_LUECKE; }
  // Batterie unter dem Minus-Anschluss (oberer Anschluss des Zeichens = kurze Platte, −); Plus wird
  // links daneben bis unter die Batterie geführt und von unten angeschlossen. Gibt das untere Ende zurück.
  function batterie(g, xp, xm, y, key, kenn, kwh, rechts = false) {
    const top = y + PV_LUECKE;
    leiter(g, xm, y, xm, top, 'DC');
    teil(key);
    const yb = unten(setze(g, 'batterie', xm, top))[0].y, yr = yb + PV_LUECKE;
    // R2 (ab v1.50): links neben der Plus-Leitung; am Hybrid-Wechselrichter liegt links der PV-Strang, dort bleibt sie rechts
    if (rechts) { const yb1 = R1('batterie', top);
      if (kenn) text(g, xm + 3.5, yb1, kenn, 2.5, 'start', { 'font-weight': 'bold' });
      if (kwh) text(g, xm + 3.5, yb1 + 3.2, `${kwh} kWh`, 2.2, 'start');
    } else bmk(g, Math.min(xp, xm - sichtLinks('batterie')) - 1.5, R1('batterie', top), kenn, [kwh ? `${kwh} kWh` : '']);
    teil(null);
    leiter(g, xp, y, xp, yr, 'DC'); leiter(g, xp, yr, xm, yr, 'DC'); leiter(g, xm, yr, xm, yb, 'DC');
    return yr;
  }
  function pvHoehe(dc) { return hoehe('wr1') + PV_LUECKE + (dc ? hoehe('lasttrenn2') + PV_LUECKE : 0) + 20; }
  // Hauptkontakte eines Schaltgeräts (Schütz, Stromstoßschalter, Zeitrelais) unter
  // dem Schutzorgan: je geschaltetem Leiter ein Schaltglied, Wirkverbindung quer
  // durch die Schaltstücke; Kennzeichen links daneben. Gibt das neue untere Ende zurück.
  const SG_KONTAKT = { schuetz: 'schuetz1', stromstoss: 'hilfs_s' };
  const ZR_KONTAKT = { aus: 'k_s_aus', ein: 'k_s_ein', einaus: 'k_s_einaus' };
  function zeichneSchaltglieder(g, a, arten, xs, enden, cursor, bis, spuleRef = '', key = null) {
    const sg = a.schalt, n = sg.pole.length, top = cursor;   // oberer Anschlussstrich = Verbindung zum Schutzorgan
    bis(top);
    teil(key);
    const kenn = sg.typ === 'zeitrelais' ? ZR_KONTAKT[sg.zr.fkt] || 'k_s_aus' : SG_KONTAKT[sg.typ];
    let unten = top;
    for (let i = 0; i < n; i++) {
      const t = setze(g, kenn, xs[i], top, null, arten[i]);
      anschlussNr(g, t, [String(2 * i + 1)], [String(2 * i + 2)]);
      const u = t.find(p => p.richtung === 's'); enden[i] = u.y; unten = Math.max(unten, u.y);
    }
    // Wirkverbindung durch die Schaltstücke (11,5 Einheiten über der Kontaktmitte)
    const yW = top + (40 - 11.5) * E;
    if (n > 1) el('line', { x1: xs[0] - 1, y1: yW, x2: xs[n - 1] - 1, y2: yW, stroke: '#000', 'stroke-width': 0.25, 'stroke-dasharray': '1 0.5' }, g);
    const zeile2 = sg.typ === 'zeitrelais' ? (sg.zr.zeit ? `t = ${sg.zr.zeit}` : '') : sg.typ === 'stromstoss' ? 'Stromstoß' : sg.rolle || '';
    // spuleRef: Lage der Spule im Steuerstromkreis; beim Zeitrelais dann links am Verzögerungszeichen vorbei
    bmk(g, R3(kenn, xs[0]), R1(kenn, top), sg.bmk.t, [zeile2, spuleRef]);
    teil(null);
    // nicht geschaltete Leiter (N, PE) laufen durch
    arten.forEach((art, i) => { if (i >= n && enden[i] < unten) { leiter(g, xs[i], enden[i], xs[i], unten, art); enden[i] = unten; } });
    return unten;
  }
  // Hauptkontakte eines Zusatzschützes an den Stellen xq ab top (ab v1.40); Beschriftung links daneben (ab v1.50)
  function zusatzKontakte(g, zs, xq, top, ref, key) {
    teil(key);
    const u = xq.map((x, i) => { const t = setze(g, 'schuetz1', x, top); anschlussNr(g, t, [String(2 * i + 1)], [String(2 * i + 2)]);
      return t.find(p => p.richtung === 's').y; });
    const yW = top + (40 - 11.5) * E;
    el('line', { x1: xq[0] - 1, y1: yW, x2: xq[xq.length - 1] - 1, y2: yW, stroke: '#000', 'stroke-width': 0.25, 'stroke-dasharray': '1 0.5' }, g);
    bmk(g, R3('schuetz1', xq[0]), R1('schuetz1', top), zs.bmk.t, [zs.rolle, ref]);     // R2: links (ab v1.50)
    teil(null);
    return Math.max(...u);
  }
  // Wendeschaltung (ab v1.40): Schütz Rechts in den Leitern, Schütz Links rechts neben PE; L1 und L3 hinter Links getauscht
  function zeichneWende(g, k, a, arten, xs, enden, yS, bis, spRef) {
    const xq = [0, 1, 2].map(i => xs[0] + ABSTAND * (5 + i)), top = yS + 7;
    bis(top);
    xq.forEach((x, i) => { const y = yS + 1.5 * (i + 1); punkt(g, xs[i], y, arten[i]); leiter(g, xs[i], y, x, y, arten[i]); leiter(g, x, y, x, top, arten[i]); });
    const u1 = zeichneSchaltglieder(g, a, arten, xs, enden, top, bis, spRef(k.id), `k:${k.id}/q`);
    const z = a.zusatz[0], u2 = zusatzKontakte(g, z.schalt, xq, top, spRef(z.id), `k:${k.id}/q2`);
    const unten = Math.max(u1, u2), ende = unten + 6;
    bis(ende);
    xq.forEach((x, i) => { const j = 2 - i, y = unten + 1.5 * (i + 1);
      leiter(g, x, u2, x, y, arten[i]); leiter(g, x, y, xs[j], y, arten[j]); punkt(g, xs[j], y, arten[j]); });
    return ende;
  }
  // Stern-Dreieck (ab v1.40): Leitungen U2 V2 W2 rechts neben PE mit dem Dreieck-Schütz, daneben auf gleicher Höhe
  // das Stern-Schütz: oben gebrückt (Sternpunkt), unten auf U2 V2 W2. Gibt { cursor, xs, enden, bis } von U2 V2 W2 zurück.
  function zeichneSternDreieck(g, k, a, arten, xs, cursor, bis, spRef) {
    // ab v1.50 je 5 mm weiter rechts: Platz für die Beschriftung links zwischen PE und Dreieck-Schütz (R2)
    const xd = [0, 1, 2].map(i => xs[0] + ABSTAND * (6 + i)), xst = [0, 1, 2].map(i => xs[0] + ABSTAND * (11 + i));
    const quelle = [1, 2, 0], top = cursor + 8;
    bis(cursor + 6);
    xd.forEach((x, i) => { const j = quelle[i], y = cursor + 1.5 * (i + 1);
      punkt(g, xs[j], y, arten[j]); leiter(g, xs[j], y, x, y, arten[j]); leiter(g, x, y, x, top, arten[j]); });
    const [zs, zd] = [a.zusatz[0], a.zusatz[1]];
    const uD = zusatzKontakte(g, zd.schalt, xd, top, spRef(zd.id), `k:${k.id}/q3`);
    const uS = zusatzKontakte(g, zs.schalt, xst, top, spRef(zs.id), `k:${k.id}/q2`);
    const yP = top - 2;        // Sternpunkt: obere Anschlüsse gebrückt
    xst.forEach(x => leiter(g, x, yP, x, top, 'L')); leiter(g, xst[0], yP, xst[2], yP, 'L'); punkt(g, xst[1], yP, 'L');
    const u = Math.max(uD, uS);
    xst.forEach((x, i) => { const y = u + 1.5 * (i + 1);
      leiter(g, x, uS, x, y, 'L'); leiter(g, x, y, xd[i], y, 'L'); punkt(g, xd[i], y, 'L'); });
    const enden = xd.map(() => uD);
    const r = { xs: xd, enden, cursor: u + 6 };
    r.bis = (y, setzen = false) => { xd.forEach((x, i) => { if (!setzen && r.enden[i] < y) leiter(g, x, r.enden[i], x, y, 'L'); r.enden[i] = y; }); };
    r.bis(u + 6);
    return r;
  }
  // Steuertrafo (ab v1.16): Primär-LS (230 V: auf L, N läuft durch; 400 V: auf L1 und L2),
  // Trafo -T, Sekundär-LS auf der Spannungsseite, Rückleitung „0 V“ wahlweise an PE geerdet;
  // darunter der Abgriff mit gehenden Querverweisen zum Steuerstromkreis
  function zeichneTrafo(g, ctx, v, k, a, xSp, bars, yG, breite, tap) {
    const T = k.trafo, prim = abgangArten(k, a, v), x0 = xSp + LINKS, xs = [x0, x0 + ABSTAND, x0 + 2 * ABSTAND];
    prim.forEach((art, i) => { const yq = bars[quelle(art, bars)]; if (tap) tap(art, xs[i], yq); else punkt(g, xs[i], yq, art); leiter(g, xs[i], yq, xs[i], yG, art); });
    const z = k.geraet.zeichen || 'ls1', pole = POLE[z] || 1;
    const enden = [yG, yG];
    if (pole >= 2) { const tp = setze(g, z, x0, yG, null, prim); anschlussNr(g, tp, ...polNr(prim)); unten(tp).forEach((p, i) => { if (i < 2) enden[i] = p.y; }); }
    else {
      const tp0 = setze(g, z, x0, yG, null, [prim[0]]); anschlussNr(g, tp0, ['1'], ['2']); enden[0] = unten(tp0)[0].y;
      // zweiter Außenleiter: zweites Schaltglied daneben (wie der LS 3-polig der Bibliothek ohne eigene Kopplungslinie)
      if (T.prim === '400') {     // ab v1.46: zweiter Pol mit 3/4 und Wirkverbindung zum ersten (2-poliger LS)
        const tp1 = setze(g, z, xs[1], yG, null, [prim[1]]); anschlussNr(g, tp1, ['3'], ['4']); enden[1] = unten(tp1)[0].y;
        const yW = yG + 3;
        el('line', { x1: x0 - 1.125, y1: yW, x2: xs[1] - 1.125, y2: yW, stroke: '#000', 'stroke-width': 0.25, 'stroke-dasharray': '1 0.5' }, g);
      }
    }
    let cursor = kennzeichen(g, z, x0, yG, Math.max(...enden), a.f && a.f.t, bemZeilen(k.geraet));
    // Trafo
    const yT = cursor + 4;
    prim.forEach((art, i) => leiter(g, xs[i], enden[i], xs[i], yT, art));
    const tt = unten(setze(g, 'trafo', x0, yT));
    const yS = Math.max(...tt.map(p => p.y));
    bmk(g, R3('trafo', x0), R1('trafo', yT), a.t && a.t.t, [`${T.prim}/${T.sek} V`, T.va ? `${T.va} VA` : '']);
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
    const tsP = setze(g, zl, x0, ySL), ts = unten(tsP); anschlussNr(g, tsP, ['1'], ['2']);
    cursor = kennzeichen(g, zl, x0, ySL, ts[0].y, a.f2 && a.f2.t, bemZeilen(T.ls));
    // Abgriff: Spannung und 0 V mit gehendem Querverweis, Leitungen enden dort (Ecke)
    const y1 = cursor + 2, xr = xs[2] + 4;
    const ref = abgriffRef(ctx, a);
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
    teil(`k:${grp.id}/f`);
    const tp = setze(g, grp.geraet.zeichen, x0, yG, null, arten), t = unten(tp);
    anschlussNr(g, tp, ...polNr(arten));
    const yU0 = kennzeichen(g, grp.geraet.zeichen, x0, yG, Math.max(...t.map(p => p.y)), e.geraete[grp.id].t, bemZeilen(grp.geraet)) + (eng ? 3 : 6);
    teil(null);
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
      unterst = Math.max(unterst, mitOrt('k:' + k.id, () => zeichneAbgang(g, ctx, v, k, a, x, unterBars, yK, w * R.sb, yEnde, tap)).unten);
      x += w * R.sb;
    }
    // Untersammelschienen nur von der ersten bis zur letzten Verbindung.
    // Verbindungspunkt überall, wo drei oder mehr Linien zusammentreffen
    // (Schiene nach links/rechts, Leiter nach oben/unten); an einer Ecke nicht.
    alle.forEach(art => {
      const an = bereich[art]; if (!an.length) return;
      const xsA = an.map(p => p.x), lo = Math.min(...xsA), hi = Math.max(...xsA), y = ys[art];
      if (hi > lo) linie(g, lo, y, hi, y, 0.25, farbe(art), art);   // Untersammelschiene in Leiterstärke
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
    teil(`s:${v.id}`);
    const t = setze(g, z, x0, yG, null, arten, 1, peSeite);
    teil(null);
    const pe = t.find(p => p.richtung === 's');
    // PE des Ableiters nach rechts und hoch auf die PE- bzw. PEN-Schiene
    const xr = xs[xs.length - 1] + ABSTAND, yPe = bars[quelle('PE', bars)];
    leiter(g, pe.x, pe.y, pe.x, pe.y + 4, 'PE'); leiter(g, pe.x, pe.y + 4, xr, pe.y + 4, 'PE');
    leiter(g, xr, pe.y + 4, xr, yPe, 'PE'); punkt(g, xr, yPe, 'PE');
    teil(`s:${v.id}`); bmk(g, R3(z, x0), R1(z, yG), e.kopf.spd.t, []); teil(null);
    return pe.y + 8;
  }

  // ---- Sammelschienen ---------------------------------------------------------
  function zeichneSchienen(g, v, y0, xStarts, xEnde, kommend, gehend, mitNamen) {
    const namen = schienenNamen(v), bars = {};
    namen.forEach((n, i) => {
      const y = y0 + ABSTAND * i, xs = Array.isArray(xStarts) ? xStarts[i] : xStarts;
      linie(g, xs, y, xEnde, y, 0.25, farbe(n), n);
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
      teil(`e:${v.id}/${feld}`);
      const tp = setze(g, gz, x0, top, null, namen.slice(0, pole)), t = unten(tp);
      if (!/^zaehler/.test(gz)) anschlussNr(g, tp, ...polNr(namen.slice(0, pole)));
      t.forEach((p, i) => { if (i < pole) enden[i] = p.y; });
      bmk(g, R3(gz, x0), R1(gz, top), e.kopf[feld].t, feld === 'zaehler' ? [] : bemZeilen(v[feld]));
      teil(null);
      cursor = Math.max(...t.map(p => p.y));
    }
    // TN-C-S: PEN wird hier in N und PE aufgeteilt
    if (v.netzform === 'TN-C-S') {
      const i = namen.indexOf('PEN'), ys = cursor + 4;
      leiter(g, xs[i], enden[i], xs[i], ys, 'PEN');
      punkt(g, xs[i], ys, 'PE');
      leiter(g, xs[i], ys, xs[i] + ABSTAND, ys, 'PE');
      // Aufteilungspunkt an die Haupterdungsschiene (ab v1.46)
      const xe = xs[i] + 3 * ABSTAND;
      punkt(g, xs[i] + ABSTAND, ys, 'PE'); leiter(g, xs[i] + ABSTAND, ys, xe, ys, 'PE'); leiter(g, xe, ys, xe, ys + 2.5, 'PE');
      setze(g, 'erde', xe, ys + 2.5, null, 'PE');
      text(g, xe + 2.5, ys + 5, 'Haupterdungsschiene', 1.9);
      text(g, xs[i] + ABSTAND + 1, ys - 1, 'PEN → N + PE', 1.9);
      namen = namen.slice(0, i).concat(['N', 'PE']);
      xs = xs.concat([xs[i] + ABSTAND]);
      enden = enden.slice(0, i).concat([ys, ys]);
      cursor = ys;
    }
    return { namen, xs, enden, cursor };
  }
  // ankommende Leiter (ab v1.46): TN-C und TN-C-S kommen mit PEN an
  const netzLeiter = v => (v.leiter === '3NPE' ? '3' : '1') + (v.netzform === 'TN-S' ? '/N/PE' : '/PEN');
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
      const L = v.layout || {}, spW = L.spalten || {}, umb = L.umbruch || {};
      for (const it of items) {
        let versucht = 0;
        // Vorgaben von Hand (ab v1.25): neues Blatt ab diesem Abgang, Wunschspalte (Lücke davor)
        if (it.k && umb[it.k.id] && bl.items.length) neu();
        const wunsch = it.k && spW[it.k.id] ? Math.min(spW[it.k.id], letzte - it.w + 1) : 0;
        if (wunsch > col) col = wunsch;
        for (;;) {
          const passtBreite = col + it.w - 1 <= letzte;
          const imSF = col + it.w - 1 >= cSF;
          const ok = passtBreite && (!imSF || tiefe(it, bl.y0) <= sfTop - 2);
          if (ok || (versucht && col === 2)) break;
          if (bl.art === 'kombiniert' && bl.items.length === 0 && !passtBreite) return null;
          neu(); versucht++;
          if (wunsch > col) col = wunsch;
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
    trenn3: 'ue_trenn', leistung3: 'ue_leistung', motorschutz3: 'ue_leistung', zaehler3: 'ue_zaehler', zaehler1: 'ue_zaehler', spd4: 'ue_spd', spd2: 'ue_spd' };
  const ST_BILD = { mss_s: 'hilfs_s', mss_oe: 'hilfs_oe' };   // Kontaktarten ohne eigenes Zeichen (ab v1.38)
  const UE_FEED_X = 24;      // Einspeisung: Abstand vom linken Rahmen
  // Leiterzahl: kurzer Schrägstrich über der Linie, Zahl rechts daneben
  function leiterzahl(g, x, y, n) {
    linie(g, x - 1.4, y + 1.4, x + 1.4, y - 1.4, 0.25);
    text(g, x + 1.7, y - 0.6, String(n), 2.2);
  }
  // zuletzt gezeichnetes Überlastrelais je Blatt (ab v1.52): steht links daneben eines auf gleicher Höhe, endet die
  // Beschriftung vor dessen Kasten
  const ueOl = new WeakMap();
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
    ueBmk(g, R3(UE[z], x), R1(UE[z], y), kenn, zeilen, P - (x - R3(UE[z], x)));
    return { unten: u, frei: u };
  }
  // Ende eines Abgangs: Anschlusszeichen und senkrechte Beschriftung bis vor das Schriftfeld
  function ueEnde(g, ctx, v, k, a, x, yE, ySF) {
    const ende = k.speist ? 'fest' : k.ziel.anschluss;
    // Wallbox: im engen Raster der Übersicht als Steckdose einpolig (Bezeichnung „Wallbox“ darunter)
    if (ende === 'steckdose3' || ende === 'steckdose5' || ende === 'wallbox') setze(g, 'ue_steckdose', x, yE);
    else if (ende === 'dose') { linie(g, x, yE, x, yE + UNTERKANTE - END_TIEFE, 0.25); setze(g, 'endklemme', x, yE + UNTERKANTE - END_TIEFE); }
    else if (ende === 'leuchte') setze(g, 'ue_leuchte', x, yE);
    else if (ende === 'pv') setze(g, 'ue_pv', x, yE);       // ab v1.49: eigenes einpoliges Zeichen
    else if (ende === 'motor') setze(g, 'ue_motor', x, yE);          // ab v1.48: eigenes einpoliges Zeichen
    else if (ende === 'speicher') setze(g, 'batterie', x, yE + UNTERKANTE - 10);   // ab v1.48: Batterie in Originalgröße, unten bündig mit den Steckdosen
    else linie(g, x, yE, x, yE + UNTERKANTE, 0.25);
    if (ende === 'speicher') text(g, R3('batterie', x), yE + 3.6, a.bat.t, 2.2, 'end');
    else if (ende === 'motor') text(g, R3('ue_motor', x), yE + 3.6, a.xd.t, 2.2, 'end');
    else if (ende === 'pv') text(g, R3('ue_pv', x), yE + 3.6, a.g.t, 2.2, 'end');     // am Zeichen steht der PV-Generator
    else if (a.xd && a.xd.t && ende !== 'fest') text(g, R3(ende === 'dose' ? 'endklemme' : ende === 'leuchte' ? 'ue_leuchte' : 'ue_steckdose', x), yE + 3.6, a.xd.t, 2.2, 'end');
    const yL = yE + 9.5, max = ySF - 2 - yL;
    const senk = (dx, t, gr, fett) => passend(text(g, x + dx, yL, t, gr, 'end',
      Object.assign({ transform: `rotate(-90 ${x + dx} ${yL})` }, fett ? { 'font-weight': 'bold' } : {})), max);
    const n = abgangArten(k, a, v).length;
    if (k.speist) {
      const u = ctx.ue[k.speist];
      senk(-2.2, `→ ${u ? u.name : 'Verteiler'}${u ? ` /${u.blatt}.${u.spalte}` : ''}`, 2.2, true);
    } else senk(-2.2, k.ziel.bez || '', 2.5, true);
    senk(0.9, k.trafo ? `${k.trafo.prim}/${k.trafo.sek} V` : k.ziel.ort || '', 2.2);
    if (!k.steuer) senk(3.9, `${a.w.t} ${k.leitung.typ || 'NYM-J'} ${n}×${k.leitung.quer || '?'}` + (a.sd ? ` · ${a.w2.t} ${adern(k.leitung.typ, 3).gesamt}×${k.leitung.quer || '?'}` : ''), 2.2);
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
      ueBmk(g, R3('ue_trafo', x), R1('ue_trafo', top), a.t && a.t.t, [`${k.trafo.prim}/${k.trafo.sek} V`], P - (x - R3('ue_trafo', x)));
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
      // Zusatzschütze (ab v1.48): Wende bzw. Stern-Dreieck mit ihren Kennzeichen unter dem Netzschütz genannt
      const zs = (a.zusatz || []).map(z => z.schalt.bmk.t);
      ueBmk(g, R3('schuetz1', x), R1('schuetz1', top), a.schalt.bmk.t, zs, P - (x - R3('schuetz1', x)));
      y = Math.max(...t.filter(p => p.richtung === 's').map(p => p.y)); frei = Math.max(y, textEnde(R1('schuetz1', top), zs));
    }
    if (a.ol) {         // Überlastrelais einpolig (ab v1.48)
      const top = Math.max(frei, y) + 2.5;
      linie(g, x, y, x, top, 0.25);
      const t = setze(g, 'ueberlast1', x, top), zl = [a.ol.bereich ? `${a.ol.bereich} A` : ''];
      const vor = ueOl.get(g), dx = x - R3('ueberlast1', x), nah = vor && x - vor.x <= P + 0.01 && x > vor.x && Math.abs(top - vor.top) < 6;
      ueBmk(g, R3('ueberlast1', x), R1('ueberlast1', top), a.ol.bmk.t, zl, P - dx - (nah ? dx - 1 : 0));
      ueOl.set(g, { x, top });
      y = Math.max(...t.filter(p => p.richtung === 's').map(p => p.y)); frei = Math.max(y, textEnde(R1('ueberlast1', top), zl));
    }
    if (a.fu) {         // Frequenzumrichter einpolig (ab v1.48)
      const top = Math.max(frei, y) + 2.5;
      linie(g, x, y, x, top, 0.25);
      const t = setze(g, 'ue_umrichter', x, top);
      ueBmk(g, R3('ue_umrichter', x), R1('ue_umrichter', top), a.fu.t, [], P - (x - R3('ue_umrichter', x)));
      y = Math.max(...t.filter(p => p.richtung === 's').map(p => p.y)); frei = y;
    }
    if (a.p) {          // Erzeugungszähler der PV-Anlage (ab v1.34)
      const top = Math.max(frei, y) + 3;
      linie(g, x, y, x, top, 0.25);
      const r = ueGeraet(g, 'zaehler3', x, top, a.p.t, [], P);
      y = r.unten; frei = r.frei;
    }
    if (yE !== null) {
      // Wechselrichter von PV und Speicher (ab v1.48) direkt über dem Endzeichen
      const wr = !k.speist && (k.ziel.anschluss === 'pv' || k.ziel.anschluss === 'speicher') && a.t, hW = wr ? 10 : 0;
      linie(g, x, y, x, yE - hW, 0.25);
      // Stern-Dreieck (ab v1.52): zwei Leitungen, Leiterzahl „4 + 3“
      leiterzahl(g, x, Math.max(Math.max(frei, y) + 4, yE - 4.5 - hW), abgangArten(k, a, v).length + (a.sd ? ' + 3' : ''));
      if (wr) { setze(g, 'ue_wr', x, yE - hW); ueBmk(g, R3('ue_wr', x), R1('ue_wr', yE - hW), a.t.t, [], P - (x - R3('ue_wr', x))); }
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
  // Leitungen der Feldgeräte und Zusatzleitungen (ab v1.45, Prüfbericht E6): Leitungstyp bestimmt Adernzahl und
  // Kennung. „-J“ hat immer eine grün-gelbe Ader (hier Reserve bzw. Gehäuse-PE): Adernzahl + 1; „-O“ ohne gnge;
  // Steuerleitungen mit Zahlenkennung (LiYY, J-Y(St)Y, H05VV5-F) tragen Zahlen, die übrigen Farben nach HD 308.
  const ZAHLEN_TYP = /^(LiYY|LiYCY|J-Y\(St\)Y|H05VV5-F|H05VVC4V5-K)/;
  const FARBEN = { 1: ['br'], 2: ['br', 'bl'], 3: ['br', 'sw', 'gr'], 4: ['bl', 'br', 'sw', 'gr'] };
  function adern(typ, n) {
    typ = typ || 'NYM-J';
    const zahl = ZAHLEN_TYP.test(typ) || n > 4, j = /-J$/.test(typ) || /^H0[57]/.test(typ) && !ZAHLEN_TYP.test(typ);
    return { gesamt: n + (j ? 1 : 0), kennung: i => zahl ? String(i + 1) : FARBEN[n][i] };
  }
  function klemmenBloecke(v, e) {
    const bloecke = [], tnc = v.netzform === 'TN-C';
    const fiN = z => ['fils1n', 'fils3n', 'fi2', 'fi4'].includes(z);
    const ausgang = (z, kenn, l, ph) => {          // Anschluss unten am Gerät
      if (!z || !kenn) return null;
      if (l === 'PE' || l === 'PEN') return null;
      if (l === 'N') return fiN(z) ? `${kenn}:N` : null;
      const i = GERAETE[z].pole === 1 ? 0 : ({ L1: 0, L2: 1, L3: 2 }[ph] || 0);
      return `${kenn}:${2 * (i + 1)}`;
    };
    const schiene = (l, ph) => 'Schiene ' + (tnc && (l === 'N' || l === 'PE') ? 'PEN' : l === 'PEN' && !tnc ? 'PE' : l === 'L' ? (v.leiter === '1NPE' ? 'L' : ph) : l);
    const abgang = (k, grp) => {
      const a = e.abgaenge[k.id]; if (!a || !a.klemmen) return;
      const zeilen = a.leiter.map((l, i) => {
        const ph = l === 'L' ? (a.phase.t && a.phase.t !== 'L' ? a.phase.t : 'L1') : l;
        const si = a.schalt ? a.schalt.pole.indexOf(l) : -1;
        // Erzeugungszähler (PV, ab v1.34): Abgangsklemmen nach DIN 43857 – drei Phasen L1 3, L2 6, L3 9, N 12; eine Phase L 3, N 6
        const zp = a.p && l !== 'PE' ? (a.drei ? { L1: 3, L2: 6, L3: 9, N: 12 }[l] : { L: 3, N: 6 }[l]) : null;
        // Frequenzumrichter (U V W) und Überlastrelais (2 4 6) liegen näher an der Klemme als das Schaltgerät (ab v1.39)
        const li = { L1: 0, L2: 1, L3: 2 }[l];
        const sdI = { U2: 0, V2: 1, W2: 2 }[l];      // Stern-Dreieck (ab v1.40): U2 V2 W2 vom Dreieck-Schütz
        const intern = (sdI !== undefined && a.zusatz ? `${a.zusatz[1].schalt.bmk.t}:${2 * (sdI + 1)}` : null)
          || (a.fu && li !== undefined ? `${a.fu.t}:${'UVW'[li]}` : null)
          || (zp ? `${a.p.t}:${zp}` : null)
          || (a.ol && li !== undefined ? `${a.ol.bmk.t}:${2 * (li + 1)}` : null)
          || (si >= 0 ? `${a.schalt.bmk.t}:${2 * (si + 1)}` : null)
          || ausgang(k.geraet.zeichen, a.f && a.f.t, l, ph)
          || (grp && ausgang(grp.geraet.zeichen, e.geraete[grp.id] && e.geraete[grp.id].t, l, ph))
          || schiene(l, ph);
        const art = l === 'PE' ? 'Schutzleiterklemme' : l === 'PEN' ? 'PEN-Klemme' : l === 'N' ? (v.nKlemme === 'normal' ? 'N-Klemme' : 'N-Trennklemme') : 'Durchgangsklemme';
        const anzeige = l === 'L' ? (v.leiter === '1NPE' ? 'L' : ph) : (tnc && (l === 'N' || l === 'PE') ? 'PEN' : l);
        const ader = sdI !== undefined ? ['br', 'sw', 'gr'][sdI] : a.drei ? ADER[l] : ADER[l === 'L' ? 'L' : l];
        // Motor (ab v1.45): Ziel mit Motoranschluss U1 V1 W1 (U2 V2 W2) bzw. U1 U2 beim Wechselstrommotor
        const ma = k.ziel.anschluss === 'motor' && a.xd ? ({ L1: 'U1', L2: 'V1', L3: 'W1', U2: 'U2', V2: 'V2', W2: 'W2', PE: 'PE' }[l]
          || (l === 'L' ? 'U1' : l === 'N' ? 'U2' : l)) : null;
        const ziel = k.speist ? `→ ${(hilfK.name(k.speist)) || 'Verteiler'}` : [a.xd && (ma ? `${a.xd.t}:${ma}` : a.xd.t), k.ziel.bez, k.ziel.ort].filter(Boolean).join(' ');
        const leitung = a.sd ? (sdI !== undefined ? `${a.w2.t} ${k.leitung.typ || 'NYM-J'} ${adern(k.leitung.typ, 3).gesamt}×${k.leitung.quer || '?'}` : `${a.w.t} ${k.leitung.typ || 'NYM-J'} 4×${k.leitung.quer || '?'}`)
          : `${a.w.t} ${k.leitung.typ || 'NYM-J'} ${a.leiter.length}×${k.leitung.quer || '?'}`;
        return [String(a.klemmen.von + i), anzeige, art, intern, leitung, ader, ziel];
      });
      // Stern-Dreieck (ab v1.52): die gnge-Ader der zweiten Leitung (U2 V2 W2) liegt mit auf der Schutzleiterklemme
      const iPE = a.leiter.indexOf('PE');
      if (a.sd && iPE >= 0 && adern(k.leitung.typ, 3).gesamt > 3) { const pe = zeilen[iPE];
        zeilen.push([pe[0], 'PE', pe[2], pe[3], `${a.w2.t} ${k.leitung.typ || 'NYM-J'} ${adern(k.leitung.typ, 3).gesamt}×${k.leitung.quer || '?'}`, 'gnge', pe[6]]); }
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
      const lt = sf.leitung[f.gid], le = g.leitung || {}, ad = lt ? adern(le.typ, lt.adern) : null;
      const leitung = lt ? `${lt.w.t} ${le.typ || 'NYM-J'} ${ad.gesamt}×${le.quer || '1,5'}` : '';
      const p = kr && kr.pfade.find(x => x.id === f.p), platz = /:v$/.test(f.key) ? 6 : +f.key.split(':')[1];
      const zeilen = nrn.map((nr, i) => {
        ader[f.gid] = (ader[f.gid] || 0) + 1;
        // innen (ab v1.45): der Nachbar im Strompfad – oben der Anschluss darüber, unten der darunter
        const innen = p ? stNachbar(v, e, kr, p, platz, i === 0) : '';
        return [String(nr), ml && i ? 'N' : '', ml && i ? (v.nKlemme === 'normal' ? 'N-Klemme' : 'N-Trennklemme') : 'Durchgangsklemme',
          innen || 'Steuerstromkreis' + (sg ? ' ' + sg.schalt.bmk.t : ''), leitung, ad ? ad.kennung(ader[f.gid] - 1) : String(ader[f.gid]),
          `${kz}:${an[i]} ${[g.bez, g.ort].filter(Boolean).join(', ')}`.trim()];
      });
      bloecke.push({ kenn: kz, leiste: '-X1', zeilen });
    });
    return bloecke;
  }
  // Nachbaranschluss eines Platzes im Steuerstromkreis (ab v1.45) für die Spalte „intern“ des Klemmenplans:
  // oben = unterer Anschluss des nächsten Kontakts darüber (im Zweig weiter im Elternpfad, sonst die Steuerspannung L),
  // unten = oberer Anschluss des nächsten Kontakts darunter bzw. des Verbrauchers (Zweig: zurück in den Elternpfad)
  function stNachbar(v, e, kr, p, platz, oben) {
    const sf = e.steuer, pf = kr.pfade, j = pf.indexOf(p);
    const eltern = q => { const jj = pf.indexOf(q); if (!(jj > 0 && q.zweig)) return null;
      if (q.zweig.an) { const h = pf.find(x => x.id === q.zweig.an); if (h) return h; }
      let h = jj; while (h > 0 && pf[h].zweig) h--; return pf[h]; };
    const name = pl => { const sa = e.abgaenge[pl.g], ger = (v.steuerung.geraete || []).find(x => x.id === pl.g), zA = ST_ART_PLAN(pl.z);
      if (zA === 'ol') return sa && sa.ol ? sa.ol.bmk.t : '';
      if (zA === 'ms') return sa && sa.f ? sa.f.t : '';
      if (sa && sa.schalt) return sa.schalt.bmk.t;
      return ger && sf.geraete[ger.id] ? sf.geraete[ger.id].t : ''; };
    const zw = j > 0 && p.zweig ? p.zweig : null;
    if (oben) {
      for (let k = Math.min(platz, 6) - 1; k >= (zw ? zw.von : 0); k--) { const pl = p.plaetze[k];
        if (pl) { const kn = sf.kontakte[p.id + ':' + k]; return kn ? `${name(pl)}:${kn.an[1]}` : name(pl); } }
      if (zw) { const h = eltern(p); return h ? stNachbar(v, e, kr, h, zw.von, true) : ''; }
      return 'Steuerspannung L';
    }
    for (let k = platz + 1; k <= (zw ? Math.min(zw.bis, 5) : 5); k++) { const pl = p.plaetze[k];
      if (pl) { const kn = sf.kontakte[p.id + ':' + k]; return kn ? `${name(pl)}:${kn.an[0]}` : name(pl); } }
    if (platz >= 6) return 'Steuerspannung N';
    if (zw && zw.bis < 6) { const h = eltern(p); return h ? stNachbar(v, e, kr, h, zw.bis, false) : ''; }
    const vb = p.verbraucher; if (!vb) return '';
    const sa = e.abgaenge[vb.g], ger = (v.steuerung.geraete || []).find(x => x.id === vb.g);
    if (sa && sa.schalt) return `${sa.schalt.bmk.t}:A1`;
    return ger ? `${(sf.geraete[ger.id] || {}).t || ''}:${ger.zeichen === 'meldeleuchte' ? 'X1' : 'A1'}` : '';
  }
  const ST_ART_PLAN = z => /thermisch$/.test(z || '') ? 'ol' : /^mss_/.test(z || '') ? 'ms' : '';
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
      passend(text(g, xs[i] + 1, yy - 1.5, t, kopf ? 2.5 : 3, 'start', kopf ? {} : {}), w * sp[i][1] - 2.5));
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
  const ST_MELDER = /^(daemmerung|bewegung|praesenz|s_schwimmer|oe_schwimmer)$/;   // Beschriftung rechts (links sitzt die Betätigung)
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
  // Beschriftung im Steuerstromkreis (ab v1.42): rechtsbündig bis xr, links begrenzt auf die eigene Spalte
  // (erste Spalte: Rahmen + 1,5 mm, sonst Nachbarpfad); zu lange Zeilen werden an Leerzeichen bzw. Bindestrich umbrochen, der Rest begrenzt
  const zeitText = z => ('t = ' + z).replace(/ /g, '\u00a0');     // Zeitangabe wird nicht umbrochen (ab v1.50)
  // Umbruch an Leerzeichen bzw. Bindestrich (Breite geschätzt); ab v1.52 erst, wenn die Zeile auch auf 85 % gestaucht
  // nicht passt – sonst wurden kurze Texte wie „Taster 1“ in der ersten Spalte umbrochen, ihre Nachbarn nicht
  const breitSt = (t, gr) => t.length * gr * 0.5;
  function umbrechenSt(t, max) {
    if (breitSt(t, 2.2) * 0.85 <= max) return [t];
    const teile = t.split(/(?<=[ -])/), r = ['']; teile.forEach(w => { if (r[r.length - 1] && breitSt(r[r.length - 1] + w, 2.2) > max) r.push(w.trimStart()); else r[r.length - 1] += w; });
    return r.map(z => z.trim()).filter(Boolean);
  }
  function bmkSt(g, xPfad, xr, y, kenn, zeilen = []) {
    // links: in der ersten Spalte der Rahmen + 1,5 mm, sonst die Anschlussnummern des Nachbarpfads + 1,5 mm
    const links = xPfad - ST_LINKS - RAND_L < 0.5 ? RAND_L + 1.5 : xPfad - ST_LINKS - 1;
    const max = xr - links;
    if (kenn) passend(text(g, xr, y, kenn, 2.5, 'end', { 'font-weight': 'bold' }), max);
    zeilen.filter(Boolean).flatMap(t => umbrechenSt(t, max)).forEach((z, i) => passend(text(g, xr, y + 3.2 + 2.8 * i, z, 2.2, 'end'), max));
  }
  function stKreis(g, ctx, v, e, kr, col, R, lt, gem, anG) {
    const pf = kr.pfade, xs = pf.map((_, j) => R.x0 + (col - 1 + j) * R.sb + ST_LINKS);
    const xA = R.x0 + (col - 1) * R.sb + 7;        // Schienenanfang (kommender Querverweis)
    // Zweig hängt am vorigen Pfad ohne Zweig oder (ab v1.40) ausdrücklich an einem Pfad bzw. Zweig (zweig.an)
    const haupt = pf.map((p, j) => { if (j > 0 && p.zweig && p.zweig.an) { const h = pf.findIndex(q => q.id === p.zweig.an); if (h >= 0 && h < j) return h; }
      let h = j; while (h > 0 && pf[h].zweig) h--; return h; });
    const zweig = j => j > 0 && pf[j].zweig ? pf[j].zweig : null;
    // Quelle: eigener Abgriff im Abgang oder gemeinsame Steuerspannung
    const kid = gem ? gem.quelle : kr.quelle && kr.quelle.art === 'abgang' && !(e.abgaenge[kr.quelle.kid] || {}).ohneN ? kr.quelle.kid : null;
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
      // R3 (ab v1.50): eine Fluchtlinie je Spalte, 1,5 mm vor der am weitesten links gezeichneten Stelle aller Kontakte des Pfads;
      // der Verbraucher (Spule, Meldeleuchte) steht ab v1.51 mit 1,5 mm Abstand zu seinem eigenen Zeichen (Jean 04.11.2026)
      const zPl = pl => { if (!pl) return null; const sa = e.abgaenge[pl.g], ger = !sa && gerVon(pl.g), zArt = pl.z || (ger && ger.zeichen), z = ST_BILD[zArt] || zArt; return z && ZEICHEN[z] ? z : null; };
      const zSp = [];
      for (let i = von; i <= Math.min(bis, ST_PL - 1); i++) zSp.push(zPl(p.plaetze[i]));
      const xr = x - Math.max(0, ...zSp.filter(z => z && !ST_MELDER.test(z)).map(sichtLinks)) - 1.5;
      for (let i = von; i <= Math.min(bis, ST_PL - 1); i++) {
        const pl = p.plaetze[i]; if (!pl) continue;
        const sa = e.abgaenge[pl.g], ger = !sa && gerVon(pl.g);
        const zArt = pl.z || (ger && ger.zeichen), z = ST_BILD[zArt] || zArt; if (!z || !ZEICHEN[z]) continue;
        const top = stB(i) + 0.5; lt(x, y, x, top, lName);
        teil(`kr:${kr.id}/pl:${p.id}:${i}`);          // Kontakt samt Beschriftung als Teil der Szene (ab v1.31)
        const t = setze(g, z, x, top);
        const u = t.filter(q => q.richtung === 's').sort((p1, p2) => Math.abs(p1.x - x) - Math.abs(p2.x - x))[0];
        y = u ? u.y : top + 15;
        const [, re] = seiten(z), kn = st.kontakte[p.id + ':' + i];
        let an;
        const relais = sa && sa.schalt ? sa.schalt.bmk.t : ger && ger.zeichen === 'zeitrelais' && st.geraete[ger.id] ? st.geraete[ger.id].t : null;
        if (kn && (kn.ol || kn.ms)) {       // Überlastrelais bzw. Motorschutzschalter: Verweis auf den Abgang (ab v1.38)
          const la = ctx.lage[pl.g], kz = kn.ol ? (sa && sa.ol ? sa.ol.bmk.t : '?') : (sa && sa.f ? sa.f.t : '?');
          bmkSt(g, x, xr, R1(z, top), kz, [la ? `/${la.blatt}.${la.spalte}` : '']);
          an = kn.an;
        } else if (relais) {            // Kontakt eines Schaltgeräts oder eigenständigen Zeitrelais mit Verweis auf die Spule
          const sp = ctx.steuer.spulen[pl.g];
          bmkSt(g, x, xr, R1(z, top), relais, [sp ? `/${sp.blatt}.${sp.spalte}` : '']);
          an = kn ? kn.an : ['', ''];
        } else {
          const kz = ger && st.geraete[ger.id] ? st.geraete[ger.id].t : '', zl = ger ? [pl.bez || ger.bez, ger.ort, st.feld && st.feld[p.id + ':' + i] ? leitungText(ger.id) : ''] : [];
          if (ST_MELDER.test(z)) {     // Melder und Schwimmer (ab v1.41): links sitzt die Betätigung, Beschriftung rechts
            // ab v1.52 begrenzt: bis 5,5 mm in die nächste Spalte – dort bleibt 1,5 mm frei vor einem kurzen Kennzeichen (-S1),
            // das rechtsbündig an der Fluchtlinie des Nachbarpfads steht
            const yb = R1(z, top), max = R.sb - ST_LINKS + 3;
            passend(text(g, x + 2.5, yb, kz, 2.5, 'start', { 'font-weight': 'bold' }), max);
            zl.filter(Boolean).flatMap(t => umbrechenSt(t, max)).forEach((s, n) => passend(text(g, x + 2.5, yb + 3.2 + 2.8 * n, s, 2.2, 'start'), max));
          } else bmkSt(g, x, xr, R1(z, top), kz, zl);
          an = kn ? kn.an : /_oe|notaus/.test(z) ? ['11', '12'] : ['13', '14'];
        }
        text(g, x + re + 0.8, top + 2.2, an[0], 1.8); text(g, x + re + 0.8, y - 0.6, an[1], 1.8);
        const fk = st.feld && st.feld[p.id + ':' + i];
        if (fk) { feldKlemme(x, top + 1.2, fk[0]); feldKlemme(x, y - 1.2, fk[1]); }
        teil(null);
      }
      if (bis >= ST_PL) {
        const vb = p.verbraucher, sa = vb && e.abgaenge[vb.g];
        const ger = vb && !sa && gerVon(vb.g);
        const zr = ger && ger.zeichen === 'zeitrelais';         // eigenständiges Zeitrelais
        const z = sa && sa.schalt ? spulenZeichen(sa.schalt) : zr ? 'spule_' + (ger.fkt || 'aus') : ger ? ger.zeichen : null;
        if (z && ZEICHEN[z]) {
          lt(x, y, x, ST_YV, lName);
          const vk = `kr:${kr.id}/pl:${p.id}:${ST_PL}`;
          teil(vk);
          const t = setze(g, z, x, ST_YV);
          const u = t.find(q => q.richtung === 's'); y = u ? u.y : ST_YV + 10;
          const [, re] = seiten(z);
          if (sa) {
            const sg = sa.schalt;
            bmkSt(g, x, R3(z, x), R1(z, ST_YV), sg.bmk.t, [sg.typ === 'zeitrelais' && sg.zr.zeit ? zeitText(sg.zr.zeit) : sg.rolle || '']);
            teil(null); stSpiegel(g, ctx, e, vb.g, x, yN + 4); teil(vk);      // der Kontaktspiegel bleibt unter N
          } else if (zr) {
            bmkSt(g, x, R3(z, x), R1(z, ST_YV), st.geraete[ger.id] ? st.geraete[ger.id].t : '', [ger.zeit ? zeitText(ger.zeit) : '']);
            teil(null); stSpiegel(g, ctx, e, vb.g, x, yN + 4, ger); teil(vk);
          } else bmkSt(g, x, R3(z, x), R1(z, ST_YV), ger && st.geraete[ger.id] ? st.geraete[ger.id].t : '', ger ? [ger.bez, ger.ort, st.feld && st.feld[p.id + ':v'] ? leitungText(ger.id) : ''] : []);
          text(g, x + re + 0.8, ST_YV + 2.2, sa || zr ? 'A1' : 'X1', 1.8); text(g, x + re + 0.8, y - 0.6, sa || zr ? 'A2' : 'X2', 1.8);
          const fk = st.feld && st.feld[p.id + ':v'];
          if (fk) { feldKlemme(x, ST_YV - 1.6, fk[0], true); feldKlemme(x, y + 1.6, fk[1], true); }
          teil(null);
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
    const la = ctx.lage[kid] || ctx.lage[String(kid).split('~')[0]], gen = (e.steuer.genutzt || {})[kid] || { s: [], o: [] };
    const lageText = key => { const l = ctx.steuer.kontakte[key]; return l ? `/${l.blatt}.${l.spalte}` : ''; };
    // Spalte je Pol (ab v1.42): Pole rechts im Abgang (N, Zusatzschütze) können in der nächsten Spalte stehen
    const basis = String(kid).split('~'), ab = e.abgaenge[basis[0]] || {};
    const versatz = !basis[1] ? 0 : ab.wende ? 5 : ab.sd ? (basis[1] === '2' ? 10 : 5) : 0;
    const polSpalte = i => la.spalte + Math.floor((LINKS + ABSTAND * (versatz + i)) / ctx.R.sb);
    const haupt = sg.pole.map((_, i) => [`${2 * i + 1}–${2 * i + 2}`, la ? `/${la.blatt}.${ctx.R ? polSpalte(i) : la.spalte}` : '']);
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
      text(g, xl, yy, t, 3 * s, 'start', {});
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
      passend(text(g, xs[i] + 1, yy - 1.8, t, kopf ? 2.5 : 3.2, 'start', kopf ? {} : {}), max);
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
    el('circle', { cx: x, cy: y, r: 3.2, fill: '#fff', stroke: '#6a35e8', 'stroke-width': 0.45 }, m);
    linie(m, x - 1.8, y, x + 1.8, y, 0.5, '#6a35e8'); linie(m, x, y - 1.8, x, y + 1.8, 0.5, '#6a35e8');
  }
  // Zusätze eines Blatts: Anker gleich; auf dem ersten Blatt auch solche, deren Anker kein Blatt mehr hat
  let ankerAlle = null;
  function zusaetze(v, anker, erstes) {
    const z = (v.layout && v.layout.zusatz) || [];
    return z.filter(x => x.blatt === anker || (erstes && ankerAlle && !ankerAlle.has(x.blatt)));
  }
  // Kennung eines Blatts, unabhängig von seiner Nummer: erster Abgang bzw. die Einspeisung
  function blattAnker(v, b) { const it = b.items.find(x => x.art !== 'spd'); return it ? 'k:' + it.k.id : 'e:' + v.id; }
  let letzteGruppeYK = 0;   // Oberkante der Abgänge in der zuletzt gezeichneten Gruppe
  function blaetter(P, BIB, hilf, opt = {}) {
    if (ZEICHEN_BIB !== BIB) { ZEICHEN = Object.fromEntries(BIB.zeichen.map(z => [z.kennung, z])); ZC = {}; SICHT = {}; SLI = {}; ZEICHEN_BIB = BIB; }
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
    ankerAlle = new Set(); plaene.forEach(p => { p.blaetter.forEach(b => ankerAlle.add(blattAnker(p.v, b))); p.st.forEach(b => ankerAlle.add('kr:' + b.kreise[0].kr.id)); });
    const gesamt = nr;
    // Lage der Abgänge (für Querverweise vom Unterverteiler zurück)
    const lage = {};
    plaene.forEach(p => p.blaetter.forEach((b, i) => b.items.forEach(it => {
      if (it.art === 'abgang') lage[it.k.id] = { blatt: p.start + i, spalte: it.col };
      if (it.art === 'gruppe') { let c = it.col; it.k.kinder.forEach(k => { if (k.typ !== 'abgang') return; lage[k.id] = { blatt: p.start + i, spalte: c };
        c += abgangSpalten(k, p.e.abgaenge[k.id], p.v, R); }); }
    })));
    ctx.lage = lage; ctx.R = R; ctx.steuer = { kreise: {}, kontakte: {}, spulen: {} };
    plaene.forEach(p => stLagen(p, ctx.steuer));
    // 2. Durchgang: zeichnen
    const aus = [];
    const neuesBlatt = () => {
      const svg = el('svg', { viewBox: `0 0 ${F.w} ${F.h}`, width: `${F.w}mm`, height: `${F.h}mm` });
      el('rect', { x: 0, y: 0, width: F.w, height: F.h, fill: '#fff' }, svg);
      const g = el('g', {}, svg); rahmen(g, F); return { svg, g };
    };
    if (mitVorn && !opt.nur) {
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
      if (opt.nur) continue;           // Editor (ab v1.23): nur die Blätter des offenen Verteilers
      const { v, e } = p, sp = hilf.speisenderAbgang(v.id);
      let herkunft = `Netz ${v.netzform}, ${netzLeiter(v)}`;
      if (sp) { const l = lageUe[sp.k.id], fz = hilf.berechne(sp.v).abgaenge[sp.k.id].f; herkunft = `von ${sp.v.name}${fz ? ' ' + fz.t : ''}${l ? ` /${l.blatt}.${l.spalte}` : ''}`; }
      p.ue.forEach((b, i) => {
        const blattNr = p.ueStart + i, { svg, g } = neuesBlatt();
        ueZeichne(g, ctx, v, e, F, R, b, i, p.ue.length, herkunft, blattNr);
        schriftfeld(g, F, Object.assign({}, P.projekt, { titel: 'Übersichtsschaltplan', verteiler: v.name, blatt: blattNr, blaetter: gesamt }));
        aus.push({ svg, verteiler: v.name, titel: v.name, nr: blattNr, art: 'uebersicht' });
      });
    }
    for (const p of plaene) {
      if (opt.nur && p.v.id !== opt.nur) continue;
      const { v, e } = p;
      const sp = hilf.speisenderAbgang(v.id);
      let herkunft = `Netz ${v.netzform}, ${netzLeiter(v)}`;
      if (sp) { const l = lage[sp.k.id], fz = hilf.berechne(sp.v).abgaenge[sp.k.id].f; herkunft = `von ${sp.v.name}${fz ? ' ' + fz.t : ''}${l ? ` /${l.blatt}.${l.spalte}` : ''}`; }
      p.blaetter.forEach((b, i) => {
        const blattNr = p.start + i, naechstes = i + 1 < p.blaetter.length ? `/${blattNr + 1}.1` : null;
        const { svg, g } = neuesBlatt();
        szeneStart(g);
        const xEnde = R.x1 - 12;
        let bars;
        if (b.art === 'einspeisung') {
          const ein = mitOrt('e:' + v.id, () => zeichneEinspeisung(g, v, e, R.x0 + R.sb, 16, herkunft));
          const y0 = ein.cursor + 10;
          if (opt.ziele) ziel(g, R.x0, RAND, 3 * R.sb, y0 - RAND, 'e:' + v.id);
          mitOrt('e:' + v.id, () => ein.namen.forEach((n, j) => leiter(g, ein.xs[j], ein.enden[j], ein.xs[j], y0 + ABSTAND * j, n)));
          zeichneSchienen(g, v, y0, ein.xs, xEnde, null, naechstes, false);
        } else {
          if (b.art === 'kombiniert') {
            const ein = mitOrt('e:' + v.id, () => zeichneEinspeisung(g, v, e, R.x0, 14, herkunft));
            mitOrt('e:' + v.id, () => ein.namen.forEach((n, j) => leiter(g, ein.xs[j], ein.enden[j], ein.xs[j], b.y0 + ABSTAND * j, n)));
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
            if (it.art === 'spd') mitOrt('s:' + v.id, () => zeichneSpd(g, v, e, xSp, bars, yG));
            else if (it.art === 'abgang') mitOrt('k:' + it.k.id, () => zeichneAbgang(g, ctx, v, it.k, e.abgaenge[it.k.id], xSp, bars, yG, it.w * R.sb, yEnde));
            else mitOrt('k:' + it.k.id, () => zeichneGruppe(g, ctx, v, e, it.k, xSp, bars, yG, it.w, R, yEnde));
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
        if (v.layout && v.layout.lage) lageAnwenden(g, v.layout.lage);
        if (v.layout && v.layout.wege) wegeAnwenden(g, v.layout.wege);
        const anker = blattAnker(v, b), pruef = SZ.hinweise.concat(zusatzZeichnen(g, zusaetze(v, anker, i === 0), opt));
        const szene = szeneEnde();
        schriftfeld(g, F, Object.assign({}, P.projekt, { verteiler: v.name, blatt: blattNr, blaetter: gesamt }));
        if (opt.ziele) ziel(g, RAND_L, F.h - RAND - SF_H, F.w - RAND - RAND_L, SF_H, 'p:');
        aus.push({ svg, verteiler: v.name, vid: v.id, titel: v.name, nr: blattNr, gesamt, art: b.art, szene, anker, pruef,
          spalten: b.items.map(it => ({ id: it.k ? it.k.id : null, col: it.col, w: it.w })) });
      });
      p.st.forEach((b, i) => {
        const blattNr = p.stStart + i, { svg, g } = neuesBlatt();
        szeneStart(g);
        stBlatt(g, ctx, v, e, b, R, F, blattNr, p.stStart + Math.max(0, ...p.st.map((x, j) => x.kreise.some(k => k.gem) ? j : -1)));
        if (v.layout && v.layout.lage) lageAnwenden(g, v.layout.lage);
        const anker = 'kr:' + b.kreise[0].kr.id, pruef = SZ.hinweise.concat(zusatzZeichnen(g, zusaetze(v, anker, false), opt));
        const szene = szeneEnde();
        if (opt.ziele) b.kreise.forEach(({ kr, col }) => {
          ziel(g, R.x0 + (col - 1) * R.sb, RAND, kr.pfade.length * R.sb, F.h - RAND - SF_H - 2 - RAND, 'kr:' + kr.id);
          // je Pfad die Plätze 1–6 und der Verbraucherplatz (pl:pfad:zeile, Zeile 6 = Verbraucher)
          kr.pfade.forEach((pf, j) => { const x = R.x0 + (col - 1 + j) * R.sb;
            for (let i = 0; i < ST_PL; i++) ziel(g, x, stB(i), R.sb, ST_H, `pl:${pf.id}:${i}`);
            ziel(g, x, stB(ST_PL), R.sb, ST_YN - stB(ST_PL), `pl:${pf.id}:${ST_PL}`); });
        });
        schriftfeld(g, F, Object.assign({}, P.projekt, { titel: 'Steuerstromkreis', verteiler: v.name, blatt: blattNr, blaetter: gesamt }));
        if (opt.ziele) ziel(g, RAND_L, F.h - RAND - SF_H, F.w - RAND - RAND_L, SF_H, 'p:');
        aus.push({ svg, verteiler: v.name, vid: v.id, titel: v.name, nr: blattNr, gesamt, art: 'steuerung', kreise: b.kreise.map(x => x.kr.id), szene, anker, pruef });
      });
    }
    for (const p of plaene) if (!opt.nur) p.kl.forEach((b, i) => {
      const blattNr = p.klStart + i, { svg, g } = neuesBlatt();
      zeichneKlemmenplan(g, F, p.v, b.bloecke, b.teil, b.teile, b.leiste);
      schriftfeld(g, F, Object.assign({}, P.projekt, { titel: 'Klemmenplan', verteiler: p.v.name, blatt: blattNr, blaetter: gesamt }));
      aus.push({ svg, verteiler: p.v.name, titel: p.v.name, nr: blattNr, art: 'klemmen' });
    });
    return { blaetter: aus, format: P.projekt.format || 'A4', begrenzen, raster: { x0: R.x0, sb: R.sb, sp: F.sp, w: F.w, h: F.h, sfTop: F.h - RAND - SF_H } };
  }
  return { blaetter };
})();
