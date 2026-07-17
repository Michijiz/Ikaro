/* ============================================================
   IKARO — Vista Profilo
   Nome, dati corporei e obiettivi. I dati corporei alimentano il
   ricalcolo del fabbisogno (Mifflin-St Jeor): sono facoltativi, e
   senza di essi gli obiettivi restano quelli inseriti a mano.
   Backup: export/import JSON — unica difesa contro la
   cancellazione dello storage da parte di iOS (ITP, ~7 giorni
   di inattività). Include il reset completo dei dati.
   ============================================================ */

import {
  getState, update, exportAll, importAll, wipeAll,
  OBIETTIVI, calcolaObiettivi, pesoAttuale,
} from '../store.js';
import { toast, esc, parseDecimal, fmtNum, ICONS, confirmModal } from '../components/ui.js';

export function renderProfilo(root) {
  const s = getState();
  const g = s.profile.goals;
  const p = s.profile;

  root.innerHTML = `
    <header class="page-head">
      <div class="title">
        <h1>Profilo</h1>
        <div class="sub">Dati, obiettivi e backup</div>
      </div>
    </header>

    <div class="card">
      <h3>Il tuo nome</h3>
      <input id="p-name" class="mt-8" value="${esc(s.profile.name)}" placeholder="Come ti chiami?" maxlength="30">
    </div>

    <div class="card mt-16">
      <h3>I tuoi dati</h3>
      <p class="muted small mt-8">
        Servono a ricalcolare il fabbisogno. Facoltativi: senza, gli
        obiettivi restano quelli che imposti a mano qui sotto.
      </p>

      <div class="field mt-16">
        <span>Sesso</span>
        <div class="ob-inline">
          <button class="ob-pill ${p.sesso === 'm' ? 'on' : ''}" data-sex="m">Uomo</button>
          <button class="ob-pill ${p.sesso === 'f' ? 'on' : ''}" data-sex="f">Donna</button>
        </div>
      </div>

      <div class="field-grid mt-16">
        <label class="field">
          <span>Età</span>
          <input id="p-eta" type="text" inputmode="numeric" value="${p.eta ?? ''}" placeholder="anni">
        </label>
        <label class="field">
          <span>Altezza (cm)</span>
          <input id="p-alt" type="text" inputmode="numeric" value="${p.altezza ?? ''}" placeholder="cm">
        </label>
      </div>

      <div class="field mt-16">
        <span>Obiettivo</span>
        <div class="ob-inline">
          ${OBIETTIVI.map(o => `
            <button class="ob-pill ${p.obiettivo === o.id ? 'on' : ''}" data-goal="${o.id}"
                    style="font-size:0.8rem;">${o.emoji} ${o.nome}</button>`).join('')}
        </div>
      </div>

      <button class="btn btn-secondary btn-block mt-16" id="p-recalc">Ricalcola i miei obiettivi</button>
      <p class="faint mt-8">
        ${pesoAttuale(s) === null
          ? 'Registra un peso in Progressi: senza, non posso calcolare niente.'
          : `Userò il peso più recente: ${fmtNum(pesoAttuale(s), 1)} kg`}
      </p>
    </div>

    <div class="card mt-16">
      <h3>Obiettivi giornalieri</h3>
      <div class="col mt-16" style="gap:12px;">
        ${field('p-cal', '🔥 Calorie (kcal)', g.calories, 0)}
        ${field('p-prot', '🥩 Proteine (g)', g.protein, 0)}
        ${field('p-carbs', '🍞 Carboidrati (g)', g.carbs, 0)}
        ${field('p-fat', '🥑 Grassi (g)', g.fat, 0)}
        ${field('p-water', '💧 Acqua (L)', g.water, 2)}
        ${field('p-weight', '🎯 Peso target (kg)', g.weightTarget, 1)}
        ${field('p-week', '🏋️ Allenamenti a settimana', g.workoutsPerWeek, 0)}
      </div>
      <button class="btn btn-primary btn-block mt-16" id="p-save">Salva profilo</button>
    </div>

    <div class="card mt-16">
      <h3>Backup</h3>
      <p class="muted small mt-8">
        I dati di IKARO vivono solo su questo dispositivo: nessun account,
        nessun server. iOS però può cancellarli da solo dopo settimane di
        inattività — <strong>esporta un backup ogni tanto.</strong>
      </p>
      <div class="row mt-16">
        <button class="btn btn-secondary grow" id="p-export">${ICONS.download} Esporta</button>
        <button class="btn btn-secondary grow" id="p-import">${ICONS.upload} Importa</button>
      </div>
      <input type="file" id="p-file" accept="application/json,.json" hidden>
    </div>

    <div class="card mt-16">
      <h3>Zona pericolosa</h3>
      <p class="muted small mt-8">Cancella stato, storico e cache. Irreversibile.</p>
      <button class="btn btn-block btn-danger mt-16" id="p-reset">Cancella tutti i dati</button>
    </div>

    <p class="center faint mt-24">IKARO · vola alto, atterra leggero</p>
  `;

  /* ---------- Dati corporei ---------- */
  // La selezione si applica subito allo stato: il ricalcolo la legge da lì,
  // e ridisegnare la vista perderebbe gli obiettivi digitati e non salvati
  root.querySelectorAll('[data-sex]').forEach(b => {
    b.addEventListener('click', () => {
      update(st => { st.profile.sesso = b.dataset.sex; });
      root.querySelectorAll('[data-sex]').forEach(x => x.classList.toggle('on', x === b));
    });
  });

  root.querySelectorAll('[data-goal]').forEach(b => {
    b.addEventListener('click', () => {
      update(st => { st.profile.obiettivo = b.dataset.goal; });
      root.querySelectorAll('[data-goal]').forEach(x => x.classList.toggle('on', x === b));
    });
  });

  root.querySelector('#p-recalc').addEventListener('click', async () => {
    const eta = parseDecimal(root.querySelector('#p-eta').value, 10, 100);
    const altezza = parseDecimal(root.querySelector('#p-alt').value, 100, 250);
    const peso = pesoAttuale(getState());
    const prof = getState().profile;

    if (!prof.sesso) { toast('Scegli uomo o donna'); return; }
    if (eta === null) { toast('Età non valida (10–100)'); return; }
    if (altezza === null) { toast('Altezza non valida (100–250 cm)'); return; }
    if (peso === null) { toast('Registra prima un peso in Progressi'); return; }
    if (!prof.obiettivo) { toast('Scegli un obiettivo'); return; }

    const nuovi = calcolaObiettivi({
      sesso: prof.sesso, eta, altezza, peso,
      obiettivo: prof.obiettivo,
      workoutsPerWeek: prof.goals.workoutsPerWeek,
    });

    const ok = await confirmModal(
      `Nuovi obiettivi: ${nuovi.calories.toLocaleString('it-IT')} kcal · ` +
      `P ${nuovi.protein}g · C ${nuovi.carbs}g · G ${nuovi.fat}g · ` +
      `acqua ${fmtNum(nuovi.water, 1)} L. Sostituire quelli attuali?`,
      { ok: 'Applica' });
    if (!ok) return;

    update(st => {
      st.profile.eta = eta;
      st.profile.altezza = altezza;
      Object.assign(st.profile.goals, {
        calories: nuovi.calories, protein: nuovi.protein,
        carbs: nuovi.carbs, fat: nuovi.fat, water: nuovi.water,
      });
    });
    toast('✅ Obiettivi ricalcolati');
    renderProfilo(root);
  });

  root.querySelector('#p-save').addEventListener('click', () => {
    const name = root.querySelector('#p-name').value.trim();
    const v = {
      cal:    num(root, '#p-cal', 800, 8000),
      prot:   num(root, '#p-prot', 20, 400),
      carbs:  num(root, '#p-carbs', 0, 1000),
      fat:    num(root, '#p-fat', 10, 400),
      water:  num(root, '#p-water', 0.5, 8),
      week:   num(root, '#p-week', 1, 14),
      weight: num(root, '#p-weight', 30, 250),
      
      
    };

    // 0 è un valore legittimo per i carboidrati: non usare il falsy check
    const invalido = Object.entries(v).find(([, x]) => x === null);
    if (invalido) { toast('Controlla i valori inseriti'); return; }

    const eta = parseDecimal(root.querySelector('#p-eta').value, 10, 100);
    const altezza = parseDecimal(root.querySelector('#p-alt').value, 100, 250);

    update(st => {
      st.profile.name = name;
      st.profile.eta = eta;        // null se il campo è vuoto: è facoltativo
      st.profile.altezza = altezza;
      // Merge, non sostituzione: eventuali chiavi future non vanno perse
      Object.assign(st.profile.goals, {
        calories: Math.round(v.cal),
        protein: Math.round(v.prot),
        carbs: Math.round(v.carbs),
        fat: Math.round(v.fat),
        water: v.water,
        weightTarget: v.weight,
        workoutsPerWeek: Math.round(v.week),
      });
      st.profile.onboarded = true;
    });
    toast('✅ Profilo salvato');
  });

  /* ---------- Backup ---------- */
  root.querySelector('#p-export').addEventListener('click', async () => {
    try {
      const data = await exportAll();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ikaro-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('💾 Backup esportato');
    } catch (e) {
      console.error(e);
      toast('Export fallito');
    }
  });

  const file = root.querySelector('#p-file');
  root.querySelector('#p-import').addEventListener('click', () => file.click());

  file.addEventListener('change', async () => {
    const f = file.files[0];
    file.value = '';
    if (!f) return;
    const ok = await confirmModal('Importare il backup? Tutti i dati attuali verranno sostituiti.',
      { ok: 'Importa' });
    if (!ok) return;

    try {
      const res = await importAll(JSON.parse(await f.text()));
      if (!res.ok) { toast(res.error); return; }
      toast('✅ Backup ripristinato');
      setTimeout(() => location.reload(), 700);
    } catch (e) {
      console.error(e);
      toast('File non leggibile');
    }
  });

  /* ---------- Reset ---------- */
  root.querySelector('#p-reset').addEventListener('click', async () => {
    const ok = await confirmModal(
      'Cancella stato, storico, alimenti custom e cache. Non si torna indietro. Hai esportato un backup?',
      { ok: 'Cancella tutto', danger: true });
    if (!ok) return;
    await wipeAll();
    location.reload();
  });
}

/* ---------- helper ---------- */
/**
 * Campo numerico. type="text" + inputmode="decimal": con type="number"
 * un valore scritto con la virgola rende .value una stringa vuota,
 * quindi qualunque decimale all'italiana veniva rifiutato.
 */
function field(id, label, value, dec) {
  return `
    <label class="between" style="gap:14px;">
      <span class="small">${label}</span>
      <input id="${id}" type="text" inputmode="decimal" enterkeyhint="done"
             value="${fmtNum(value, dec)}" style="width:110px;text-align:right;">
    </label>`;
}

function num(root, sel, min, max) {
  const el = root.querySelector(sel);
  if (!el) { console.error(`IKARO: campo ${sel} assente dal markup.`); return null; }
  return parseDecimal(el.value, min, max);
}