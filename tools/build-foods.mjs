/* ============================================================
   IKARO — Generatore catalogo alimenti
   Sorgente: OpenFoodFacts (licenza ODbL — ridistribuibile con
   attribuzione, che è il motivo per cui è questa e non FatSecret).

   Uso:  node tools/build-foods.mjs
         node tools/build-foods.mjs --pages 40   (catalogo più grande)

   Out:  data/foods.json   (artefatto committato)

   Gira UNA VOLTA sulla tua macchina, non nell'app: il risultato è
   un JSON statico. Nessun build step a runtime, nessuna dipendenza.

   OFF limita le ricerche a ~10 al minuto: lo script rispetta il
   limite da solo. Non è un bug, è cortesia verso un progetto
   no-profit che ci regala i dati.

   È INCREMENTALE e RIPETIBILE: rilanciarlo non riparte da zero, ma
   riprende il data/foods.json esistente e ci aggiunge quello che
   manca. OFF risponde 503 quando è sotto carico — capita, e non
   deve costare un intero catalogo.
   ============================================================ */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';

const API = 'https://world.openfoodfacts.org/api/v2/search';

// OFF chiede un User-Agent identificabile. È una condizione d'uso, non un vezzo.
const UA = 'IKARO/1.0 (personal fitness PWA; https://github.com/tuo-utente/ikaro)';

const args = process.argv.slice(2);
const PAGES = Number(args[args.indexOf('--pages') + 1]) || 20;
const PAGE_SIZE = 100;
const DELAY_MS = 7000;   // ~8 richieste/minuto: sotto il limite di OFF
const RETRY = 4;         // tentativi per pagina prima di rinunciare
const OUT = 'data/foods.json';

/* ---------- Categorie: prima i generici, poi i confezionati ----------
   L'ordine conta: i generici (pollo, riso, mela) sono il 90% di quello
   che pesi davvero, e devono vincere sui prodotti a marchio in ricerca. */
const CATEGORIE = [
  // Generici / freschi
  { tag: 'fresh-foods', emoji: '🥗' },
  { tag: 'meats', emoji: '🥩' },
  { tag: 'poultry', emoji: '🍗' },
  { tag: 'fishes', emoji: '🐟' },
  { tag: 'eggs', emoji: '🥚' },
  { tag: 'fresh-vegetables', emoji: '🥦' },
  { tag: 'fresh-fruits', emoji: '🍎' },
  { tag: 'legumes', emoji: '🫘' },
  { tag: 'nuts', emoji: '🥜' },
  { tag: 'cereals-and-potatoes', emoji: '🌾' },
  { tag: 'rice', emoji: '🍚' },
  { tag: 'pastas', emoji: '🍝' },
  { tag: 'breads', emoji: '🍞' },
  { tag: 'dairies', emoji: '🥛' },
  { tag: 'cheeses', emoji: '🧀' },
  { tag: 'yogurts', emoji: '🥣' },
  { tag: 'vegetable-oils', emoji: '🫒' },
  // Confezionati di uso comune
  { tag: 'breakfast-cereals', emoji: '🥣' },
  { tag: 'canned-foods', emoji: '🥫' },
  { tag: 'charcuterie', emoji: '🥓' },
  { tag: 'sauces', emoji: '🧂' },
  { tag: 'biscuits-and-cakes', emoji: '🍪' },
  { tag: 'chocolates', emoji: '🍫' },
  { tag: 'beverages', emoji: '🥤' },
  { tag: 'sweeteners', emoji: '🍯' },
  { tag: 'frozen-foods', emoji: '🧊' },
  { tag: 'protein-bars', emoji: '🍫' },
  { tag: 'meat-substitutes', emoji: '🌱' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

const slug = s => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 40);

const r1 = n => Math.round(n * 10) / 10;

/**
 * Ripulisce il nome: OFF è pieno di ALL CAPS, doppi spazi e formati
 * appiccicati al nome ("Petto di pollo 500g"). Il peso non è il nome.
 */
function pulisciNome(raw) {
  let n = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!n) return '';
  // Tutto maiuscolo → Capitalizzato: "TONNO AL NATURALE" è urlato
  if (n === n.toUpperCase() && n.length > 3) {
    n = n.toLowerCase().replace(/(^\w|\s\w)/g, c => c.toUpperCase());
  }
  n = n.replace(/\s*[-–,]?\s*\d+\s?(g|gr|kg|ml|cl|l)\b\.?$/i, '').trim();
  return n.slice(0, 60);
}

/**
 * Un record OFF è utilizzabile solo se ha i quattro macro e sono coerenti.
 * Il DB è aperto: dentro c'è di tutto, comprese righe con 900 g di proteine
 * per 100 g. Meglio scartare che pesare per anni su un dato falso.
 */
function normalizza(p, emoji) {
  const nome = pulisciNome(p.product_name_it || p.product_name);
  if (!nome || nome.length < 3) return null;

  const n = p.nutriments || {};
  const kcal = Number(n['energy-kcal_100g']);
  const prot = Number(n.proteins_100g);
  const carb = Number(n.carbohydrates_100g);
  const fat = Number(n.fat_100g);

  if (![kcal, prot, carb, fat].every(v => Number.isFinite(v) && v >= 0)) return null;
  if (kcal <= 0 || kcal > 900) return null;
  if (prot > 100 || carb > 100 || fat > 100) return null;
  if (prot + carb + fat > 100) return null; // impossibile su 100 g

  // Le kcal dichiarate devono somigliare a quelle dei macro (±25%):
  // uno scarto più grande vuol dire che uno dei due campi è sbagliato
  const teoriche = prot * 4 + carb * 4 + fat * 9;
  if (teoriche > 0 && Math.abs(teoriche - kcal) / kcal > 0.25) return null;

  const porzione = Math.round(Number(p.serving_quantity)) || 100;

  return {
    id: `off_${p.code}`,
    nome,
    marca: (p.brands || '').split(',')[0].trim() || null,
    emoji,
    porzione: porzione > 0 && porzione <= 500 ? porzione : 100,
    kcal: Math.round(kcal),
    p: r1(prot),
    c: r1(carb),
    f: r1(fat),
    barcode: p.code, // pronto per la scansione, se un giorno la vorrai
  };
}

/**
 * Scarica una pagina, riprovando col fiato lungo.
 * 503 e 429 non sono errori nostri: sono OFF che chiede di rallentare.
 * L'unica risposta sensata è aspettare di più, non rinunciare.
 */
async function scarica(categoria, page) {
  const url = `${API}?${new URLSearchParams({
    categories_tags_en: categoria,
    countries_tags_en: 'italy',
    fields: 'code,product_name,product_name_it,brands,nutriments,serving_quantity',
    sort_by: 'unique_scans_n', // i più scansionati = quelli che si mangiano davvero
    page_size: String(PAGE_SIZE),
    page: String(page),
  })}`;

  let ultimo;
  for (let t = 1; t <= RETRY; t++) {
    let definitivo = false;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.ok) return res.json();

      ultimo = new Error(`HTTP ${res.status}`);
      // 4xx diversi da 429: riprovare non cambia niente.
      // Il flag, e non un throw: un throw qui finirebbe nel catch
      // qui sotto e verrebbe ritentato lo stesso.
      if (res.status < 500 && res.status !== 429) definitivo = true;
    } catch (e) {
      ultimo = e; // rete giù, DNS, timeout: vale la pena riprovare
    }

    if (definitivo) throw ultimo;

    if (t < RETRY) {
      const attesa = DELAY_MS * Math.pow(2, t); // 14s, 28s, 56s
      console.log(`     ↻ ${categoria} p${page}: ${ultimo.message}, riprovo tra ${attesa / 1000}s (${t}/${RETRY - 1})`);
      await sleep(attesa);
    }
  }
  throw ultimo;
}

/* ---------- Main ---------- */

const perId = new Map();
const perNome = new Map(); // dedup: OFF ha lo stesso prodotto sotto barcode diversi
let scartati = 0;

/* Ripresa: quello che c'è già è buono e non si ributta via. */
if (existsSync(OUT)) {
  try {
    const vecchio = JSON.parse(readFileSync(OUT, 'utf8'));
    for (const rec of vecchio.alimenti || []) {
      perId.set(rec.id, rec);
      perNome.set(slug(`${rec.nome}-${rec.marca || ''}`), true);
    }
    console.log(`↻ Riprendo da ${OUT}: ${perId.size} alimenti già presenti.\n`);
  } catch {
    console.warn(`⚠️  ${OUT} illeggibile, riparto da zero.\n`);
  }
}

const paginePerCat = Math.max(1, Math.ceil(PAGES / CATEGORIE.length));
const falliti = [];

for (const { tag, emoji } of CATEGORIE) {
  for (let page = 1; page <= paginePerCat; page++) {
    try {
      const data = await scarica(tag, page);
      const prodotti = data.products || [];
      if (prodotti.length === 0) break;

      for (const p of prodotti) {
        const rec = normalizza(p, emoji);
        if (!rec) { scartati++; continue; }

        const chiaveNome = slug(`${rec.nome}-${rec.marca || ''}`);
        if (perNome.has(chiaveNome) || perId.has(rec.id)) continue;

        perNome.set(chiaveNome, true);
        perId.set(rec.id, rec);
      }

      console.log(`  ${tag} p${page}: ${prodotti.length} → totale ${perId.size}`);
      if (prodotti.length < PAGE_SIZE) break;
      await sleep(DELAY_MS);
    } catch (e) {
      console.warn(`  ❌ ${tag} p${page}: ${e.message} — categoria saltata`);
      falliti.push(tag);
      break; // inutile insistere sulle pagine dopo se la prima non arriva
    }
  }
}

const alimenti = [...perId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'it'));

mkdirSync('data', { recursive: true });
writeFileSync('data/foods.json', JSON.stringify({
  version: 1,
  fonte: 'OpenFoodFacts (ODbL)',
  generatoIl: new Date().toISOString().slice(0, 10),
  alimenti,
}));

const kb = Math.round(Buffer.byteLength(JSON.stringify({ alimenti })) / 1024);
console.log(`\n✅ ${alimenti.length} alimenti (${kb} KB) → ${OUT}`);
console.log(`   ${scartati} record scartati perché coi macro incoerenti.`);

if (falliti.length) {
  console.log(`\n⚠️  ${falliti.length} categorie non scaricate: ${falliti.join(', ')}`);
  console.log(`   OFF era sotto carico. Rilancia lo script tra qualche minuto:`);
  console.log(`   riprende da qui e recupera solo queste.`);
} else {
  console.log(`\n🎉 Tutte le categorie scaricate.`);
}

console.log(`\n⚠️  Ricordati: ODbL vuole l'attribuzione a OpenFoodFacts nell'app.`);
