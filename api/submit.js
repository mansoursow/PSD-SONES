// POST /api/submit {dept} → marque le questionnaire comme soumis et envoie les réponses par e-mail
// (à la personne qui a réservé l'entretien, copie aux consultants).
import { createRequire } from 'node:module';
import { handler, send, readBody, checkAccess, fail, siteUrl } from '../lib/http.js';
import * as store from '../lib/store.js';
import { sendMail, consultantEmails, formatWhen } from '../lib/mail.js';
import { getDept, answersKey, bookingKey, progressKey } from '../lib/bookings.js';

const guides = createRequire(import.meta.url)('../public/data/guides.json');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function answersHtml(guide, answers) {
  const row = (label, text, answer) => `
    <div style="padding:12px 0;border-bottom:1px solid #e5e8ef">
      ${label ? `<div style="font-weight:700;color:#0a2f73">${esc(label)}</div>` : ''}
      <div style="color:#4b5563;font-size:14px">${esc(text)}</div>
      <div style="margin-top:6px;padding:10px 12px;border-radius:10px;white-space:pre-wrap;${answer ? 'background:#f5f7fb;color:#0a1f44' : 'background:#fff7f2;color:#b45309;font-style:italic'}">${answer ? esc(answer) : 'Sans réponse'}</div>
    </div>`;
  return guide.sections.map((s) => {
    const items = [];
    for (const it of s.items) {
      if (it.type !== 'q') continue;
      if (it.answer) items.push(row(it.label, it.text, (answers[it.id] || '').trim()));
      for (const c of it.children || []) if (c.answer) items.push(row(c.label || it.label, c.text, (answers[c.id] || '').trim()));
    }
    return `<h3 style="margin:26px 0 4px;font-size:15px;color:#fff;background:#0a2f73;border-radius:8px;padding:8px 12px">${esc(s.code)} · ${esc(s.title)}</h3>${items.join('')}`;
  }).join('');
}

export default handler(async (req, res) => {
  checkAccess(req);
  if (req.method !== 'POST') throw fail(405, 'Méthode non autorisée');
  const body = await readBody(req);
  const dept = getDept(body.dept);
  const guide = guides[dept.guide || 'generic'];
  const [{ answers }, booking] = await Promise.all([store.getFields(answersKey(dept.slug)), store.get(bookingKey(dept.slug))]);

  const ids = [];
  for (const s of guide.sections) for (const it of s.items) {
    if (it.type !== 'q') continue;
    if (it.answer) ids.push(it.id);
    for (const c of it.children || []) if (c.answer) ids.push(c.id);
  }
  const filled = ids.filter((id) => (answers[id] || '').trim()).length;
  if (!filled) throw fail(400, 'Renseignez au moins une réponse avant de soumettre le questionnaire.');

  const now = new Date().toISOString();
  await store.mergeFields(answersKey(dept.slug), {}, { submittedAt: now });
  await store.set(progressKey(dept.slug), { filled, total: ids.length, updatedAt: now, submittedAt: now });

  const link = `${siteUrl(req)}/#/s/${dept.slug}/questionnaire`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0a1f44">
  <div style="max-width:680px;margin:0 auto;padding:28px 18px">
    <div style="background:linear-gradient(150deg,#061f4d,#0a2f73);border-radius:18px 18px 0 0;padding:26px 28px;color:#fff">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#ff8a4c;font-weight:700">SONES · PSD 2026–2030</div>
      <div style="font-size:22px;font-weight:700;margin-top:8px">Questionnaire soumis — ${esc(dept.name)}</div>
    </div>
    <div style="background:#fff;border-radius:0 0 18px 18px;padding:26px 28px;line-height:1.55;font-size:15px">
      <p>${booking ? `Bonjour ${esc(booking.name)},` : 'Bonjour,'}</p>
      <p>Merci : les réponses préliminaires de la structure <b>${esc(dept.name)}</b> ont bien été transmises à l'équipe du consultant
      (<b>${filled} question${filled > 1 ? 's' : ''} renseignée${filled > 1 ? 's' : ''} sur ${ids.length}</b>).
      ${booking ? `Elles serviront de base à l'entretien du <b>${esc(formatWhen(booking))}</b>.` : ''}</p>
      <p>Vous pouvez encore compléter ou modifier vos réponses jusqu'à l'entretien :</p>
      <p style="margin:18px 0"><a href="${esc(link)}" style="background:#e64501;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">Revoir le questionnaire</a></p>
      <div style="margin-top:10px">${answersHtml(guide, answers)}</div>
      <p style="margin-top:22px">Cordialement,<br>L'équipe du consultant — PSD SONES 2026–2030</p>
    </div>
  </div></body></html>`;

  const to = booking?.email || consultantEmails()[0];
  let mail = { sent: false, reason: 'Aucun destinataire' };
  if (to) {
    try {
      mail = await sendMail({ to, cc: consultantEmails(), subject: `Questionnaire soumis — PSD SONES — ${dept.name}`, html });
    } catch (e) {
      console.error('mail', e);
      mail = { sent: false, reason: e.message };
    }
  }
  send(res, 200, { ok: true, submittedAt: now, filled, total: ids.length, mail, to: booking ? 'interviewee' : 'consultant' });
});
