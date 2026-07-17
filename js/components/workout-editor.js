/* ============================================================
   IKARO — Editor scheda workout
   Una riga per esercizio: nome · serie · reps · carico.
   Prima ogni serie era una riga a sé: 5 esercizi × 4 serie
   facevano 20 righe e 40 campi. Ora sono 5 righe e 20 campi,
   e i casi particolari (piramidale, drop set) restano possibili
   come override sulla singola serie, dalla vista allenamento.
   ============================================================ */

import { getState, update, uid } from '../store.js';
import { toast, esc, ICONS, confirmModal, parseDecimal } from './ui.js';

/**
 * Apre l'editor per creare (workoutId=null) o modificare una scheda.
 * @param {string|null} workoutId
 * @param {(deleted:boolean)=>void} [onDone]
 */
export function openWorkoutEditor(workoutId, onDone) {
  const s = getState();
  const existing = workoutId ? s.workouts.find(w => w.id === workoutId) : null;

  // Copia di lavoro: le modifiche si applicano solo al salvataggio
  const draft = existing
    ? JSON.parse(JSON.stringify(existing))
    : { id: uid(), nome: '', icona: '🏋️', esercizi: [] };

  const mount = document.createElement('div');
  document.body.appendChild(mount);

  function paintEditor() {
    mount.innerHTML = `
      <div class="modal-overlay" id="editor-overlay">
        <div class="modal modal-tall">
          <div class="between">
            <h2>${existing ? 'Modifica scheda' : 'Nuova scheda'}</h2>
            <button class="btn-ghost" id="ed-close" aria-label="Chiudi">✕</button>
          </div>

          <div class="col mt-16" style="gap:12px;">
            <label class="field">
              <span>Nome scheda</span>
              <input id="ed-nome" value="${esc(draft.nome)}" placeholder="Es. Petto e tricipiti" maxlength="40">
            </label>

            <div class="between mt-8">
              <h3>Esercizi</h3>
              <button class="btn btn-secondary btn-sm" id="ed-add-ex">${ICONS.plus} Esercizio</button>
            </div>

            ${draft.esercizi.length === 0
              ? '<p class="muted small">Nessun esercizio. Aggiungine almeno uno.</p>'
              : `<div class="ex-head">
                   <span></span><span>Serie</span><span>Reps</span><span>Kg</span><span></span>
                 </div>`}

            ${draft.esercizi.map((e, i) => `
              <div class="ex-row">
                <input data-ex="${i}-nome" value="${esc(e.nome)}" placeholder="Nome esercizio" maxlength="50" aria-label="Nome esercizio">
                <input data-ex="${i}-serie" type="text" inputmode="numeric" value="${e.serie}" aria-label="Numero di serie">
                <input data-ex="${i}-reps" type="text" inputmode="numeric" value="${e.reps}" aria-label="Ripetizioni">
                <input data-ex="${i}-carico" type="text" inputmode="decimal" value="${fmtKg(e.carico)}" placeholder="—" aria-label="Carico in kg">
                <button class="btn-ghost btn-danger" data-ex-del="${i}" aria-label="Elimina esercizio">${ICONS.trash}</button>
              </div>
              ${e.override && Object.keys(e.override).length ? `
                <div class="faint" style="margin:-6px 0 4px 2px;font-size:0.7rem;">
                  ↳ ${Object.keys(e.override).length} serie con carico diverso (si modificano durante l'allenamento)
                </div>` : ''}
            `).join('')}

            <button class="btn btn-primary btn-block mt-8" id="ed-save">Salva scheda</button>
            ${existing ? '<button class="btn btn-block btn-danger" id="ed-delete">Elimina scheda</button>' : ''}
          </div>
        </div>
      </div>
    `;
    bindEditor();
  }

  /** Copia i valori digitati nel draft prima di ridisegnare o salvare. */
  function syncDraft() {
    draft.nome = mount.querySelector('#ed-nome').value.trim();

    mount.querySelectorAll('[data-ex]').forEach(inp => {
      const [i, campo] = inp.dataset.ex.split('-');
      const e = draft.esercizi[Number(i)];
      if (campo === 'nome') { e.nome = inp.value.trim(); return; }
      // Il carico accetta i decimali: i dischi da 1,25 e 2,5 kg esistono
      const min = campo === 'carico' ? 0 : 1;
      const v = parseDecimal(inp.value, min, 2000);
      if (v !== null) e[campo] = campo === 'carico' ? v : Math.round(v);
    });
  }

  function bindEditor() {
    const overlay = mount.querySelector('#editor-overlay');
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    mount.querySelector('#ed-close').addEventListener('click', close);

    mount.querySelector('#ed-add-ex').addEventListener('click', () => {
      syncDraft();
      // Il nuovo esercizio eredita dall'ultimo: di solito una scheda
      // ha lo stesso schema di serie e reps per tutti gli esercizi
      const last = draft.esercizi[draft.esercizi.length - 1];
      draft.esercizi.push({
        id: uid(), nome: '',
        serie: last?.serie || 4,
        reps: last?.reps || 10,
        carico: 0,
      });
      paintEditor();
      const inputs = mount.querySelectorAll('[data-ex$="-nome"]');
      inputs[inputs.length - 1]?.focus();
    });

    mount.querySelectorAll('[data-ex-del]').forEach(b => b.addEventListener('click', () => {
      syncDraft();
      draft.esercizi.splice(Number(b.dataset.exDel), 1);
      paintEditor();
    }));

    mount.querySelector('#ed-save').addEventListener('click', () => {
      syncDraft();
      if (!draft.nome) { toast('Dai un nome alla scheda'); return; }

      draft.esercizi = draft.esercizi.filter(e => e.nome);
      if (draft.esercizi.length === 0) { toast('Aggiungi almeno un esercizio'); return; }

      const rotto = draft.esercizi.find(e => !e.serie || !e.reps);
      if (rotto) { toast(`Serie e reps mancanti in «${rotto.nome}»`); return; }

      update(st => {
        const i = st.workouts.findIndex(w => w.id === draft.id);
        if (i >= 0) st.workouts[i] = draft;
        else st.workouts.push(draft);
      });
      toast(existing ? 'Scheda aggiornata' : 'Scheda creata');
      close();
      onDone && onDone(false);
    });

    const del = mount.querySelector('#ed-delete');
    if (del) del.addEventListener('click', async () => {
      const ok = await confirmModal(
        `Eliminare «${esc(draft.nome)}»? Lo storico delle sessioni già fatte resta.`,
        { ok: 'Elimina', danger: true });
      if (!ok) return;
      update(st => {
        st.workouts = st.workouts.filter(w => w.id !== draft.id);
        if (st.session && st.session.workoutId === draft.id) st.session = null;
      });
      toast('Scheda eliminata');
      close();
      onDone && onDone(true);
    });
  }

  function close() { mount.remove(); }

  paintEditor();
}

function fmtKg(n) { return n ? String(n).replace('.', ',') : ''; }
