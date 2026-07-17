/* ============================================================
   IKARO — Donut chart in SVG puro
   Riceve segmenti { value, color } e disegna un anello con
   archi proporzionali. Nessuna dipendenza esterna.
   ============================================================ */

/**
 * Crea un donut chart SVG.
 * @param {Array<{value:number,color:string}>} segments
 * @param {Object} opts { size, stroke, centerHTML }
 * @returns {string} markup SVG (+ eventuale label centrale via foreignObject)
 */
export function donutChart(segments, opts = {}) {
  const size = opts.size || 180;
  const stroke = opts.stroke || 20;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;

  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;

  let offset = 0;
  const gap = segments.filter(s => s.value > 0).length > 1 ? 2 : 0; // piccolo respiro tra archi

  const arcs = segments.map(seg => {
    const frac = Math.max(0, seg.value) / total;
    const len = Math.max(0, frac * circ - gap);
    const dash = `${len} ${circ - len}`;
    const el = frac > 0 ? `
      <circle cx="${c}" cy="${c}" r="${r}"
        fill="none" stroke="${seg.color}" stroke-width="${stroke}"
        stroke-dasharray="${dash}" stroke-dashoffset="${-offset}"
        stroke-linecap="${gap ? 'round' : 'butt'}" />` : '';
    offset += frac * circ;
    return el;
  }).join('');

  return `
    <svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Ripartizione macro"
         style="transform: rotate(-90deg); max-width:${size}px; margin:0 auto;">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none"
              stroke="var(--macro-rest)" stroke-width="${stroke}" />
      ${arcs}
    </svg>
  `;
}

/**
 * Anello di progresso a valore singolo (calorie consumate su obiettivo).
 * Diverso da donutChart: qui conta il progresso, non la ripartizione.
 * Oltre il 100% l'anello resta pieno e vira su --warn: l'informazione
 * "sei oltre" sta nel colore, non in un arco che si riavvolge.
 * @param {number} value
 * @param {number} max
 * @param {Object} opts { size, stroke, color }
 * @returns {string} markup SVG
 */
export function progressRing(value, max, opts = {}) {
  const size = opts.size || 108;
  const stroke = opts.stroke || 9;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;

  const frac = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const over = max > 0 && value > max;
  const color = over ? 'var(--warn)' : (opts.color || 'var(--accent)');
  const len = frac * circ;

  return `
    <svg viewBox="0 0 ${size} ${size}" role="img"
         aria-label="Progresso ${Math.round(frac * 100)}%"
         style="transform: rotate(-90deg); width:100%; height:auto;">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none"
              stroke="var(--macro-rest)" stroke-width="${stroke}" />
      ${frac > 0 ? `
        <circle cx="${c}" cy="${c}" r="${r}" fill="none"
                stroke="${color}" stroke-width="${stroke}"
                stroke-dasharray="${len} ${circ - len}"
                stroke-linecap="round"
                style="transition: stroke-dasharray var(--t-med) var(--ease);" />` : ''}
    </svg>
  `;
}
