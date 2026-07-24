/* ============================================================
   IKARO — Vista Nutrizione
   Stesso blocco Calorie della Home (anello + macro), poi i
   quattro pasti espandibili con rimozione dei singoli alimenti.
   ============================================================ */

import { getState, update, subscribe, dayTotals, PASTI } from '../store.js';
import { progressRing } from '../components/donut-chart.js';
import { toast, esc, ICONS } from '../components/ui.js';

export function renderNutrizione(root) {
  // Lo stato di espansione è locale alla visita, non globale al modulo
  const expanded = new Set();
  const unsub = subscribe(() => paint(root, expanded));
  paint(root, expanded);
  return () => unsub();
}

function paint(root, expanded) {
  const s = getState();
  const tot = dayTotals(s);
  const g = s.profile.goals;
  const rimanenti = g.calories - tot.kcal;
  const oltre = rimanenti < 0;

  root.innerHTML = `
    <header class="page-head">
      <div class="title">
        <h1>Nutrizione</h1>
        <div class="sub">${dataOggi()}</div>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-add">${ICONS.plus} Alimento</button>
    </header>

    <div class="card">
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
          ${fibreRow(tot)}
        </div>
      </div>
      <div class="stat-row">
        ${statCell(fmtInt(tot.kcal), 'Assunte', 'kcal')}
        ${statCell(fmtInt(g.calories), 'Obiettivo', 'kcal')}
        ${statCell(`${pct(tot.kcal, g.calories)}`, 'Del target', '%')}
      </div>
    </div>

    <div class="col mt-16" style="gap:12px;">
      ${PASTI.map(p => mealCard(p, s, expanded)).join('')}
    </div>

    <button class="btn btn-primary btn-block mt-16" id="btn-add-2">${ICONS.plus} Aggiungi alimento</button>
  `;

  const goAdd = () => { location.hash = '#/aggiungi-alimento'; };
  root.querySelector('#btn-add').addEventListener('click', goAdd);
  root.querySelector('#btn-add-2').addEventListener('click', goAdd);

  root.querySelectorAll('[data-meal]').forEach(card => {
    card.querySelector('.meal-head').addEventListener('click', () => {
      const id = card.dataset.meal;
      expanded.has(id) ? expanded.delete(id) : expanded.add(id);
      paint(root, expanded);
    });
  });

  root.querySelectorAll('[data-remove]').forEach(b => {
    b.addEventListener('click', e => {
      e.stopPropagation();
      const [mealId, itemId] = b.dataset.remove.split('|');
      update(st => {
        st.meals.pasti[mealId] = st.meals.pasti[mealId].filter(x => x.id !== itemId);
      });
      toast('Alimento rimosso');
    });
  });
}

/* ---------- Card singolo pasto ---------- */
function mealCard(p, s, expanded) {
  const items = s.meals.pasti[p.id] || [];
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
                <span>${x.emoji || '🍽️'} ${esc(x.nome)} <span class="faint tabular">${x.qta ?? x.grammi} ${x.unita || 'g'}</span></span>
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

/* Le fibre sono un dato informativo: nessun obiettivo, nessuna barra.
   Se qualche voce del giorno non le riporta il totale è un minimo, non
   una misura — e va detto, altrimenti sembra un dato completo. */
function fibreRow(tot) {
  if (!tot.fib && !tot.fibParziale) return '';
  return `
    <div class="macro-row">
      <div class="lbl">Fibre ${tot.fib.toLocaleString('it-IT')} <span class="g">g${tot.fibParziale ? ' · dato parziale' : ''}</span></div>
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

function dataOggi() {
  const d = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  return d.charAt(0).toUpperCase() + d.slice(1);
}
