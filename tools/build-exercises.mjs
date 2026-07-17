/* ============================================================
   IKARO — Generatore catalogo esercizi
   Sorgente: lista curata a mano, ispirata a free-exercise-db (MIT)
   ma potata a ciò che esiste in una palestra vera e tradotta.

   Uso:  node tools/build-exercises.mjs
   Out:  data/exercises.json   (artefatto committato)

   Sta FUORI dall'app: nessun build step a runtime.
   Formato riga: Nome | gruppo | attrezzo | alias;alias;...
   ============================================================ */

import { writeFileSync, mkdirSync } from 'node:fs';

const RAW = `
# ---- PETTO ----
Panca piana con bilanciere|petto|bilanciere|panca piana;bench press;panca
Panca inclinata con bilanciere|petto|bilanciere|panca inclinata;incline bench
Panca declinata con bilanciere|petto|bilanciere|panca declinata
Panca piana con manubri|petto|manubri|distensioni su panca con manubri
Panca inclinata con manubri|petto|manubri|incline dumbbell press
Croci su panca piana|petto|manubri|croci con manubri;flyes
Croci su panca inclinata|petto|manubri|croci inclinate
Croci ai cavi|petto|cavi|cable fly;croci al cavo
Croci ai cavi bassi|petto|cavi|low cable fly
Chest press|petto|macchina|pectoral press;chest press machine
Pectoral machine|petto|macchina|peck deck;butterfly;pinne
Piegamenti|petto|corpo-libero|push up;flessioni
Piegamenti alle parallele|petto|corpo-libero|dip;dips;dip alle parallele
Piegamenti con piedi rialzati|petto|corpo-libero|decline push up
Pullover con manubrio|petto|manubri|pull over

# ---- DORSO ----
Stacco da terra|dorso|bilanciere|stacco;deadlift;stacchi
Stacco rumeno|femorali|bilanciere|romanian deadlift;rdl;stacco a gambe tese
Stacco sumo|dorso|bilanciere|sumo deadlift
Trazioni alla sbarra|dorso|corpo-libero|trazioni;pull up;pullup
Trazioni presa supina|dorso|corpo-libero|chin up;trazioni supine
Trazioni presa larga|dorso|corpo-libero|wide grip pull up
Trazioni assistite|dorso|macchina|assisted pull up
Lat machine|dorso|macchina|lat machine avanti;lat pulldown
Lat machine presa inversa|dorso|macchina|lat machine supina
Lat machine presa stretta|dorso|macchina|close grip pulldown
Pulley basso|dorso|cavi|rematore al cavo basso;seated row
Rematore con bilanciere|dorso|bilanciere|bent over row;rematore
Rematore con manubrio|dorso|manubri|rematore un braccio;single arm row
Rematore con bilanciere presa inversa|dorso|bilanciere|rematore supino;yates row
Rematore T-bar|dorso|bilanciere|t bar row
Rematore alla macchina|dorso|macchina|hammer row
Pulldown a braccia tese|dorso|cavi|straight arm pulldown
Iperestensioni|dorso|corpo-libero|hyperextension;lombari;back extension
Good morning|femorali|bilanciere|good mornings

# ---- SPALLE ----
Military press|spalle|bilanciere|lento avanti;overhead press;ohp
Lento avanti con manubri|spalle|manubri|shoulder press;distensioni sopra la testa
Arnold press|spalle|manubri|arnold
Shoulder press alla macchina|spalle|macchina|distensioni spalle macchina
Push press|spalle|bilanciere|spinta sopra la testa
Alzate laterali|spalle|manubri|lateral raise;alzate laterali manubri
Alzate laterali al cavo|spalle|cavi|cable lateral raise
Alzate frontali|spalle|manubri|front raise
Alzate posteriori|spalle|manubri|rear delt;alzate a 90 gradi
Reverse pec deck|spalle|macchina|rear delt machine;pectoral inverso
Face pull|spalle|cavi|face pulls
Tirate al mento|spalle|bilanciere|upright row;tirate al mento bilanciere
Scrollate con bilanciere|spalle|bilanciere|shrug;scrollate
Scrollate con manubri|spalle|manubri|dumbbell shrug

# ---- BICIPITI ----
Curl con bilanciere|bicipiti|bilanciere|curl bilanciere;barbell curl
Curl con bilanciere EZ|bicipiti|bilanciere|curl ez
Curl con manubri|bicipiti|manubri|dumbbell curl
Curl alternato|bicipiti|manubri|curl alternato manubri
Curl a martello|bicipiti|manubri|hammer curl;martello
Curl su panca inclinata|bicipiti|manubri|incline curl
Curl concentrato|bicipiti|manubri|concentration curl
Curl alla panca Scott|bicipiti|bilanciere|preacher curl;panca scott
Curl al cavo basso|bicipiti|cavi|cable curl
Curl alla sbarra|bicipiti|corpo-libero|body row curl

# ---- TRICIPITI ----
French press|tricipiti|bilanciere|skull crusher;distensioni su panca presa stretta
Panca presa stretta|tricipiti|bilanciere|close grip bench press
Push down ai cavi|tricipiti|cavi|pushdown;tricipiti al cavo
Push down corda|tricipiti|cavi|rope pushdown;corda
Push down presa inversa|tricipiti|cavi|reverse pushdown
Estensioni sopra la testa al cavo|tricipiti|cavi|overhead extension cavo
Estensioni sopra la testa con manubrio|tricipiti|manubri|overhead dumbbell extension
Kickback|tricipiti|manubri|tricipiti kickback
Dip alla panca|tricipiti|corpo-libero|bench dip
Dip alle parallele per tricipiti|tricipiti|corpo-libero|triceps dip
Piegamenti presa stretta|tricipiti|corpo-libero|diamond push up

# ---- QUADRICIPITI ----
Squat con bilanciere|quadricipiti|bilanciere|squat;back squat
Front squat|quadricipiti|bilanciere|squat frontale
Squat a corpo libero|quadricipiti|corpo-libero|air squat
Goblet squat|quadricipiti|manubri|goblet
Hack squat|quadricipiti|macchina|hack squat machine
Pressa|quadricipiti|macchina|leg press;pressa 45
Leg extension|quadricipiti|macchina|estensioni gambe
Affondi con manubri|quadricipiti|manubri|affondi;lunges
Affondi con bilanciere|quadricipiti|bilanciere|barbell lunge
Affondi camminati|quadricipiti|manubri|walking lunge
Affondi bulgari|quadricipiti|manubri|bulgarian split squat;split squat bulgaro
Step up|quadricipiti|manubri|salita su rialzo
Sissy squat|quadricipiti|corpo-libero|sissy
Squat bulgaro|quadricipiti|corpo-libero|split squat

# ---- FEMORALI E GLUTEI ----
Leg curl sdraiato|femorali|macchina|leg curl;curl femorali
Leg curl seduto|femorali|macchina|seated leg curl
Nordic curl|femorali|corpo-libero|nordic hamstring curl
Stacco a gambe tese con manubri|femorali|manubri|stiff leg deadlift
Hip thrust|glutei|bilanciere|spinte in alto glutei
Glute bridge|glutei|corpo-libero|ponte glutei
Hip thrust alla macchina|glutei|macchina|glute machine
Slanci posteriori al cavo|glutei|cavi|kickback glutei
Abduzioni alla macchina|glutei|macchina|abductor machine
Adduzioni alla macchina|quadricipiti|macchina|adductor machine

# ---- POLPACCI ----
Calf raise in piedi|polpacci|macchina|calf in piedi;standing calf
Calf raise seduto|polpacci|macchina|calf seduto;seated calf
Calf raise alla pressa|polpacci|macchina|calf alla pressa
Calf raise con manubri|polpacci|manubri|calf manubri

# ---- ADDOME ----
Crunch|addome|corpo-libero|crunch a terra
Crunch inverso|addome|corpo-libero|reverse crunch
Crunch al cavo|addome|cavi|cable crunch
Sit up|addome|corpo-libero|situp
Plank|addome|corpo-libero|plank frontale
Plank laterale|addome|corpo-libero|side plank
Leg raise alla sbarra|addome|corpo-libero|sollevamento gambe alla sbarra;hanging leg raise
Leg raise a terra|addome|corpo-libero|sollevamento gambe
Russian twist|addome|corpo-libero|torsioni russe
Ab wheel|addome|corpo-libero|ruota addominali;rollout
Mountain climber|addome|corpo-libero|climber
Hollow hold|addome|corpo-libero|hollow body
Dead bug|addome|corpo-libero|deadbug
Bicycle crunch|addome|corpo-libero|crunch bicicletta

# ---- AVAMBRACCI ----
Wrist curl|avambracci|bilanciere|curl polsi
Reverse wrist curl|avambracci|bilanciere|curl polsi inverso
Curl presa inversa|avambracci|bilanciere|reverse curl
Farmer walk|avambracci|manubri|camminata del contadino;farmer's walk
Dead hang|avambracci|corpo-libero|sospensione alla sbarra

# ---- KETTLEBELL / FULL BODY ----
Kettlebell swing|full-body|kettlebell|swing
Turkish get up|full-body|kettlebell|get up
Kettlebell clean|full-body|kettlebell|clean kb
Kettlebell snatch|full-body|kettlebell|snatch kb
Thruster|full-body|bilanciere|thrusters
Clean and jerk|full-body|bilanciere|slancio
Strappo|full-body|bilanciere|snatch
Girata al petto|full-body|bilanciere|power clean;clean
Burpees|full-body|corpo-libero|burpee
Battle rope|full-body|corpo-libero|corde
Box jump|full-body|corpo-libero|salti sul box
Jump squat|full-body|corpo-libero|squat con salto
Salto della corda|full-body|corpo-libero|corda;jump rope
`;

const slug = s => s
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const out = [];
const visti = new Set();

for (const line of RAW.split('\n')) {
  const riga = line.trim();
  if (!riga || riga.startsWith('#')) continue;

  const [nome, gruppo, attrezzo, alias = ''] = riga.split('|').map(x => x.trim());
  const id = slug(nome);

  if (visti.has(id)) {
    console.warn(`⚠️  id duplicato, salto: ${id}`);
    continue;
  }
  visti.add(id);

  out.push({
    id,
    nome,
    gruppo,
    attrezzo,
    // Gli alias alimentano il match in fase di migrazione e la ricerca:
    // chi ha scritto "panca" nella sua scheda deve ritrovare "Panca piana".
    alias: alias ? alias.split(';').map(a => a.trim()).filter(Boolean) : [],
  });
}

mkdirSync('data', { recursive: true });
writeFileSync('data/exercises.json', JSON.stringify({
  version: 1,
  esercizi: out,
}));

console.log(`✅ ${out.length} esercizi → data/exercises.json`);
