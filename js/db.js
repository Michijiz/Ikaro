/* ============================================================
   IKARO — Layer IndexedDB
   Contiene tutto ciò che cresce nel tempo e che non deve
   stare in localStorage (quota ~5 MB, cancellabile da iOS):
     - nutritionDays : storico completo dei pasti, giorno per giorno
     - workoutHistory: storico delle sessioni di allenamento
     - customFoods   : alimenti creati dall'utente
     - customExercises: esercizi creati dall'utente
     - catalog       : cataloghi statici scaricati (esercizi, alimenti)
   Le API sono tutte async e non lanciano mai: in caso di errore
   ritornano un fallback e lo segnalano al chiamante.
   ============================================================ */

const DB_NAME = 'ikaro';
const DB_VERSION = 2;

export const STORES = {
  NUTRITION: 'nutritionDays',
  WORKOUTS: 'workoutHistory',
  FOODS: 'customFoods',
  EXERCISES: 'customExercises',
  CATALOG: 'catalog',
};

/* Store che contengono dati dell'utente: il reset e l'export guardano qui.
   `catalog` ne resta fuori: è una cache di dati pubblici, non roba sua. */
export const USER_STORES = [STORES.NUTRITION, STORES.WORKOUTS, STORES.FOODS, STORES.EXERCISES];

let dbPromise = null;

/** Apre (e se serve crea) il database. Idempotente. */
export function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB non disponibile'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = req.result;

      // Storico nutrizionale: una riga per giorno, chiave YYYY-MM-DD
      if (!db.objectStoreNames.contains(STORES.NUTRITION)) {
        db.createObjectStore(STORES.NUTRITION, { keyPath: 'data' });
      }

      // Storico allenamenti: chiave id, indice sulla data per query a range
      if (!db.objectStoreNames.contains(STORES.WORKOUTS)) {
        const os = db.createObjectStore(STORES.WORKOUTS, { keyPath: 'id' });
        os.createIndex('data', 'data', { unique: false });
      }

      // Alimenti custom
      if (!db.objectStoreNames.contains(STORES.FOODS)) {
        db.createObjectStore(STORES.FOODS, { keyPath: 'id' });
      }

      // Esercizi custom (v2)
      if (!db.objectStoreNames.contains(STORES.EXERCISES)) {
        db.createObjectStore(STORES.EXERCISES, { keyPath: 'id' });
      }

      // Cataloghi statici scaricati: una riga per catalogo (v2).
      // Cache pura: se sparisce si riscarica, nessun dato utente qui dentro.
      if (!db.objectStoreNames.contains(STORES.CATALOG)) {
        db.createObjectStore(STORES.CATALOG, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      // Se un'altra scheda apre una versione nuova, chiudiamo per non bloccarla
      db.onversionchange = () => db.close();
      resolve(db);
    };

    req.onerror = () => reject(req.error || new Error('Apertura DB fallita'));
    req.onblocked = () => reject(new Error('DB bloccato da un\'altra scheda'));
  });

  // Un fallimento non deve restare "appiccicato": permetti un nuovo tentativo
  dbPromise.catch(() => { dbPromise = null; });

  return dbPromise;
}

/** Esegue una transazione e risolve quando è realmente committata. */
function tx(storeName, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    let result;
    try {
      result = fn(store);
    } catch (e) {
      reject(e);
      return;
    }
    t.oncomplete = () => resolve(result && result.__req ? result.__req.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transazione annullata'));
  }));
}

/** Wrappa una IDBRequest perché il suo result sia risolto al commit. */
function wrap(req) { return { __req: req }; }

/* ---------- API generiche ---------- */

export function put(storeName, value) {
  return tx(storeName, 'readwrite', store => wrap(store.put(value)));
}

export function get(storeName, key) {
  return tx(storeName, 'readonly', store => wrap(store.get(key)));
}

export function getAll(storeName) {
  return tx(storeName, 'readonly', store => wrap(store.getAll()));
}

export function del(storeName, key) {
  return tx(storeName, 'readwrite', store => wrap(store.delete(key)));
}

export function clear(storeName) {
  return tx(storeName, 'readwrite', store => wrap(store.clear()));
}

/** Inserisce più record in un'unica transazione (usato dall'import). */
export function putMany(storeName, values) {
  return tx(storeName, 'readwrite', store => {
    values.forEach(v => store.put(v));
    return values.length;
  });
}

/* ---------- Query specifiche ---------- */

/**
 * Giorni nutrizionali in un intervallo (estremi inclusi).
 * @param {string} from YYYY-MM-DD
 * @param {string} to   YYYY-MM-DD
 */
export function nutritionRange(from, to) {
  return tx(STORES.NUTRITION, 'readonly', store =>
    wrap(store.getAll(IDBKeyRange.bound(from, to)))
  );
}

/** Sessioni di allenamento in un intervallo di date (estremi inclusi). */
export function workoutRange(from, to) {
  return tx(STORES.WORKOUTS, 'readonly', store =>
    wrap(store.index('data').getAll(IDBKeyRange.bound(from, to)))
  );
}

/** Svuota tutti gli store (reset totale dei dati). */
export async function clearAll() {
  await Promise.all(Object.values(STORES).map(s => clear(s)));
}
