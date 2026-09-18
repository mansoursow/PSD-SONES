import { DEPARTMENTS, bySlug, isInterviewed, isActive, SLOTS, DURATION_MIN } from './departments.js';

const app = document.getElementById('app');
const state = { config: null, guides: null, status: {} };

/* ------------------------------------------------------------------ utils */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const session = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch {} },
  del(k) { try { sessionStorage.removeItem(k); } catch {} },
};

const utc = (date) => new Date(date + 'T12:00:00Z');
const fmtLong = (date) => utc(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtShort = (date) => utc(date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtTime = (t) => t.replace(':', 'h');
const ucfirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const iso = (d) => d.toISOString().slice(0, 10);
const addMin = (t, m) => { const [h, mm] = t.split(':').map(Number); const x = h * 60 + mm + m; return `${String(Math.floor(x / 60)).padStart(2, '0')}h${String(x % 60).padStart(2, '0')}`; };

let toastTimer;
function toast(msg, error = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('is-error', error);
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), error ? 6000 : 4200);
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  const code = store.get('psd-access');
  const admin = session.get('psd-admin');
  if (code) headers['x-access-code'] = code;
  if (admin) headers['x-admin-password'] = admin;
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, keepalive: method === 'PUT' });
  let data = {};
  try { data = await r.json(); } catch {}
  if (!r.ok) {
    const e = new Error(data.error || `Erreur ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return data;
}

/* ------------------------------------------------------------- données */
async function loadConfig() {
  state.config = await api('/api/config');
  state.status = Object.fromEntries((state.config.status || []).map((s) => [s.slug, s]));
  return state.config;
}
async function loadGuides() {
  if (!state.guides) state.guides = await (await fetch('data/guides.json')).json();
  return state.guides;
}
const guideFor = (d) => state.guides[d.guide || 'generic'];

function answerIds(guide) {
  const ids = [];
  for (const s of guide.sections) for (const it of s.items) {
    if (it.type !== 'q') continue;
    if (it.answer) ids.push(it.id);
    for (const c of it.children || []) if (c.answer) ids.push(c.id);
  }
  return ids;
}

const takenSlots = (exceptSlug) => {
  const set = new Set();
  for (const s of Object.values(state.status)) if (s.booking && s.slug !== exceptSlug) set.add(`${s.booking.date}T${s.booking.time}`);
  return set;
};

/* --------------------------------------------------------- code d'accès */
function accessGate() {
  return new Promise((resolve) => {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<form class="modal__box">
      <div class="card__kicker">Accès réservé</div>
      <h2 style="font-size:1.25rem">Code d'accès aux entretiens</h2>
      <p class="muted" style="font-size:.9rem">Saisissez le code communiqué par l'équipe du consultant dans l'invitation.</p>
      <label class="field">Code d'accès<input name="code" required autocomplete="off" autofocus></label>
      <p class="notice hidden" data-err>Code incorrect.</p>
      <button class="btn btn--primary">Accéder</button></form>`;
    document.body.append(m);
    $('form', m).addEventListener('submit', async (e) => {
      e.preventDefault();
      store.set('psd-access', new FormData(e.target).get('code').trim());
      await loadConfig();
      if (state.config.locked) return $('[data-err]', m).classList.remove('hidden');
      m.remove();
      resolve();
    });
  });
}

/* ------------------------------------------------------------ routeur */
let cleanup = null;
async function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  const hash = location.hash.replace(/^#/, '') || '/';
  const [, page, arg, sub] = hash.split('/');
  window.scrollTo({ top: 0 });
  try {
    if (!state.config) await loadConfig();
    await loadGuides();
    if (page === 'admin') return renderAdmin(arg);
    if (state.config.locked) await accessGate();
    if (page === 's' && isActive(bySlug[arg])) return sub === 'questionnaire' ? renderQuestionnaire(bySlug[arg]) : renderDept(bySlug[arg]);
    if (hash !== '/') { history.replaceState(null, '', '#/'); }
    return renderHome();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="container section"><div class="empty">Impossible de charger la page : ${esc(e.message)}</div></div>`;
  }
}
window.addEventListener('hashchange', route);
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-anchor]');
  if (!a) return;
  e.preventDefault();
  const go = () => document.getElementById(a.dataset.anchor)?.scrollIntoView({ behavior: 'smooth' });
  if ((location.hash || '#/') === '#/') go();
  else { location.hash = '#/'; setTimeout(go, 250); }
});

/* ---------------------------------------------------------------- accueil */
function unit(d, cls = '') {
  if (!isActive(d)) {
    return `<div class="unit ${cls} is-off" aria-disabled="true" title="Entretien à venir"><span class="unit__name">${esc(d.name)}</span></div>`;
  }
  const b = state.status[d.slug]?.booking;
  const badge = b
    ? `<span class="unit__done">✓ Terminé · ${esc(utc(b.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' }))} ${fmtTime(b.time)}</span>`
    : `<span class="unit__cta">Cliquez ici →</span>`;
  return `<a class="unit ${cls} is-active${b ? ' is-booked' : ''}" href="#/s/${d.slug}"><span class="unit__name">${esc(d.name)}</span>${badge}</a>`;
}

function orgChart() {
  const g = (grp) => DEPARTMENTS.filter((d) => d.group === grp && isInterviewed(d));
  return `<div class="org" id="org">
    <div class="org__trunk" aria-hidden="true"></div>
    <div class="org__row org__top">${unit(bySlug.dg, 'unit--top')}</div>
    <div class="org__row org__staff"><div class="col">${g('staff').map((d) => unit(d)).join('')}</div></div>
    <div class="org__row org__mid">
      <div class="org__left">
        ${unit(bySlug['coordonnateur-technique'], 'unit--strong')}
        ${g('cell').map((d) => unit(d, 'unit--cell')).join('')}
      </div>
      <div class="org__right">
        <div class="sg">${unit(bySlug['secretariat-general'], 'unit--strong')}</div>
        <div class="org__sgkids">${g('sg-child').map((d) => unit(d, 'unit--cell')).join('')}</div>
      </div>
    </div>
    <div class="org__row org__dirs">${g('dir').map((d) => unit(d, 'unit--dir')).join('')}</div>
  </div>`;
}

function placeTrunk() {
  const org = $('#org');
  if (!org) return;
  const trunk = $('.org__trunk', org);
  const o = org.getBoundingClientRect();
  const top = $('.org__top .unit', org).getBoundingClientRect();
  const dirs = $('.org__dirs', org).getBoundingClientRect();
  trunk.style.top = `${top.bottom - o.top}px`;
  trunk.style.height = `${Math.max(0, dirs.top - top.bottom)}px`;
}

function renderHome() {
  app.innerHTML = `
  <section class="container home">
    <h1 class="home__title">Entretiens <span>PSD 2026–2030</span></h1>
    <p class="home__lead">Cliquez sur votre pôle pour choisir la date de votre entretien.</p>
    ${state.config.storeKind === 'none' ? `<p class="notice" style="margin-bottom:1rem">La réservation en ligne n'est pas encore activée.</p>` : ''}
    ${orgChart()}
  </section>`;
  placeTrunk();
  const onResize = () => placeTrunk();
  window.addEventListener('resize', onResize);
  document.fonts?.ready.then(placeTrunk);
  cleanup = () => window.removeEventListener('resize', onResize);
}

/* ------------------------------------------------------------ page rendez-vous */
function renderDept(d) {
  app.innerHTML = `
  <div class="container page">
    <a class="back" href="#/">← Organigramme</a>
    <h1 class="page__title">${esc(d.name)}</h1>
    <section class="step" id="booking"><p class="muted">Chargement…</p></section>
  </div>`;
  setupBooking(d);
}

/* ------------------------------------------------------------ page questionnaire */
function renderQuestionnaire(d) {
  const guide = guideFor(d);
  const ids = answerIds(guide);
  const objectif = guide.fiche.find((f) => /objectif/i.test(f.k))?.v;
  app.innerHTML = `
  <div class="container page">
    <a class="back" href="#/s/${d.slug}">← Rendez-vous</a>
    <h1 class="page__title">Questionnaire — ${esc(d.name)}</h1>
    <section class="step">
      <p class="muted step__intro">${objectif ? esc(objectif) + ' ' : ''}Apportez des premiers éléments de réponse avant l'entretien : quelques lignes par question suffisent, tout est enregistré automatiquement.</p>
      <div class="guide-bar">
        <span class="save-state" id="save"><i></i><span>À jour</span></span>
        <span class="muted" id="pcttxt">0 / ${ids.length} questions</span>
        <button class="btn btn--ghost btn--sm no-print" id="print">Imprimer / PDF</button>
      </div>
      <div id="submitted"></div>
      <div id="guide">${guide.sections.map((s, i) => moduleHtml(s, i)).join('')}</div>
      <div class="q-actions no-print">
        <button class="btn btn--ghost" id="pause">💾 Enregistrer et continuer plus tard</button>
        <button class="btn btn--cta" id="submit">Soumettre le questionnaire →</button>
      </div>
    </section>
  </div>`;
  $('#print').addEventListener('click', () => window.print());
  const ctl = setupAnswers(d, guide, ids);

  const showSubmitted = (at) => {
    $('#submitted').innerHTML = at ? `<p class="notice notice--ok" style="margin-bottom:1rem">✓ Questionnaire soumis le ${esc(new Date(at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }))}. Vous pouvez encore compléter vos réponses et le soumettre à nouveau.</p>` : '';
    $('#submit').textContent = at ? 'Soumettre à nouveau →' : 'Soumettre le questionnaire →';
  };
  ctl.onLoad = (meta) => showSubmitted(meta.submittedAt);

  $('#pause').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const ok = await ctl.flush();
    btn.disabled = false;
    if (!ok) return toast("L'enregistrement a échoué. Vérifiez votre connexion et réessayez.", true);
    modal(`<div class="done" style="padding:.4rem 0 0">
      <div class="done__icon" style="width:60px;height:60px;font-size:1.7rem">💾</div>
      <div class="done__title" style="font-size:1.4rem">Réponses enregistrées</div>
      <p class="done__text">Vous pouvez fermer cette page et reprendre plus tard : vos réponses vous attendront. Pour revenir, utilisez le bouton <b>« Consulter le questionnaire »</b> de l'e-mail de confirmation, ou ce lien :</p>
      <p style="word-break:break-all;font-size:.85rem;background:var(--paper-2);border-radius:10px;padding:.6rem .8rem;margin-bottom:1rem">${esc(location.href)}</p>
      <div class="row-actions" style="justify-content:center"><button class="btn btn--ghost btn--sm" data-copy>Copier le lien</button><button class="btn btn--primary btn--sm" data-close>Continuer à répondre</button></div>
    </div>`, (m) => {
      $('[data-copy]', m).onclick = async () => { await navigator.clipboard?.writeText(location.href).catch(() => {}); toast('Lien copié.'); };
    });
  });

  $('#submit').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const ok = await ctl.flush();
    if (!ok) { btn.disabled = false; return toast("L'enregistrement a échoué. Vérifiez votre connexion et réessayez.", true); }
    const filled = ctl.filled();
    if (!filled) { btn.disabled = false; return toast('Renseignez au moins une réponse avant de soumettre.', true); }
    const missing = ctl.total - filled;
    const go = await confirmBox(
      'Soumettre le questionnaire ?',
      missing
        ? `${filled} question${filled > 1 ? 's' : ''} sur ${ctl.total} renseignée${filled > 1 ? 's' : ''} : ${missing} restent sans réponse. Vos réponses seront envoyées par e-mail à l'équipe du consultant ; vous pourrez encore les compléter ensuite.`
        : "Toutes les questions sont renseignées. Vos réponses seront envoyées par e-mail à l'équipe du consultant.",
      'Soumettre');
    if (!go) { btn.disabled = false; return; }
    btn.textContent = 'Envoi…';
    try {
      const r = await api('/api/submit', { method: 'POST', body: { dept: d.slug } });
      showSubmitted(r.submittedAt);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      modal(`<div class="done" style="padding:.4rem 0 0">
        <div class="done__icon">✓</div>
        <div class="done__title">Questionnaire soumis</div>
        <p class="done__text">Merci ! ${r.filled} réponse${r.filled > 1 ? 's ont' : ' a'} été transmise${r.filled > 1 ? 's' : ''} à l'équipe du consultant.${r.mail?.sent ? (r.to === 'interviewee' ? ' Un récapitulatif vous a été envoyé par e-mail.' : '') : " (L'e-mail récapitulatif n'a pas pu être envoyé, mais vos réponses sont bien enregistrées.)"}</p>
        <div class="row-actions" style="justify-content:center"><a class="btn btn--ghost btn--sm" href="#/" data-close>Retour à l'organigramme</a><button class="btn btn--primary btn--sm" data-close>Fermer</button></div>
      </div>`);
    } catch (err) {
      toast(err.message, true);
      showSubmitted(null);
    } finally {
      btn.disabled = false;
    }
  });
}

function modal(inner, setup) {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="modal__box" role="dialog" aria-modal="true">${inner}</div>`;
  document.body.append(m);
  const close = () => m.remove();
  m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) close(); });
  setup?.(m);
  return close;
}

function confirmBox(title, text, cta) {
  return new Promise((resolve) => {
    let done = false;
    const close = modal(`<h2 style="font-size:1.2rem">${esc(title)}</h2><p class="muted" style="font-size:.92rem">${esc(text)}</p>
      <div class="row-actions" style="justify-content:flex-end"><button class="btn btn--ghost btn--sm" data-no>Continuer à répondre</button><button class="btn btn--cta btn--sm" data-yes>${esc(cta)}</button></div>`, (m) => {
      $('[data-yes]', m).onclick = () => { done = true; close(); resolve(true); };
      $('[data-no]', m).onclick = () => { done = true; close(); resolve(false); };
      m.addEventListener('click', (e) => { if (e.target === m && !done) resolve(false); });
    });
  });
}

const KEEP = new Set(['SONES', 'SWOT', 'PSD', 'SI', 'SDSI', 'ERP', 'QSE', 'SMQ', 'ISO', 'EIES', 'PGES', 'RSE', 'IT', 'MHA', 'PPP', 'DG', 'SG', 'CPSM', 'GED', 'PAR', 'SST', "SEN'EAU"]);
const cap = (t) => t.split(/(\s+|[()&/,])/).map((w, i) => (KEEP.has(w) ? w : i === 0 ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase())).join('').replace(/sénégal/g, 'Sénégal').replace(/holding/g, 'Holding');

function qHtml(it, child = false) {
  const head = `${it.label ? `<div class="q__label">${esc(it.label)}</div>` : ''}${it.text ? `<div class="q__text">${esc(it.text)}</div>` : ''}`;
  const points = it.points?.length ? `<ul class="q__points">${it.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '';
  const hint = it.hint ? `<div class="q__hint">${esc(it.hint)}</div>` : '';
  const ans = it.answer ? `<div class="answer"><textarea data-qid="${it.id}" rows="3" placeholder="Premiers éléments de réponse…" aria-label="Réponse : ${esc(it.label || it.text.slice(0, 80))}"></textarea><span class="answer__meta" data-meta="${it.id}"></span><div class="print-answer" data-print="${it.id}"></div></div>` : '';
  const kids = it.children?.length ? `<div class="q__children">${it.children.map((c) => qHtml(c, true)).join('')}</div>` : '';
  return `<div class="q${child ? ' q--child' : ''}">${head}${points}${hint}${ans}${kids}</div>`;
}

function moduleHtml(s, i) {
  return `<section class="module" id="m${i}">
    <div class="module__head"><span class="module__code">${esc(s.code)}</span><h3>${esc(s.title)}</h3></div>
    <div class="module__body">${s.items.map((it) => (it.type === 'sub' ? `<div class="subhead">${esc(it.text)}</div>` : qHtml(it))).join('')}</div>
  </section>`;
}

/* ---------- réponses (enregistrement automatique) ---------- */
function setupAnswers(d, guide, ids) {
  const answers = {};
  const dirty = new Set();
  let timer = null, saving = false;
  const draftKey = `psd-draft:${d.slug}`;
  const saveEl = $('#save');
  const setSave = (cls, txt) => { saveEl.className = `save-state ${cls}`; $('span', saveEl).textContent = txt; };

  const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = `${Math.max(78, ta.scrollHeight + 2)}px`; };
  const refresh = () => {
    const n = ids.filter((id) => (answers[id] || '').trim()).length;
    const pct = ids.length ? Math.round((n / ids.length) * 100) : 0;
    $('#pcttxt').textContent = `${n} / ${ids.length} questions renseignées (${pct} %)`;
    return n;
  };

  async function save() {
    if (saving || !dirty.size) return;
    saving = true;
    const batch = {};
    for (const id of dirty) batch[id] = answers[id] || '';
    dirty.clear();
    setSave('is-pending', 'Enregistrement…');
    try {
      await api('/api/answers', { method: 'PUT', body: { dept: d.slug, answers: batch, filled: refresh(), total: ids.length, by: '' } });
      setSave('', `Enregistré à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
      if (!dirty.size) store.del(draftKey);
      const st = state.status[d.slug] ||= { slug: d.slug };
      st.progress = { filled: refresh(), total: ids.length };
    } catch (e) {
      for (const id of Object.keys(batch)) dirty.add(id);
      setSave('is-error', 'Non enregistré — nouvel essai…');
      if (e.status === 401) toast("Code d'accès requis ou expiré. Rechargez la page.", true);
      clearTimeout(timer);
      timer = setTimeout(save, 8000);
    } finally {
      saving = false;
      if (dirty.size) { clearTimeout(timer); timer = setTimeout(save, 1200); }
    }
  }

  const onInput = (e) => {
    const ta = e.target.closest('textarea[data-qid]');
    if (!ta) return;
    answers[ta.dataset.qid] = ta.value;
    ta.classList.toggle('has-value', !!ta.value.trim());
    grow(ta);
    dirty.add(ta.dataset.qid);
    store.set(draftKey, JSON.stringify(Object.fromEntries([...dirty].map((id) => [id, answers[id]]))));
    setSave('is-pending', 'Modifications en cours…');
    refresh();
    clearTimeout(timer);
    timer = setTimeout(save, 1200);
  };
  const guideEl = $('#guide');
  guideEl.addEventListener('input', onInput);
  guideEl.addEventListener('focusout', () => { if (dirty.size) { clearTimeout(timer); save(); } });

  const beforeUnload = (e) => { if (dirty.size) { save(); e.preventDefault(); e.returnValue = ''; } };
  const beforePrint = () => $$('[data-print]').forEach((p) => { p.textContent = answers[p.dataset.print] || ''; });
  window.addEventListener('beforeunload', beforeUnload);
  window.addEventListener('beforeprint', beforePrint);
  cleanup = () => {
    if (dirty.size) save();
    clearTimeout(timer);
    window.removeEventListener('beforeunload', beforeUnload);
    window.removeEventListener('beforeprint', beforePrint);
  };

  const fill = (data) => {
    Object.assign(answers, data);
    $$('textarea[data-qid]').forEach((ta) => {
      ta.value = answers[ta.dataset.qid] || '';
      ta.classList.toggle('has-value', !!ta.value.trim());
      grow(ta);
    });
    refresh();
  };

  const flush = async () => {
    clearTimeout(timer);
    for (let i = 0; i < 40 && (dirty.size || saving); i++) {
      if (!saving) await save();
      else await new Promise((r) => setTimeout(r, 150));
    }
    return !dirty.size;
  };
  const ctl = { flush, filled: () => refresh(), total: ids.length, onLoad: null };

  api(`/api/answers?dept=${d.slug}`).then((res) => {
    ctl.onLoad?.(res.meta || {});
    fill(res.answers || {});
    // Brouillon local non encore envoyé (coupure réseau, fermeture d'onglet…)
    let draft = {};
    try { draft = JSON.parse(store.get(draftKey) || '{}'); } catch {}
    const pending = Object.keys(draft).filter((id) => draft[id] !== (res.answers || {})[id]);
    if (pending.length) {
      fill(draft);
      pending.forEach((id) => dirty.add(id));
      save();
    }
    if (res.meta?.updatedAt) {
      setSave('', `Dernière mise à jour : ${new Date(res.meta.updatedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}${res.meta.updatedBy ? ` · ${res.meta.updatedBy}` : ''}`);
    }
  }).catch((e) => {
    setSave('is-error', 'Réponses indisponibles');
    toast(`Chargement des réponses impossible : ${e.message}`, true);
  });
  return ctl;
}

/* ---------- réservation ---------- */
function setupBooking(d) {
  const el = $('#booking');
  const w = state.config.window;
  const s = { booking: null, editing: false, month: w.start.slice(0, 7), date: null, time: null };

  const load = async () => {
    try {
      const r = await api(`/api/bookings?dept=${d.slug}`);
      s.booking = r.booking;
    } catch (e) {
      el.innerHTML = `<p class="notice">${esc(e.message)}</p>`;
      return;
    }
    render();
  };

  const freeTimes = (date) => {
    const taken = takenSlots(d.slug);
    const dow = utc(date).getUTCDay();
    return (SLOTS[dow] || []).map((t) => ({ t, free: !taken.has(`${date}T${t}`) }));
  };
  const dayState = (date) => {
    if (date < w.start || date > w.end) return 'off';
    const ts = freeTimes(date);
    if (!ts.length) return 'off';
    return ts.some((x) => x.free) ? 'open' : 'full';
  };

  function calendar() {
    const [y, m] = s.month.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const lead = (first.getUTCDay() + 6) % 7; // lundi en premier
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<span></span>');
    for (let day = 1; day <= days; day++) {
      const date = iso(new Date(Date.UTC(y, m - 1, day)));
      const st = dayState(date);
      cells.push(`<button type="button" class="cal__day ${st === 'open' ? 'is-open' : ''} ${st === 'full' ? 'is-full' : ''} ${s.date === date ? 'is-sel' : ''}" ${st === 'open' ? `data-date="${date}"` : 'disabled'} aria-label="${esc(fmtLong(date))}${st === 'open' ? ' — créneaux disponibles' : ''}">${day}</button>`);
    }
    const title = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return `<div class="cal">
      <div class="cal__head"><button type="button" class="cal__nav" data-nav="-1" ${s.month <= w.start.slice(0, 7) ? 'disabled' : ''} aria-label="Mois précédent">‹</button><b>${esc(title)}</b><button type="button" class="cal__nav" data-nav="1" ${s.month >= w.end.slice(0, 7) ? 'disabled' : ''} aria-label="Mois suivant">›</button></div>
      <div class="cal__grid">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x) => `<span class="cal__dow">${x}</span>`).join('')}${cells.join('')}</div>
    </div>
    ${s.date ? `<div class="slots">${freeTimes(s.date).map(({ t, free }) => `<button type="button" class="slot ${s.time === t ? 'is-sel' : ''}" data-time="${t}" ${free ? '' : 'disabled'}>${fmtTime(t)}<small>${free ? `→ ${addMin(t, DURATION_MIN)}` : 'réservé'}</small></button>`).join('')}</div>`
      : ''}`;
  }

  function form() {
    if (!s.date || !s.time) return `<div class="pick-hint">${s.date ? 'Choisissez maintenant une heure.' : 'Choisissez un jour dans le calendrier.'}</div>`;
    const b = s.booking;
    const needEmail = b && s.editing;
    return `<form class="booking-form" id="bform" novalidate>
      <div class="picked">Créneau choisi : <b>${esc(fmtLong(s.date))}</b> à <b>${fmtTime(s.time)}</b></div>
      ${needEmail ? `<label class="field">E-mail utilisé lors de la réservation<input name="currentEmail" type="email" required placeholder="${esc(b.email)}"><small>Nécessaire pour modifier un rendez-vous existant.</small></label>` : ''}
      <label class="field">Votre nom *<input name="name" required value="${esc(b?.name || '')}" autocomplete="name"></label>
      <div class="grid-2">
        <label class="field">E-mail *<input name="email" type="email" required autocomplete="email" placeholder="prenom.nom@sones.sn"></label>
        <label class="field">Téléphone (facultatif)<input name="phone" type="tel" value="${esc(b?.phone || '')}" autocomplete="tel"></label>
      </div>
      <div class="field">Modalité
        <div class="seg"><label><input type="radio" name="mode" value="presentiel" ${b?.mode !== 'visio' ? 'checked' : ''}>Présentiel</label><label><input type="radio" name="mode" value="visio" ${b?.mode === 'visio' ? 'checked' : ''}>Visioconférence</label></div>
      </div>
      <p class="notice hidden" data-err></p>
      <button class="btn btn--primary" type="submit">${b ? 'Confirmer le nouveau créneau' : 'Confirmer le rendez-vous'}</button>
      <p class="muted" style="font-size:.8rem">Vous recevrez un e-mail de confirmation.</p>
    </form>`;
  }

  function render() {
    const b = s.booking;
    if (state.config.storeKind === 'none') {
      el.innerHTML = `<p class="notice">La réservation en ligne n'est pas encore activée (stockage non configuré).</p>`;
      return;
    }
    if (b && !s.editing) {
      el.innerHTML = `<div class="done">
          <div class="done__icon">✓</div>
          <div class="done__title">Terminé</div>
          <p class="done__text">Votre entretien est confirmé le <b>${esc(fmtLong(b.date))}</b> à <b>${fmtTime(b.time)}</b> (heure de Dakar)${b.mode === 'visio' ? ', en visioconférence' : `, ${esc(state.config.place)}`}.</p>
          <a class="btn btn--cta btn--pulse" href="#/s/${d.slug}/questionnaire">Consulter le questionnaire →</a>
          <p class="done__hint">Parcourez les questions et apportez vos premiers éléments de réponse avant l'entretien.</p>
          <div class="done__links">
            <a href="#" data-act="ics">Ajouter à mon agenda</a> · <a href="#" data-act="edit">Modifier la date</a> · <a href="#" data-act="cancel">Annuler</a>
          </div>
        </div>`;
      return;
    }
    el.innerHTML = `<div class="step__head"><span class="step__n">1</span><h2>Choisissez la date de votre entretien</h2></div><p class="muted" style="font-size:.9rem">Choisissez un jour, puis une heure. Durée : 1 h 30 à 2 h (heure de Dakar).${b ? ' <a href="#" data-act="back" style="color:var(--blue);font-weight:600">Garder le rendez-vous actuel</a>' : ''}</p>
      <div class="booking-grid"><div>${calendar()}</div><div>${form()}</div></div>`;
    if (s.date && s.time) $('#bform [name=name]')?.focus({ preventScroll: true });
  }

  el.addEventListener('click', async (e) => {
    const t = e.target.closest('button,[data-act]');
    if (!t) return;
    if (t.dataset.nav) {
      const [y, m] = s.month.split('-').map(Number);
      s.month = iso(new Date(Date.UTC(y, m - 1 + Number(t.dataset.nav), 1))).slice(0, 7);
      return render();
    }
    if (t.dataset.date) { s.date = t.dataset.date; s.time = null; return render(); }
    if (t.dataset.time) { s.time = t.dataset.time; render(); $('#bform')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
    const act = t.dataset.act;
    if (!act) return;
    e.preventDefault();
    if (act === 'edit') { s.editing = true; s.date = null; s.time = null; return render(); }
    if (act === 'back') { s.editing = false; return render(); }
    if (act === 'ics') return downloadIcs(d, s.booking);
    if (act === 'cancel') {
      const email = await askEmail('Annuler le rendez-vous', "Pour confirmer l'annulation, indiquez l'adresse e-mail utilisée lors de la réservation. Un e-mail d'annulation sera envoyé.", 'Annuler le rendez-vous');
      if (email == null) return;
      try {
        const r = await api(`/api/bookings?dept=${d.slug}`, { method: 'DELETE', body: { email } });
        s.booking = null; s.editing = false; s.date = s.time = null;
        await loadConfig();
        render();
        toast(r.mail?.sent ? "Rendez-vous annulé — e-mail d'annulation envoyé." : 'Rendez-vous annulé.');
      } catch (err) { toast(err.message, true); }
    }
  });

  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const data = Object.fromEntries(new FormData(f));
    const err = $('[data-err]', f);
    const show = (m) => { err.textContent = m; err.classList.remove('hidden'); };
    if (!data.name.trim()) return show("Indiquez le nom de l'interviewé(e).");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) return show('Indiquez une adresse e-mail valide.');
    const btn = $('button[type=submit]', f);
    btn.disabled = true; btn.textContent = 'Envoi…';
    try {
      const r = await api('/api/bookings', { method: 'POST', body: { ...data, dept: d.slug, date: s.date, time: s.time } });
      s.booking = r.booking; s.editing = false;
      await loadConfig();
      render();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (r.mail?.sent) toast(`Rendez-vous confirmé — e-mail envoyé à ${data.email.trim()}.`);
      else toast(`Rendez-vous enregistré. L'e-mail n'a pas pu être envoyé${r.mail?.reason ? ` (${r.mail.reason})` : ''} : utilisez « Ajouter à mon agenda ».`, true);
    } catch (ex) {
      if (ex.status === 409) { await loadConfig(); s.time = null; render(); toast(ex.message, true); return; }
      show(ex.message);
      btn.disabled = false; btn.textContent = 'Réessayer';
    }
  });

  load();
}

function askEmail(title, text, cta) {
  return new Promise((resolve) => {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<form class="modal__box"><h2 style="font-size:1.2rem">${esc(title)}</h2><p class="muted" style="font-size:.9rem">${esc(text)}</p>
      <label class="field">E-mail<input type="email" name="email" required autofocus></label>
      <div class="row-actions" style="justify-content:flex-end"><button type="button" class="btn btn--ghost btn--sm" data-x>Fermer</button><button class="btn btn--danger btn--sm">${esc(cta)}</button></div></form>`;
    document.body.append(m);
    const close = (v) => { m.remove(); resolve(v); };
    $('[data-x]', m).onclick = () => close(null);
    m.addEventListener('click', (e) => { if (e.target === m) close(null); });
    $('form', m).onsubmit = (e) => { e.preventDefault(); close(new FormData(e.target).get('email').trim()); };
  });
}

function downloadIcs(d, b) {
  const p = (n) => String(n).padStart(2, '0');
  const stamp = (x) => `${x.getUTCFullYear()}${p(x.getUTCMonth() + 1)}${p(x.getUTCDate())}T${p(x.getUTCHours())}${p(x.getUTCMinutes())}00Z`;
  const start = new Date(`${b.date}T${b.time}:00Z`);
  const end = new Date(start.getTime() + DURATION_MIN * 60000);
  const e = (s) => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const link = `${location.origin}${location.pathname}#/s/${d.slug}`;
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PSD SONES 2026-2030//Entretiens//FR', 'BEGIN:VEVENT',
    `UID:${b.id}@psd-sones`, `SEQUENCE:${b.seq || 0}`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${e(`Entretien PSD 2026-2030 — ${d.name}`)}`,
    `DESCRIPTION:${e(`Entretien stratégique PSD 2026-2030 / Contrat de Performance État-SONES.\nGuide et réponses : ${link}`)}`,
    `LOCATION:${e(b.mode === 'visio' ? 'Visioconférence' : state.config.place)}`, `URL:${link}`,
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Entretien PSD SONES', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `entretien-psd-sones-${d.slug}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ------------------------------------------------------------ espace consultant */
async function renderAdmin(sub) {
  if (!session.get('psd-admin')) return adminLogin();
  let data;
  try {
    data = await api(`/api/admin${sub === 'compilation' ? '?answers=1' : ''}`);
  } catch (e) {
    if (e.status === 401) { session.del('psd-admin'); return adminLogin('Mot de passe incorrect.'); }
    app.innerHTML = `<div class="container section"><div class="empty">${esc(e.message)}</div></div>`;
    return;
  }
  if (sub === 'compilation') return renderCompilation(data);

  const rows = data.rows.map((r) => ({ ...r, d: bySlug[r.slug] }));
  rows.sort((a, b) => ((a.booking ? a.booking.date + a.booking.time : 'z') + a.d.name).localeCompare((b.booking ? b.booking.date + b.booking.time : 'z') + b.d.name));
  const planned = rows.filter((r) => r.booking).length;
  const started = rows.filter((r) => r.progress?.filled).length;
  const base = `${location.origin}${location.pathname}`;

  app.innerHTML = `<section class="dhead"><div class="container">
      <div class="crumb"><a href="#/">Accueil</a><span>›</span><span>Espace consultant</span></div>
      <h1>Suivi des entretiens</h1>
      <p>Rendez-vous, contacts et avancement des réponses préliminaires par structure.</p>
    </div></section>
    <div class="container section" style="padding-top:28px">
      <div class="kpis">
        <div class="kpi"><b>${planned} / ${rows.length}</b><span>entretiens planifiés</span></div>
        <div class="kpi"><b>${started}</b><span>structures ayant commencé leurs réponses</span></div>
        <div class="kpi"><b>${data.mailKind === 'none' ? 'Non configuré' : data.mailKind.toUpperCase()}</b><span>envoi des e-mails${data.consultant ? ` · copie à ${esc(data.consultant)}` : ''}</span></div>
        <div class="kpi"><b>${data.storeKind === 'redis' ? 'Redis' : data.storeKind === 'file' ? 'Fichier local' : 'Non configuré'}</b><span>stockage</span></div>
      </div>
      <div class="row-actions" style="margin-bottom:14px">
        <a class="btn btn--primary btn--sm" href="#/admin/compilation">Compilation des réponses</a>
        <button class="btn btn--ghost btn--sm" data-act="csv">Exporter les rendez-vous (CSV)</button>
        <button class="btn btn--ghost btn--sm" data-act="links">Copier tous les liens</button>
        <button class="btn btn--ghost btn--sm" data-act="logout">Déconnexion</button>
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Structure</th><th>Date</th><th>Interviewé(e)</th><th>Contact</th><th>Modalité</th><th>Réponses</th><th></th></tr></thead>
        <tbody>${rows.map((r) => {
          const b = r.booking, p = r.progress;
          const pct = p?.total ? Math.round((p.filled / p.total) * 100) : 0;
          return `<tr>
            <td><a href="#/s/${r.slug}" style="font-weight:600;color:var(--blue)">${esc(r.d.short)}</a><div class="muted" style="font-size:.78rem">${esc(r.d.name)}</div></td>
            <td class="nowrap">${b ? `${esc(fmtShort(b.date))}<br><b>${fmtTime(b.time)}</b>` : '<span class="chip chip--todo">À planifier</span>'}</td>
            <td>${b ? `${esc(b.name)}<div class="muted" style="font-size:.78rem">${esc(b.role)}</div>` : ''}</td>
            <td>${b ? `<a href="mailto:${esc(b.email)}">${esc(b.email)}</a><div class="muted" style="font-size:.78rem">${esc(b.phone)}</div>${b.participants ? `<div class="muted" style="font-size:.78rem">+ ${esc(b.participants)}</div>` : ''}` : ''}</td>
            <td>${b ? (b.mode === 'visio' ? 'Visio' : 'Présentiel') : ''}${b?.notes ? `<div class="muted" style="font-size:.78rem">${esc(b.notes)}</div>` : ''}</td>
            <td style="min-width:110px"><div class="bar"><i style="width:${pct}%"></i></div><span class="bar-label">${p ? `${p.filled}/${p.total}` : '—'}</span></td>
            <td class="nowrap"><button class="btn btn--ghost btn--sm" data-copy="${esc(base + '#/s/' + r.slug)}">Lien</button>${b ? ` <button class="btn btn--danger btn--sm" data-cancel="${r.slug}">Annuler</button>` : ''}</td>
          </tr>`;
        }).join('')}</tbody></table></div>
    </div>`;

  app.onclick = async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.copy) { await navigator.clipboard?.writeText(t.dataset.copy).catch(() => {}); return toast('Lien copié.'); }
    if (t.dataset.cancel) {
      if (!confirm(`Annuler l'entretien de ${bySlug[t.dataset.cancel].name} ? Un e-mail d'annulation sera envoyé.`)) return;
      try { await api(`/api/bookings?dept=${t.dataset.cancel}`, { method: 'DELETE', body: {} }); await loadConfig(); toast('Entretien annulé.'); renderAdmin(); } catch (err) { toast(err.message, true); }
      return;
    }
    const act = t.dataset.act;
    if (act === 'logout') { session.del('psd-admin'); location.hash = '#/'; }
    if (act === 'links') {
      const txt = rows.map((r) => `${r.d.name} : ${base}#/s/${r.slug}`).join('\n');
      await navigator.clipboard?.writeText(txt).catch(() => {});
      toast('Liste des liens copiée.');
    }
    if (act === 'csv') {
      const head = ['Structure', 'Sigle', 'Date', 'Heure', 'Interviewé', 'Fonction', 'Email', 'Téléphone', 'Participants', 'Modalité', 'Remarques', 'Réponses', 'Total questions'];
      const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = rows.map((r) => { const b = r.booking || {}; return [r.d.name, r.d.short, b.date, b.time, b.name, b.role, b.email, b.phone, b.participants, b.mode, b.notes, r.progress?.filled, r.progress?.total].map(q).join(';'); });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + [head.map(q).join(';'), ...lines].join('\r\n')], { type: 'text/csv' }));
      a.download = 'entretiens-psd-sones.csv';
      a.click();
    }
  };
  cleanup = () => { app.onclick = null; };
}

function adminLogin(err = '') {
  app.innerHTML = `<div class="container"><form class="card login" id="login">
    <div class="card__kicker">Espace consultant</div><h2>Connexion</h2>
    <label class="field" style="margin-top:.8rem">Mot de passe<input type="password" name="pw" required autofocus></label>
    ${err ? `<p class="notice" style="margin-top:.8rem">${esc(err)}</p>` : ''}
    <button class="btn btn--primary" style="margin-top:1rem;width:100%">Se connecter</button></form></div>`;
  $('#login').onsubmit = (e) => { e.preventDefault(); session.set('psd-admin', new FormData(e.target).get('pw')); renderAdmin(); };
}

function renderCompilation(data) {
  const rows = [...data.rows].sort((a, b) => (b.progress?.filled || 0) - (a.progress?.filled || 0));
  const blocks = rows.map((r) => {
    const d = bySlug[r.slug];
    const g = guideFor(d);
    const a = r.answers?.answers || {};
    const qa = [];
    for (const s of g.sections) {
      const items = [];
      for (const it of s.items) {
        if (it.type !== 'q') continue;
        const one = (x, parentLabel) => { if (x.answer && (a[x.id] || '').trim()) items.push(`<div class="q"><div class="q__label">${esc(x.label || parentLabel || '')}</div><div class="q__text muted">${esc(x.text)}</div><div class="print-answer" style="display:block;white-space:pre-wrap;margin-top:.4rem;background:var(--paper);border-radius:10px;padding:.6rem .8rem">${esc(a[x.id])}</div></div>`); };
        one(it);
        (it.children || []).forEach((c) => one(c, it.label));
      }
      if (items.length) qa.push(`<div class="subhead">${esc(s.code)} · ${esc(s.title)}</div>${items.join('')}`);
    }
    const b = r.booking;
    return `<section class="module"><div class="module__head"><span class="module__code">${esc(d.short)}</span><h3>${esc(d.name)}</h3></div>
      <div class="module__body"><p class="muted" style="margin-top:.8rem;font-size:.85rem">${b ? `Entretien : ${esc(fmtLong(b.date))} à ${fmtTime(b.time)} — ${esc(b.name)}` : 'Entretien non planifié'}${r.answers?.meta?.updatedBy ? ` · Réponses : ${esc(r.answers.meta.updatedBy)}` : ''}</p>
      ${qa.join('') || '<p class="muted" style="padding:.8rem 0">Aucune réponse préliminaire.</p>'}</div></section>`;
  });
  app.innerHTML = `<section class="dhead"><div class="container">
      <div class="crumb no-print"><a href="#/admin">Espace consultant</a><span>›</span><span>Compilation</span></div>
      <h1>Compilation des réponses préliminaires</h1><p>Toutes structures · générée le ${new Date().toLocaleString('fr-FR')}</p>
      <button class="btn btn--light btn--sm no-print" style="margin-top:1rem" onclick="print()">Imprimer / PDF</button>
    </div></section>
    <div class="container" style="padding-top:28px;padding-bottom:60px">${blocks.join('')}</div>`;
}

route();
