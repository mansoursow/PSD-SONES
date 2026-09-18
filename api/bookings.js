// GET    /api/bookings?dept=slug            → rendez-vous de la structure (e-mail masqué)
// POST   /api/bookings  {dept, date, time…}  → réserve ou reprogramme + e-mail de confirmation
// DELETE /api/bookings?dept=slug {email}    → annule + e-mail d'annulation
import { handler, send, readBody, query, checkAccess, fail, siteUrl } from '../lib/http.js';
import * as store from '../lib/store.js';
import { buildIcs, bookingEmail, sendMail, consultantEmails } from '../lib/mail.js';
import { getDept, sanitizeBooking, slotKey, bookingKey, ccList, newId } from '../lib/bookings.js';

const mask = (e) => e.replace(/^(.{2})[^@]*/, (m, a) => a + '•••');
const publicView = (b) => b && { ...b, email: mask(b.email), participants: b.participants ? '(renseignés)' : '' };

const isAdmin = (req) => process.env.ADMIN_PASSWORD && req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;

async function notify(req, dept, booking, kind) {
  const link = `${siteUrl(req)}/#/s/${dept.slug}${kind === 'cancel' ? '' : '/questionnaire'}`;
  const { subject, html } = bookingEmail({ booking, dept, link, kind });
  const ics = buildIcs({ booking, dept, link, cancel: kind === 'cancel' });
  try {
    return await sendMail({
      to: booking.email,
      cc: [...ccList(booking), ...consultantEmails()],
      subject, html, ics,
    });
  } catch (e) {
    console.error('mail', e);
    return { sent: false, reason: e.message };
  }
}

export default handler(async (req, res) => {
  checkAccess(req);
  const q = query(req);

  if (req.method === 'GET') {
    const dept = getDept(q.dept);
    return send(res, 200, { booking: publicView(await store.get(bookingKey(dept.slug))) });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const dept = getDept(body.dept);
    const b = sanitizeBooking(body);
    const prev = await store.get(bookingKey(dept.slug));
    if (prev && !isAdmin(req) && prev.email !== b.email && (body.currentEmail || '').trim().toLowerCase() !== prev.email) {
      throw fail(403, "Un entretien est déjà planifié pour cette structure. Pour le modifier, indiquez l'adresse e-mail utilisée lors de la réservation.");
    }
    const sameSlot = prev && prev.date === b.date && prev.time === b.time;
    if (!sameSlot) {
      const ok = await store.setNX(slotKey(b.date, b.time), dept.slug);
      if (!ok) {
        const owner = await store.get(slotKey(b.date, b.time));
        if (owner !== dept.slug) throw fail(409, 'Ce créneau vient d\'être réservé par une autre structure. Merci d\'en choisir un autre.');
      }
      if (prev) await store.del(slotKey(prev.date, prev.time));
    }
    const booking = {
      ...b,
      id: prev?.id || newId(),
      seq: prev ? (prev.seq || 0) + 1 : 0,
      dept: dept.slug,
      createdAt: prev?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.set(bookingKey(dept.slug), booking);
    const mail = await notify(req, dept, booking, prev ? 'update' : 'new');
    return send(res, 200, { booking: publicView(booking), mail });
  }

  if (req.method === 'DELETE') {
    const dept = getDept(q.dept);
    const body = await readBody(req).catch(() => ({}));
    const prev = await store.get(bookingKey(dept.slug));
    if (!prev) return send(res, 200, { ok: true });
    if (!isAdmin(req) && (body.email || '').trim().toLowerCase() !== prev.email) {
      throw fail(403, "Indiquez l'adresse e-mail utilisée lors de la réservation pour annuler.");
    }
    await store.del(slotKey(prev.date, prev.time));
    await store.del(bookingKey(dept.slug));
    const mail = await notify(req, dept, { ...prev, seq: (prev.seq || 0) + 1 }, 'cancel');
    return send(res, 200, { ok: true, mail });
  }

  throw fail(405, 'Méthode non autorisée');
});
