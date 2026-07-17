# IKARO

Fitness tracker PWA: allenamenti, nutrizione, progressi. Offline-first, single-user, zero dipendenze, zero build. I dati restano in `localStorage`, nessun account e nessun server.

## Stack

- HTML + CSS + JavaScript vanilla (ES modules)
- Service Worker per cache dell'app shell (offline)
- Deploy statico su Vercel

## Struttura

```
index.html          entry HTML
manifest.json       manifest PWA
sw.js               service worker (pre-cache + stale-while-revalidate)
vercel.json         header e cache policy
css/
  variables.css     design token (tema dark verde)
  base.css          reset, tipografia, layout
  components.css    card, bottoni, nav, chart, modali
js/
  app.js            entry point: rotte, nav, onboarding, SW
  router.js         router SPA hash-based
  store.js          stato globale + localStorage + pub/sub + selettori
  components/       bottom-nav, ui, timer, donut-chart, line-chart, workout-editor
  views/            home, allenamento, workout-attivo, scheda,
                    nutrizione, aggiungi-alimento, progressi, profilo
assets/             icone
```

## Funzionalità

- **Home** — goals giornalieri (acqua, calorie, training), donut macro, prossimo workout, streak
- **Allenamento** — schede con esercizi/serie/carichi, editor, strip settimanale, ripresa sessione
- **Workout attivo** — cronometro e rest timer basati su timestamp assoluti (sopravvivono a blocco schermo e reload), Wake Lock, storico per esercizio
- **Nutrizione** — DB alimenti locale (~30 voci), 4 pasti, ricalcolo macro live, reset giornaliero automatico
- **Progressi** — grafico peso, medie e delta settimanali, massimali 1RM, foto (ridimensionate e salvate in locale)
- **Profilo** — nome, obiettivi, recupero predefinito, reset completo dei dati

## Architettura

- **Store centralizzato** (`store.js`): `getState()` in sola lettura, `update(mutator)` per mutare + persistere + notificare, `subscribe(fn)` per i listener. Le viste si ridisegnano da sole.
- **Router** (`router.js`): rotte hash (`#/home`, `#/scheda/:id`, …). Ogni vista può restituire una funzione di cleanup per timer e listener.
- **Rendering**: template string + `innerHTML`. Ogni input utente passa da `esc()`.
- **Persistenza**: chiave `ikaro-state-v2`, con funzione `migrate()` come punto di estensione per gli schemi futuri.

## Sviluppo

Serve un server statico (gli ES modules non funzionano da `file://`):

```bash
npx serve .
```

## Deploy

Push sul repo collegato a Vercel. Al cambio di file dell'app shell **bisogna alzare la costante `CACHE` in `sw.js`**, altrimenti i client tengono la versione vecchia.

## Convenzioni

- Modifiche incrementali sui file esistenti, mai riscritture
- Nessuna dipendenza esterna, nessun build step
- Nuove viste: registrare la rotta in `app.js` e aggiungere il file a `SHELL` in `sw.js`
- Testo dell'interfaccia in italiano
