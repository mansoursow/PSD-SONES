// GET /api/admin               → tous les rendez-vous (données complètes) + avancement
// GET /api/admin?answers=1     → idem + toutes les réponses préliminaires (export)
import { handler, send, query, checkAdmin, checkDispatcher, isDispatcher } from '../lib/http.js';
import * as store from '../lib/store.js';
import { mailKind, consultantEmails } from '../lib/mail.js';
import { allBookings, answersKey } from '../lib/bookings.js';

export default handler(async (req, res) => {
  // Le code de répartition donne accès à la liste des rendez-vous, mais pas aux réponses des questionnaires.
  const admin = !!process.env.ADMIN_PASSWORD && req.headers['x-admin-password'] === process.env.ADMIN_PASSWORD;
  if (admin) checkAdmin(req);
  else checkDispatcher(req);
  const rows = await allBookings();
  if (admin && query(req).answers) {
    await Promise.all(rows.map(async (r) => { r.answers = await store.getFields(answersKey(r.slug)); }));
  }
  send(res, 200, { rows, storeKind: store.storeKind, mailKind, consultant: consultantEmails().join(', ') || null });
});
