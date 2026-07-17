/* ============================================================
   IKARO — Header fisso
   Wordmark a sinistra, selettore tema a destra. Sta sopra ogni
   vista e non scorre: il tema è una preferenza che si cambia
   spesso, seppellirla in fondo al Profilo la rendeva un lavoro.
   ============================================================ */

import { getState, setTheme, THEMES } from '../store.js';

/** Monta l'header. Va chiamato una volta sola, prima del router. */
export function mountHeader(root) {
  const el = document.createElement('header');
  el.className = 'app-header';
  el.innerHTML = `
    <div class="app-header-inner">
      <a class="wordmark" href="#/home" aria-label="IKARO, vai alla home">I<span class="k">K</span>ARO</a>

      <div class="theme-menu">
        <button class="theme-btn" id="theme-toggle"
                aria-haspopup="true" aria-expanded="false" aria-label="Cambia tema">
          <span class="theme-dot"></span>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
               stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="caret">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>

        <div class="theme-pop" id="theme-pop" role="menu" hidden>
          <div class="theme-pop-grid">
            ${THEMES.map(t => `
              <button class="theme-opt" role="menuitemradio" data-theme-id="${t.id}" data-theme="${t.id}"
                      aria-label="Tema ${t.nome}" title="${t.nome}">
                <span class="swatch">
                  <i class="s-bg"></i><i class="s-accent"></i>
                </span>
                <span class="nm">${t.nome}</span>
              </button>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
  root.appendChild(el);

  const btn = el.querySelector('#theme-toggle');
  const pop = el.querySelector('#theme-pop');

  const chiudi = () => {
    if (pop.hidden) return;
    pop.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', fuori, true);
    document.removeEventListener('keydown', esc);
  };
  const apri = () => {
    segna();
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    // In cattura: così un click su un elemento che ferma la propagazione
    // non lascia comunque il menu aperto alle spalle dell'utente
    document.addEventListener('click', fuori, true);
    document.addEventListener('keydown', esc);
  };
  const fuori = e => { if (!el.contains(e.target)) chiudi(); };
  const esc = e => { if (e.key === 'Escape') { chiudi(); btn.focus(); } };

  btn.addEventListener('click', e => {
    e.stopPropagation();
    pop.hidden ? apri() : chiudi();
  });

  el.querySelectorAll('[data-theme-id]').forEach(b => {
    b.addEventListener('click', () => {
      setTheme(b.dataset.themeId);
      segna();
      chiudi();
    });
  });

  /** Evidenzia il tema attivo. */
  function segna() {
    const cur = getState().profile.theme;
    el.querySelectorAll('[data-theme-id]').forEach(b => {
      const on = b.dataset.themeId === cur;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
  }

  segna();
  return { chiudi, segna };
}
