/* ============================================================
   IKARO — Vista Aggiungi Alimento
   Tre modi per arrivare a un alimento, dal più veloce al più lento:
     1. Recenti  — quelli che mangi davvero, in un tap
     2. Ricerca  — sul DB predefinito + i tuoi custom
     3. Crea     — quando non esiste, te lo fai
   L'alimento finisce sul giorno passato via rotta (#/aggiungi-alimento/DATA),
   che di default è oggi.
   ============================================================ */

import {
  uid, todayKey, validDay, dayLabel,
  allFoods, saveCustomFood, deleteCustomFood, frequentFoods, findFoodByName,
  addFoodToDay, PASTI,
} from '../store.js';
import {
  toast, esc, ICONS, openModal, confirmModal, parseDecimal,
} from '../components/ui.js';

/* Oltre questa soglia la lista smette di essere consultabile e diventa
   rumore: il DB ha ~1900 voci, renderizzarle tutte è inutile e lento. */
const MAX_RISULTATI = 40;

export function renderAggiungiAlimento(root, param) {
  const giorno = validDay(param);
  let query = '';
  let recenti = [];

  paintShell();

  // I recenti richiedono una lettura su IndexedDB: la vista si disegna
  // subito e loro compaiono appena pronti, senza bloccare la ricerca
  frequentFoods(8).then(r => {
    recenti = r.filter(x => findFoodByName(x.nome));
    if (recenti.length && !query) paintResults();
  });

  /* Il guscio (header + campo di ricerca) si disegna una volta sola:
     ridisegnarlo a ogni tasto costringeva a rimettere focus e cursore
     a mano, ed era la parte più fragile della vista. */
  function paintShell() {
    const oggi = giorno === todayKey();
    root.innerHTML = `
      <header class="page-head">
        <button class="icon-btn" id="btn-back" aria-label="Indietro">${ICONS.back}</button>
        <div class="title grow">
          <h1 style="font-size:1.35rem;">Aggiungi</h1>
          <div class="sub">${oggi ? 'a oggi' : `a ${dayLabel(giorno).toLowerCase()}`}</div>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-new">${ICONS.plus} Crea</button>
      </header>

      <div class="search-sticky">
        <div class="search-wrap">
          ${ICONS.search}
          <input id="search" type="search" placeholder="Cerca tra ${allFoods().length} alimenti…"
                 autocomplete="off" enterkeyhint="search">
          <button class="search-clear" id="btn-clear" aria-label="Cancella" hidden>✕</button>
        </div>
      </div>

      <div id="results"></div>
    `;

    root.querySelector('#btn-back').addEventListener('click', () => {
      location.hash = `#/nutrizione/${giorno}`;
    });
    root.querySelector('#btn-new').addEventListener('click', () =>
      openFoodEditor(null, () => { setQuery(''); }));

    const search = root.querySelector('#search');
    search.addEventListener('input', () => setQuery(search.value, false));
    root.querySelector('#btn-clear').addEventListener('click', () => {
      setQuery('');
      search.focus();
    });

    paintResults();
  }

  function setQuery(v, syncInput = true) {
    query = v;
    const input = root.querySelector('#search');
    if (syncInput) input.value = v;
    root.querySelector('#btn-clear').hidden = !v;
    paintResults();
  }

  /* Solo la lista viene ridisegnata: il campo di ricerca non perde mai
     il focus e non serve alcun ripristino del cursore. */
  function paintResults() {
    const box = root.querySelector('#results');
    if (!box) return;

    if (!query.trim()) {
      const suggeriti = padStaples(recenti, 8);
      box.innerHTML = `
        ${recenti.length ? `
          <div class="eyebrow mt-16">Usati di recente</div>
          <div class="card mt-8 list-card">
            ${recenti.map(r => foodRowRecente(r)).join('')}
          </div>` : ''}

        ${suggeriti.length ? `
          <div class="eyebrow mt-16">Di base</div>
          <div class="card mt-8 list-card">
            ${suggeriti.map(f => foodRow(f)).join('')}
          </div>` : ''}

        <p class="faint center mt-16">Scrivi per cercare negli altri alimenti.</p>
      `;
    } else {
      const results = searchFoods(query, allFoods());
      const mostrati = results.slice(0, MAX_RISULTATI);
      box.innerHTML = `
        <div class="between mt-16">
          <div class="eyebrow">Risultati</div>
          ${results.length ? `<span class="faint">${results.length > MAX_RISULTATI
            ? `primi ${MAX_RISULTATI} di ${results.length}` : results.length}</span>` : ''}
        </div>
        <div class="card mt-8 list-card">
          ${mostrati.length === 0 ? `
            <div class="empty">
              <div class="icon">🔍</div>
              Nessun risultato per «${esc(query)}».
              <div class="mt-8">
                <button class="btn btn-secondary btn-sm" id="btn-new-2">${ICONS.plus} Crea «${esc(query.trim().slice(0, 20))}»</button>
              </div>
            </div>
          ` : mostrati.map(f => foodRow(f)).join('')}
        </div>
        ${results.length > MAX_RISULTATI
          ? '<p class="faint center mt-8">Affina la ricerca per vedere il resto.</p>' : ''}
      `;
    }

    bindRows();
  }

  function bindRows() {
    root.querySelector('#btn-new-2')?.addEventListener('click', () =>
      openFoodEditor({ nome: query.trim() }, () => { setQuery(''); }));

    root.querySelectorAll('[data-food]').forEach(row => {
      const open = () => {
        const f = allFoods().find(x => x.id === row.dataset.food);
        if (f) openDetail(f, null, giorno, paintResults);
      };
      row.addEventListener('click', open);
      row.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
    });

    // Un recente riapre il dettaglio già con la grammatura dell'ultima volta
    root.querySelectorAll('[data-recente]').forEach(row => {
      const open = () => {
        const r = recenti.find(x => x.nome === row.dataset.recente);
        const f = findFoodByName(row.dataset.recente);
        if (f) openDetail(f, r?.grammi, giorno, paintResults);
      };
      row.addEventListener('click', open);
      row.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
    });
  }
}

/* ---------- Righe lista ---------- */
function foodRow(f) {
  return `
    <div class="food-row" data-food="${esc(f.id)}" role="button" tabindex="0">
      <div class="row" style="gap:10px;min-width:0;">
        <span class="food-emoji">${f.emoji}</span>
        <div style="min-width:0;">
          <div class="row" style="gap:6px;min-width:0;">
            <strong class="small ellipsis">${esc(f.nome)}</strong>
            ${f.custom ? '<span class="tag-custom">tuo</span>' : ''}
          </div>
          <div class="faint">${Math.round(f.kcal)} kcal / 100 g · porzione ${f.porzione} g</div>
        </div>
      </div>
      <span class="chevron">${ICONS.chevron}</span>
    </div>`;
}

function foodRowRecente(r) {
  return `
    <div class="food-row" data-recente="${esc(r.nome)}" role="button" tabindex="0">
      <div class="row" style="gap:10px;min-width:0;">
        <span class="food-emoji">${r.emoji || '🍽️'}</span>
        <div style="min-width:0;">
          <strong class="small ellipsis">${esc(r.nome)}</strong>
          <div class="faint">ultima volta ${r.grammi} g</div>
        </div>
      </div>
      <span class="chevron">${ICONS.chevron}</span>
    </div>`;
}

/* ---------- Dettaglio: quantità, macro live, pasto ---------- */
function openDetail(food, grammiIniziali, giorno, onChange) {
  let grammi = grammiIniziali || food.porzione;
  let pasto = suggestMeal();

  const calc = g => ({
    kcal: Math.round(food.kcal * g / 100),
    p: r1(food.p * g / 100),
    c: r1(food.c * g / 100),
    f: r1(food.f * g / 100),
  });

  const m = calc(grammi);
  const oggi = giorno === todayKey();

  const close = openModal({
    title: `${food.emoji} ${esc(food.nome)}`,
    body: `
      <label class="col" style="gap:5px;">
        <span class="faint">Quantità (grammi)</span>
        <input id="dt-grammi" type="text" inputmode="numeric" enterkeyhint="done" value="${grammi}">
      </label>

      <div class="row mt-16" style="justify-content:space-around;text-align:center;">
        <div><div class="stat" style="font-size:1.1rem;" id="dt-kcal">${m.kcal}</div><div class="stat-label">kcal</div></div>
        <div><div class="stat" style="font-size:1.1rem;color:var(--macro-protein);" id="dt-p">${m.p}</div><div class="stat-label">P</div></div>
        <div><div class="stat" style="font-size:1.1rem;color:var(--macro-carbs);" id="dt-c">${m.c}</div><div class="stat-label">C</div></div>
        <div><div class="stat" style="font-size:1.1rem;color:var(--macro-fat);" id="dt-f">${m.f}</div><div class="stat-label">G</div></div>
      </div>

      <div class="col mt-16" style="gap:6px;">
        <span class="faint">In quale pasto</span>
        <div class="segmented" id="dt-pasti">
          ${PASTI.map(p => `
            <button type="button" data-pasto="${p.id}" class="${p.id === pasto ? 'on' : ''}">
              ${p.emoji} ${p.nome}
            </button>`).join('')}
        </div>
      </div>

      <button class="btn btn-primary btn-block mt-16" id="dt-add">
        Aggiungi ${oggi ? 'a oggi' : `a ${dayLabel(giorno).toLowerCase()}`}
      </button>
      ${food.custom ? `
        <div class="row mt-8">
          <button class="btn btn-secondary btn-sm grow" id="dt-edit">${ICONS.edit} Modifica</button>
          <button class="btn btn-sm btn-danger grow" id="dt-del">${ICONS.trash} Elimina</button>
        </div>` : ''}
    `,
    onMount: (root, closeFn) => {
      const inp = root.querySelector('#dt-grammi');

      // Ricalcolo live senza ridisegnare: l'input non perde il focus
      inp.addEventListener('input', () => {
        const g = parseDecimal(inp.value, 1, 5000);
        if (!g) return;
        grammi = g;
        const v = calc(g);
        root.querySelector('#dt-kcal').textContent = v.kcal;
        root.querySelector('#dt-p').textContent = v.p;
        root.querySelector('#dt-c').textContent = v.c;
        root.querySelector('#dt-f').textContent = v.f;
      });

      root.querySelectorAll('[data-pasto]').forEach(b => {
        b.addEventListener('click', () => {
          pasto = b.dataset.pasto;
          root.querySelectorAll('[data-pasto]').forEach(x =>
            x.classList.toggle('on', x === b));
        });
      });

      const aggiungi = async () => {
        const g = parseDecimal(inp.value, 1, 5000);
        if (!g) { toast('Quantità non valida (1–5000 g)'); return; }
        const v = calc(g);
        const ok = await addFoodToDay(giorno, pasto, {
          id: uid(), nome: food.nome, emoji: food.emoji,
          grammi: Math.round(g), kcal: v.kcal, p: v.p, c: v.c, f: v.f,
        });
        if (!ok) return;
        const nomePasto = PASTI.find(x => x.id === pasto).nome;
        toast(`${food.emoji} ${nomePasto} · ${dayLabel(giorno).toLowerCase()}`);
        closeFn();
        location.hash = `#/nutrizione/${giorno}`;
      };

      root.querySelector('#dt-add').addEventListener('click', aggiungi);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') aggiungi(); });

      root.querySelector('#dt-edit')?.addEventListener('click', () => {
        closeFn();
        openFoodEditor(food, onChange);
      });

      root.querySelector('#dt-del')?.addEventListener('click', async () => {
        const ok = await confirmModal(
          `Eliminare «${esc(food.nome)}»? I pasti già registrati non cambiano.`,
          { ok: 'Elimina', danger: true });
        if (!ok) return;
        await deleteCustomFood(food.id);
        toast('Alimento eliminato');
        closeFn();
        onChange && onChange();
      });
    },
  });
  return close;
}

/* ---------- Editor alimento custom ---------- */
function openFoodEditor(existing, onDone) {
  const d = {
    id: existing?.id || null,
    nome: existing?.nome || '',
    emoji: existing?.emoji || '🍽️',
    porzione: existing?.porzione || 100,
    kcal: existing?.kcal ?? '',
    p: existing?.p ?? '',
    c: existing?.c ?? '',
    f: existing?.f ?? '',
  };

  const close = openModal({
    title: existing?.id ? 'Modifica alimento' : 'Nuovo alimento',
    tall: true,
    body: `
      <p class="faint">Valori per 100 g, come sull'etichetta.</p>

      <div class="row mt-16" style="gap:10px;align-items:flex-end;">
        <label class="field" style="width:62px;flex-shrink:0;">
          <span>Emoji</span>
          <input id="f-emoji" type="text" value="${esc(d.emoji)}" maxlength="4" style="text-align:center;">
        </label>
        <label class="field grow">
          <span>Nome</span>
          <input id="f-nome" type="text" value="${esc(d.nome)}" maxlength="40" placeholder="Es. Skyr alla vaniglia">
        </label>
      </div>

      <div class="field-grid mt-16">
        <label class="field">
          <span>Calorie / 100 g</span>
          <input id="f-kcal" type="text" inputmode="decimal" value="${d.kcal}" placeholder="kcal">
        </label>
        <label class="field">
          <span>Porzione tipica (g)</span>
          <input id="f-porz" type="text" inputmode="numeric" value="${d.porzione}">
        </label>
        <label class="field">
          <span>Proteine / 100 g</span>
          <input id="f-p" type="text" inputmode="decimal" value="${d.p}" placeholder="g">
        </label>
        <label class="field">
          <span>Carboidrati / 100 g</span>
          <input id="f-c" type="text" inputmode="decimal" value="${d.c}" placeholder="g">
        </label>
        <label class="field">
          <span>Grassi / 100 g</span>
          <input id="f-f" type="text" inputmode="decimal" value="${d.f}" placeholder="g">
        </label>
      </div>

      <p class="faint mt-8" id="f-check"></p>
      <button class="btn btn-primary btn-block mt-16" id="f-save">Salva alimento</button>
    `,
    onMount: (root, closeFn) => {
      const q = s => root.querySelector(s);
      q('#f-nome').focus();

      /* I macro devono tornare con le calorie (4/4/9 kcal per g).
         Non è un errore bloccante — le etichette arrotondano — ma se lo
         scarto è grosso di solito è un valore digitato male. */
      const verifica = () => {
        const p = parseDecimal(q('#f-p').value, 0, 100);
        const c = parseDecimal(q('#f-c').value, 0, 100);
        const f = parseDecimal(q('#f-f').value, 0, 100);
        const kcal = parseDecimal(q('#f-kcal').value, 0, 900);
        const el = q('#f-check');
        if ([p, c, f, kcal].some(x => x === null) || !kcal) { el.textContent = ''; return; }
        const teoriche = p * 4 + c * 4 + f * 9;
        const scarto = Math.abs(teoriche - kcal) / kcal;
        if (scarto > 0.2) {
          el.innerHTML = `⚠️ Dai macro verrebbero <strong>${Math.round(teoriche)}</strong> kcal, non ${Math.round(kcal)}. Ricontrolla.`;
          el.style.color = 'var(--warn)';
        } else {
          el.textContent = '✓ Macro e calorie tornano.';
          el.style.color = 'var(--accent)';
        }
      };
      ['#f-p', '#f-c', '#f-f', '#f-kcal'].forEach(s =>
        q(s).addEventListener('input', verifica));
      verifica();

      q('#f-save').addEventListener('click', async () => {
        const nome = q('#f-nome').value.trim();
        const emoji = q('#f-emoji').value.trim() || '🍽️';
        const porzione = parseDecimal(q('#f-porz').value, 1, 2000);
        const kcal = parseDecimal(q('#f-kcal').value, 0, 900);
        const p = parseDecimal(q('#f-p').value, 0, 100);
        const c = parseDecimal(q('#f-c').value, 0, 100);
        const f = parseDecimal(q('#f-f').value, 0, 100);

        if (!nome) { toast('Serve un nome'); return; }
        if (porzione === null) { toast('Porzione non valida'); return; }
        if ([kcal, p, c, f].some(x => x === null)) {
          toast('Compila calorie e macro (0 è valido)'); return;
        }

        await saveCustomFood({
          id: d.id, nome, emoji,
          porzione: Math.round(porzione), kcal, p, c, f,
        });
        toast(d.id ? 'Alimento aggiornato' : `${emoji} Alimento creato`);
        closeFn();
        onDone && onDone();
      });
    },
  });
  return close;
}

/* ---------- helper ---------- */

const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Ricerca ordinata per pertinenza, non per posizione nel catalogo:
 * chi scrive "pol" vuole "Pollo", non "Insalata di finocchi e pollo".
 * 0 = inizia con la query, 1 = una parola inizia con la query, 2 = la contiene.
 * I custom vincono i pari merito: sono roba tua, li cerchi più spesso.
 */
export function searchFoods(q, foods) {
  const nq = norm(q.trim());
  if (!nq) return [];
  const out = [];
  for (const f of foods) {
    const n = norm(f.nome);
    const i = n.indexOf(nq);
    if (i < 0) continue;
    const rank = i === 0 ? 0 : (n[i - 1] === ' ' || n[i - 1] === "'" ? 1 : 2);
    out.push({ f, rank });
  }
  return out
    .sort((a, b) =>
      a.rank - b.rank ||
      (b.f.custom ? 1 : 0) - (a.f.custom ? 1 : 0) ||
      a.f.nome.length - b.f.nome.length ||
      a.f.nome.localeCompare(b.f.nome, 'it'))
    .map(x => x.f);
}

/**
 * Riempie la lista "Di base" con alimenti del catalogo, saltando quelli
 * già mostrati fra i recenti: con lo storico vuoto la vista non è nuda.
 */
function padStaples(recenti, quanti) {
  const visti = new Set(recenti.map(r => r.nome));
  return allFoods().filter(f => !f.custom && !visti.has(f.nome)).slice(0, quanti);
}

/** Suggerisce il pasto in base all'ora corrente. */
function suggestMeal() {
  const h = new Date().getHours();
  if (h < 11) return 'colazione';
  if (h < 15) return 'pranzo';
  if (h < 18) return 'spuntino';
  return 'cena';
}

function r1(n) { return Math.round(n * 10) / 10; }
