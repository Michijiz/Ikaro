/* ============================================================
   IKARO — Vista Nutrizione
   Stesso blocco Calorie della Home (anello + macro), poi i
   quattro pasti espandibili con rimozione dei singoli alimenti.
   Il giorno è navigabile: oggi arriva dallo stato live, i giorni
   passati dallo storico su IndexedDB.
   ============================================================ */

import {
  getState, subscribe, todayKey, shiftDay, validDay, dayLabel, PASTI,
  nutritionDay, removeFoodFromDay,
} from '../store.js';
import { progressRing } from '../components/donut-chart.js';
import { toast, esc, ICONS } from '../components/ui.js';

export function renderNutrizione(root, param) {
  // Lo stato di espansione è locale alla visita, non globale al modulo
  const expanded = new Set();
  let giorno = validDay(param);

  // Le modifiche live riguardano solo oggi: sugli altri giorni scriviamo
  // direttamente su IndexedDB e ridisegniamo a mano.
  const unsub = subscribe(() => { if (giorno === todayKey()) paint(); });
  paint();
  return () => unsub();

  function setGiorno(nuovo) {
    if (nuovo > todayKey()) return;            // il futuro non si logga
    giorno = nuovo;
    expanded.clear();
    // replaceState non scatena hashchange: niente remount, ma l'URL resta
    // coerente se ricarichi o torni indietro dalla schermata di aggiunta.
    history.replaceState(null, '', `#/nutrizione/${giorno}`);
    paint();
  }

  async function paint() {
    const s = getState();
    const d = await nutritionDay(giorno);
    if (d.data !== giorno) return;             // giorno cambiato nel frattempo
    const tot = d.totali;
    const g = s.profile.goals;
    const rimanenti = g.calories - tot.kcal;
    const oltre = rimanenti < 0;
    const oggi = giorno === todayKey();

    root.innerHTML = `
      <header class="page-head">
        <div class="title">
          <h1>Nutrizione</h1>
          <div class="sub">${dayLabel(giorno)}</div>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-add">${ICONS.plus} Alimento</button>
      </header>

      <div class="day-nav">
        <button class="icon-btn" id="day-prev" aria-label="Giorno precedente">${ICONS.back}</button>
        <button class="day-nav-label" id="day-today" ${oggi ? 'disabled' : ''}>
          <strong>${dayLabel(giorno)}</strong>
          <span class="faint">${oggi ? 'stai loggando oggi' : 'tocca per tornare a oggi'}</span>
        </button>
        <button class="icon-btn" id="day-next" aria-label="Giorno successivo" ${oggi ? 'disabled' : ''}>${ICONS.chevron}</button>
      </div>

      <div class="card mt-16">
        <div class="card-title">Calorie</div>
        <div class="ring-block">
          <div class="ring-wrap">
            ${progressRing(tot.kcal, g.calories)}
            <div class="ring-center">
              <span class="v" style="${oltre ? 'color:var(--warn);' : ''}">${fmtInt(Math.abs(rimanenti))}</span>
              <span class="l">${oltre ? 'in eccesso' : 'rimanenti'}</span>
            </div>
          </div>
          <div class="macro-list">
            ${macroRow('Carbo', tot.c, g.carbs, 'var(--macro-carbs)')}
            ${macroRow('Proteine', tot.p, g.protein, 'var(--macro-protein)')}
            ${macroRow('Grassi', tot.f, g.fat, 'var(--macro-fat)')}
          </div>
        </div>
        <div class="stat-row">
          ${statCell(fmtInt(tot.kcal), 'Assunte', 'kcal')}
          ${statCell(fmtInt(g.calories), 'Obiettivo', 'kcal')}
          ${statCell(`${pct(tot.kcal, g.calories)}`, 'Del target', '%')}
        </div>
      </div>

      <div class="col mt-16" style="gap:12px;">
        ${PASTI.map(p => mealCard(p, d.pasti, expanded)).join('')}
      </div>

      <button class="btn btn-primary btn-block mt-16" id="btn-add-2">${ICONS.plus} Aggiungi alimento</button>
    `;

    const goAdd = () => { location.hash = `#/aggiungi-alimento/${giorno}`; };
    root.querySelector('#btn-add').addEventListener('click', goAdd);
    root.querySelector('#btn-add-2').addEventListener('click', goAdd);

    root.querySelector('#day-prev').addEventListener('click', () => setGiorno(shiftDay(giorno, -1)));
    root.querySelector('#day-next').addEventListener('click', () => setGiorno(shiftDay(giorno, +1)));
    root.querySelector('#day-today').addEventListener('click', () => setGiorno(todayKey()));

    root.querySelectorAll('[data-meal]').forEach(card => {
      card.querySelector('.meal-head').addEventListener('click', () => {
        const id = card.dataset.meal;
        expanded.has(id) ? expanded.delete(id) : expanded.add(id);
        paint();
      });
    });

    root.querySelectorAll('[data-remove]').forEach(b => {
      b.addEventListener('click', async e => {
        e.stopPropagation();
        const [mealId, itemId] = b.dataset.remove.split('|');
        const ok = await removeFoodFromDay(giorno, mealId, itemId);
        if (!ok) return;
        toast('Alimento rimosso');
        if (giorno !== todayKey()) paint();     // su oggi ci pensa subscribe
      });
    });
  }
}

/* ---------- Card singolo pasto ---------- */
function mealCard(p, pasti, expanded) {
  const items = pasti[p.id] || [];
  const kcal = Math.round(items.reduce((n, x) => n + x.kcal, 0));
  const desc = items.length === 0
    ? '<span class="faint">Niente ancora</span>'
    : esc(items.map(x => x.nome).join(', '));
  const open = expanded.has(p.id);

  return `
    <div class="card" data-meal="${p.id}">
      <div class="row meal-head" style="cursor:pointer;" role="button" tabindex="0" aria-expanded="${open}">
        <div class="meal-emoji">${p.emoji}</div>
        <div class="grow" style="min-width:0;">
          <strong>${p.nome}</strong>
          <div class="muted small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${desc}</div>
        </div>
        <div class="col" style="align-items:flex-end;gap:0;flex-shrink:0;">
          <strong class="tabular">${kcal}</strong>
          <span class="faint">kcal</span>
        </div>
        <span class="chevron" style="transform:rotate(${open ? 90 : 0}deg);transition:transform var(--t-fast) var(--ease);">${ICONS.chevron}</span>
      </div>

      ${open ? `
        <div class="meal-items">
          ${items.length === 0
            ? '<p class="faint center" style="padding:6px;">Vuoto: aggiungi qualcosa.</p>'
            : items.map(x => `
              <div class="meal-item">
                <span>${x.emoji || '🍽️'} ${esc(x.nome)} <span class="faint tabular">${x.grammi} g</span></span>
                <span class="row" style="gap:8px;">
                  <span class="tabular muted">${Math.round(x.kcal)} kcal</span>
                  <button class="btn-ghost btn-danger" data-remove="${p.id}|${x.id}" aria-label="Rimuovi ${esc(x.nome)}">${ICONS.trash}</button>
                </span>
              </div>`).join('')}
        </div>` : ''}
    </div>`;
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
