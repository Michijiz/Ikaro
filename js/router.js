/* ============================================================
   IKARO — Router SPA hash-based
   Rotte: #/home, #/allenamento, #/scheda/:id,
          #/nutrizione, #/aggiungi-alimento, #/progressi, #/profilo
   ============================================================ */

const routes = new Map();
let container = null;
let currentCleanup = null;
let onNavigateCb = null;

/** Registra una rotta. Il pattern può contenere un parametro ":id". */
export function register(pattern, renderFn) {
  routes.set(pattern, renderFn);
}

/** Inizializza il router sul contenitore delle viste. */
export function initRouter(el, onNavigate) {
  container = el;
  onNavigateCb = onNavigate;
  window.addEventListener('hashchange', resolve);
  if (!location.hash) location.hash = '#/home';
  resolve();
}

/** Naviga programmaticamente. */
export function navigate(hash) {
  if (location.hash === hash) resolve();
  else location.hash = hash;
}

/** Rotta base corrente (es. "#/allenamento"). */
export function currentBase() {
  const parts = location.hash.split('/');
  return parts.length > 1 ? `#/${parts[1]}` : '#/home';
}

/** Risolve l'hash corrente e monta la vista corrispondente. */
function resolve() {
  const hash = location.hash || '#/home';
  const segs = hash.slice(2).split('/'); // ["scheda", "abc"]
  const base = `#/${segs[0]}`;
  const param = segs[1] || null;

  const render = routes.get(base) || routes.get('#/home');

  // Cleanup della vista precedente (timer, listener globali, ecc.)
  if (typeof currentCleanup === 'function') {
    try { currentCleanup(); } catch (e) { console.warn(e); }
    currentCleanup = null;
  }

  container.innerHTML = '';
  const view = document.createElement('div');
  view.className = 'view';
  container.appendChild(view);

  // La vista può restituire una funzione di cleanup
  currentCleanup = render(view, param) || null;

  window.scrollTo({ top: 0 });
  if (onNavigateCb) onNavigateCb(base);
}
