/* ============================================================
   IKARO — Vista Home (Dashboard)
   Cinque blocchi, nell'ordine in cui servono nella giornata:
     Streak · Calorie · Allenamenti settimanali · Idratazione ·
     Report 7 giorni
   ============================================================ */

import {
  getState, update, subscribe, dayTotals, currentStreak, streakWeek, restBudget,
  nextWorkout, trainedToday, workoutsThisWeek, getWorkoutHistory,
  nutritionLastDays, numSerie, lastPerformed, todayKey, GIORNI_BREVI,
} from '../store.js';
import { progressRing } from '../components/donut-chart.js';
import { esc, ICONS, toast, openModal, parseDecimal, fmtNum } from '../components/ui.js';

export function renderHome(root) {
  const unsub = subscribe(() => paint(root));
  paint(root);
  return () => unsub();
}

function paint(root) {
  const s = getState();
  const tot = dayTotals(s);
  const g = s.profile.goals;

  root.innerHTML = `
    <header class="page-head">
      <div class="title">
        <h1>Oggi</h1>
        <div class="sub">${dataOggi()}</div>
      </div>
      <button class="avatar" id="btn-profilo" aria-label="Vai al profilo">
        ${s.profile.name ? esc(s.profile.name.trim()[0].toUpperCase()) : '👤'}
      </button>
    </header>

    ${cardStreak(s)}
    <div class="mt-16" id="report-mount">
      <div class="card">
        <div class="card-title">Ultimi 7 giorni</div>
        <div class="empty" style="padding:16px 8px;"><span class="faint">Carico lo storico…</span></div>
      </div>
    </div>
    <div class="mt-16">${cardSettimana(s, g)}</div>
    <div class="mt-16">${cardIdratazione(s, g)}</div>
    <div class="mt-16">${cardCalorie(tot, g)}</div>
  `;

  bind(root, s);
  loadReport(root);
}

/* ---------- Streak ---------- */
function cardStreak(s) {
  const streak = currentStreak(s);
  const week = streakWeek(s);
  const budget = restBudget(s);
  const rimasti = riposiRimasti(s);

  const LABEL = {
    trained: 'Allenato',
    rest:    'Riposo',
    broken:  'Streak interrotto',
    future:  '—',
  };

  return `
    <div class="card">
      <div class="between">
        <div class="row" style="gap:11px;">
          <div class="workout-thumb" style="font-size:1.3rem;">🔥</div>
          <div>
            <div class="stat" style="font-size:1.9rem;">${streak}</div>
            <div class="stat-label">${streak === 1 ? 'giorno di fila' : 'giorni di fila'}</div>
          </div>
        </div>
        <span class="faint" style="text-align:right;max-width:52%;line-height:1.35;">
          ${streak === 0
            ? 'Allenati per accenderlo'
            : budget === 0
              ? 'Il tuo obiettivo non prevede riposo: salta un giorno e riparti da zero'
              : rimasti === 0
                ? 'Hai finito i giorni di riposo: allenati oggi o riparti da zero'
                : `Puoi ancora riposare ${rimasti} ${rimasti === 1 ? 'giorno' : 'giorni'}`}
        </span>
      </div>

      <div class="streak-days mt-16">
        ${week.map((stato, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          const oggi = i === 6;
          return `<div class="streak-day s-${stato} ${oggi ? 'today' : ''}"
                       title="${d.toLocaleDateString('it-IT')} · ${LABEL[stato]}">
                    <span>${GIORNI_BREVI[(d.getDay() + 6) % 7][0]}</span>
                  </div>`;
        }).join('')}
      </div>

      <div class="row mt-8" style="gap:14px;flex-wrap:wrap;">
        <span class="faint" style="display:flex;align-items:center;gap:5px;">
          <i style="width:8px;height:8px;border-radius:2px;background:var(--accent);display:block;"></i>Allenamento
        </span>
        <span class="faint" style="display:flex;align-items:center;gap:5px;">
          <i style="width:8px;height:8px;border-radius:2px;background:var(--accent-dim);border:1px solid var(--border-strong);display:block;"></i>Riposo
        </span>
      </div>
    </div>`;
}

/* ---------- Calorie: assunte + obiettivo/rimanenti ---------- */
function cardCalorie(tot, g) {
  const rimanenti = g.calories - tot.kcal;
  const oltre = rimanenti < 0;

  return `
    <div class="card">
      <div class="between">
        <div class="card-title" style="margin:0;">Calorie</div>
        <span class="faint">obiettivo ${fmtInt(g.calories)}</span>
      </div>

      <div class="ring-block mt-16">
        <div class="ring-wrap">
          ${progressRing(tot.kcal, g.calories)}
          <div class="ring-center">
            <span class="v" style="${oltre ? 'color:var(--warn);' : ''}">${fmtInt(Math.abs(rimanenti))}</span>
            <span class="l">${oltre ? 'in eccesso' : 'rimanenti'}</span>
          </div>
        </div>
        <div class="grow" style="min-width:0;">
          <div class="kcal-dual">
            <span class="big">${fmtInt(tot.kcal)}</span>
            <span class="of">/ ${fmtInt(g.calories)} kcal</span>
          </div>
          <div class="stat-label" style="margin-top:2px;">assunte oggi</div>
          <div class="macro-list mt-16">
            ${macroRow('Carbo', tot.c, g.carbs, 'var(--macro-carbs)')}
            ${macroRow('Proteine', tot.p, g.protein, 'var(--macro-protein)')}
            ${macroRow('Grassi', tot.f, g.fat, 'var(--macro-fat)')}
          </div>
        </div>
      </div>
    </div>`;
}

/* ---------- Allenamenti settimanali ---------- */
function cardSettimana(s, g) {
  const fatti = workoutsThisWeek();
  const obiettivo = g.workoutsPerWeek || 4;
  const fattoOggi = trainedToday();
  const inCorso = s.session ? s.workouts.find(w => w.id === s.session.workoutId) : null;
  // Senza giorni fissi, la scheda proposta è quella trascurata da più tempo
  const consigliata = nextWorkout(s);
  const tacche = Math.max(obiettivo, fatti);

  return `
    <div class="card">
      <div class="between">
        <div class="card-title" style="margin:0;">Allenamenti</div>
        <span class="pct-inline">${fatti} / ${obiettivo}</span>
      </div>

      <div class="goal-ticks mt-8">
        ${Array.from({ length: tacche }, (_, i) =>
          `<div class="goal-tick ${i < fatti ? 'on' : ''} ${i >= obiettivo && i < fatti ? 'extra' : ''}"></div>`).join('')}
      </div>
      <div class="faint mt-8">
        ${fatti >= obiettivo
          ? `Obiettivo settimanale raggiunto${fatti > obiettivo ? ` · +${fatti - obiettivo}` : ''}`
          : `Ne mancano ${obiettivo - fatti} per chiudere la settimana`}
      </div>

      ${inCorso ? `
        <button class="btn btn-primary btn-block mt-16" data-scheda="${inCorso.id}">
          ▶ Riprendi · ${esc(inCorso.nome)}
        </button>
      ` : consigliata ? `
        <button class="list-row" data-scheda="${consigliata.id}" style="margin-top:12px;">
          <span class="grow">
            <span class="dim">${fattoOggi ? 'Già fatto oggi · poi tocca a' : 'Consigliata'}</span>
            ${esc(consigliata.nome)}
            <span class="dim">— ${consigliata.esercizi.reduce((n, e) => n + numSerie(e), 0)} serie</span>
          </span>
          <span class="chevron">${ICONS.chevron}</span>
        </button>
        <div class="faint" style="margin-top:2px;">
          ${lastPerformed(consigliata.id)
            ? `Non la fai da ${daQuanto(lastPerformed(consigliata.id))}`
            : 'Mai eseguita'}
        </div>
        ${fattoOggi ? '' : `
          <button class="btn btn-primary btn-block mt-16" data-scheda="${consigliata.id}">
            ▶ Inizia allenamento
          </button>`}
      ` : `
        <div class="empty" style="padding:14px 8px;">
          Nessuna scheda. <a href="#/allenamento" class="accent" style="font-weight:600;">Creane una</a>
        </div>`}
    </div>`;
}

/* ---------- Idratazione ---------- */
function cardIdratazione(s, g) {
  const step = s.profile.waterStepMl || 250;
  const p = pct(s.water.litri, g.water);

  return `
    <div class="card tappable" id="hydro-card" role="button" tabindex="0"
         aria-label="Idratazione, tocca per inserire i millilitri">
      <div class="between">
        <div class="card-title" style="margin:0;">Idratazione</div>
        <span class="faint">${step} ml a tocco</span>
      </div>
      <div class="hydro mt-8">
        <div class="body">
          <div class="hydro-top">
            <span class="hydro-val">${fmtNum(s.water.litri, 2)} <span class="goal">/ ${fmtNum(g.water, 1)} L</span></span>
            <span class="hydro-pct">${p}%</span>
          </div>
          <div class="progress mt-8" style="height:6px;"><i style="width:${p}%"></i></div>
        </div>
        <button class="btn-add" id="water-minus" aria-label="Togli ${step} ml"
                ${s.water.litri <= 0 ? 'disabled style="opacity:0.3;"' : ''}>−</button>
        <button class="btn-add primary" id="water-plus" aria-label="Aggiungi ${step} ml">${ICONS.plus}</button>
      </div>
    </div>`;
}

/* ---------- Report 7 giorni (async, da IndexedDB) ---------- */
async function loadReport(root) {
  const giorni = await nutritionLastDays(7);
  const mount = root.querySelector('#report-mount');
  if (!mount) return; // vista smontata mentre leggevo il DB

  const s = getState();
  const g = s.profile.goals;
  const storico = getWorkoutHistory();
  const allenati = new Set(storico.map(h => h.data));

  // Gli ultimi 7 giorni sempre tutti, anche quelli senza dati: un buco
  // nel report è informazione, non un giorno da nascondere
  const serie = Array.from({ length: 7 }, (_, i) => {
    const key = todayKey(i - 6);
    const d = giorni.find(x => x.data === key);
    const t = d?.totali || {};
    return {
      key,
      giorno: new Date(key.slice(0, 4), key.slice(5, 7) - 1, key.slice(8)),
      workout: allenati.has(key),
      kcal: Math.round(t.kcal || 0),
      litri: t.litri || 0,
    };
  });

  const maxKcal = Math.max(g.calories, ...serie.map(x => x.kcal)) || 1;
  const maxAcqua = Math.max(g.water, ...serie.map(x => x.litri)) || 1;
  const conDati = serie.filter(x => x.kcal > 0);
  const mediaKcal = conDati.length
    ? Math.round(conDati.reduce((n, x) => n + x.kcal, 0) / conDati.length) : 0;
  const totWorkout = serie.filter(x => x.workout).length;
  const mediaAcqua = conDati.length
    ? conDati.reduce((n, x) => n + x.litri, 0) / conDati.length : 0;

  mount.innerHTML = `
    <div class="card">
      <div class="between">
        <div class="card-title" style="margin:0;">Ultimi 7 giorni</div>
        <span class="faint">allenamenti · calorie · acqua</span>
      </div>

      <div class="report mt-16">
        <span></span>
        ${serie.map(x => `<span class="rday ${x.key === todayKey() ? 'today' : ''}">${GIORNI_BREVI[(x.giorno.getDay() + 6) % 7][0]}</span>`).join('')}

        <span class="rlabel">Allen</span>
        ${serie.map(x => `
          <div class="cell workout ${x.workout ? 'on' : 'off'}" title="${x.workout ? 'Allenamento fatto' : 'Riposo'}">
            ${x.workout ? '🏋️' : '·'}
          </div>`).join('')}

        <span class="rlabel">Kcal</span>
        ${serie.map(x => {
          const inTarget = x.kcal > 0 && Math.abs(x.kcal - g.calories) <= g.calories * 0.1;
          return `
          <div class="cell ${x.kcal > g.calories ? 'over' : ''} ${inTarget ? 'target' : ''}"
               title="${x.kcal ? `${fmtInt(x.kcal)} kcal` : 'nessun dato'}">
            <i style="height:${x.kcal ? Math.max(8, pct(x.kcal, maxKcal)) : 0}%"></i>
          </div>`;
        }).join('')}

        <span class="rlabel">Acqua</span>
        ${serie.map(x => `
          <div class="cell" title="${x.litri ? `${fmtNum(x.litri, 1)} L` : 'nessun dato'}">
            <i style="height:${x.litri ? Math.max(8, pct(x.litri, maxAcqua)) : 0}%"></i>
          </div>`).join('')}
      </div>

      <div class="stat-row">
        ${statCell(String(totWorkout), 'Allenamenti')}
        ${statCell(mediaKcal ? fmtInt(mediaKcal) : '—', 'Media kcal')}
        ${statCell(mediaAcqua ? fmtNum(mediaAcqua, 1) : '—', 'Media acqua', mediaAcqua ? 'L' : '')}
      </div>
    </div>`;
}

/* ---------- Eventi ---------- */
function bind(root, s) {
  root.querySelector('#btn-profilo').addEventListener('click', () => { location.hash = '#/profilo'; });

  root.querySelectorAll('[data-scheda]').forEach(b => {
    b.addEventListener('click', () => { location.hash = `#/scheda/${b.dataset.scheda}`; });
  });

  const step = (s.profile.waterStepMl || 250) / 1000;

  // Il container apre la modale; i due bottoni devono fermare la propagazione,
  // altrimenti ogni tocco su +/− aprirebbe anche il popup
  const card = root.querySelector('#hydro-card');
  card.addEventListener('click', () => openWaterModal());
  card.addEventListener('keydown', e => { if (e.key === 'Enter') openWaterModal(); });

  root.querySelector('#water-plus').addEventListener('click', e => {
    e.stopPropagation();
    addWater(step);
  });
  root.querySelector('#water-minus').addEventListener('click', e => {
    e.stopPropagation();
    addWater(-step);
  });
}

/** Somma (o sottrae) litri, mai sotto zero. */
function addWater(litri) {
  update(st => {
    st.water.litri = Math.max(0, Math.round((st.water.litri + litri) * 1000) / 1000);
  });
  if (navigator.vibrate) navigator.vibrate(12);
}

/** Registro manuale: il passo fisso copre il bicchiere, non la borraccia. */
function openWaterModal() {
  const s = getState();
  const step = s.profile.waterStepMl || 250;

  openModal({
    title: 'Acqua',
    body: `
      <p class="faint">Oggi: <span class="tabular">${fmtNum(s.water.litri, 2)} L</span>
        di ${fmtNum(s.profile.goals.water, 1)} L</p>

      <label class="col mt-16" style="gap:5px;">
        <span class="faint">Aggiungi millilitri</span>
        <input id="w-ml" type="text" inputmode="numeric" enterkeyhint="done" placeholder="es. 500" autocomplete="off">
      </label>
      <div class="row mt-8" style="flex-wrap:wrap;gap:6px;">
        ${[250, 500, 750, 1000].map(v => `<button class="btn btn-secondary btn-sm" data-quick="${v}">${v} ml</button>`).join('')}
      </div>
      <button class="btn btn-primary btn-block mt-16" id="w-ok">Aggiungi</button>

      <label class="col mt-16" style="gap:5px;">
        <span class="faint">Totale di oggi (L) — per correggere</span>
        <input id="w-tot" type="text" inputmode="decimal" value="${fmtNum(s.water.litri, 2)}">
      </label>
      <button class="btn btn-secondary btn-block mt-8" id="w-set">Imposta totale</button>

      <label class="col mt-16" style="gap:5px;">
        <span class="faint">Il tasto + aggiunge (ml)</span>
        <input id="w-step" type="text" inputmode="numeric" value="${step}">
      </label>
    `,
    onMount: (m, close) => {
      const inp = m.querySelector('#w-ml');
      inp.focus();

      m.querySelectorAll('[data-quick]').forEach(b =>
        b.addEventListener('click', () => { inp.value = b.dataset.quick; }));

      // Il passo si salva solo se valido: un campo vuoto non deve azzerarlo
      const salvaStep = () => {
        const n = parseDecimal(m.querySelector('#w-step').value, 50, 2000);
        if (n && n !== step) update(st => { st.profile.waterStepMl = Math.round(n); });
      };

      const aggiungi = () => {
        const ml = parseDecimal(inp.value, 1, 5000);
        if (!ml) { toast('Valore tra 1 e 5000 ml'); return; }
        salvaStep();
        addWater(ml / 1000);
        toast(`💧 +${Math.round(ml)} ml`);
        close();
      };
      m.querySelector('#w-ok').addEventListener('click', aggiungi);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') aggiungi(); });

      m.querySelector('#w-set').addEventListener('click', () => {
        const l = parseDecimal(m.querySelector('#w-tot').value, 0, 15);
        if (l === null) { toast('Totale non valido (0–15 L)'); return; }
        salvaStep();
        update(st => { st.water.litri = Math.round(l * 1000) / 1000; });
        toast(`💧 Totale: ${fmtNum(l, 2)} L`);
        close();
      });
    },
  });
}

/* ---------- helper ---------- */
function macroRow(label, val, goal, color) {
  return `
    <div class="macro-row">
      <div class="lbl">${label} ${fmtInt(val)} <span class="g">/ ${fmtInt(goal)}g</span></div>
      <div class="macro-track"><i style="width:${pct(val, goal)}%;background:${color};"></i></div>
    </div>`;
}

function statCell(v, label, unit = '') {
  return `
    <div class="stat-cell">
      <div class="stat">${v}${unit ? `<span class="u">${unit}</span>` : ''}</div>
      <div class="stat-label">${label}</div>
    </div>`;
}

function pct(v, max) { return max ? Math.min(100, Math.round(v / max * 100)) : 0; }
function fmtInt(n) { return Math.round(n).toLocaleString('it-IT'); }

/** "3 giorni" invece di una data: si legge senza contare. */
function daQuanto(key) {
  const [y, m, g] = key.split('-').map(Number);
  const d = new Date(y, m - 1, g);
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const gg = Math.round((oggi - d) / 86400000);
  if (gg <= 0) return 'oggi';
  if (gg === 1) return '1 giorno';
  if (gg < 14) return `${gg} giorni`;
  return `${Math.floor(gg / 7)} settimane`;
}

/**
 * Giorni di riposo ancora disponibili prima che lo streak si rompa.
 * Conta i riposi consecutivi già fatti e li sottrae dal budget: dire
 * "puoi riposare fino a 3 giorni" è vero il primo giorno e una bugia il
 * terzo, mentre un contatore che scende è utile tutti i giorni.
 */
function riposiRimasti(s) {
  const trained = new Set(s.activityDates);
  const budget = restBudget(s);
  let usati = 0;
  // Oggi non conta: la giornata è ancora aperta
  for (let i = -1; ; i--) {
    if (trained.has(todayKey(i))) break;
    usati++;
    if (usati > budget) break;
  }
  return Math.max(0, budget - usati);
}

function dataOggi() {
  const d = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  return d.charAt(0).toUpperCase() + d.slice(1);
}
