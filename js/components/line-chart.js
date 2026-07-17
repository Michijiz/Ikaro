/* ============================================================
   IKARO — Line chart in SVG puro
   Disegna una spezzata con area sfumata, punti e label sull'asse X.
   Usato per l'andamento del peso corporeo.
   ============================================================ */

/**
 * Crea un line chart SVG.
 * @param {Array<{label:string, value:number}>} points
 * @param {Object} opts { width, height, color, unit, id }
 * @returns {string} markup SVG
 */
export function lineChart(points, opts = {}) {
  // L'id del gradiente deve essere unico nel documento: con due grafici
  // nella stessa vista (peso + nutrizione) il secondo ereditava il
  // gradiente del primo, perché gli id duplicati non sono validi.
  const gid = `areaFill-${opts.id || Math.random().toString(36).slice(2, 8)}`;
  const W = opts.width || 340;
  const H = opts.height || 160;
  const color = opts.color || 'var(--accent)';
  const unit = opts.unit || '';
  const padX = 16, padTop = 18, padBottom = 26;

  if (!points || points.length === 0) return '';

  const values = points.map(p => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }        // evita divisione per zero
  const range = max - min;
  min -= range * 0.15; max += range * 0.15;       // margine visivo

  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

  const xy = points.map((p, i) => {
    const x = padX + (points.length > 1 ? i * stepX : innerW / 2);
    const y = padTop + innerH - ((p.value - min) / (max - min)) * innerH;
    return { x, y };
  });

  const path = xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L${xy[xy.length - 1].x.toFixed(1)},${H - padBottom} L${xy[0].x.toFixed(1)},${H - padBottom} Z`;

  const dots = xy.map((p, i) => {
    const last = i === xy.length - 1;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${last ? 4.5 : 3}"
      fill="${last ? color : 'var(--card)'}" stroke="${color}" stroke-width="2"/>`;
  }).join('');

  const labels = points.map((p, i) => {
    const x = padX + (points.length > 1 ? i * stepX : innerW / 2);
    return `<text x="${x.toFixed(1)}" y="${H - 8}" text-anchor="middle"
      font-size="9.5" fill="var(--text-faint)" font-family="inherit">${p.label}</text>`;
  }).join('');

  // Valore in evidenza sull'ultimo punto
  const last = xy[xy.length - 1];
  const lastVal = points[points.length - 1].value;
  const labelX = Math.min(Math.max(last.x, padX + 24), W - padX - 24);

  return `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafico andamento">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#${gid})"/>
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      ${labels}
      <text x="${labelX.toFixed(1)}" y="${Math.max(12, last.y - 10).toFixed(1)}"
            text-anchor="middle" font-size="11" font-weight="700"
            fill="var(--text)" font-family="inherit">${lastVal}${unit}</text>
    </svg>
  `;
}
