// Configuration publique + état de l'organigramme (créneaux pris, avancement des réponses).
import { handler, send, checkAccess } from '../lib/http.js';
import { storeKind } from '../lib/store.js';
import { mailKind } from '../lib/mail.js';
import { bookingWindow, allBookings } from '../lib/bookings.js';

export default handler(async (req, res) => {
  const base = {
    accessRequired: !!process.env.ACCESS_CODE,
    storeKind,
    mailEnabled: mailKind !== 'none',
    place: process.env.MEETING_PLACE || 'Siège de la SONES, Dakar',
    window: bookingWindow(),
  };
  try {
    checkAccess(req);
  } catch {
    return send(res, 200, { ...base, locked: true });
  }
  if (storeKind === 'none') return send(res, 200, { ...base, status: [] });
  const all = await allBookings();
  send(res, 200, {
    ...base,
    status: all.map(({ slug, booking, progress }) => ({
      slug,
      booking: booking ? { date: booking.date, time: booking.time, mode: booking.mode } : null,
      progress: progress ? { filled: progress.filled, total: progress.total, updatedAt: progress.updatedAt } : null,
    })),
  });
});
