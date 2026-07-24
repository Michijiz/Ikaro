/* ============================================================
   IKARO — Vista Aggiungi Alimento
   Tre modi per arrivare a un alimento, dal più veloce al più lento:
     1. Recenti  — quelli che mangi davvero, in un tap
     2. Ricerca  — sul DB predefinito + i tuoi custom
     3. Crea     — quando non esiste, te lo fai
   ============================================================ */

import {
  getState, update, uid,
  allFoods, saveCustomFood, deleteCustomFood, frequentFoods, findFoodByName,
  PASTI, UNITA, toBaseQty,
} from '../store.js';
import {
  toast, esc, ICONS, openModal, confirmModal, parseDecimal,
} from '../components/ui.js';

export function renderAggiungiAlimento(root) {
  let query = '';
  let recenti = [];

  paint();

  // I recenti richiedono una lettura su IndexedDB: la vista si disegna
  // subito e loro compaiono appena pronti, senza bloccare la ricerca
  frequentFoods(6).then(r => {
    recenti = r.filter(x => findFoodByName(x.nome));
    if (recenti.length) paint();
  });

  function paint() {
    const results = filterFoods(query, allFoods());

    root.innerHTML = `
      <header class="page-head">
        <button class="icon-btn" id="btn-back" aria-label="Indietro">${ICONS.back}</button>
        <div class="title grow"><h1 style="font-size:1.35rem;">Aggiungi</h1></div>
        <button class="btn btn-secondary btn-sm" id="btn-new">${ICONS.plus} Crea</button>
      </header>

      <div class="search-wrap">
        ${ICONS.search}
        <input id="search" type="search" placeholder="Cerca un alimento…"
               value="${esc(query)}" autocomplete="off" enterkeyhint="search">
      </div>

      ${!query && recenti.length ? `
        <div class="eyebrow mt-16">Recenti</div>
        <div class="card mt-8" style="padding:2px 14px;">
          ${recenti.map(r => `
            <div class="food-row" data-recente="${esc(r.nome)}" role="button" tabindex="0">
              <div class="row" style="gap:10px;min-width:0;">
                <span style="font-size:1.1rem;">${r.emoji || '🍽️'}</span>
                <div style="min-width:0;">
                  <strong class="small">${esc(r.nome)}</strong>
                  <div class="faint">ultima volta ${r.grammi} g</div>
                </div>
              </div>
              <span class="chevron">${ICONS.chevron}</span>
            </div>`).join('')}
        </div>` : ''}

      <div class="eyebrow mt-16">${query ? 'Risultati' : 'Tutti gli alimenti'}</div>
      <div class="card mt-8" style="padding:2px 14px;">
        ${results.length === 0 ? `
          <div class="empty">
            <div class="icon">🔍</div>
            Nessun risultato per «${esc(query)}».
            <div class="mt-8">
              <button class="btn btn-secondary btn-sm" id="btn-new-2">${ICONS.plus} Crea «${esc(query.slice(0, 20))}»</button>
            </div>
          </div>
        ` : results.map(f => `
          <div class="food-row" data-food="${esc(f.id)}" role="button" tabindex="0">
            <div class="row" style="gap:10px;min-width:0;">
              <span style="font-size:1.1rem;">${f.emoji}</span>
              <div style="min-width:0;">
                <div class="row" style="gap:6px;min-width:0;">
                  <strong class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(f.nome)}</strong>
                  ${f.custom ? '<span class="tag-custom">tuo</span>' : ''}
                </div>
                <div class="faint">porzione ${f.porzione} ${f.unita}</div>
              </div>
            </div>
            <span class="tabular muted small" style="flex-shrink:0;">${Math.round(f.kcal * toBaseQty(f, f.porzione) / 100)} kcal</span>
          </div>
        `).join('')}
      </div>
    `;

    bind();
  }

  function bind() {
    root.querySelector('#btn-back').addEventListener('click', () => {
      location.hash = '#/nutrizione';
    });

    const search = root.querySelector('#search');
    search.addEventListener('input', () => {
      query = search.value;
      const pos = search.selectionStart;
      paint();
      const s2 = root.querySelector('#search');
      s2.focus();
      s2.setSelectionRange(pos, pos);
    });

    const nuovo = () => openFoodEditor(null, () => { query = ''; paint(); });
    root.querySelector('#btn-new').addEventListener('click', nuovo);
    root.querySelector('#btn-new-2')?.addEventListener('click', () =>
      openFoodEditor({ nome: query }, () => { query = ''; paint(); }));

    root.querySelectorAll('[data-food]').forEach(row => {
      const open = () => {
        const f = allFoods().find(x => x.id === row.dataset.food);
        if (f) openDetail(f, null, paint);
      };
      row.addEventListener('click', open);
      row.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
    });

    // Un recente riapre il dettaglio già con la grammatura dell'ultima volta
    root.querySelectorAll('[data-recente]').forEach(row => {
      const open = () => {
        const r = recenti.find(x => x.nome === row.dataset.recente);
        const f = findFoodByName(row.dataset.recente);
        if (f) openDetail(f, r?.grammi, paint);
      };
      row.addEventListener('click', open);
      row.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
    });
  }
}

/* ---------- Dettaglio: quantità, macro live, pasto ---------- */
function openDetail(food, grammiIniziali, onChange) {
  let pasto = suggestMeal();
  const u = UNITA.find(x => x.id === food.unita) || UNITA[0];
  const pesoPz = food.pesoPz || 100;

  /* L'input è nell'unità dell'alimento; i macro sanno lavorare solo in
     grammi/ml, quindi ogni valore passa da `toBaseQty` prima del calcolo. */
  let qta = grammiIniziali
    ? (u.id === 'pz' ? Math.max(1, Math.round(grammiIniziali / pesoPz)) : grammiIniziali)
    : (u.id === 'pz' ? 1 : food.porzione);

  const maxQta = u.id === 'pz' ? 50 : 5000;

  const calc = q => {
    const g = toBaseQty(food, q);
    return {
      g,
      kcal: Math.round(food.kcal * g / 100),
      p: r1(food.p * g / 100),
      c: r1(food.c * g / 100),
      f: r1(food.f * g / 100),
      fib: food.fib === null ? null : r1(food.fib * g / 100),
    };
  };

  const m = calc(qta);
  const equiv = v => u.id === 'pz' ? `≈ ${Math.round(v.g)} g` : '';

  const close = openModal({
    title: `${food.emoji} ${esc(food.nome)}`,
    body: `
      <label class="col" style="gap:5px;">
        <span class="faint">Quantità</span>
        <div class="row" style="gap:8px;align-items:center;">
          <input id="dt-qta" class="grow" type="text" inputmode="decimal" enterkeyhint="done" value="${qta}">
          <span class="chip-unit">${u.nome}</span>
        </div>
        <span class="faint tabular" id="dt-equiv">${equiv(m)}</span>
      </label>

      <div class="row mt-16" style="justify-content:space-around;text-align:center;">
        <div><div class="stat" style="font-size:1.1rem;" id="dt-kcal">${m.kcal}</div><div class="stat-label">kcal</div></div>
        <div><div class="stat" style="font-size:1.1rem;color:var(--macro-protein);" id="dt-p">${m.p}</div><div class="stat-label">P</div></div>
        <div><div class="stat" style="font-size:1.1rem;color:var(--macro-carbs);" id="dt-c">${m.c}</div><div class="stat-label">C</div></div>
        <div><div class="stat" style="font-size:1.1rem;color:var(--macro-fat);" id="dt-f">${m.f}</div><div class="stat-label">G</div></div>
        <div><div class="stat" style="font-size:1.1rem;" id="dt-fib">${m.fib === null ? '—' : m.fib}</div><div class="stat-label">Fibre</div></div>
      </div>

      <label class="col mt-16" style="gap:5px;">
        <span class="faint">Aggiungi a</span>
        <select id="dt-pasto">
          ${PASTI.map(p => `<option value="${p.id}" ${p.id === pasto ? 'selected' : ''}>${p.emoji} ${p.nome}</option>`).join('')}
        </select>
      </label>

      <button class="btn btn-primary btn-block mt-16" id="dt-add">Aggiungi al pasto</button>
      ${food.custom ? `
        <div class="row mt-8">
          <button class="btn btn-secondary btn-sm grow" id="dt-edit">${ICONS.edit} Modifica</button>
          <button class="btn btn-sm btn-danger grow" id="dt-del">${ICONS.trash} Elimina</button>
        </div>` : ''}
    `,
    onMount: (root, closeFn) => {
      const inp = root.querySelector('#dt-qta');

      // Ricalcolo live senza ridisegnare: l'input non perde il focus
      inp.addEventListener('input', () => {
        const q = parseDecimal(inp.value, 0.1, maxQta);
        if (!q) return;
        qta = q;
        const v = calc(q);
        root.querySelector('#dt-kcal').textContent = v.kcal;
        root.querySelector('#dt-p').textContent = v.p;
        root.querySelector('#dt-c').textContent = v.c;
        root.querySelector('#dt-f').textContent = v.f;
        root.querySelector('#dt-fib').textContent = v.fib === null ? '—' : v.fib;
        root.querySelector('#dt-equiv').textContent = equiv(v);
      });

      root.querySelector('#dt-pasto').addEventListener('change', e => { pasto = e.target.value; });

      const aggiungi = () => {
        const q = parseDecimal(inp.value, 0.1, maxQta);
        if (!q) { toast(`Quantità non valida (max ${maxQta} ${u.nome})`); return; }
        const v = calc(q);
        update(st => {
          st.meals.pasti[pasto].push({
            id: uid(), nome: food.nome, emoji: food.emoji,
            qta: q, unita: u.id,
            grammi: Math.round(v.g),   // resta la scala interna di riferimento
            kcal: v.kcal, p: v.p, c: v.c, f: v.f, fib: v.fib,
          });
        });
        toast(`${food.emoji} Aggiunto a ${PASTI.find(x => x.id === pasto).nome}`);
        closeFn();
        location.hash = '#/nutrizione';
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
  /* I valori sono memorizzati per 100 g/ml, ma l'etichetta di un prodotto
     spesso riporta «per vasetto», «per barretta», «per 30 g». Qui si
     inserisce come sta scritto sulla confezione: `base` + `unita` sono il
     riferimento, la conversione a 100 avviene al salvataggio. */
  const d = {
    id: existing?.id || null,
    nome: existing?.nome || '',
    emoji: existing?.emoji || '🍽️',
    unita: existing?.unita || 'g',
    base: existing?.base || 100,
    pesoPz: existing?.pesoPz || 100,
    porzione: existing?.porzione || 100,
  };

  // Da per-100 al riferimento scelto, per rimostrarli come erano stati scritti
  const fattore = d.unita === 'pz' ? d.pesoPz / 100 : d.base / 100;
  const back = v => (v === '' || v === null || v === undefined) ? '' : r1(v * fattore);
  d.kcal = existing ? back(existing.kcal) : '';
  d.p    = existing ? back(existing.p)    : '';
  d.c    = existing ? back(existing.c)    : '';
  d.f    = existing ? back(existing.f)    : '';
  d.fib  = existing && existing.fib !== null && existing.fib !== undefined ? back(existing.fib) : '';

  const close = openModal({
    title: existing?.id ? 'Modifica alimento' : 'Nuovo alimento',
    tall: true,
    body: `
      <p class="faint">Inserisci i valori così come stanno sull'etichetta: scegli tu il riferimento.</p>

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

      <div class="row mt-16" style="gap:10px;align-items:flex-end;">
        <label class="field grow">
          <span>Valori riferiti a</span>
          <input id="f-base" type="text" inputmode="decimal" value="${d.base}">
        </label>
        <label class="field" style="width:96px;flex-shrink:0;">
          <span>Unità</span>
          <select id="f-unita">
            ${UNITA.map(x => `<option value="${x.id}" ${x.id === d.unita ? 'selected' : ''}>${x.label}</option>`).join('')}
          </select>
        </label>
      </div>

      <label class="field mt-16" id="f-peso-wrap" style="display:${d.unita === 'pz' ? '' : 'none'};">
        <span>Peso di 1 pezzo (g)</span>
        <input id="f-peso" type="text" inputmode="decimal" value="${d.pesoPz}" placeholder="Es. 60">
      </label>

      <div class="field-grid mt-16">
        <label class="field">
          <span>Calorie</span>
          <input id="f-kcal" type="text" inputmode="decimal" value="${d.kcal}" placeholder="kcal">
        </label>
        <label class="field">
          <span>Porzione tipica (<span class="u-lbl">${d.unita}</span>)</span>
          <input id="f-porz" type="text" inputmode="decimal" value="${d.porzione}">
        </label>
        <label class="field">
          <span>Proteine (g)</span>
          <input id="f-p" type="text" inputmode="decimal" value="${d.p}" placeholder="g">
        </label>
        <label class="field">
          <span>Carboidrati (g)</span>
          <input id="f-c" type="text" inputmode="decimal" value="${d.c}" placeholder="g">
        </label>
        <label class="field">
          <span>Grassi (g)</span>
          <input id="f-f" type="text" inputmode="decimal" value="${d.f}" placeholder="g">
        </label>
        <label class="field">
          <span>Fibre (g)</span>
          <input id="f-fib" type="text" inputmode="decimal" value="${d.fib}" placeholder="facoltativo">
        </label>
      </div>

      <p class="faint mt-8" id="f-check"></p>
      <button class="btn btn-primary btn-block mt-16" id="f-save">Salva alimento</button>
    `,
    onMount: (root, closeFn) => {
      const q = s => root.querySelector(s);
      q('#f-nome').focus();

      const unitaSel = () => q('#f-unita').value;

      /* Il riferimento cambia le etichette e, se è «pezzi», serve sapere
         quanto pesa un pezzo: senza quel dato i macro non sono convertibili. */
      const syncUnita = () => {
        const u = unitaSel();
        q('#f-peso-wrap').style.display = u === 'pz' ? '' : 'none';
        root.querySelectorAll('.u-lbl').forEach(el => { el.textContent = u; });
        verifica();
      };
      q('#f-unita').addEventListener('change', syncUnita);

      /* Il controllo 4/4/9 va fatto sulla stessa scala dei valori inseriti,
         qualunque essa sia. Le fibre restano fuori: il loro apporto calorico
         non segue Atwater e le etichette le conteggiano in modo difforme. */
      const verifica = () => {
        const p = parseDecimal(q('#f-p').value, 0, 10000);
        const c = parseDecimal(q('#f-c').value, 0, 10000);
        const f = parseDecimal(q('#f-f').value, 0, 10000);
        const kcal = parseDecimal(q('#f-kcal').value, 0, 20000);
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
        const unita = unitaSel();
        const base = parseDecimal(q('#f-base').value, 0.1, 10000);
        const pesoPz = unita === 'pz' ? parseDecimal(q('#f-peso').value, 0.1, 5000) : null;
        const porzione = parseDecimal(q('#f-porz').value, 0.1, 5000);
        const kcal = parseDecimal(q('#f-kcal').value, 0, 20000);
        const p = parseDecimal(q('#f-p').value, 0, 10000);
        const c = parseDecimal(q('#f-c').value, 0, 10000);
        const f = parseDecimal(q('#f-f').value, 0, 10000);
        const fibRaw = q('#f-fib').value.trim();
        const fib = fibRaw === '' ? null : parseDecimal(fibRaw, 0, 10000);

        if (!nome) { toast('Serve un nome'); return; }
        if (base === null) { toast('Riferimento non valido'); return; }
        if (unita === 'pz' && pesoPz === null) { toast('Serve il peso di 1 pezzo'); return; }
        if (porzione === null) { toast('Porzione non valida'); return; }
        if ([kcal, p, c, f].some(x => x === null)) {
          toast('Compila calorie e macro (0 è valido)'); return;
        }
        if (fibRaw !== '' && fib === null) { toast('Fibre non valide'); return; }

        /* Normalizzazione a 100 g/ml: è l'unica scala su cui l'app calcola.
           Con «pezzi» la quantità di riferimento è base × peso del pezzo. */
        const grammiRif = unita === 'pz' ? base * pesoPz : base;
        const per100 = v => v === null ? null : r1(v * 100 / grammiRif);

        await saveCustomFood({
          id: d.id, nome, emoji,
          unita, base, pesoPz,
          porzione: r1(porzione),
          kcal: per100(kcal), p: per100(p), c: per100(c), f: per100(f), fib: per100(fib),
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

/** Filtro insensibile a maiuscole e accenti. I custom vengono prima. */
function filterFoods(q, foods) {
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const nq = norm(q.trim());
  if (!nq) return foods;
  return foods.filter(f => norm(f.nome).includes(nq));
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
