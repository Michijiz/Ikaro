/* ============================================================
   IKARO — Entry point
   Il boot è asincrono: lo store deve aprire IndexedDB e caricare
   le cache PRIMA che le viste vengano montate, altrimenti i
   selettori sincroni lavorerebbero su uno storico vuoto.
   ============================================================ */

import { initRouter, register } from './router.js';
import {
  initStore, getState, ensureDailyReset,
  applyTheme, onPersistError,
} from './store.js';
import { mountBottomNav } from './components/bottom-nav.js';
import { mountHeader } from './components/app-header.js';
import { openOnboarding } from './components/onboarding.js';
import { toast } from './components/ui.js';

import { renderHome } from './views/home.js';
import { renderAllenamento } from './views/allenamento.js';
import { renderScheda } from './views/scheda.js';
import { renderNutrizione } from './views/nutrizione.js';
import { renderAggiungiAlimento } from './views/aggiungi-alimento.js';
import { renderProgressi } from './views/progressi.js';
import { renderProfilo } from './views/profilo.js';

boot().catch(err => {
  // Rete di sicurezza: se il boot esplode, la splash resta a coprire tutto
  // e l'app diventa inutilizzabile — schermo pieno, invisibile, che
  // intercetta ogni tocco. Meglio un'app a metà che un'app murata.
  console.error('IKARO: boot fallito.', err);
  rivelaApp();
  document.getElementById('app').innerHTML = `
    <div class="card empty mt-16">
      <div class="icon">⚠️</div>
      <strong>Qualcosa è andato storto all'avvio.</strong>
      <p class="muted small mt-8">Prova a ricaricare. Se persiste, i tuoi dati
      sono comunque salvati: esporta un backup appena l'app riparte.</p>
      <button class="btn btn-primary mt-16" onclick="location.reload()">Ricarica</button>
    </div>`;
});

/** Toglie la splash e sblocca l'interfaccia. */
function rivelaApp() {
  document.body.dataset.booted = 'true';
}

async function boot() {
  // Gli errori di persistenza devono essere visibili, non solo in console
  onPersistError(msg => toast(msg, 5000));

  const res = await initStore();
  applyTheme();

  if (!res.ok) {
    // L'app funziona comunque, ma lo storico non viene salvato: dirlo subito
    setTimeout(() => toast('Archiviazione non disponibile: lo storico non verrà salvato.', 5000), 800);
  }

  await ensureDailyReset();

  /* ---------- Rotte ---------- */
  register('#/home', renderHome);
  register('#/allenamento', renderAllenamento);
    register('#/scheda', renderScheda);
  register('#/nutrizione', renderNutrizione);
  register('#/aggiungi-alimento', renderAggiungiAlimento);
  register('#/progressi', renderProgressi);
  register('#/profilo', renderProfilo);

  /* ---------- Mount ---------- */
  const app = document.getElementById('app');
  mountHeader(document.body);
  const setActiveTab = mountBottomNav(document.body);
  initRouter(app, base => setActiveTab(base));

  rivelaApp();

  /* ---------- Reset giornaliero al ritorno in foreground ---------- */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') ensureDailyReset();
  });

  /* ---------- Onboarding: configurazione guidata al primo avvio ---------- */
  if (!getState().profile.onboarded) {
    openOnboarding(() => { location.hash = '#/home'; });
  }

  registerServiceWorker();
}

/* ---------- Service Worker ----------
   Registrazione soltanto: la strategia di aggiornamento (network-first
   + reload automatico) arriva in Fase 4, insieme al nuovo sw.js. */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(err => {
    console.warn('IKARO: registrazione Service Worker fallita.', err);
  });
}
