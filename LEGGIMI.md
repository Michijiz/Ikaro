# IKARO — v7

Pacchetto completo. Sostituisce l'intera cartella del progetto.

## ⚠️ Prima di deployare

1. **Profilo → Esporta** un backup dalla versione attuale.
2. **ELIMINA dal repo:** `js/components/timer.js` e `js/views/workout-attivo.js`.
   Se restano, il Service Worker prova a precacharle e l'install fallisce.
3. Deploy in blocco.

## Cosa cambia: comprensibilità

Il problema non era che mancasse qualcosa: era che **tutto aveva lo stesso
peso**. Cinque card identiche, e per capire cosa fare dovevi leggerle tutte.

### La Home ora risponde a "cosa faccio adesso"
In cima una card grande — l'unica — che cambia in base alla situazione:

| Situazione | Cosa dice |
|---|---|
| C'è da allenarsi | **Oggi tocca a → Panca e gambe** · Inizia |
| Sessione aperta | **Allenamento in corso** · sei a 2 serie su 7 · Riprendi |
| Già allenato oggi | **Completato** · il muscolo cresce nel recupero |
| Settimana chiusa | **Oggi puoi staccare** · se vuoi allenati, ma non ti serve |
| Nessuna scheda | **Crea la tua prima scheda** + spiega cos'è una scheda |

Sotto, in ordine: streak, ultimi 7 giorni, acqua, calorie — tutto più piccolo.

**Nota:** questo contraddice l'ordine che avevi chiesto (streak per primo).
Senza una risposta in cima, l'app resta un cruscotto da leggere. La card
"Allenamenti" è stata assorbita dall'hero, tacche settimanali incluse.

### Report 7 giorni leggibile
Erano 21 celle e tre etichette tagliate ("Allen", "Kcal", "Acqua"), senza un
numero: per leggerlo serviva il dito. Ora è **una riga**: sette giorni, un
riquadro pieno se hai allenato, un pallino per le calorie (verde in obiettivo,
giallo fuori, vuoto se non hai registrato). Sotto, una frase in italiano.
Il dettaglio sta nei Progressi, che è il posto dei confronti.

### Calorie: una sola volta
Lo stesso anello stava in Home e in Nutrizione, identico. In Home ora c'è il
**riassunto** (kcal rimaste + tre barre macro), tappabile; il dettaglio è in
Nutrizione.

### La Scheda dice in che modalità sei
Prima delle "Inizia" le pastiglie delle serie c'erano già ma non facevano
niente. Ora fuori sessione sono **spente e tratteggiate**, e una barra dice
"Stai guardando la scheda". In sessione la barra diventa viva e istruisce:
"tocca i numeri delle serie che finisci".

### Via il gergo
- "Volume 4.800 kg" → **"4.800 kg sollevati"**
- "Override" → **"Peso diverso · serie 2"**, con spiegazione
- "Massimali (1RM)" → **"Massimali"** + "il peso massimo che riesci a
  sollevare per una sola ripetizione"
- Stato vuoto Allenamento: spiega **cos'è una scheda**

## Promemoria di backup

Non a ogni apertura: un avviso che c'è sempre diventa invisibile in tre giorni
e ti allena a chiuderlo senza leggere. Compare **solo** se:
- non hai **mai** esportato e hai già dati veri (≥3 sessioni o ≥3 pesate), oppure
- l'ultimo backup ha **più di 30 giorni**

"Più tardi" lo zittisce per un mese. L'export registra la data, quindi dopo un
backup tace da solo.

## Cosa NON è ancora fatto

- Service Worker network-first con reload automatico
- Icone PNG per iOS

Il SW è cache-first: dopo il deploy potresti vedere i file vecchi.
Chiudi la PWA e riaprila.

## Verificato su Chromium headless

- 25 asserzioni v7: hero in tutti e 5 gli stati, report compatto, promemoria
  backup (compare, si zittisce, resta zitto), modalità della scheda
- Regressione v6, v5, flow4, flows, ed: tutte verdi
- 8 scenari sul contatore dei riposi
- 390/375/320px con dati estremi: 7/7 viste · stato vuoto: 7/7 · 10 temi
- L'harness dei test ora **non riscrive più lo stato a ogni caricamento**:
  sovrascriverlo mascherava i bug di persistenza (è così che il promemoria
  sembrava non ricordarsi dello snooze)
