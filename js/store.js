/* ============================================================
   IKARO — Store centralizzato
   Divisione dei dati:
     - localStorage : stato "vivo" e piccolo (profilo, tema,
       schede, sessione, giorno corrente, pesi, massimali).
       Sincrono, sempre disponibile.
     - IndexedDB    : ciò che cresce all'infinito (storico pasti,
       storico allenamenti, alimenti custom). Vedi db.js.

   Storico allenamenti e alimenti custom vengono caricati in una
   cache in memoria all'avvio: così i selettori restano sincroni
   e le viste non devono diventare async.

   L'app DEVE chiamare `await initStore()` prima di montare il router.
   ============================================================ */

import * as db from './db.js';

export const STORAGE_KEY = 'ikaro-state-v2';
export const SCHEMA_VERSION = 5;

/* ---------- Utility date (funzioni pure) ---------- */

/** Ritorna la data odierna in formato YYYY-MM-DD (fuso locale). */
export function todayKey(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return dateKey(d);
}

/** Converte un oggetto Date in chiave YYYY-MM-DD. */
export function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const g = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${g}`;
}

/** Giorno della settimana 0=Lunedì … 6=Domenica (convenzione italiana). */
export function weekdayIndex(d = new Date()) {
  return (d.getDay() + 6) % 7;
}

export const GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
export const GIORNI_BREVI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
export const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/** Valore più frequente in un array di numeri (a parità, il primo). */
function moda(arr) {
  const c = new Map();
  arr.forEach(x => c.set(x, (c.get(x) || 0) + 1));
  let best = arr[0] ?? 10, n = 0;
  c.forEach((v, k) => { if (v > n) { n = v; best = k; } });
  return best;
}

/** ID univoco semplice. */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- Database alimenti predefiniti (macro per 100 g) ---------- */

export const FOOD_DB = [
  { id: 'avena',      nome: 'Fiocchi d\'avena',    emoji: '🌾', porzione: 50,  kcal: 372, p: 13.5, c: 60,   f: 7 },
  { id: 'riso',       nome: 'Riso basmati',        emoji: '🍚', porzione: 80,  kcal: 350, p: 7.5,  c: 78,   f: 0.6 },
  { id: 'pasta',      nome: 'Pasta di semola',     emoji: '🍝', porzione: 80,  kcal: 353, p: 12,   c: 71,   f: 1.5 },
  { id: 'pane',       nome: 'Pane integrale',      emoji: '🍞', porzione: 60,  kcal: 247, p: 8.5,  c: 45,   f: 3.5 },
  { id: 'patate',     nome: 'Patate',              emoji: '🥔', porzione: 200, kcal: 77,  p: 2,    c: 17,   f: 0.1 },
  { id: 'pollo',      nome: 'Petto di pollo',      emoji: '🍗', porzione: 150, kcal: 110, p: 23,   c: 0,    f: 1.5 },
  { id: 'tacchino',   nome: 'Fesa di tacchino',    emoji: '🦃', porzione: 120, kcal: 107, p: 24,   c: 0.5,  f: 1 },
  { id: 'manzo',      nome: 'Manzo magro',         emoji: '🥩', porzione: 150, kcal: 158, p: 26,   c: 0,    f: 5.5 },
  { id: 'tonno',      nome: 'Tonno al naturale',   emoji: '🐟', porzione: 80,  kcal: 103, p: 24,   c: 0,    f: 0.8 },
  { id: 'salmone',    nome: 'Salmone',             emoji: '🍣', porzione: 130, kcal: 208, p: 20,   c: 0,    f: 13 },
  { id: 'uova',       nome: 'Uova intere',         emoji: '🥚', porzione: 110, kcal: 143, p: 12.5, c: 0.7,  f: 9.5 },
  { id: 'albume',     nome: 'Albume d\'uovo',      emoji: '🍳', porzione: 100, kcal: 52,  p: 10.9, c: 0.7,  f: 0.2 },
  { id: 'greco',      nome: 'Yogurt greco 0%',     emoji: '🥛', porzione: 170, kcal: 57,  p: 10,   c: 3.6,  f: 0.2 },
  { id: 'latte',      nome: 'Latte parz. scremato', emoji: '🥛', porzione: 200, kcal: 46, p: 3.3,  c: 5,    f: 1.6 },
  { id: 'ricotta',    nome: 'Ricotta vaccina',     emoji: '🧀', porzione: 100, kcal: 146, p: 8.8,  c: 3.5,  f: 10.9 },
  { id: 'parmigiano', nome: 'Parmigiano',          emoji: '🧀', porzione: 20,  kcal: 392, p: 33,   c: 0,    f: 28.5 },
  { id: 'banana',     nome: 'Banana',              emoji: '🍌', porzione: 120, kcal: 89,  p: 1.1,  c: 23,   f: 0.3 },
  { id: 'mela',       nome: 'Mela',                emoji: '🍎', porzione: 180, kcal: 52,  p: 0.3,  c: 14,   f: 0.2 },
  { id: 'arancia',    nome: 'Arancia',             emoji: '🍊', porzione: 180, kcal: 47,  p: 0.9,  c: 12,   f: 0.1 },
  { id: 'mirtilli',   nome: 'Mirtilli',            emoji: '🫐', porzione: 100, kcal: 57,  p: 0.7,  c: 14,   f: 0.3 },
  { id: 'broccoli',   nome: 'Broccoli',            emoji: '🥦', porzione: 200, kcal: 34,  p: 2.8,  c: 7,    f: 0.4 },
  { id: 'spinaci',    nome: 'Spinaci',             emoji: '🥬', porzione: 150, kcal: 23,  p: 2.9,  c: 3.6,  f: 0.4 },
  { id: 'zucchine',   nome: 'Zucchine',            emoji: '🥒', porzione: 200, kcal: 17,  p: 1.2,  c: 3.1,  f: 0.3 },
  { id: 'pomodori',   nome: 'Pomodori',            emoji: '🍅', porzione: 150, kcal: 18,  p: 0.9,  c: 3.9,  f: 0.2 },
  { id: 'mandorle',   nome: 'Mandorle',            emoji: '🥜', porzione: 25,  kcal: 579, p: 21,   c: 22,   f: 50 },
  { id: 'noci',       nome: 'Noci',                emoji: '🌰', porzione: 25,  kcal: 654, p: 15,   c: 14,   f: 65 },
  { id: 'arachidi',   nome: 'Burro d\'arachidi',   emoji: '🥜', porzione: 20,  kcal: 588, p: 25,   c: 20,   f: 50 },
  { id: 'olio',       nome: 'Olio extravergine',   emoji: '🫒', porzione: 10,  kcal: 884, p: 0,    c: 0,    f: 100 },
  { id: 'avocado',    nome: 'Avocado',             emoji: '🥑', porzione: 80,  kcal: 160, p: 2,    c: 8.5,  f: 14.7 },
  { id: 'whey',       nome: 'Proteine whey',       emoji: '💪', porzione: 30,  kcal: 380, p: 78,   c: 6,    f: 5 },
];

export const PASTI = [
  { id: 'colazione', nome: 'Colazione', emoji: '☕' },
  { id: 'pranzo',    nome: 'Pranzo',    emoji: '🍝' },
  { id: 'spuntino',  nome: 'Spuntino',  emoji: '🍌' },
  { id: 'cena',      nome: 'Cena',      emoji: '🍽️' },
];

/* ---------- Temi disponibili (i valori CSS stanno in variables.css) ---------- */

export const THEMES = [
  { id: 'hyper-crimson',      nome: 'Hyper Crimson' },
  { id: 'volt',               nome: 'Volt' },
  { id: 'blue-void',          nome: 'Blue Void' },
  { id: 'anthracite',         nome: 'Anthracite' },
  { id: 'pure-platinum',      nome: 'Pure Platinum' },
  { id: 'olive-aura',         nome: 'Olive Aura' },
  { id: 'midnight-turquoise', nome: 'Midnight Turquoise' },
  { id: 'magic-ember',        nome: 'Magic Ember' },
  { id: 'cerulean',           nome: 'Cerulean' },
  { id: 'cargo-khaki',        nome: 'Cargo Khaki' },
];

export const DEFAULT_THEME = 'hyper-crimson';

/* ---------- Stato iniziale ---------- */

function buildSeedState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: {
      name: '',
      onboarded: false,
      theme: DEFAULT_THEME,
      /* Dati corporei: vuoti finché non è l'utente a darli. Riempirli di
         default plausibili significherebbe mostrare come suoi dei valori
         che non ha mai inserito — e ricalcolarci sopra le sue calorie. */
      sesso: null,             // 'm' | 'f'
      eta: null,
      altezza: null,           // cm
      obiettivo: null,         // 'dimagrire' | 'mantenere' | 'massa'
      goals: {
        calories: 2400, protein: 150, carbs: 300, fat: 85,
        water: 2.5, weightTarget: 75, workoutsPerWeek: 4,
      },
      waterStepMl: 250,
    },
    workouts: [],
    weights: [],
    meals: { date: todayKey(), pasti: { colazione: [], pranzo: [], spuntino: [], cena: [] } },
    water: { date: todayKey(), litri: 0 },
    maxes: { squat: 0, panca: 0, stacco: 0, prev: { squat: 0, panca: 0, stacco: 0 } },
    activityDates: [],
    session: null,
  };
}

/* ---------- Stato in memoria ---------- */

let state = buildSeedState();
let ready = false;
const listeners = new Set();

/** Cache sincrona dello storico allenamenti (fonte di verità: IndexedDB). */
let workoutCache = [];
/** Cache sincrona degli alimenti custom (fonte di verità: IndexedDB). */
let customFoods = [];
/** Record migrati da localStorage e non ancora scritti su IDB. */
let pendingMigration = null;

/* ---------- Boot ---------- */

/**
 * Carica lo stato da localStorage, applica le migrazioni, apre IndexedDB
 * e popola le cache. Da chiamare (e attendere) prima di montare le viste.
 * @returns {Promise<{ok:boolean, error?:Error}>}
 */
export async function initStore() {
  state = loadLocal();

  try {
    await db.openDB();

    // Migrazione v2 → v3: sposta lo storico da localStorage a IndexedDB
    if (pendingMigration) {
      if (pendingMigration.workoutHistory?.length) {
        await db.putMany(db.STORES.WORKOUTS, pendingMigration.workoutHistory);
      }
      pendingMigration = null;
      persist(state); // ora lo stato locale è definitivamente snello
    }

    workoutCache = (await db.getAll(db.STORES.WORKOUTS)) || [];
    customFoods = (await db.getAll(db.STORES.FOODS)) || [];
    ready = true;
    return { ok: true };
  } catch (e) {
    console.error('IKARO: IndexedDB non disponibile, storico in sola lettura.', e);
    // L'app resta usabile: lo storico semplicemente non persiste
    workoutCache = pendingMigration?.workoutHistory || [];
    customFoods = [];
    ready = true;
    return { ok: false, error: e };
  }
}

export function isReady() { return ready; }

/* ---------- localStorage ---------- */

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const prima = parsed.schemaVersion || 2;
      const migrato = migrate(parsed);
      // Lo stato migrato va SCRITTO, non solo tenuto in memoria: altrimenti
      // localStorage resta alla versione vecchia e la migrazione si ripete
      // a ogni avvio, riconvertendo ogni volta gli stessi dati.
      if (migrato.schemaVersion !== prima) persist(migrato);
      return migrato;
    }
  } catch (e) {
    console.warn('IKARO: stato locale corrotto, riparto da zero.', e);
  }
  const seed = buildSeedState();
  persist(seed);
  return seed;
}

/**
 * Catena di migrazioni dello schema. Ogni step porta da una versione
 * alla successiva: non saltare mai un anello.
 */
function migrate(s) {
  let v = s.schemaVersion || 2; // prima di v3 il campo non esisteva

  if (v === 2) {
    // Le foto progressi sono state rimosse: liberano subito ~1 MB di quota
    delete s.photos;

    // Lo storico allenamenti passa a IndexedDB (scritto in initStore)
    if (Array.isArray(s.workoutHistory) && s.workoutHistory.length) {
      pendingMigration = { workoutHistory: s.workoutHistory };
    }
    delete s.workoutHistory;

    // Nuovi campi di profilo
    s.profile = s.profile || {};
    s.profile.theme = s.profile.theme || DEFAULT_THEME;
    s.profile.waterStepMl = s.profile.waterStepMl ?? 250;
    s.profile.goals = s.profile.goals || {};
    s.profile.goals.carbs = s.profile.goals.carbs ?? 300;
    s.profile.goals.fat = s.profile.goals.fat ?? 85;

    v = 3;
  }

  if (v === 3) {
    /* Modello esercizio semplificato.
       Prima: serie = [{carico, reps}, ...]  → 4 serie = 8 campi da compilare.
       Dopo:  serie = 4, reps = 10, carico = 80 → 3 campi.
       I carichi diversi tra le serie restano possibili come override
       puntuali (override[indiceSerie] = kg), ma non sono più il default. */
    s.migrationNotes = [];
    (s.workouts || []).forEach(w => {
      (w.esercizi || []).forEach(e => {
        if (!Array.isArray(e.serie)) return; // già convertito
        const sets = e.serie;
        const n = sets.length || 1;
        const carichi = sets.map(x => Number(x.carico) || 0);
        const reps = sets.map(x => Number(x.reps) || 0);
        const maxCarico = Math.max(0, ...carichi);
        const modaReps = moda(reps);

        // Se i valori non erano uniformi, l'utente merita di saperlo
        const caricoVario = new Set(carichi).size > 1;
        const repsVarie = new Set(reps).size > 1;
        if (caricoVario || repsVarie) {
          s.migrationNotes.push({
            workout: w.nome, esercizio: e.nome,
            prima: sets.map(x => `${x.carico}×${x.reps}`).join(', '),
            dopo: `${n} × ${modaReps} @ ${maxCarico} kg`,
          });
        }

        // I valori non uniformi sopravvivono come override sulle serie
        const override = {};
        sets.forEach((x, i) => {
          if ((Number(x.carico) || 0) !== maxCarico) override[i] = Number(x.carico) || 0;
        });

        e.serie = n;
        e.reps = modaReps;
        e.carico = maxCarico;
        if (Object.keys(override).length) e.override = override;
      });
    });

    // Una sessione a metà non è convertibile in modo affidabile: si scarta
    s.session = null;

    s.profile.goals.workoutsPerWeek = s.profile.goals.workoutsPerWeek ?? 4;
    v = 4;
  }

  if (v === 4) {
    /* Le schede non sono più legate a un giorno fisso della settimana.
       Il "prossimo allenamento" non si deduce più dal calendario ma dalla
       rotazione: è quello che non fai da più tempo. */
    (s.workouts || []).forEach(w => { delete w.giorno; delete w.ora; });

    /* Timer e recupero rimossi dall'interfaccia. La sessione in corso
       però sopravvive: il suo formato non cambia (serie spuntate, carichi,
       override) e swStart/swElapsed restano a misurare la durata in
       silenzio. Scartarla farebbe perdere un allenamento a metà. */
    delete s.profile.restSeconds;
    if (s.session) delete s.session.restEndAt;

    /* Campi per il ricalcolo degli obiettivi. Restano VUOTI: chi usa
       l'app da prima non li ha mai inseriti, e riempirli con valori
       plausibili (uomo, 30 anni, 175 cm) significherebbe mostrargli come
       suoi dei dati inventati — e ricalcolarci sopra le sue calorie.
       Il Profilo li chiede quando servono. */
    s.profile.sesso = s.profile.sesso ?? null;
    s.profile.eta = s.profile.eta ?? null;
    s.profile.altezza = s.profile.altezza ?? null;
    s.profile.obiettivo = s.profile.obiettivo ?? null;
    v = 5;
  }

  s.schemaVersion = v;

  // Rete di sicurezza per campi mancanti (stati salvati a metà, import, ecc.)
  const seed = buildSeedState();
  for (const k of Object.keys(seed)) {
    if (!(k in s)) s[k] = seed[k];
  }
  return s;
}

let quotaWarned = false;

function persist(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    quotaWarned = false;
  } catch (e) {
    // Fallire in silenzio qui significa perdere dati senza accorgersene
    console.error('IKARO: salvataggio locale fallito.', e);
    if (!quotaWarned) {
      quotaWarned = true;
      notifyError('Spazio esaurito: i dati non vengono più salvati. Esporta un backup dal Profilo.');
    }
  }
}

/* ---------- Errori visibili all'utente ---------- */

let errorHandler = null;

/** Registra il gestore che mostra gli errori di persistenza (di norma un toast). */
export function onPersistError(fn) { errorHandler = fn; }

function notifyError(msg) {
  if (errorHandler) errorHandler(msg);
}

/* ---------- Lettura / scrittura stato ---------- */

/** Ritorna lo stato corrente (da trattare come sola lettura). */
export function getState() {
  return state;
}

/** Applica una mutazione allo stato, salva e notifica i sottoscrittori. */
export function update(mutator) {
  mutator(state);
  persist(state);
  emit();
}

/** Notifica i sottoscrittori senza mutare (usato dopo scritture su IDB). */
export function emit() {
  listeners.forEach(fn => fn(state));
}

/** Sottoscrive un listener; ritorna la funzione di unsubscribe. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ---------- Tema ---------- */

/** Applica il tema al documento e lo salva nel profilo. */
export function setTheme(id) {
  const valid = THEMES.some(t => t.id === id) ? id : DEFAULT_THEME;
  update(s => { s.profile.theme = valid; });
  applyTheme(valid);
}

/**
 * Scrive data-theme sul <html> e allinea <meta name="theme-color">,
 * che iOS/Android usano per la barra di sistema: senza questo, cambiando
 * tema la chrome del browser resterebbe del colore precedente.
 */
export function applyTheme(id = state.profile?.theme || DEFAULT_THEME) {
  const root = document.documentElement;
  root.dataset.theme = id;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bar = getComputedStyle(root).getPropertyValue('--statusbar').trim();
    if (bar) meta.setAttribute('content', bar);
  }
}

/* ---------- Reset giornaliero + archiviazione ---------- */

/**
 * Se è cambiato il giorno, archivia il giorno concluso su IndexedDB
 * (pasti completi + totali + litri) e poi azzera i contatori.
 */
export async function ensureDailyReset() {
  const t = todayKey();
  const oldMealsDate = state.meals.date;
  const oldWaterDate = state.water.date;
  if (oldMealsDate === t && oldWaterDate === t) return;

  // 1. Archivia il giorno concluso, ma solo se conteneva qualcosa
  const tot = dayTotals(state);
  const litri = oldWaterDate === oldMealsDate ? state.water.litri : 0;
  const haDati = tot.kcal > 0 || litri > 0;

  if (haDati && oldMealsDate !== t) {
    try {
      await db.put(db.STORES.NUTRITION, {
        data: oldMealsDate,
        pasti: state.meals.pasti,
        totali: { ...tot, litri },
      });
    } catch (e) {
      console.error('IKARO: archiviazione del giorno fallita.', e);
      notifyError('Impossibile archiviare il giorno precedente.');
    }
  }

  // 2. Azzera
  update(s => {
    if (s.water.date !== t) s.water = { date: t, litri: 0 };
    if (s.meals.date !== t) {
      s.meals = { date: t, pasti: { colazione: [], pranzo: [], spuntino: [], cena: [] } };
    }
  });
}

/* ---------- Storico nutrizionale (async, da IndexedDB) ---------- */

/** Giorni archiviati in un intervallo. Il giorno corrente NON è incluso. */
export async function nutritionHistory(from, to) {
  try {
    return (await db.nutritionRange(from, to)) || [];
  } catch (e) {
    console.warn('IKARO: lettura storico nutrizionale fallita.', e);
    return [];
  }
}

/**
 * Ultimi N giorni di nutrizione, col giorno corrente calcolato al volo
 * e accodato: così i grafici includono sempre "oggi".
 */
export async function nutritionLastDays(n = 7) {
  const from = todayKey(-(n - 1));
  const to = todayKey(-1);
  const past = await nutritionHistory(from, to);
  const tot = dayTotals(state);
  past.push({
    data: todayKey(),
    pasti: state.meals.pasti,
    totali: { ...tot, litri: state.water.litri },
  });
  return past;
}

/* ---------- Storico allenamenti (cache sincrona + IndexedDB) ---------- */

/** Storico completo delle sessioni, dalla cache in memoria. */
export function getWorkoutHistory() {
  return workoutCache;
}

/** Salva una sessione conclusa su IndexedDB e aggiorna la cache. */
export async function addWorkoutSession(record) {
  workoutCache.push(record);
  emit();
  try {
    await db.put(db.STORES.WORKOUTS, record);
  } catch (e) {
    console.error('IKARO: salvataggio sessione fallito.', e);
    notifyError('Sessione non salvata: spazio o permessi insufficienti.');
  }
}

/**
 * Elimina una sessione svolta.
 * Se era l'unica del giorno, quel giorno smette di contare per lo streak:
 * lasciarlo acceso significherebbe mostrare un dato che non esiste più.
 */
export async function deleteWorkoutSession(id) {
  const rec = workoutCache.find(h => h.id === id);
  if (!rec) return;

  workoutCache = workoutCache.filter(h => h.id !== id);

  const restano = workoutCache.some(h => h.data === rec.data);
  if (!restano && state.activityDates.includes(rec.data)) {
    update(s => { s.activityDates = s.activityDates.filter(d => d !== rec.data); });
  } else {
    emit();
  }

  try {
    await db.del(db.STORES.WORKOUTS, id);
  } catch (e) {
    console.error('IKARO: eliminazione sessione fallita.', e);
    notifyError('Sessione non eliminata.');
  }
}

/** Sessioni svolte, dalla più recente. */
export function recentSessions(limit = 20) {
  return [...workoutCache]
    .sort((a, b) => b.data.localeCompare(a.data) || (b.id > a.id ? 1 : -1))
    .slice(0, limit);
}

/* ---------- Alimenti custom ---------- */

/** Alimenti predefiniti + creati dall'utente. */
export function allFoods() {
  return [...customFoods, ...FOOD_DB];
}

export function getCustomFoods() {
  return customFoods;
}

/** Crea o aggiorna un alimento custom. */
export async function saveCustomFood(food) {
  const rec = { ...food, id: food.id || `c_${uid()}`, custom: true };
  const i = customFoods.findIndex(f => f.id === rec.id);
  if (i >= 0) customFoods[i] = rec; else customFoods.unshift(rec);
  emit();
  try {
    await db.put(db.STORES.FOODS, rec);
  } catch (e) {
    console.error('IKARO: salvataggio alimento fallito.', e);
    notifyError('Alimento non salvato.');
  }
  return rec;
}

/** Elimina un alimento custom. */
export async function deleteCustomFood(id) {
  customFoods = customFoods.filter(f => f.id !== id);
  emit();
  try {
    await db.del(db.STORES.FOODS, id);
  } catch (e) {
    console.error('IKARO: eliminazione alimento fallita.', e);
  }
}

/* ---------- Selettori derivati (funzioni pure sullo stato) ---------- */

/** Totali nutrizionali del giorno corrente: kcal e macro. */
export function dayTotals(s = state) {
  const tot = { kcal: 0, p: 0, c: 0, f: 0 };
  Object.values(s.meals.pasti).forEach(items => items.forEach(it => {
    tot.kcal += it.kcal; tot.p += it.p; tot.c += it.c; tot.f += it.f;
  }));
  tot.kcal = Math.round(tot.kcal);
  tot.p = Math.round(tot.p); tot.c = Math.round(tot.c); tot.f = Math.round(tot.f);
  return tot;
}

/** Streak: giorni consecutivi con attività, calcolato a ritroso da oggi. */
/**
 * Giorni di riposo consecutivi concessi, dedotti dall'obiettivo settimanale.
 * 4 allenamenti a settimana ⇒ 3 giorni di riposo: quelli sono il budget.
 * Con 7 allenamenti il budget è zero, ed è una scelta di chi lo imposta.
 */
export function restBudget(s = state) {
  return Math.max(0, 7 - (s.profile.goals.workoutsPerWeek || 4));
}

/**
 * Streak = giorni consecutivi in cui sei rimasto dentro il programma.
 *
 * Il riposo NON spezza lo streak: lo alimenta, finché resta dentro il budget
 * settimanale. Premiare l'allenamento quotidiano sarebbe premiare il
 * sovrallenamento — il recupero è parte dell'allenamento, non una pausa da
 * esso. Lo streak si rompe solo quando i giorni di riposo consecutivi
 * superano quelli che l'obiettivo ti concede.
 *
 * Oggi è neutro: se non ti sei ancora allenato, la giornata non è finita e
 * non viene conteggiata contro di te.
 */
export function currentStreak(s = state) {
  const trained = new Set(s.activityDates);
  if (trained.size === 0) return 0;

  const primo = [...trained].sort()[0];
  const budget = restBudget(s);

  let streak = 0;
  let sospesi = 0;        // riposi incontrati, non ancora convalidati
  let riposiDiFila = 0;
  // Se oggi non c'è ancora attività si parte da ieri: la giornata è aperta
  let i = trained.has(todayKey()) ? 0 : -1;

  for (; ; i--) {
    const giorno = todayKey(i);
    if (giorno < primo) break;   // prima del primo allenamento non c'è streak

    if (trained.has(giorno)) {
      // Un allenamento convalida i riposi che lo seguono: erano guadagnati
      streak += sospesi + 1;
      sospesi = 0;
      riposiDiFila = 0;
    } else {
      riposiDiFila++;
      // Riposo oltre il concesso: rotto. I riposi in sospeso si perdono,
      // perché non li ha guadagnati nessun allenamento — sono solo assenza.
      if (riposiDiFila > budget) break;
      sospesi++;
    }
  }
  return streak;
}

/**
 * Stato degli ultimi 7 giorni per la striscia in dashboard.
 * @returns {Array<'trained'|'rest'|'broken'|'future'>}
 */
export function streakWeek(s = state) {
  const trained = new Set(s.activityDates);
  const budget = restBudget(s);
  const primo = trained.size ? [...trained].sort()[0] : null;

  const out = [];
  for (let i = -6; i <= 0; i++) {
    const giorno = todayKey(i);
    if (trained.has(giorno)) { out.push('trained'); continue; }
    if (!primo || giorno < primo) { out.push('future'); continue; }

    // Riposo: dentro o fuori budget? Si contano i riposi di fila fino a qui
    let n = 0;
    for (let k = i; ; k--) {
      const g = todayKey(k);
      if (trained.has(g) || (primo && g < primo)) break;
      n++;
      if (n > budget) break;
    }
    // Oggi non ancora allenato non è una rottura: la giornata è aperta
    out.push(n > budget && i < 0 ? 'broken' : 'rest');
  }
  return out;
}

/**
 * Registra l'allenamento di oggi (per lo streak).
 * Solo gli allenamenti lo alimentano: prima bastava un tap sull'acqua,
 * e uno streak che si mantiene premendo "+" non misura niente.
 */
export function markActivityToday() {
  const t = todayKey();
  if (!state.activityDates.includes(t)) {
    update(s => { s.activityDates.push(t); });
  }
}

/** Sessioni completate nella settimana corrente (da lunedì). */
export function workoutsThisWeek() {
  const inizio = todayKey(-weekdayIndex());
  const giorni = new Set(workoutCache.filter(h => h.data >= inizio).map(h => h.data));
  return giorni.size;
}

/** Data dell'ultima sessione di una scheda, o null se mai eseguita. */
export function lastPerformed(workoutId) {
  const date = workoutCache.filter(h => h.workoutId === workoutId).map(h => h.data);
  return date.length ? date.sort().at(-1) : null;
}

/**
 * Scheda consigliata: quella che non fai da più tempo (mai eseguita = prima).
 * Senza giorni fissi, la rotazione è l'unico criterio sensato: suggerisce
 * ciò che stai trascurando invece di ciò che dice il calendario.
 */
export function nextWorkout(s = state) {
  if (s.workouts.length === 0) return null;
  // Una scheda già fatta oggi non è ciò che dovresti fare adesso
  const oggi = todayKey();
  const candidati = s.workouts.filter(w => lastPerformed(w.id) !== oggi);
  const pool = candidati.length ? candidati : s.workouts;

  return [...pool].sort((a, b) => {
    const la = lastPerformed(a.id);
    const lb = lastPerformed(b.id);
    if (la === lb) return 0;
    if (la === null) return -1;   // mai fatta: massima priorità
    if (lb === null) return 1;
    return la.localeCompare(lb);  // la meno recente prima
  })[0];
}

/** Stato di una scheda: done (fatta in settimana) | next (consigliata) | planned. */
export function workoutStatus(w, s = state) {
  const inizioSettimana = todayKey(-weekdayIndex());
  const done = workoutCache.some(h => h.workoutId === w.id && h.data >= inizioSettimana);
  if (done) return 'done';
  const next = nextWorkout(s);
  if (next && next.id === w.id) return 'next';
  return 'planned';
}

/** Vero se oggi è già stato completato un allenamento. */
export function trainedToday() {
  return workoutCache.some(h => h.data === todayKey());
}

/** Carico di una serie: l'override puntuale vince sul carico dell'esercizio. */
export function caricoSerie(ex, i) {
  const o = ex.override && ex.override[i];
  return o !== undefined && o !== null ? o : (ex.carico || 0);
}

/** Numero di serie di un esercizio, tollerante al vecchio modello ad array. */
export function numSerie(ex) {
  return Array.isArray(ex.serie) ? ex.serie.length : (ex.serie || 0);
}

/**
 * Ultimi carichi usati per un esercizio, dal più recente.
 * Alimenta il confronto per il sovraccarico progressivo.
 * @returns {Array<{data:string, carico:number, reps:number, serie:number}>}
 */
export function caricoHistory(nomeEsercizio, limit = 5) {
  return exerciseHistory(nomeEsercizio, state, limit).map(h => {
    const carichi = h.serie.map(x => Number(x.carico) || 0);
    return {
      data: h.data,
      carico: Math.max(0, ...carichi),
      reps: moda(h.serie.map(x => Number(x.reps) || 0)),
      serie: h.serie.length,
    };
  });
}

/** Storico serie di un esercizio (per nome), dalla sessione più recente. */
export function exerciseHistory(nomeEsercizio, s = state, limit = 3) {
  const out = [];
  const sorted = [...workoutCache].sort((a, b) => b.data.localeCompare(a.data));
  for (const h of sorted) {
    const e = h.esercizi.find(x => x.nome === nomeEsercizio);
    if (e) out.push({ data: h.data, serie: e.serie });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Alimenti usati più spesso negli ultimi giorni, oggi incluso.
 * Alimenta la sezione "Recenti": nella pratica si mangiano sempre
 * le stesse cose, e ricercarle ogni volta è lavoro inutile.
 * @param {number} limit
 * @param {number} days finestra di scansione
 */
export async function frequentFoods(limit = 6, days = 30) {
  const conteggio = new Map();

  const conta = pasti => {
    Object.values(pasti || {}).forEach(items => (items || []).forEach(it => {
      const k = it.nome;
      const prev = conteggio.get(k);
      if (prev) prev.n++;
      else conteggio.set(k, { n: 1, nome: it.nome, emoji: it.emoji, grammi: it.grammi });
    }));
  };

  conta(state.meals.pasti);
  const past = await nutritionHistory(todayKey(-days), todayKey(-1));
  past.forEach(d => conta(d.pasti));

  return [...conteggio.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, limit);
}

/**
 * Risale all'alimento di origine (predefinito o custom) partendo dal nome
 * registrato in un pasto: i "Recenti" salvano il nome, non l'id.
 */
export function findFoodByName(nome) {
  return allFoods().find(f => f.nome === nome) || null;
}

/* ---------- Calcolo obiettivi nutrizionali ---------- */

export const OBIETTIVI = [
  { id: 'dimagrire', nome: 'Dimagrire',  emoji: '📉', desc: 'Deficit ~20%: circa 0,5 kg a settimana' },
  { id: 'mantenere', nome: 'Mantenere',  emoji: '⚖️', desc: 'Ricomposizione, peso stabile' },
  { id: 'massa',     nome: 'Aumentare',  emoji: '📈', desc: 'Surplus ~10%: massa con poco grasso' },
];

/**
 * Calcola gli obiettivi giornalieri dai dati antropometrici.
 *
 * Metabolismo basale con Mifflin-St Jeor, che è l'equazione predittiva
 * più accurata sulla popolazione generale. Moltiplicatore di attività in
 * funzione degli allenamenti settimanali. Poi:
 *   - proteine 1,8 g/kg (2,2 in deficit: preservano la massa magra)
 *   - grassi 0,8 g/kg (sotto gli 0,6 la sintesi ormonale ne risente)
 *   - carboidrati: tutto il resto
 *   - acqua 35 ml/kg
 *
 * Sono stime di partenza, non verità: si correggono guardando la bilancia
 * dopo due settimane. Restano tutte modificabili a mano.
 *
 * @param {{sesso:string, eta:number, altezza:number, peso:number,
 *          obiettivo:string, workoutsPerWeek:number}} d
 */
export function calcolaObiettivi(d) {
  const peso = d.peso || 75;
  const altezza = d.altezza || 175;
  const eta = d.eta || 30;

  // Mifflin-St Jeor
  const bmr = (10 * peso) + (6.25 * altezza) - (5 * eta) + (d.sesso === 'f' ? -161 : 5);

  // Da sedentario (1,2) a molto attivo (1,725), per allenamenti a settimana
  const w = Math.min(7, Math.max(0, d.workoutsPerWeek ?? 3));
  const fattore = 1.2 + (w * 0.075);

  const tdee = bmr * fattore;

  const delta = d.obiettivo === 'dimagrire' ? 0.8
              : d.obiettivo === 'massa' ? 1.1
              : 1;
  const calories = Math.round(tdee * delta / 10) * 10;

  const protein = Math.round(peso * (d.obiettivo === 'dimagrire' ? 2.2 : 1.8));
  const fat = Math.round(peso * 0.8);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  const weightTarget = d.obiettivo === 'dimagrire' ? round1(peso - 5)
                     : d.obiettivo === 'massa' ? round1(peso + 3)
                     : round1(peso);

  return {
    calories, protein, carbs, fat,
    water: Math.round(peso * 35 / 100) / 10,
    weightTarget,
    workoutsPerWeek: d.workoutsPerWeek ?? 3,
  };
}

function round1(n) { return Math.round(n * 10) / 10; }

/** Peso più recente registrato, o null. */
export function pesoAttuale(s = state) {
  if (!s.weights.length) return null;
  return [...s.weights].sort((a, b) => a.data.localeCompare(b.data)).at(-1).peso;
}

/* ---------- Export / Import ---------- */

/**
 * Backup completo: stato locale + tutto IndexedDB, in un unico JSON.
 * È l'unica difesa contro la cancellazione dello storage da parte di iOS.
 */
export async function exportAll() {
  const [nutrition, workouts, foods] = await Promise.all([
    db.getAll(db.STORES.NUTRITION).catch(() => []),
    db.getAll(db.STORES.WORKOUTS).catch(() => []),
    db.getAll(db.STORES.FOODS).catch(() => []),
  ]);

  return {
    app: 'IKARO',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    state,
    nutritionDays: nutrition || [],
    workoutHistory: workouts || [],
    customFoods: foods || [],
  };
}

/**
 * Ripristina un backup. Sostituisce integralmente i dati esistenti.
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
export async function importAll(payload) {
  if (!payload || payload.app !== 'IKARO' || !payload.state) {
    return { ok: false, error: 'File non riconosciuto: non è un backup IKARO.' };
  }
  if ((payload.schemaVersion || 0) > SCHEMA_VERSION) {
    return { ok: false, error: 'Backup creato da una versione più recente dell\'app.' };
  }

  try {
    // Lo stato passa dalla catena di migrazioni come un qualsiasi stato vecchio
    const incoming = migrate(JSON.parse(JSON.stringify(payload.state)));
    // Un backup v2 può portarsi dietro lo storico dentro lo stato
    const legacy = pendingMigration?.workoutHistory || [];
    pendingMigration = null;

    await db.clearAll();
    if (payload.nutritionDays?.length) await db.putMany(db.STORES.NUTRITION, payload.nutritionDays);
    const wh = payload.workoutHistory?.length ? payload.workoutHistory : legacy;
    if (wh.length) await db.putMany(db.STORES.WORKOUTS, wh);
    if (payload.customFoods?.length) await db.putMany(db.STORES.FOODS, payload.customFoods);

    state = incoming;
    persist(state);
    workoutCache = (await db.getAll(db.STORES.WORKOUTS)) || [];
    customFoods = (await db.getAll(db.STORES.FOODS)) || [];
    applyTheme();
    emit();
    return { ok: true };
  } catch (e) {
    console.error('IKARO: import fallito.', e);
    return { ok: false, error: 'Import fallito: il file potrebbe essere danneggiato.' };
  }
}

/** Cancella tutto: localStorage, IndexedDB e cache del Service Worker. */
export async function wipeAll() {
  try { await db.clearAll(); } catch (e) { /* il DB potrebbe non esistere */ }
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignora */ }
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch (e) { /* ignora */ }
  }
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    } catch (e) { /* ignora */ }
  }
}
