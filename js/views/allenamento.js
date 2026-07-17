/* ============================================================
   IKARO — Vista Allenamento
   Le schede non hanno più un giorno fisso: si allena chi vuole
   quando vuole, e la scheda "consigliata" è quella che non fai
   da più tempo. Sotto, le sessioni svolte, eliminabili.
   ============================================================ */

import {
  getState, subscribe, workoutStatus, getWorkoutHistory, recentSessions,
  deleteWorkoutSession, lastPerformed, numSerie, todayKey, weekdayIndex,
  GIORNI_BREVI,
} from '../store.js';
import { openWorkoutEditor } from '../components/workout-editor.js';
import { toast, esc, ICONS, confirmModal, fmtTime } from '../components/ui.js';

const STATUS = {
  done:    { label: 'Fatta',      cls: 'badge-ok' },
  next:    { label: 'Consigliata', cls: 'badge-warn' },
  planned: { label: 'In rotazione', cls: 'badge-muted' },
};

export function renderAllenamento(root) {
  const unsub = subscribe(() => paint(root));
  paint(root);
  return () => unsub();
}

function paint(root) {
  const s = getState();
  const workouts = s.workouts;
  const sessione = s.session ? s.workouts.find(w => w.id === s.session.workoutId) : null;
  const storico = getWorkoutHistory();
  const settimana = storico.filter(h => h.data >= todayKey(-weekdayIndex()));
  const giorniAllenati = new Set(settimana.map(h => h.data));
  const volumeSett = settimana.reduce((n, h) => n + (h.volume || 0), 0);
  const obiettivo = s.profile.goals.workoutsPerWeek || 4;

  root.innerHTML = `
    <header class="page-head">
      <div class="title">
        <h1>Allenamento</h1>
        <div class="sub">${meseCorrente()}</div>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-new">${ICONS.plus} Nuova</button>
    </header>

    ${sessione ? `
      <div class="card tappable resume-banner" id="btn-resume" role="button" tabindex="0">
        <div class="row">
          <div class="workout-thumb" style="font-size:1.2rem;">⏱️</div>
          <div class="grow" style="min-width:0;">
            <strong>Sessione in corso</strong>
            <div class="muted small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(sessione.nome)} · tocca per riprendere</div>
          </div>
          <span class="chevron">${ICONS.chevron}</span>
        </div>
      </div>` : ''}

    <div class="card ${sessione ? 'mt-16' : ''}">
      <div class="between">
        <div class="card-title" style="margin:0;">Questa settimana</div>
        <span class="pct-inline">${giorniAllenati.size} / ${obiettivo}</span>
      </div>
      <div class="week-strip mt-8">${weekStrip(giorniAllenati)}</div>
      <div class="stat-row">
        ${statCell(String(settimana.length), 'Sessioni')}
        ${statCell(fmtInt(volumeSett), 'Kg sollevati')}
        ${statCell(String(workouts.length), 'Schede')}
      </div>
    </div>

    <div class="eyebrow mt-16">Le tue schede</div>
    <div class="col mt-8" style="gap:12px;">
      ${workouts.length === 0 ? `
        <div class="card empty">
          <div class="icon">🏋️</div>
          <strong style="color:var(--text);">Nessuna scheda</strong>
          <p class="muted small mt-8" style="max-width:300px;margin:8px auto 0;line-height:1.5;">
            Una scheda è la lista degli esercizi di un allenamento: per ognuno
            scrivi quante serie fare, quante ripetizioni e con quanti chili.
            Poi la segui in palestra spuntando le serie finite.
          </p>
          <div class="mt-16">
            <button class="btn btn-primary" id="btn-new-empty">${ICONS.plus} Crea la prima</button>
          </div>
        </div>
      ` : workouts.map(w => {
        const st = STATUS[workoutStatus(w, s)];
        const totSerie = w.esercizi.reduce((n, e) => n + numSerie(e), 0);
        const last = lastPerformed(w.id);
        return `
        <div class="card tappable" data-open="${w.id}" role="button" tabindex="0">
          <div class="row">
            <div class="workout-thumb" style="font-size:1.3rem;">${w.icona || '🏋️'}</div>
            <div class="grow" style="min-width:0;">
              <strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(w.nome)}</strong>
              <div class="muted small">${w.esercizi.length} esercizi · ${totSerie} serie</div>
              <div class="faint">${last ? `Ultima volta ${daQuanto(last)}` : 'Mai eseguita'}</div>
            </div>
            <div class="col" style="align-items:flex-end;gap:8px;flex-shrink:0;">
              <span class="badge ${st.cls}">${st.label}</span>
              <button class="btn-ghost" data-edit="${w.id}" aria-label="Modifica ${esc(w.nome)}">${ICONS.edit}</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>

    ${sessioniSvolte(storico)}
  `;

  bind(root, s);
}

/* ---------- Sessioni svolte, eliminabili ---------- */
function sessioniSvolte(storico) {
  const recenti = recentSessions(8);
  if (recenti.length === 0) return '';

  return `
    <div class="eyebrow mt-24">Allenamenti svolti</div>
    <div class="card mt-8" style="padding:4px 14px;">
      ${recenti.map(h => `
        <div class="row" style="padding:11px 0;border-top:1px solid var(--border);gap:10px;">
          <div class="grow" style="min-width:0;">
            <strong class="small" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(h.nome)}</strong>
            <div class="faint tabular">
              ${fmtData(h.data)} · ${h.serieFatte ?? '?'} serie
              ${h.volume ? ` · ${fmtInt(h.volume)} kg` : ''}
              ${h.durata ? ` · ${fmtTime(h.durata)}` : ''}
            </div>
          </div>
          <button class="btn-ghost btn-danger" data-del-sess="${esc(h.id)}"
                  aria-label="Elimina l'allenamento ${esc(h.nome)} del ${fmtData(h.data)}">${ICONS.trash}</button>
        </div>`).join('')}
    </div>
    <p class="faint mt-8" style="padding:0 4px;">
      Eliminare una sessione la toglie dallo storico, dallo streak e dai carichi di riferimento.
    </p>`;
}

/* ---------- Strip settimana: i giorni in cui ti sei allenato ---------- */
function weekStrip(giorniAllenati) {
  const oggi = weekdayIndex();
  return GIORNI_BREVI.map((g, i) => {
    const d = new Date();
    d.setDate(d.getDate() + (i - oggi));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const fatto = giorniAllenati.has(key);
    return `
      <div class="week-day ${fatto ? 'has-workout' : ''} ${i === oggi ? 'today' : ''}">
        <span>${g}</span>
        <span class="num">${d.getDate()}</span>
        ${fatto ? '<span style="font-size:0.6rem;line-height:1;">✓</span>' : ''}
      </div>`;
  }).join('');
}

/* ---------- Eventi ---------- */
function bind(root, s) {
  root.querySelector('#btn-new').addEventListener('click', () => openWorkoutEditor(null));
  root.querySelector('#btn-new-empty')?.addEventListener('click', () => openWorkoutEditor(null));

  const resume = root.querySelector('#btn-resume');
  if (resume) {
    const go = () => { location.hash = `#/scheda/${s.session.workoutId}`; };
    resume.addEventListener('click', go);
    resume.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  }

  root.querySelectorAll('[data-edit]').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      openWorkoutEditor(b.dataset.edit);
    });
  });

  root.querySelectorAll('[data-open]').forEach(card => {
    const go = () => { location.hash = `#/scheda/${card.dataset.open}`; };
    card.addEventListener('click', go);
    card.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  });

  root.querySelectorAll('[data-del-sess]').forEach(b => {
    b.addEventListener('click', async () => {
      const ok = await confirmModal(
        'Eliminare questo allenamento? Sparisce dallo storico e dallo streak, e non conterà più tra i carichi di riferimento.',
        { ok: 'Elimina', danger: true });
      if (!ok) return;
      await deleteWorkoutSession(b.dataset.delSess);
      toast('Allenamento eliminato');
    });
  });
}

/* ---------- helper ---------- */
function statCell(v, label, unit = '') {
  return `
    <div class="stat-cell">
      <div class="stat">${v}${unit ? `<span class="u">${unit}</span>` : ''}</div>
      <div class="stat-label">${label}</div>
    </div>`;
}

function fmtInt(n) { return Math.round(n).toLocaleString('it-IT'); }

function fmtData(key) {
  const [y, m, g] = key.split('-').map(Number);
  return new Date(y, m - 1, g).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "oggi" / "ieri" / "3 giorni fa": più leggibile di una data. */
function daQuanto(key) {
  const [y, m, g] = key.split('-').map(Number);
  const d = new Date(y, m - 1, g);
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const gg = Math.round((oggi - d) / 86400000);
  if (gg <= 0) return 'oggi';
  if (gg === 1) return 'ieri';
  if (gg < 7) return `${gg} giorni fa`;
  if (gg < 14) return 'una settimana fa';
  if (gg < 60) return `${Math.floor(gg / 7)} settimane fa`;
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function meseCorrente() {
  const m = new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return m.charAt(0).toUpperCase() + m.slice(1);
}
