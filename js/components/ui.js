/* ============================================================
   IKARO — Helper UI condivisi (toast, icone, sanificazione)
   ============================================================ */

/** Mostra un toast temporaneo in basso. */
export function toast(message, ms = 2200) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/** Formatta secondi in mm:ss. (Ex timer.js, ora l'unica primitiva rimasta.) */
export function fmtTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/**
 * Converte in numero un input decimale scritto all'italiana.
 * NB: va usato con input type="text" inputmode="decimal": un input
 * type="number" restituisce stringa vuota se contiene una virgola,
 * quindi il replace non farebbe mai in tempo a servire.
 * @returns {number|null} null se non valido o fuori range
 */
export function parseDecimal(raw, min = -Infinity, max = Infinity) {
  const v = Number(String(raw ?? '').trim().replace(',', '.'));
  if (!isFinite(v) || v < min || v > max) return null;
  return v;
}

/** Formatta un numero con la virgola decimale (e senza zeri inutili). */
export function fmtNum(n, dec = 2) {
  const r = Math.round(n * 10 ** dec) / 10 ** dec;
  return String(r).replace('.', ',');
}

/** Sanifica testo inserito dall'utente prima dell'inserimento in HTML. */
export function esc(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/* Icone SVG riusabili */
export const ICONS = {
  back: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  bell: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z"/><path d="M10 18a2 2 0 0 0 4 0"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L20 8l-4-4L4 16v4Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 18 19 6"/></svg>',
  download: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M8 11l4 4 4-4M5 19h14"/></svg>',
  upload: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V8M8 12l4-4 4 4M5 4h14"/></svg>',
  fire: '🔥',
};

/* ============================================================
   Modali (v3)
   Sostituiscono prompt()/confirm() nativi: bloccanti, non
   tematizzabili, e in PWA standalone iOS mostrano il dominio
   nel dialog, rompendo l'illusione dell'app.
   ============================================================ */

/**
 * Apre un overlay modale. Ritorna la funzione di chiusura.
 * @param {Object} o
 * @param {string} o.title
 * @param {string} o.body        markup interno (già sanificato dal chiamante)
 * @param {boolean} [o.tall]     usa il layout alto con scroll interno
 * @param {(root:HTMLElement, close:Function)=>void} [o.onMount]
 * @param {()=>void} [o.onClose]
 */
export function openModal({ title, body, tall = false, onMount, onClose }) {
  const mount = document.createElement('div');
  mount.innerHTML = `
    <div class="modal-overlay">
      <div class="modal ${tall ? 'modal-tall' : ''}" role="dialog" aria-modal="true" aria-label="${title}">
        <div class="between">
          <h2>${title}</h2>
          <button class="btn-ghost" data-close aria-label="Chiudi">✕</button>
        </div>
        <div class="mt-16">${body}</div>
      </div>
    </div>`;
  document.body.appendChild(mount);

  const overlay = mount.firstElementChild;
  const close = () => {
    if (!mount.isConnected) return;
    mount.remove();
    document.removeEventListener('keydown', onKey);
    onClose && onClose();
  };
  const onKey = e => { if (e.key === 'Escape') close(); };

  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  mount.querySelector('[data-close]').addEventListener('click', close);
  document.addEventListener('keydown', onKey);

  onMount && onMount(mount, close);
  return close;
}

/**
 * Conferma tematizzata. Rimpiazza confirm().
 * @returns {Promise<boolean>}
 */
export function confirmModal(message, { ok = 'Conferma', danger = false } = {}) {
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };

    const close = openModal({
      title: 'Conferma',
      body: `
        <p class="muted small">${message}</p>
        <div class="row mt-16">
          <button class="btn btn-secondary grow" data-no>Annulla</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} grow" data-yes>${ok}</button>
        </div>`,
      onMount: (root) => {
        root.querySelector('[data-yes]').addEventListener('click', () => { finish(true); close(); });
        root.querySelector('[data-no]').addEventListener('click', () => { finish(false); close(); });
      },
      onClose: () => finish(false),
    });
  });
}
