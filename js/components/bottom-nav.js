/* ============================================================
   IKARO — Bottom navigation (5 tab con icone SVG inline)
   L'icona attiva siede su un disco dell'accento (.nav-icon).
   ============================================================ */

const TABS = [
  {
    hash: '#/home', label: 'Home',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>',
  },
  {
    hash: '#/allenamento', label: 'Allenamento',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/></svg>',
  },
  {
    hash: '#/nutrizione', label: 'Nutrizione',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-4.5 0-7.5-3-7.5-7 0-4.5 4-8 7.5-8s7.5 3.5 7.5 8c0 4-3 7-7.5 7Z"/><path d="M12 6c.2-1.8 1.4-3 3-3"/></svg>',
  },
  {
    hash: '#/progressi', label: 'Progressi',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>',
  },
  {
    hash: '#/profilo', label: 'Profilo',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.5 3.6-5.5 7-5.5s6.2 2 7 5.5"/></svg>',
  },
];

/** Monta la bottom nav e ritorna una funzione per evidenziare la tab attiva. */
export function mountBottomNav(root) {
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Navigazione principale');
  nav.innerHTML = `
    <div class="nav-inner">
      ${TABS.map(t => `
        <a class="nav-item" href="${t.hash}" data-hash="${t.hash}">
          <span class="nav-icon">${t.icon}</span>
          <span>${t.label}</span>
        </a>
      `).join('')}
    </div>
  `;
  root.appendChild(nav);

  return function setActive(baseHash) {
    // Le viste secondarie mantengono attiva la tab di appartenenza
    const alias = {
      '#/scheda': '#/allenamento',
      '#/aggiungi-alimento': '#/nutrizione',
    };
    const target = alias[baseHash] || baseHash;
    nav.querySelectorAll('.nav-item').forEach(a => {
      a.classList.toggle('active', a.dataset.hash === target);
    });
  };
}
