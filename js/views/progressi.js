/* ============================================================
   IKARO — Vista Progressi
   Quattro andamenti, tutti sui dati reali:
     Peso · Nutrizione (kcal) · Idratazione · Massimali 1RM
   Lo storico nutrizionale vive su IndexedDB: si legge async e
   la vista si completa da sola quando arriva.
   ============================================================ */

import {
  getState, update, subscribe, todayKey, uid,
  nutritionLastDays, getWorkoutHistory,
} from '../store.js';
import { lineChart } from '../components/line-chart.js';
import { toast, parseDecimal, fmtNum } from '../components/ui.js';

// Finestra dei grafici, persiste tra i re-render della visita
let giorni = 7;

export function renderProgressi(root) {
  const unsub = subscribe(() => paint(root));
  paint(root);
  return () => unsub();
}

function paint(root) {
  const s = getState();
  const weights = [...s.weights].sort((a, b) => a.data.localeCompare(b.data));

  const chartPoints = weights.slice(-giorni).map(w => ({
    label: shortDay(w.data), value: w.peso,
  }));

  const current = weights.length ? weights[weights.length - 1].peso : null;
  const { media, delta } = weekStats(weights);
  const target = s.profile.goals.weightTarget;
  const daTarget = current !== null ? round1(current - target) : null;

  const m = s.maxes;
  const gain = round1((m.squat - m.prev.squat) + (m.panca - m.prev.panca) + (m.stacco - m.prev.stacco));
  const storico = getWorkoutHistory();

  root.innerHTML = `
    <header class="page-head">
      <div class="title">
        <h1>Progressi</h1>
        <div class="sub">${storico.length} sessioni registrate</div>
      </div>
    </header>

    <div class="segmented" id="seg">
      ${[7, 30, 90].map(n =>
        `<button data-g="${n}" class="${n === giorni ? 'on' : ''}">${n} giorni</button>`).join('')}
    </div>

    <div class="card mt-16">
      <div class="between">
        <div class="card-title" style="margin:0;">Peso corporeo</div>
        ${current !== null
          ? `<strong class="accent tabular">${fmtNum(current, 1)} kg</strong>` : ''}
      </div>

      ${chartPoints.length >= 2 ? `
        <div class="chart-wrap mt-16">${lineChart(chartPoints, { unit: '', id: 'w' })}</div>
      ` : `
        <div class="empty" style="padding:22px 8px;">
          <div class="icon">⚖️</div>
          ${chartPoints.length === 0
            ? 'Nessuna pesata.<br>Registra la prima per vedere l&rsquo;andamento.'
            : 'Serve almeno una seconda pesata per tracciare una linea.'}
        </div>`}

      <div class="stat-row">
        ${statCell(media !== null ? fmtNum(media, 1) : '—', 'Media', media !== null ? 'kg' : '')}
        ${statCell(delta !== null ? `${delta > 0 ? '+' : ''}${fmtNum(delta, 1)}` : '—', 'Variazione', delta !== null ? 'kg' : '', deltaColor(delta))}
        ${statCell(daTarget !== null ? `${daTarget > 0 ? '+' : ''}${fmtNum(daTarget, 1)}` : '—', 'Dal target', daTarget !== null ? 'kg' : '')}
      </div>

      <div class="row mt-16">
        <input id="w-input" type="text" inputmode="decimal" enterkeyhint="done"
               placeholder="Nuovo peso (kg)" class="grow" aria-label="Nuovo peso in kg">
        <button class="btn btn-primary" id="w-add">Registra</button>
      </div>
    </div>

    <!-- Riempita in modo asincrono da IndexedDB -->
    <div id="nutri-mount" class="mt-16">
      <div class="card">
        <div class="card-title">Nutrizione</div>
        <div class="empty" style="padding:22px 8px;"><span class="faint">Carico lo storico…</span></div>
      </div>
    </div>

    <div class="card mt-16">
      <div class="between">
        <div class="card-title" style="margin:0;">Massimali (1RM)</div>
        ${gain > 0 ? `<span class="badge badge-ok">+${fmtNum(gain, 1)} kg</span>` : ''}
      </div>
      <div class="col mt-16" style="gap:10px;">
        ${maxRow('squat', 'Squat', '🦵', m)}
        ${maxRow('panca', 'Panca piana', '🏋️', m)}
        ${maxRow('stacco', 'Stacco da terra', '💀', m)}
      </div>
    </div>
  `;

  bind(root);
  loadNutrizione(root);
}

/* ---------- Blocco nutrizione (async) ---------- */
async function loadNutrizione(root) {
  const giorniDati = await nutritionLastDays(giorni);
  const mount = root.querySelector('#nutri-mount');
  if (!mount) return; // vista già smontata mentre leggevo il DB

  const s = getState();
  const goal = s.profile.goals.calories;
  const goalAcqua = s.profile.goals.water;

  // Solo i giorni in cui hai davvero registrato qualcosa: gli zeri
  // dei giorni saltati falserebbero la media verso il basso
  const conDati = giorniDati.filter(d => (d.totali?.kcal || 0) > 0);

  if (conDati.length < 2) {
    mount.innerHTML = `
      <div class="card">
        <div class="card-title">Nutrizione</div>
        <div class="empty" style="padding:22px 8px;">
          <div class="icon">🍽️</div>
          Registra i pasti per almeno due giorni:<br>l'andamento compare da solo.
        </div>
      </div>`;
    return;
  }

  const punti = conDati.map(d => ({ label: shortDay(d.data), value: Math.round(d.totali.kcal) }));
  const mediaKcal = Math.round(conDati.reduce((n, d) => n + d.totali.kcal, 0) / conDati.length);
  const mediaP = Math.round(conDati.reduce((n, d) => n + (d.totali.p || 0), 0) / conDati.length);
  const mediaAcqua = round1(conDati.reduce((n, d) => n + (d.totali.litri || 0), 0) / conDati.length);
  const inTarget = conDati.filter(d => Math.abs(d.totali.kcal - goal) <= goal * 0.1).length;

  mount.innerHTML = `
    <div class="card">
      <div class="between">
        <div class="card-title" style="margin:0;">Nutrizione</div>
        <span class="faint">media ${mediaKcal.toLocaleString('it-IT')} kcal</span>
      </div>
      <div class="chart-wrap mt-16">${lineChart(punti, { unit: '', id: 'n' })}</div>
      <div class="stat-row">
        ${statCell(String(mediaP), 'Proteine', 'g')}
        ${statCell(`${inTarget}/${conDati.length}`, 'Giorni in target')}
        ${statCell(fmtNum(mediaAcqua, 1), 'Acqua', 'L')}
      </div>
      <div class="macro-row mt-16">
        <div class="lbl">Acqua media <span class="g">/ ${fmtNum(goalAcqua, 1)} L</span></div>
        <div class="macro-track"><i style="width:${pct(mediaAcqua, goalAcqua)}%;background:var(--accent);"></i></div>
      </div>
    </div>`;
}

/* ---------- Eventi ---------- */
function bind(root) {
  root.querySelectorAll('#seg [data-g]').forEach(b => {
    b.addEventListener('click', () => {
      giorni = Number(b.dataset.g);
      paint(root);
    });
  });

  root.querySelector('#w-add').addEventListener('click', () => {
    const inp = root.querySelector('#w-input');
    const peso = round1(parseDecimal(inp.value, 20, 300));
    if (!peso) { toast('Inserisci un peso valido (20–300 kg)'); return; }
    update(s => {
      // Una sola pesata per giorno: la seconda sovrascrive la prima
      const t = todayKey();
      const i = s.weights.findIndex(w => w.data === t);
      if (i >= 0) s.weights[i].peso = peso;
      else s.weights.push({ id: uid(), data: t, peso });
    });
    toast('⚖️ Peso registrato');
  });

  root.querySelector('#w-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') root.querySelector('#w-add').click();
  });

  root.querySelectorAll('[data-max]').forEach(inp => {
    inp.addEventListener('change', () => {
      const key = inp.dataset.max;
      const v = round1(parseDecimal(inp.value, 0.5, 500));
      if (!v) { toast('Massimale non valido'); return; }
      update(s => {
        if (v !== s.maxes[key]) s.maxes.prev[key] = s.maxes[key];
        s.maxes[key] = v;
      });
      toast('Massimale aggiornato');
    });
  });
}

/* ---------- Rendering helper ---------- */
function maxRow(key, label, emoji, maxes) {
  const diff = round1(maxes[key] - maxes.prev[key]);
  return `
    <div class="row" style="justify-content:space-between;">
      <span>${emoji} <strong class="small">${label}</strong>
        ${diff > 0 ? `<span class="accent small tabular"> ▲ +${fmtNum(diff, 1)}</span>` : ''}
      </span>
      <span class="row" style="gap:6px;">
        <input data-max="${key}" type="text" inputmode="decimal"
               value="${fmtNum(maxes[key], 1)}" style="width:84px;text-align:right;" aria-label="1RM ${label}">
        <span class="faint">kg</span>
      </span>
    </div>`;
}

function statCell(v, label, unit = '', color = '') {
  return `
    <div class="stat-cell">
      <div class="stat" ${color ? `style="color:${color};"` : ''}>${v}${unit ? `<span class="u">${unit}</span>` : ''}</div>
      <div class="stat-label">${label}</div>
    </div>`;
}

/* ---------- Calcoli ---------- */
function weekStats(weights) {
  const now = todayKey();
  const c1 = todayKey(-7);
  const c2 = todayKey(-14);
  const inRange = (w, from, to) => w.data > from && w.data <= to;

  const avg = arr => arr.length ? round1(arr.reduce((n, w) => n + w.peso, 0) / arr.length) : null;
  const media = avg(weights.filter(w => inRange(w, c1, now)));
  const mediaPrev = avg(weights.filter(w => inRange(w, c2, c1)));
  const delta = media !== null && mediaPrev !== null ? round1(media - mediaPrev) : null;
  return { media, delta };
}

function deltaColor(delta) {
  if (delta === null || delta === 0) return '';
  return delta > 0 ? 'var(--accent)' : 'var(--warn)';
}

function pct(v, max) { return max ? Math.min(100, Math.round(v / max * 100)) : 0; }
function round1(n) { return n === null ? null : Math.round(n * 10) / 10; }

function shortDay(key) {
  const [y, m, g] = key.split('-').map(Number);
  return new Date(y, m - 1, g).toLocaleDateString('it-IT', { day: 'numeric', month: 'numeric' });
}
