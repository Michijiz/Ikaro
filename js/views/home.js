/* ============================================================
   IKARO — Vista Home (Dashboard)

   Gerarchia, non elenco. In cima una sola cosa grande: cosa fare
   adesso. Sotto, il contorno — streak, settimana, acqua, calorie —
   più piccolo e in ordine di urgenza.

   Prima erano cinque card identiche: apri l'app e dovevi leggerle
   tutte per capire cosa fare. Un'app di allenamento deve rispondere
   in mezzo secondo.
   ============================================================ */

import {
  getState, update, subscribe, dayTotals, currentStreak, streakWeek, restBudget,
  nextWorkout, trainedToday, workoutsThisWeek, getWorkoutHistory, lastPerformed,
  nutritionLastDays, numSerie, todayKey, backupStatus, snoozeBackup, exportAll,
  GIORNI_BREVI,
} from '../store.js';
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
        <h1>${saluto(s)}</h1>
        <div class="sub">${dataOggi()}</div>
      </div>
      <button class="avatar" id="btn-profilo" aria-label="Vai al profilo">
        ${s.profile.name ? esc(s.profile.name.trim()[0].toUpperCase()) : '👤'}
      </button>
    </header>

    <div id="notice-mount"></div>

    ${cardHero(s, g)}
    <div class="mt-16">${cardStreak(s)}</div>
    <div class="mt-16" id="report-mount">
      <div class="card">
        <div class="card-title">Ultimi 7 giorni</div>
        <div class="empty" style="padding:14px 8px;"><span class="faint">Carico…</span></div>
      </div>
    </div>
    <div class="mt-16">${cardIdratazione(s, g)}</div>
    <div class="mt-16">${cardCalorie(tot, g)}</div>
  `;

  bind(root, s);
  paintNotice(root);
  loadReport(root);
}

/* ============================================================
   HERO — cosa fare adesso
   ============================================================ */
function cardHero(s, g) {
  const fatti = workoutsThisWeek();
  const obiettivo = g.workoutsPerWeek || 4;
  const fattoOggi = trainedToday();
  const inCorso = s.session ? s.workouts.find(w => w.id === s.session.workoutId) : null;
  const consigliata = nextWorkout(s);

  const ticks = `
    <div class="goal-ticks mt-16">
      ${Array.from({ length: Math.max(obiettivo, fatti) }, (_, i) =>
        `<div class="goal-tick ${i < fatti ? 'on' : ''} ${i >= obiettivo && i < fatti ? 'extra' : ''}"></div>`).join('')}
    </div>
    <div class="faint mt-8">${fatti} di ${obiettivo} allenamenti questa settimana</div>`;

  /* 1. Sessione aperta: la cosa da fare è finirla */
  if (inCorso) {
    const ss = s.session;
    const tot = ss.esercizi.reduce((n, e) => n + e.serie, 0);
    const done = ss.esercizi.reduce((n, e) => n + e.done.filter(Boolean).length, 0);
    return `
      <div class="card hero">
        <div class="eyebrow">Allenamento in corso</div>
        <div class="hero-title">${esc(inCorso.nome)}</div>
        <div class="hero-sub">Sei a ${done} serie su ${tot}. Riprendi da dove eri.</div>
        <button class="btn btn-primary btn-block" data-scheda="${inCorso.id}">Riprendi</button>
      </div>`;
  }

  /* 2. Nessuna scheda: la cosa da fare è crearne una */
  if (!consigliata) {
    return `
      <div class="card hero">
        <div class="eyebrow">Per iniziare</div>
        <div class="hero-title">Crea la tua prima scheda</div>
        <div class="hero-sub">
          Una scheda è la lista degli esercizi di un allenamento, con quante
          serie e quante ripetizioni fare. La segui in palestra spuntando le
          serie via via che le finisci.
        </div>
        <button class="btn btn-primary btn-block" id="go-crea">Crea una scheda</button>
      </div>`;
  }

  /* 3. Già allenato oggi: la cosa da fare è riposare */
  if (fattoOggi) {
    return `
      <div class="card hero rest">
        <div class="eyebrow">Fatto</div>
        <div class="hero-title">Allenamento completato 💪</div>
        <div class="hero-sub">
          ${fatti >= obiettivo
            ? 'Obiettivo settimanale raggiunto. Il recupero da qui in poi è guadagnato.'
            : 'Il muscolo cresce nel recupero, non in palestra. Ci vediamo domani.'}
        </div>
        ${ticks}
      </div>`;
  }

  /* 4. Riposo guadagnato: la cosa da fare è non fare niente */
  const rimasti = riposiRimasti(s);
  const budget = restBudget(s);
  if (fatti >= obiettivo && budget > 0 && rimasti > 0) {
    return `
      <div class="card hero rest">
        <div class="eyebrow">Riposo</div>
        <div class="hero-title">Oggi puoi staccare</div>
        <div class="hero-sub">
          Hai già chiuso la settimana. Se ti va di allenarti lo puoi fare,
          ma non ti serve.
        </div>
        <button class="btn btn-secondary btn-block" data-scheda="${consigliata.id}">
          Allenati lo stesso · ${esc(consigliata.nome)}
        </button>
        ${ticks}
      </div>`;
  }

  /* 5. Il caso normale: c'è da allenarsi */
  const serie = consigliata.esercizi.reduce((n, e) => n + numSerie(e), 0);
  const ultima = lastPerformed(consigliata.id);
  return `
    <div class="card hero">
      <div class="eyebrow">Oggi tocca a</div>
      <div class="hero-title">${esc(consigliata.nome)}</div>
      <div class="hero-sub">
        ${consigliata.esercizi.length} esercizi · ${serie} serie ·
        ${ultima ? `non la fai da ${daQuanto(ultima)}` : 'mai fatta'}
      </div>
      <button class="btn btn-primary btn-block" data-scheda="${consigliata.id}">
        Inizia allenamento
      </button>
      ${ticks}
    </div>`;
}

/* ============================================================
   Streak
   ============================================================ */
function cardStreak(s) {
  const streak = currentStreak(s);
  const week = streakWeek(s);
  const budget = restBudget(s);
  const rimasti = riposiRimasti(s);

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
        <span class="faint" style="text-align:right;max-width:54%;line-height:1.35;">
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
          return `<div class="streak-day s-${stato} ${i === 6 ? 'today' : ''}"
                       title="${d.toLocaleDateString('it-IT')}">
                    <span>${GIORNI_BREVI[(d.getDay() + 6) % 7][0]}</span>
                  </div>`;
        }).join('')}
      </div>
      <div class="faint mt-8">Il riposo non lo spezza: fa parte del programma.</div>
    </div>`;
}

/* ============================================================
   Idratazione
   ============================================================ */
function cardIdratazione(s, g) {
  const step = s.profile.waterStepMl || 250;
  const p = pct(s.water.litri, g.water);

  return `
    <div class="card tappable" id="hydro-card" role="button" tabindex="0"
         aria-label="Acqua, tocca per inserire i millilitri">
      <div class="between">
        <div class="card-title" style="margin:0;">Acqua</div>
        <span class="faint">${p}% dell'obiettivo</span>
      </div>
      <div class="hydro mt-8">
        <div class="body">
          <div class="mini-row">
            <span class="mini-val">${fmtNum(s.water.litri, 2)}</span>
            <span class="mini-of">/ ${fmtNum(g.water, 1)} L</span>
          </div>
          <div class="progress mt-8" style="height:6px;"><i style="width:${p}%"></i></div>
        </div>
        <button class="btn-add" id="water-minus" aria-label="Togli ${step} millilitri"
                ${s.water.litri <= 0 ? 'disabled style="opacity:0.3;"' : ''}>−</button>
        <button class="btn-add primary" id="water-plus" aria-label="Aggiungi ${step} millilitri">${ICONS.plus}</button>
      </div>
      <div class="faint mt-8">Un tocco = un bicchiere (${step} ml) · tocca la card per inserirne altri</div>
    </div>`;
}

/* ============================================================
   Calorie — qui il riassunto, il dettaglio sta in Nutrizione
   ============================================================ */
function cardCalorie(tot, g) {
  const rimanenti = g.calories - tot.kcal;
  const oltre = rimanenti < 0;
  const vuoto = tot.kcal === 0;

  return `
    <div class="card tappable" id="kcal-card" role="button" tabindex="0"
         aria-label="Calorie, tocca per aprire la nutrizione">
      <div class="between">
        <div class="card-title" style="margin:0;">Calorie</div>
        <span class="chevron">${ICONS.chevron}</span>
      </div>

      ${vuoto ? `
        <div class="mini-row">
          <span class="mini-val">${fmtInt(g.calories)}</span>
          <span class="mini-of">kcal da assumere oggi</span>
        </div>
        <div class="faint mt-8">Non hai ancora registrato niente. Tocca per aggiungere un pasto.</div>
      ` : `
        <div class="mini-row">
          <span class="mini-val" style="${oltre ? 'color:var(--warn);' : ''}">${fmtInt(Math.abs(rimanenti))}</span>
          <span class="mini-of">kcal ${oltre ? 'oltre l&rsquo;obiettivo' : 'ancora disponibili'}</span>
        </div>
        <div class="progress mt-8 ${oltre ? 'over' : ''}" style="height:6px;">
          <i style="width:${pct(tot.kcal, g.calories)}%"></i>
        </div>
        <div class="faint mt-8">${fmtInt(tot.kcal)} di ${fmtInt(g.calories)} kcal</div>

        <div class="macro-list mt-16">
          ${macroRow('Carboidrati', tot.c, g.carbs, 'var(--macro-carbs)')}
          ${macroRow('Proteine', tot.p, g.protein, 'var(--macro-protein)')}
          ${macroRow('Grassi', tot.f, g.fat, 'var(--macro-fat)')}
        </div>
      `}
    </div>`;
}

/* ============================================================
   Report 7 giorni — una riga sola
   ============================================================ */
async function loadReport(root) {
  const giorni = await nutritionLastDays(7);
  const mount = root.querySelector('#report-mount');
  if (!mount) return; // vista smontata mentre leggevo il DB

  const s = getState();
  const g = s.profile.goals;
  const allenati = new Set(getWorkoutHistory().map(h => h.data));

  const serie = Array.from({ length: 7 }, (_, i) => {
    const key = todayKey(i - 6);
    const t = giorni.find(x => x.data === key)?.totali || {};
    const kcal = Math.round(t.kcal || 0);
    return {
      key,
      d: new Date(key.slice(0, 4), key.slice(5, 7) - 1, key.slice(8)),
      workout: allenati.has(key),
      kcal,
      // In target = entro il 10% dell'obiettivo
      kcalStato: kcal === 0 ? 'none'
        : Math.abs(kcal - g.calories) <= g.calories * 0.1 ? 'ok' : 'off',
      litri: t.litri || 0,
    };
  });

  const nWorkout = serie.filter(x => x.workout).length;
  const conDati = serie.filter(x => x.kcal > 0);
  const inTarget = serie.filter(x => x.kcalStato === 'ok').length;
  const mediaAcqua = conDati.length
    ? conDati.reduce((n, x) => n + x.litri, 0) / conDati.length : 0;

  mount.innerHTML = `
    <div class="card">
      <div class="between">
        <div class="card-title" style="margin:0;">Ultimi 7 giorni</div>
        <a href="#/progressi" class="faint" style="text-decoration:underline;text-underline-offset:2px;">Dettagli</a>
      </div>

      <div class="week-dots">
        ${serie.map(x => `
          <div class="week-dot ${x.key === todayKey() ? 'today' : ''}">
            <span class="lbl">${GIORNI_BREVI[(x.d.getDay() + 6) % 7][0]}</span>
            <span class="mark ${x.workout ? 'trained' : 'rest'}"
                  title="${x.d.toLocaleDateString('it-IT')}: ${x.workout ? 'allenamento' : 'riposo'}">
              ${x.workout ? '🏋️' : '·'}
            </span>
            <span class="kcal-dot ${x.kcalStato}"
                  title="${x.kcal ? `${fmtInt(x.kcal)} kcal` : 'nessun pasto registrato'}"></span>
          </div>`).join('')}
      </div>

      <div class="faint mt-16" style="line-height:1.45;">
        <strong class="accent">${nWorkout}</strong> ${nWorkout === 1 ? 'allenamento' : 'allenamenti'} ·
        calorie in obiettivo <strong class="accent">${inTarget}</strong> ${inTarget === 1 ? 'giorno' : 'giorni'} su 7 ·
        media acqua <strong class="accent">${mediaAcqua ? fmtNum(mediaAcqua, 1) : '—'}</strong> L
      </div>
    </div>`;
}

/* ============================================================
   Promemoria di backup
   ============================================================ */
function paintNotice(root) {
  const mount = root.querySelector('#notice-mount');
  if (!mount) return;
  const st = backupStatus(getState());
  if (!st.mostra) { mount.innerHTML = ''; return; }

  mount.innerHTML = `
    <div class="notice">
      <span class="ico">💾</span>
      <div class="txt">
        <strong>${st.motivo === 'mai' ? 'Salva una copia dei tuoi dati' : 'Il tuo backup ha un mese'}</strong>
        IKARO tiene tutto solo su questo telefono. Se lo perdi o iOS fa
        pulizia, i tuoi allenamenti spariscono. L'export è un file: salvalo
        dove vuoi.
        <div class="acts">
          <button class="btn btn-primary btn-sm" id="nt-export">Esporta ora</button>
          <button class="btn btn-secondary btn-sm" id="nt-later">Più tardi</button>
        </div>
      </div>
    </div>`;

  mount.querySelector('#nt-export').addEventListener('click', async () => {
    try {
      const data = await exportAll();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `ikaro-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('💾 Backup salvato');
    } catch (e) {
      console.error(e);
      toast('Export fallito');
    }
  });

  mount.querySelector('#nt-later').addEventListener('click', () => {
    snoozeBackup(30);
    toast('Te lo ricordo tra un mese');
  });
}

/* ============================================================
   Eventi
   ============================================================ */
function bind(root, s) {
  root.querySelector('#btn-profilo').addEventListener('click', () => { location.hash = '#/profilo'; });
  root.querySelector('#go-crea')?.addEventListener('click', () => { location.hash = '#/allenamento'; });

  root.querySelectorAll('[data-scheda]').forEach(b => {
    b.addEventListener('click', () => { location.hash = `#/scheda/${b.dataset.scheda}`; });
  });

  const kcal = root.querySelector('#kcal-card');
  const goNutri = () => { location.hash = '#/nutrizione'; };
  kcal.addEventListener('click', goNutri);
  kcal.addEventListener('keydown', e => { if (e.key === 'Enter') goNutri(); });

  const step = (s.profile.waterStepMl || 250) / 1000;
  const card = root.querySelector('#hydro-card');
  card.addEventListener('click', () => openWaterModal());
  card.addEventListener('keydown', e => { if (e.key === 'Enter') openWaterModal(); });

  // I bottoni fermano la propagazione: senza, ogni tocco su +/− aprirebbe
  // anche la modale del container
  root.querySelector('#water-plus').addEventListener('click', e => {
    e.stopPropagation(); addWater(step);
  });
  root.querySelector('#water-minus').addEventListener('click', e => {
    e.stopPropagation(); addWater(-step);
  });
}

function addWater(litri) {
  update(st => {
    st.water.litri = Math.max(0, Math.round((st.water.litri + litri) * 1000) / 1000);
  });
  if (navigator.vibrate) navigator.vibrate(12);
}

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
        salvaStep(); addWater(ml / 1000);
        toast(`💧 +${Math.round(ml)} ml`); close();
      };
      m.querySelector('#w-ok').addEventListener('click', aggiungi);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') aggiungi(); });

      m.querySelector('#w-set').addEventListener('click', () => {
        const l = parseDecimal(m.querySelector('#w-tot').value, 0, 15);
        if (l === null) { toast('Totale non valido (0–15 L)'); return; }
        salvaStep();
        update(st => { st.water.litri = Math.round(l * 1000) / 1000; });
        toast(`💧 Totale: ${fmtNum(l, 2)} L`); close();
      });
    },
  });
}

/* ============================================================
   helper
   ============================================================ */
function macroRow(label, val, goal, color) {
  return `
    <div class="macro-row">
      <div class="lbl">${label} ${fmtInt(val)} <span class="g">/ ${fmtInt(goal)} g</span></div>
      <div class="macro-track"><i style="width:${pct(val, goal)}%;background:${color};"></i></div>
    </div>`;
}

/**
 * Giorni di riposo ancora disponibili prima che lo streak si rompa.
 * Un contatore che scende è utile ogni giorno; "puoi riposare fino a 3
 * giorni" è vero il primo e una bugia il terzo.
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

function saluto(s) {
  const h = new Date().getHours();
  const nome = s.profile.name ? `, ${esc(s.profile.name.split(' ')[0])}` : '';
  if (h < 6) return `Buonanotte${nome}`;
  if (h < 13) return `Buongiorno${nome}`;
  if (h < 18) return `Buon pomeriggio${nome}`;
  return `Buonasera${nome}`;
}

function dataOggi() {
  const d = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  return d.charAt(0).toUpperCase() + d.slice(1);
}
