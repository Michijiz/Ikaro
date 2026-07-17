/* ============================================================
   IKARO — Vista Scheda (operativa)
   Una pagina sola: il piano E l'esecuzione. Prima erano due
   (#/scheda in lettura + #/workout-attivo), con due punti in cui
   spuntare le serie e due stati che potevano divergere.

   Qui dentro: tutti gli esercizi con le serie da spuntare, il
   carico per esercizio e lo storico dei carichi in fondo
   (sovraccarico progressivo).

   Niente cronometro né recupero a schermo: la durata continua a
   essere registrata in silenzio dai timestamp, perché lo storico
   la usa, ma non occupa spazio mentre ti alleni.

   La sessione vive nello STORE come timestamp assoluti:
   sopravvive a blocco schermo, chiusura della PWA e reload.
   ============================================================ */

import {
  getState, update, subscribe, uid, todayKey,
  addWorkoutSession, markActivityToday, caricoHistory,
  caricoSerie, numSerie, workoutStatus, lastPerformed,
} from '../store.js';
import { openWorkoutEditor } from '../components/workout-editor.js';
import {
  toast, esc, ICONS, fmtTime, openModal, confirmModal, parseDecimal, fmtNum,
} from '../components/ui.js';


const STATUS = {
  done:    { label: 'Fatto',        cls: 'badge-ok' },
  next:    { label: 'Prossimo',     cls: 'badge-warn' },
  planned: { label: 'In programma', cls: 'badge-muted' },
};

export function renderScheda(root, workoutId) {
  const w = getState().workouts.find(x => x.id === workoutId);

  if (!w) {
    root.innerHTML = `
      <header class="page-head">
        <button class="icon-btn" id="btn-back" aria-label="Indietro">${ICONS.back}</button>
        <div class="title grow"><h1 style="font-size:1.35rem;">Scheda</h1></div>
      </header>
      <div class="card empty">
        <div class="icon">🏋️</div>
        Scheda non trovata: forse è stata eliminata.
      </div>`;
    root.querySelector('#btn-back').addEventListener('click', () => { location.hash = '#/allenamento'; });
    return;
  }

  /* ----- Sessione: riprende quella salvata o ne prepara una nuova ----- */
  const sess = () => getState().session;

  function apriSessione() {
    update(st => {
      st.session = {
        workoutId: w.id,
        esercizi: w.esercizi.map(e => ({
          nome: e.nome,
          serie: numSerie(e),
          reps: e.reps,
          carico: e.carico || 0,
          override: e.override ? { ...e.override } : {},
          done: Array(numSerie(e)).fill(false),
        })),
        // Durata registrata in silenzio: non c'è cronometro a schermo,
        // ma lo storico e la dashboard mostrano quanto è durata la sessione
        swStart: Date.now(),
        swElapsed: 0,
      };
    });
  }

  /* ----- Letture derivate dai timestamp (robuste al blocco schermo) ----- */
  function swSeconds() {
    const ss = sess();
    if (!ss) return 0;
    return ss.swElapsed + (ss.swStart ? (Date.now() - ss.swStart) / 1000 : 0);
  }
  let justDone = null; // serie appena spuntata, per l'animazione

  /* ----- Wake Lock: schermo acceso durante la sessione ----- */
  let wakeLock = null;
  async function acquireWakeLock() {
    try {
      if ('wakeLock' in navigator && attiva()) wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) { /* negato o non supportato: i timestamp coprono comunque */ }
  }
  function onVisibility() {
    // Il lock decade al blocco schermo: si riprende al ritorno in foreground
    if (document.visibilityState === 'visible') acquireWakeLock();
  }
  document.addEventListener('visibilitychange', onVisibility);

  /* Una sessione senza esercizi non è una sessione: senza questa guardia
     la pagina resterebbe bloccata in modalità "in corso" con zero serie
     da spuntare e nessuna via d'uscita se non scartarla. */
  const attiva = () => {
    const s = sess();
    return !!s && s.workoutId === w.id && Array.isArray(s.esercizi) && s.esercizi.length > 0;
  };

  const unsub = subscribe(() => paint());
  paint();
  if (attiva()) acquireWakeLock();

  return () => {
    unsub();
    document.removeEventListener('visibilitychange', onVisibility);
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  };

  /* ================= Rendering ================= */
  function paint() {
    const s = getState();
    const wNow = s.workouts.find(x => x.id === workoutId);
    if (!wNow) { location.hash = '#/allenamento'; return; }

    const on = attiva();
    const ss = on ? sess() : null;
    // Senza sessione si guarda il piano; con sessione si guarda ciò che si sta facendo
    const esercizi = on ? ss.esercizi : wNow.esercizi.map(e => ({
      nome: e.nome, serie: numSerie(e), reps: e.reps,
      carico: e.carico || 0, override: e.override || {},
      done: Array(numSerie(e)).fill(false),
    }));

    const totSerie = esercizi.reduce((n, e) => n + e.serie, 0);
    const fatte = esercizi.reduce((n, e) => n + e.done.filter(Boolean).length, 0);
    const volume = Math.round(esercizi.reduce((n, e) =>
      n + e.done.reduce((v, d, i) => v + (d ? caricoSerie(e, i) * e.reps : 0), 0), 0));
    const volumePrevisto = Math.round(esercizi.reduce((n, e) =>
      n + Array.from({ length: e.serie }, (_, i) => caricoSerie(e, i) * e.reps).reduce((a, b) => a + b, 0), 0));
    const st = STATUS[workoutStatus(wNow, s)];

    root.innerHTML = `
      <header class="page-head">
        <button class="icon-btn" id="btn-back" aria-label="Indietro">${ICONS.back}</button>
        <div class="title grow" style="min-width:0;">
          <h1 style="font-size:1.3rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(wNow.nome)}</h1>
          <div class="sub">${on
            ? 'Sessione in corso'
            : (lastPerformed(wNow.id) ? `Ultima volta ${daQuanto(lastPerformed(wNow.id))}` : 'Mai eseguita')}</div>
        </div>
        ${on
          ? '<button class="btn btn-primary btn-sm" id="btn-finish">Fine</button>'
          : `<button class="icon-btn" id="btn-edit" aria-label="Modifica scheda">${ICONS.edit}</button>`}
      </header>

      ${on ? `
        <div class="mode-bar live">
          <span class="pulse"></span>
          Allenamento in corso · tocca i numeri delle serie che finisci
        </div>
        <div class="progress" style="height:5px;"><i style="width:${pct(fatte, totSerie)}%"></i></div>
        <div class="row mt-8" style="justify-content:space-between;">
          <span class="faint tabular">${fatte} serie su ${totSerie} · ${pct(fatte, totSerie)}%</span>
          <span class="faint tabular">${fmtInt(volume)} kg sollevati</span>
        </div>
      ` : `
        <div class="mode-bar plan">
          👁️ Stai guardando la scheda · premi Inizia per allenarti
        </div>
        <div class="card">
          <span class="badge ${st.cls}">${st.label}</span>
          <div class="stat-row">
            ${statCell(String(wNow.esercizi.length), 'Esercizi')}
            ${statCell(String(totSerie), 'Serie')}
            ${statCell(fmtInt(volumePrevisto), 'Da sollevare', 'kg')}
          </div>
        </div>`}

      <div class="col mt-16" style="gap:12px;">
        ${esercizi.map((e, ei) => exCard(e, ei, on)).join('')}
      </div>

      ${storicoCarichi(esercizi)}

      <div class="sticky-actions">
        ${on
          ? `<button class="btn btn-primary btn-block" id="btn-finish-2">Termina allenamento</button>
             <button class="btn btn-block btn-ghost btn-sm mt-8" id="btn-discard">Scarta sessione</button>`
          : '<button class="btn btn-primary btn-block" id="btn-start">▶ Inizia allenamento</button>'}
      </div>
    `;

    bind(on);
  }

  /* ---------- Card esercizio ---------- */
  function exCard(e, ei, on) {
    const tutteFatte = e.done.every(Boolean);
    const last = caricoHistory(e.nome, 1)[0];
    const diff = last ? round1(e.carico - last.carico) : null;

    return `
      <div class="card ex-card ${tutteFatte && on ? 'done' : ''}">
        <div class="row">
          <strong class="grow ex-name" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(e.nome)}</strong>
          <span class="faint tabular" style="flex-shrink:0;">${e.serie} × ${e.reps}</span>
        </div>

        <div class="serie-dots mt-8">
          ${Array.from({ length: e.serie }, (_, i) => {
            const ov = e.override && e.override[i] !== undefined;
            return `<button class="serie-dot ${e.done[i] ? 'done' : ''} ${ov ? 'override' : ''} ${justDone === `${ei}-${i}` ? 'just-done' : ''}"
                      data-set="${ei}-${i}"
                      ${on ? '' : 'disabled'}
                      aria-pressed="${e.done[i]}"
                      aria-label="Serie ${i + 1}${ov ? `, ${fmtNum(caricoSerie(e, i), 1)} kg` : ''}">${i + 1}</button>`;
          }).join('')}
        </div>

        <div class="carico-row">
          <input data-carico="${ei}" type="text" inputmode="decimal" enterkeyhint="done"
                 value="${e.carico ? fmtNum(e.carico, 2) : ''}" placeholder="—"
                 aria-label="Carico per ${esc(e.nome)}">
          <span class="faint">kg</span>
          <span class="hint grow">
            ${last
              ? `L'ultima volta: <b>${fmtNum(last.carico, 1)} kg</b>${diff ? ` · ${diff > 0 ? '▲ +' : '▼ '}${fmtNum(Math.abs(diff), 1)}` : ''}`
              : 'Primo allenamento con questo esercizio'}
          </span>
        </div>
      </div>`;
  }

  /* ---------- Storico carichi (sovraccarico progressivo) ---------- */
  function storicoCarichi(esercizi) {
    const righe = esercizi.map(e => ({ nome: e.nome, carico: e.carico, storia: caricoHistory(e.nome, 4) }));
    if (righe.every(r => r.storia.length === 0)) {
      return `
        <div class="card mt-16">
          <div class="card-title">Storico carichi</div>
          <p class="muted small">Nessuna sessione precedente per questi esercizi.
          Da qui confronterai i carichi allenamento dopo allenamento.</p>
        </div>`;
    }

    // Le colonne sono le date delle sessioni, dalla più vecchia alla più recente
    const date = [...new Set(righe.flatMap(r => r.storia.map(h => h.data)))]
      .sort().slice(-4);

    return `
      <div class="card mt-16">
        <div class="between">
          <div class="card-title" style="margin:0;">Storico carichi</div>
          <span class="faint">kg usati per serie</span>
        </div>
        <div style="overflow-x:auto;margin-top:12px;">
          <table class="hist-table">
            <thead>
              <tr>
                <th>Esercizio</th>
                ${date.map(d => `<th>${shortDay(d)}</th>`).join('')}
                <th>Oggi</th>
              </tr>
            </thead>
            <tbody>
              ${righe.map(r => {
                const byDate = new Map(r.storia.map(h => [h.data, h.carico]));
                const ultimo = r.storia[0]?.carico ?? null;
                const su = ultimo !== null && r.carico > ultimo;
                return `
                <tr>
                  <td title="${esc(r.nome)}">${esc(r.nome)}</td>
                  ${date.map(d => `<td>${byDate.has(d) ? fmtNum(byDate.get(d), 1) : '·'}</td>`).join('')}
                  <td class="${su ? 'up' : 'now'}">${r.carico ? fmtNum(r.carico, 1) : '·'}${su ? ' ▲' : ''}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  /* ================= Eventi ================= */
  function bind(on) {
    root.querySelector('#btn-back').addEventListener('click', () => { location.hash = '#/allenamento'; });

    root.querySelector('#btn-edit')?.addEventListener('click', () =>
      openWorkoutEditor(w.id, deleted => { if (deleted) location.hash = '#/allenamento'; }));

    root.querySelector('#btn-start')?.addEventListener('click', async () => {
      const s = getState();
      if (s.session && s.session.workoutId !== w.id) {
        const ok = await confirmModal(
          'Hai una sessione in corso su un\'altra scheda. Scartarla e iniziare questa?',
          { ok: 'Scarta e inizia', danger: true });
        if (!ok) return;
      }
      apriSessione();
    });

    if (!on) return;

    /* --- Serie: tap spunta, pressione lunga apre l'override del carico --- */
    root.querySelectorAll('[data-set]').forEach(btn => {
      let timer = null, longPress = false;

      const start = () => {
        longPress = false;
        timer = setTimeout(() => {
          longPress = true;
          if (navigator.vibrate) navigator.vibrate(35);
          const [ei, i] = btn.dataset.set.split('-').map(Number);
          openOverride(ei, i);
        }, 500);
      };
      const cancel = () => { if (timer) clearTimeout(timer); timer = null; };

      btn.addEventListener('pointerdown', start);
      btn.addEventListener('pointerup', cancel);
      btn.addEventListener('pointerleave', cancel);
      btn.addEventListener('pointercancel', cancel);
      // Su iOS la pressione lunga aprirebbe il menu di sistema
      btn.addEventListener('contextmenu', e => e.preventDefault());

      btn.addEventListener('click', () => {
        if (longPress) { longPress = false; return; }
        toggleSerie(btn.dataset.set);
      });
    });

    /* --- Carico: si scrive una volta e vale per tutto l'esercizio --- */
    root.querySelectorAll('[data-carico]').forEach(inp => {
      const salva = () => {
        const ei = Number(inp.dataset.carico);
        const v = parseDecimal(inp.value, 0, 1000);
        if (v === null) { toast('Carico non valido'); return; }
        // Non ridisegno: perderei il focus mentre si digita
        update(st => { st.session.esercizi[ei].carico = v; });
      };
      inp.addEventListener('change', salva);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') inp.blur(); });
    });

    [root.querySelector('#btn-finish'), root.querySelector('#btn-finish-2')]
      .forEach(b => b?.addEventListener('click', finishWorkout));

    root.querySelector('#btn-discard').addEventListener('click', async () => {
      const ok = await confirmModal('Scartare la sessione? Le serie spuntate vanno perse.',
        { ok: 'Scarta', danger: true });
      if (!ok) return;
      update(st => { st.session = null; });
      toast('Sessione scartata');
    });
  }

  /** Spunta/de-spunta una serie. */
  function toggleSerie(key) {
    const [ei, i] = key.split('-').map(Number);
    let acceso = false;
    update(st => {
      const e = st.session.esercizi[ei];
      e.done[i] = !e.done[i];
      acceso = e.done[i];
    });
    if (acceso) {
      justDone = key;
      if (navigator.vibrate) navigator.vibrate(18);
      setTimeout(() => { justDone = null; }, 400);
    }
  }

  /** Carico diverso su una singola serie (piramidale, drop set, back-off). */
  function openOverride(ei, i) {
    const e = sess().esercizi[ei];
    const attuale = caricoSerie(e, i);
    const haOverride = e.override && e.override[i] !== undefined;

    openModal({
      title: `Peso diverso · serie ${i + 1}`,
      body: `
        <p class="faint">Solo per la serie ${i + 1} di ${esc(e.nome)}.
        Le altre restano a ${fmtNum(e.carico, 1)} kg. Serve per piramidali,
        drop set o serie di scarico.</p>
        <label class="col mt-16" style="gap:5px;">
          <span class="faint">Kg per la serie ${i + 1}</span>
          <input id="ov-kg" type="text" inputmode="decimal" value="${fmtNum(attuale, 2)}" enterkeyhint="done">
        </label>
        <button class="btn btn-primary btn-block mt-16" id="ov-ok">Salva</button>
        ${haOverride
          ? '<button class="btn btn-block btn-ghost mt-8" id="ov-clear">Riallinea al carico dell\'esercizio</button>'
          : ''}`,
      onMount: (m, close) => {
        const inp = m.querySelector('#ov-kg');
        inp.focus(); inp.select();

        const salva = () => {
          const v = parseDecimal(inp.value, 0, 1000);
          if (v === null) { toast('Carico non valido'); return; }
          update(st => {
            const ex = st.session.esercizi[ei];
            if (v === ex.carico) delete ex.override[i];
            else ex.override[i] = v;
          });
          close();
        };
        m.querySelector('#ov-ok').addEventListener('click', salva);
        inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') salva(); });

        m.querySelector('#ov-clear')?.addEventListener('click', () => {
          update(st => { delete st.session.esercizi[ei].override[i]; });
          close();
        });
      },
    });
  }

  /* ---------- Salvataggio ---------- */
  async function finishWorkout() {
    const ss = sess();
    const fatte = ss.esercizi.reduce((n, e) => n + e.done.filter(Boolean).length, 0);
    if (fatte === 0) {
      const ok = await confirmModal('Nessuna serie completata. Terminare comunque?', { ok: 'Termina' });
      if (!ok) return;
    }

    const durata = Math.round(swSeconds());
    const volume = Math.round(ss.esercizi.reduce((n, e) =>
      n + e.done.reduce((v, d, i) => v + (d ? caricoSerie(e, i) * e.reps : 0), 0), 0));

    // Lo storico registra le serie fatte davvero, una per una: è il
    // formato che legge caricoHistory, ed è compatibile coi record vecchi
    await addWorkoutSession({
      id: uid(),
      workoutId: w.id,
      nome: w.nome,
      data: todayKey(),
      durata, volume, serieFatte: fatte,
      esercizi: ss.esercizi
        .map(e => ({
          nome: e.nome,
          serie: e.done.map((d, i) => d ? { carico: caricoSerie(e, i), reps: e.reps } : null).filter(Boolean),
        }))
        .filter(e => e.serie.length > 0),
    });

    // I carichi usati oggi diventano il punto di partenza della prossima volta
    update(st => {
      const wk = st.workouts.find(x => x.id === w.id);
      if (wk) {
        ss.esercizi.forEach(e => {
          const ex = wk.esercizi.find(x => x.nome === e.nome);
          if (ex && e.done.some(Boolean)) {
            ex.carico = e.carico;
            if (Object.keys(e.override).length) ex.override = { ...e.override };
            else delete ex.override;
          }
        });
      }
      st.session = null;
    });

    markActivityToday();
    toast(`💪 Salvato · ${fmtTime(durata)} · ${fmtInt(volume)} kg sollevati`);
    location.hash = '#/allenamento';
  }
}

/* ---------- helper ---------- */
function statCell(v, label, unit = '') {
  return `
    <div class="stat-cell">
      <div class="stat">${v}${unit ? `<span class="u">${unit}</span>` : ''}</div>
      <div class="stat-label">${label}</div>
    </div>`;
}

function pct(v, max) { return max ? Math.min(100, Math.round(v / max * 100)) : 0; }
function fmtInt(n) { return Math.round(n).toLocaleString('it-IT'); }
function round1(n) { return Math.round(n * 10) / 10; }

/** "3 giorni fa" invece di una data: si legge senza contare. */
function daQuanto(key) {
  const [y, m, g] = key.split('-').map(Number);
  const d = new Date(y, m - 1, g);
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const gg = Math.round((oggi - d) / 86400000);
  if (gg <= 0) return 'oggi';
  if (gg === 1) return 'ieri';
  if (gg < 14) return `${gg} giorni fa`;
  return `${Math.floor(gg / 7)} settimane fa`;
}

function shortDay(key) {
  const [y, m, g] = key.split('-').map(Number);
  return new Date(y, m - 1, g).toLocaleDateString('it-IT', { day: 'numeric', month: 'numeric' });
}
