/* ============================================================
   IKARO — Cataloghi statici (esercizi, in futuro alimenti)

   Sono dati pubblici, uguali per tutti e in sola lettura: non
   sono "database", sono asset. Vengono serviti come JSON statici,
   scaricati una volta e messi in cache su IndexedDB.

   Perché non inline in un .js: il catalogo cresce (129 esercizi
   oggi, gli alimenti saranno molti di più) e non ha senso pagarne
   il parse a ogni avvio dell'app.

   Perché non un backend: cercare "panca piana" in palestra senza
   campo deve funzionare. Dopo il primo avvio è tutto locale, e
   i selettori restano sincroni.

   Il fallito download non rompe niente: si resta senza catalogo
   e gli esercizi tornano a essere testo libero, come prima.
   ============================================================ */

import * as db from './db.js';

/** Alzare questo numero forza il ri-download al prossimo avvio. */
const CATALOG_VERSION = 1;
const EXERCISES_URL = '/data/exercises.json';
const FOODS_URL = '/data/foods.json';

/** Cache sincrona: popolata da loadCatalogs(), letta da tutto il resto. */
let exercises = [];
let foods = [];
/** Indice nome/alias normalizzato → esercizio. Costruito una volta sola. */
let byName = new Map();

/* ---------- Normalizzazione ---------- */

/**
 * Riduce un nome alla sua forma confrontabile: minuscolo, senza accenti,
 * senza punteggiatura, spazi collassati.
 * "Panca Piana (bilanciere)" e "panca piana bilanciere" devono collidere:
 * è tutto il senso della migrazione da nome a id.
 */
export function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Slug stabile, usato per gli id degli esercizi custom. */
export function slugify(s) {
  return normalizeName(s).replace(/ /g, '-');
}

/* ---------- Caricamento ---------- */

function buildIndex() {
  byName = new Map();
  for (const ex of exercises) {
    byName.set(normalizeName(ex.nome), ex);
    for (const a of ex.alias || []) {
      const k = normalizeName(a);
      // Il nome ufficiale vince sempre sull'alias di un altro esercizio
      if (!byName.has(k)) byName.set(k, ex);
    }
  }
}

/**
 * Carica un catalogo: prima dalla cache IDB, poi dalla rete se manca
 * o se la versione è vecchia. Non lancia mai.
 * @param {string} id chiave in IDB ('exercises' | 'foods')
 * @param {string} url sorgente statica
 * @param {string} campo nome dell'array dentro il JSON
 * @returns {Promise<{ok:boolean, source:'cache'|'network'|'none', voci:Array}>}
 */
async function loadCatalog(id, url, campo) {
  // 1. Cache locale: è la via veloce e l'unica che funziona offline
  try {
    const cached = await db.get(db.STORES.CATALOG, id);
    if (cached && cached.version === CATALOG_VERSION && cached.voci?.length) {
      return { ok: true, source: 'cache', voci: cached.voci };
    }
  } catch (e) {
    console.warn(`IKARO: cache catalogo ${id} non leggibile.`, e);
  }

  // 2. Rete: solo al primo avvio o quando CATALOG_VERSION cambia
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const voci = data[campo];
    if (!Array.isArray(voci) || voci.length === 0) {
      throw new Error('catalogo vuoto o malformato');
    }

    // Il salvataggio in cache è un'ottimizzazione: se fallisce, pazienza
    db.put(db.STORES.CATALOG, { id, version: CATALOG_VERSION, voci })
      .catch(e => console.warn(`IKARO: catalogo ${id} non messo in cache.`, e));

    return { ok: true, source: 'network', voci };
  } catch (e) {
    console.warn(`IKARO: catalogo ${id} non disponibile.`, e);
    return { ok: false, source: 'none', voci: [] };
  }
}

/**
 * Carica tutti i cataloghi. In parallelo: sono indipendenti, e il primo
 * avvio non deve costare due round-trip in fila.
 */
export async function loadCatalogs() {
  const [ex, fd] = await Promise.all([
    loadCatalog('exercises', EXERCISES_URL, 'esercizi'),
    loadCatalog('foods', FOODS_URL, 'alimenti'),
  ]);

  exercises = ex.voci;
  foods = fd.voci;
  buildIndex();

  return { exercises: ex, foods: fd };
}

/* ---------- Lettura (sincrona) ---------- */

/** Tutti gli esercizi del catalogo ufficiale. */
export function catalogExercises() {
  return exercises;
}

/** Alimenti del catalogo ufficiale (OpenFoodFacts, ODbL). */
export function catalogFoods() {
  return foods;
}

/** Vero se il catalogo esercizi è stato caricato. */
export function catalogReady() {
  return exercises.length > 0;
}

/** Esercizio del catalogo per id, o null. */
export function catalogExerciseById(id) {
  return exercises.find(e => e.id === id) || null;
}

/**
 * Cerca un esercizio del catalogo partendo da un nome scritto a mano.
 * Match esatto sul nome normalizzato o su un alias: niente fuzzy.
 * Un match sbagliato attaccherebbe lo storico di un esercizio a un altro,
 * e un dato falso è peggio di un dato mancante.
 * @returns {object|null}
 */
export function matchExerciseByName(nome) {
  return byName.get(normalizeName(nome)) || null;
}

/** Gruppi muscolari presenti nel catalogo, in ordine d'uso sensato. */
export const GRUPPI = [
  'petto', 'dorso', 'spalle', 'bicipiti', 'tricipiti',
  'quadricipiti', 'femorali', 'glutei', 'polpacci',
  'addome', 'avambracci', 'full-body',
];

export const GRUPPO_LABEL = {
  petto: 'Petto', dorso: 'Dorso', spalle: 'Spalle',
  bicipiti: 'Bicipiti', tricipiti: 'Tricipiti',
  quadricipiti: 'Quadricipiti', femorali: 'Femorali',
  glutei: 'Glutei', polpacci: 'Polpacci', addome: 'Addome',
  avambracci: 'Avambracci', 'full-body': 'Full body',
};

export const GRUPPO_EMOJI = {
  petto: '🫁', dorso: '🔙', spalle: '🎯', bicipiti: '💪', tricipiti: '🔺',
  quadricipiti: '🦵', femorali: '🦿', glutei: '🍑', polpacci: '🦶',
  addome: '🧱', avambracci: '✊', 'full-body': '🔥',
};
