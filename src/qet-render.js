/* QET-Übersetzer: liest eine QElectroTech-Elementdatei (.elmt, XML) unverändert
   ein und gibt eine SVG-Gruppe zurück. Koordinaten bleiben die des Elements
   (Ursprung = Bezugspunkt "hotspot"), damit Maße und Anschlusspunkte exakt
   erhalten bleiben. */
const QET = (() => {
  const NS = 'http://www.w3.org/2000/svg';

  const FARBEN = { black:'#000', white:'#fff', red:'#d00', green:'#080', blue:'#00c',
    gray:'#888', grey:'#888', lightgray:'#ccc', brown:'#840', yellow:'#ee0',
    cyan:'#0cc', magenta:'#c0c', orange:'#f80', purple:'#808' };
  const STAERKE = { none:0, thin:0.5, normal:1, hight:2, eleve:3 };

  function stil(s) {
    const o = {};
    (s || '').split(';').forEach(t => { const [k, v] = t.split(':'); if (k) o[k.trim()] = (v || '').trim(); });
    const farbe = FARBEN[o.color] || (o.color && o.color.startsWith('#') ? o.color : '#000');
    let fuell = 'none';
    if (o.filling && o.filling !== 'none' && !/^(hor|ver|bdiag|fdiag)$/.test(o.filling))
      fuell = FARBEN[o.filling] || (o.filling.startsWith('#') ? o.filling : 'none');
    const w = o['line-weight'] in STAERKE ? STAERKE[o['line-weight']] : 1;
    let dash = null;
    if (o['line-style'] === 'dashed') dash = '4 2';
    else if (o['line-style'] === 'dotted') dash = '1 1.5';
    else if (o['line-style'] === 'dashdotted') dash = '4 1.5 1 1.5';
    return { farbe, fuell, w, dash };
  }

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    return e;
  }
  function strich(e, st) {
    e.setAttribute('stroke', st.w === 0 ? 'none' : st.farbe);
    e.setAttribute('stroke-width', st.w || 0);
    if (st.dash) e.setAttribute('stroke-dasharray', st.dash);
    e.setAttribute('stroke-linecap', 'square');
    e.setAttribute('stroke-linejoin', 'miter');
    return e;
  }
  const n = (x, a, d = 0) => { const v = parseFloat(x.getAttribute(a)); return isNaN(v) ? d : v; };

  // Linienenden: simple, triangle, circle, diamond
  function ende(g, x, y, wx, wy, art, len, st) {
    if (!art || art === 'none') return;
    const L = Math.hypot(wx, wy) || 1, ux = wx / L, uy = wy / L, px = -uy, py = ux, l = len || 1.5;
    if (art === 'simple' || art === 'triangle') {
      const bx = x - ux * l, by = y - uy * l;
      const p = `${bx + px * l / 2},${by + py * l / 2} ${x},${y} ${bx - px * l / 2},${by - py * l / 2}`;
      g.appendChild(strich(el(art === 'simple' ? 'polyline' : 'polygon',
        { points: p, fill: art === 'triangle' ? st.farbe : 'none' }), st));
    } else if (art === 'circle') {
      g.appendChild(strich(el('circle', { cx: x - ux * l / 2, cy: y - uy * l / 2, r: l / 2, fill: 'none' }), st));
    } else if (art === 'diamond') {
      const cx = x - ux * l / 2, cy = y - uy * l / 2, h = l / 2;
      g.appendChild(strich(el('polygon', { points:
        `${cx + ux * h},${cy + uy * h} ${cx + px * h},${cy + py * h} ${cx - ux * h},${cy - uy * h} ${cx - px * h},${cy - py * h}`,
        fill: 'none' }), st));
    }
  }

  function schrift(e) {
    const f = e.getAttribute('font');
    if (f) { const p = f.split(','); return { fam: p[0] || 'Liberation Sans', size: parseFloat(p[1]) || 9 }; }
    return { fam: 'Liberation Sans', size: n(e, 'size', 9) };
  }

  /* opts: { labels: true|false, terminals: true|false, texte: {label:'-F1', ...} } */
  function zeichne(xmlText, opts = {}) {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    const def = doc.documentElement;
    const g = el('g', {});
    const desc = def.getElementsByTagName('description')[0];
    const anschluesse = [];
    if (!desc) return { g, def, anschluesse };
    for (const e of Array.from(desc.children)) {
      const st = stil(e.getAttribute('style'));
      switch (e.tagName) {
        case 'line': {
          const x1 = n(e, 'x1'), y1 = n(e, 'y1'), x2 = n(e, 'x2'), y2 = n(e, 'y2');
          g.appendChild(strich(el('line', { x1, y1, x2, y2 }), st));
          ende(g, x1, y1, x1 - x2, y1 - y2, e.getAttribute('end1'), n(e, 'length1', 1.5), st);
          ende(g, x2, y2, x2 - x1, y2 - y1, e.getAttribute('end2'), n(e, 'length2', 1.5), st);
          break;
        }
        case 'rect':
          g.appendChild(strich(el('rect', { x: n(e, 'x'), y: n(e, 'y'), width: n(e, 'width'), height: n(e, 'height'),
            rx: n(e, 'rx') || null, ry: n(e, 'ry') || null, fill: st.fuell }), st));
          break;
        case 'ellipse': {
          const w = n(e, 'width'), h = n(e, 'height');
          g.appendChild(strich(el('ellipse', { cx: n(e, 'x') + w / 2, cy: n(e, 'y') + h / 2, rx: w / 2, ry: h / 2, fill: st.fuell }), st));
          break;
        }
        case 'circle': {
          const d = n(e, 'diameter');
          g.appendChild(strich(el('circle', { cx: n(e, 'x') + d / 2, cy: n(e, 'y') + d / 2, r: d / 2, fill: st.fuell }), st));
          break;
        }
        case 'arc': {
          // Qt-Konvention: 0° = 3 Uhr, positive Winkel gegen den Uhrzeigersinn
          const x = n(e, 'x'), y = n(e, 'y'), w = n(e, 'width'), h = n(e, 'height');
          const rx = w / 2, ry = h / 2, cx = x + rx, cy = y + ry;
          const a0 = n(e, 'start') * Math.PI / 180, da = n(e, 'angle') * Math.PI / 180;
          const p = a => [cx + rx * Math.cos(a), cy - ry * Math.sin(a)];
          const [sx, sy] = p(a0), [ex, ey] = p(a0 + da);
          const gross = Math.abs(da) > Math.PI ? 1 : 0, sweep = da > 0 ? 0 : 1;
          let d;
          if (Math.abs(da) >= 2 * Math.PI - 1e-6) {
            const [mx, my] = p(a0 + Math.PI);
            d = `M${sx},${sy} A${rx},${ry} 0 1 ${sweep} ${mx},${my} A${rx},${ry} 0 1 ${sweep} ${sx},${sy}`;
          } else d = `M${sx},${sy} A${rx},${ry} 0 ${gross} ${sweep} ${ex},${ey}`;
          g.appendChild(strich(el('path', { d, fill: st.fuell }), st));
          break;
        }
        case 'polygon': {
          const pts = [];
          for (let i = 1; e.hasAttribute('x' + i); i++) pts.push(n(e, 'x' + i) + ',' + n(e, 'y' + i));
          const zu = e.getAttribute('closed') !== 'false';
          g.appendChild(strich(el(zu ? 'polygon' : 'polyline', { points: pts.join(' '), fill: zu ? st.fuell : 'none' }), st));
          break;
        }
        case 'text': {
          const f = schrift(e), rot = n(e, 'rotation');
          const t = el('text', { x: n(e, 'x'), y: n(e, 'y'), 'font-family': 'Liberation Sans, Arial, Helvetica, sans-serif',
            'font-size': f.size * 1.33, fill: FARBEN[e.getAttribute('color')] || '#000',
            transform: rot ? `rotate(${rot} ${n(e, 'x')} ${n(e, 'y')})` : null });
          t.textContent = e.getAttribute('text') || '';
          g.appendChild(t);
          break;
        }
        case 'dynamic_text':
        case 'input': {
          if (opts.labels === false) break;
          const f = schrift(e);
          const info = (e.getElementsByTagName('info_name')[0] || {}).textContent || e.getAttribute('tagg') || '';
          const fest = (e.getElementsByTagName('text')[0] || {}).textContent || e.getAttribute('text') || '';
          const wert = (opts.texte && opts.texte[info]) || fest || (info ? '{' + info + '}' : '');
          if (!wert) break;
          const x = n(e, 'x'), y = n(e, 'y'), rot = n(e, 'rotation');
          const t = el('text', { x, y: e.tagName === 'input' ? y : y + f.size * 1.33,
            'font-family': 'Liberation Sans, Arial, Helvetica, sans-serif', 'font-size': f.size * 1.33,
            fill: opts.texte && opts.texte[info] ? '#000' : '#2563eb',
            transform: rot ? `rotate(${rot} ${x} ${y})` : null, class: 'qet-dyn' });
          t.textContent = wert;
          g.appendChild(t);
          break;
        }
        case 'terminal': {
          const x = n(e, 'x'), y = n(e, 'y'), o = e.getAttribute('orientation') || 'n';
          anschluesse.push({ x, y, richtung: o, name: e.getAttribute('name') || '' });
          if (opts.terminals) {
            const d = { n: [0, -4], s: [0, 4], e: [4, 0], w: [-4, 0] }[o] || [0, 0];
            g.appendChild(el('line', { x1: x, y1: y, x2: x + d[0], y2: y + d[1], stroke: '#e11d48', 'stroke-width': 1.2, class: 'qet-term' }));
            g.appendChild(el('circle', { cx: x, cy: y, r: 1.6, fill: '#e11d48', class: 'qet-term' }));
          }
          break;
        }
      }
    }
    return { g, def, anschluesse };
  }

  function name(xmlText, lang = 'de') {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    const ns = Array.from(doc.getElementsByTagName('name'));
    const t = ns.find(x => x.getAttribute('lang') === lang) || ns.find(x => x.getAttribute('lang') === 'en') || ns[0];
    return t ? t.textContent.trim() : '';
  }

  return { zeichne, name };
})();
