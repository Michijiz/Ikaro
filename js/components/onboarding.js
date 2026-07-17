/* ============================================================
   IKARO — Onboarding
   Cinque passi al primo avvio. Raccoglie il minimo per calcolare
   un fabbisogno sensato invece di partire da numeri inventati:
   sesso, età, altezza, peso, obiettivo, allenamenti a settimana.

   Ogni valore calcolato resta modificabile: la formula è una stima
   di partenza, non una diagnosi.
   ============================================================ */

import {
  update, calcolaObiettivi, OBIETTIVI, THEMES, setTheme,
  todayKey, uid, DEFAULT_THEME,
} from '../store.js';
import { esc, toast, parseDecimal, fmtNum } from './ui.js';

/**
 * Apre il wizard. Chiama onDone() alla fine.
 * @param {() => void} onDone
 */
export function openOnboarding(onDone) {
  const d = {
    name: '', sesso: null, eta: null, altezza: null, peso: null,
    obiettivo: null, workoutsPerWeek: 4,
    theme: DEFAULT_THEME,
    goals: null,
  };

  let step = 0;
  const STEPS = [stepNome, stepCorpo, stepObiettivo, stepFrequenza, stepRiepilogo];

  const overlay = document.createElement('div');
  overlay.className = 'ob-overlay';
  document.body.appendChild(overlay);

  paint();

  function paint() {
    overlay.innerHTML = `
      <div class="ob-box">
        <div class="ob-steps">
          ${STEPS.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}
        </div>
        <div class="ob-body">${STEPS[step]()}</div>
      </div>`;
    overlay.scrollTop = 0;
    bind();
  }

  const next = () => { step = Math.min(STEPS.length - 1, step + 1); paint(); };
  const prev = () => { step = Math.max(0, step - 1); paint(); };

  /* ---------- 1. Nome ---------- */
  function stepNome() {
    return `
      <div class="wordmark" style="font-size:1.3rem;">I<span class="k">K</span>ARO</div>
      <h1 class="ob-title mt-16">Ciao.<br>Come ti chiami?</h1>
      <p class="ob-sub">Serve solo per salutarti. Resta su questo dispositivo, come tutto il resto.</p>
      <input id="ob-name" class="mt-16" value="${esc(d.name)}" maxlength="30"
             placeholder="Il tuo nome" autocomplete="given-name" enterkeyhint="next">
      <button class="btn btn-primary btn-block mt-16" data-next>Continua</button>
      <button class="btn btn-block btn-ghost btn-sm mt-8" data-skip>Salta la configurazione</button>`;
  }

  /* ---------- 2. Corpo ---------- */
  function stepCorpo() {
    return `
      <h1 class="ob-title">Qualche numero</h1>
      <p class="ob-sub">Serve a calcolare il tuo fabbisogno. Senza, dovrei tirare a indovinare.</p>

      <div class="field mt-16">
        <span>Sesso</span>
        <div class="ob-inline">
          <button class="ob-pill ${d.sesso === 'm' ? 'on' : ''}" data-sesso="m">Uomo</button>
          <button class="ob-pill ${d.sesso === 'f' ? 'on' : ''}" data-sesso="f">Donna</button>
        </div>
      </div>

      <div class="field-grid mt-16">
        <label class="field">
          <span>Età</span>
          <input id="ob-eta" type="text" inputmode="numeric" value="${d.eta ?? ''}" placeholder="anni">
        </label>
        <label class="field">
          <span>Altezza (cm)</span>
          <input id="ob-alt" type="text" inputmode="numeric" value="${d.altezza ?? ''}" placeholder="cm">
        </label>
        <label class="field">
          <span>Peso attuale (kg)</span>
          <input id="ob-peso" type="text" inputmode="decimal" value="${d.peso ?? ''}" placeholder="kg">
        </label>
      </div>

      <button class="btn btn-primary btn-block mt-16" data-next>Continua</button>
      <button class="btn btn-block btn-ghost btn-sm mt-8" data-prev>Indietro</button>`;
  }

  /* ---------- 3. Obiettivo ---------- */
  function stepObiettivo() {
    return `
      <h1 class="ob-title">Cosa vuoi ottenere?</h1>
      <p class="ob-sub">Decide il taglio delle calorie. Si cambia quando vuoi.</p>
      <div class="ob-choices mt-16">
        ${OBIETTIVI.map(o => `
          <button class="ob-choice ${d.obiettivo === o.id ? 'on' : ''}" data-obiettivo="${o.id}">
            <span class="em">${o.emoji}</span>
            <span class="txt">
              <strong>${o.nome}</strong>
              <span>${o.desc}</span>
            </span>
          </button>`).join('')}
      </div>
      <button class="btn btn-primary btn-block mt-16" data-next>Continua</button>
      <button class="btn btn-block btn-ghost btn-sm mt-8" data-prev>Indietro</button>`;
  }

  /* ---------- 4. Frequenza ---------- */
  function stepFrequenza() {
    return `
      <h1 class="ob-title">Quante volte<br>ti allenerai?</h1>
      <p class="ob-sub">A settimana. Scegli quello che reggi davvero, non quello che vorresti.</p>
      <div class="ob-inline mt-16">
        ${[2, 3, 4, 5, 6, 7].map(n => `
          <button class="ob-pill ${d.workoutsPerWeek === n ? 'on' : ''}" data-freq="${n}">${n}</button>`).join('')}
      </div>
      <p class="faint mt-16">Diventa il tuo obiettivo settimanale in dashboard, e alza il fabbisogno calorico.</p>
      <button class="btn btn-primary btn-block mt-16" data-next>Calcola i miei obiettivi</button>
      <button class="btn btn-block btn-ghost btn-sm mt-8" data-prev>Indietro</button>`;
  }

  /* ---------- 5. Riepilogo ---------- */
  function stepRiepilogo() {
    if (!d.goals) d.goals = calcolaObiettivi(d);
    const g = d.goals;

    return `
      <h1 class="ob-title">Ecco i tuoi numeri</h1>
      <p class="ob-sub">Stime di partenza. Guarda la bilancia tra due settimane e correggi.</p>

      <div class="ob-calc mt-16">
        <div class="row" style="align-items:baseline;gap:6px;">
          <span class="big">${g.calories.toLocaleString('it-IT')}</span>
          <span class="faint">kcal al giorno</span>
        </div>
        <div class="row mt-16" style="justify-content:space-between;">
          <div><div class="stat" style="font-size:1rem;color:var(--macro-protein);">${g.protein}g</div><div class="stat-label">Proteine</div></div>
          <div><div class="stat" style="font-size:1rem;color:var(--macro-carbs);">${g.carbs}g</div><div class="stat-label">Carbo</div></div>
          <div><div class="stat" style="font-size:1rem;color:var(--macro-fat);">${g.fat}g</div><div class="stat-label">Grassi</div></div>
          <div><div class="stat" style="font-size:1rem;">${fmtNum(g.water, 1)}L</div><div class="stat-label">Acqua</div></div>
        </div>
      </div>

      <div class="field-grid mt-16">
        <label class="field">
          <span>Calorie</span>
          <input id="ob-cal" type="text" inputmode="numeric" value="${g.calories}">
        </label>
        <label class="field">
          <span>Peso target (kg)</span>
          <input id="ob-target" type="text" inputmode="decimal" value="${fmtNum(g.weightTarget, 1)}">
        </label>
      </div>

      <div class="field mt-16">
        <span>Tema</span>
        <div class="ob-inline">
          ${THEMES.slice(0, 5).map(t => `
            <button class="ob-pill ${d.theme === t.id ? 'on' : ''}" data-theme-pick="${t.id}"
                    style="font-size:0.78rem;">${esc(t.nome)}</button>`).join('')}
        </div>
        <span class="faint" style="font-size:0.7rem;">Gli altri sei sono nel Profilo.</span>
      </div>

      <button class="btn btn-primary btn-block mt-16" data-finish>Inizia a volare 🕊️</button>
      <button class="btn btn-block btn-ghost btn-sm mt-8" data-prev>Indietro</button>`;
  }

  /* ---------- Eventi ---------- */
  function bind() {
    const q = sel => overlay.querySelector(sel);

    q('[data-next]')?.addEventListener('click', () => { if (valida()) next(); });
    q('[data-prev]')?.addEventListener('click', () => { leggi(); prev(); });
    q('[data-skip]')?.addEventListener('click', () => { leggi(); salva(true); });
    q('[data-finish]')?.addEventListener('click', () => { leggi(); salva(false); });

    q('#ob-name')?.addEventListener('keydown', e => { if (e.key === 'Enter' && valida()) next(); });

    overlay.querySelectorAll('[data-sesso]').forEach(b =>
      b.addEventListener('click', () => { leggi(); d.sesso = b.dataset.sesso; paint(); }));

    overlay.querySelectorAll('[data-obiettivo]').forEach(b =>
      b.addEventListener('click', () => {
        d.obiettivo = b.dataset.obiettivo;
        d.goals = null;   // l'obiettivo cambia i numeri: si ricalcola
        paint();
      }));

    overlay.querySelectorAll('[data-freq]').forEach(b =>
      b.addEventListener('click', () => {
        d.workoutsPerWeek = Number(b.dataset.freq);
        d.goals = null;
        paint();
      }));

    overlay.querySelectorAll('[data-theme-pick]').forEach(b =>
      b.addEventListener('click', () => {
        leggi();
        d.theme = b.dataset.themePick;
        // Applicato subito: un tema si sceglie vedendolo, non leggendone il nome
        document.documentElement.dataset.theme = d.theme;
        paint();
      }));
  }

  /** Copia nel draft i campi del passo corrente, senza validare. */
  function leggi() {
    const q = sel => overlay.querySelector(sel);
    if (q('#ob-name')) d.name = q('#ob-name').value.trim();
    if (q('#ob-eta')) d.eta = parseDecimal(q('#ob-eta').value, 10, 100);
    if (q('#ob-alt')) d.altezza = parseDecimal(q('#ob-alt').value, 100, 250);
    if (q('#ob-peso')) d.peso = parseDecimal(q('#ob-peso').value, 30, 300);
    if (q('#ob-cal') && d.goals) {
      const c = parseDecimal(q('#ob-cal').value, 800, 8000);
      if (c) d.goals.calories = Math.round(c);
    }
    if (q('#ob-target') && d.goals) {
      const t = parseDecimal(q('#ob-target').value, 30, 250);
      if (t) d.goals.weightTarget = t;
    }
  }

  /** Blocca l'avanzamento solo se manca ciò che serve al calcolo. */
  function valida() {
    leggi();
    if (step === 1) {
      if (!d.sesso) { toast('Scegli uomo o donna'); return false; }
      if (d.eta === null) { toast('Età non valida (10–100)'); return false; }
      if (d.altezza === null) { toast('Altezza non valida (100–250 cm)'); return false; }
      if (d.peso === null) { toast('Peso non valido (30–300 kg)'); return false; }
    }
    if (step === 2 && !d.obiettivo) { toast('Scegli un obiettivo'); return false; }
    return true;
  }

  /**
   * @param {boolean} saltato se true, l'utente ha rinunciato: si tengono
   * i default e non si inventano numeri sui suoi dati.
   */
  function salva(saltato) {
    const goals = !saltato && d.goals ? d.goals : null;

    update(s => {
      s.profile.name = d.name;
      s.profile.onboarded = true;
      s.profile.theme = d.theme;
      if (!saltato) {
        s.profile.sesso = d.sesso;
        s.profile.eta = d.eta;
        s.profile.altezza = d.altezza;
        s.profile.obiettivo = d.obiettivo;
        if (goals) Object.assign(s.profile.goals, goals);
      }
      // Il peso di partenza è già un dato di progresso: si registra
      if (!saltato && d.peso) {
        s.weights.push({ id: uid(), data: todayKey(), peso: d.peso });
      }
    });

    setTheme(d.theme);
    overlay.remove();
    if (!saltato) toast(`Tutto pronto${d.name ? `, ${d.name}` : ''} 💪`);
    onDone && onDone();
  }
}
