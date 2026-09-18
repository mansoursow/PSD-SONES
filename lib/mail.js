// Envoi des e-mails de rendez-vous.
// Priorité : RESEND_API_KEY (API Resend) sinon SMTP (SMTP_HOST/SMTP_USER/SMTP_PASS, ex. Gmail + mot de passe d'application).
import { DURATION_MIN } from '../public/js/departments.js';

// CONSULTANT_EMAIL peut contenir plusieurs adresses séparées par « , » ou « ; ».
export const consultantEmails = () => (process.env.CONSULTANT_EMAIL || '').split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);

export const mailKind = process.env.RESEND_API_KEY ? 'resend' : process.env.SMTP_HOST ? 'smtp' : 'none';
const FROM = process.env.MAIL_FROM || (process.env.SMTP_USER ? `PSD SONES 2026-2030 <${process.env.SMTP_USER}>` : 'PSD SONES <onboarding@resend.dev>');

const pad = (n) => String(n).padStart(2, '0');
const icsDate = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const icsEsc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

// Dakar = UTC toute l'année : "2026-10-05" + "09:00" => instant UTC direct.
export const slotStart = (date, time) => new Date(`${date}T${time}:00Z`);

export function buildIcs({ booking, dept, link, cancel = false }) {
  const start = slotStart(booking.date, booking.time);
  const end = new Date(start.getTime() + DURATION_MIN * 60000);
  const organizer = consultantEmails()[0] || '';
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PSD SONES 2026-2030//Entretiens//FR',
    `METHOD:${cancel ? 'CANCEL' : 'REQUEST'}`, 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${booking.id}@psd-sones`,
    `SEQUENCE:${booking.seq || 0}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEsc(`Entretien PSD 2026-2030 — ${dept.name}`)}`,
    `DESCRIPTION:${icsEsc(`Entretien stratégique dans le cadre de l'élaboration du PSD 2026-2030 et du Contrat de Performance État-SONES.\nGuide d'entretien et saisie des réponses : ${link}`)}`,
    `LOCATION:${icsEsc(booking.mode === 'visio' ? 'Visioconférence (lien communiqué par le consultant)' : process.env.MEETING_PLACE || 'Siège de la SONES, Dakar')}`,
    `URL:${link}`,
    organizer ? `ORGANIZER;CN=Consultant PSD:mailto:${organizer}` : null,
    `ATTENDEE;CN=${icsEsc(booking.name)};ROLE=REQ-PARTICIPANT:mailto:${booking.email}`,
    `STATUS:${cancel ? 'CANCELLED' : 'CONFIRMED'}`,
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Entretien PSD SONES', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function formatWhen(booking) {
  const d = slotStart(booking.date, booking.time);
  const day = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `${day} à ${booking.time.replace(':', 'h')}`;
}

export function bookingEmail({ booking, dept, link, kind }) {
  const when = formatWhen(booking);
  const titles = {
    new: 'Votre entretien est confirmé',
    update: 'Votre entretien a été reprogrammé',
    cancel: 'Votre entretien a été annulé',
  };
  const place = booking.mode === 'visio' ? 'Visioconférence — le lien vous sera communiqué' : esc(process.env.MEETING_PLACE || 'Siège de la SONES, Dakar');
  const body = kind === 'cancel'
    ? `<p>L'entretien prévu le <b>${esc(when)}</b> avec la structure <b>${esc(dept.name)}</b> a été annulé.</p>
       <p>Vous pouvez choisir un nouveau créneau à tout moment :</p>`
    : `<p>Bonjour ${esc(booking.name)},</p>
       <p>Dans le cadre de l'élaboration du <b>Plan Stratégique de Développement (PSD) 2026–2030</b> et du <b>Contrat de Performance État–SONES</b>, votre entretien stratégique est fixé :</p>
       <table style="border-collapse:collapse;margin:14px 0;font-size:15px">
         <tr><td style="padding:6px 14px 6px 0;color:#4a5c74">Structure</td><td style="padding:6px 0"><b>${esc(dept.name)}</b></td></tr>
         <tr><td style="padding:6px 14px 6px 0;color:#4a5c74">Date</td><td style="padding:6px 0"><b>${esc(when)}</b> (heure de Dakar)</td></tr>
         <tr><td style="padding:6px 14px 6px 0;color:#4a5c74">Durée</td><td style="padding:6px 0">1 h 30 à 2 h</td></tr>
         <tr><td style="padding:6px 14px 6px 0;color:#4a5c74">Lieu</td><td style="padding:6px 0">${place}</td></tr>
       </table>
       <p>Le questionnaire de l'entretien est disponible en ligne. Nous vous invitons à le parcourir et à y <b>apporter des premiers éléments de réponse</b> avant la rencontre : ils sont enregistrés automatiquement et permettront de consacrer l'entretien aux points essentiels.</p>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#10233f">
  <div style="max-width:600px;margin:0 auto;padding:28px 18px">
    <div style="background:linear-gradient(150deg,#061f4d,#0a2f73);border-radius:18px 18px 0 0;padding:26px 28px;color:#fff">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#ff8a4c;font-weight:700">SONES · PSD 2026–2030</div>
      <div style="font-size:22px;font-weight:700;margin-top:8px">${titles[kind]}</div>
    </div>
    <div style="background:#fff;border-radius:0 0 18px 18px;padding:26px 28px;line-height:1.6;font-size:15px">
      ${body}
      <p style="margin:24px 0"><a href="${esc(link)}" style="background:#e64501;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">${kind === 'cancel' ? 'Choisir un nouveau créneau' : 'Consulter le questionnaire'}</a></p>
      ${kind !== 'cancel' ? '<p style="font-size:13px;color:#4a5c74">L\'invitation est jointe à ce message (fichier .ics) pour l\'ajouter à votre agenda. Pour modifier le créneau, rendez-vous sur la même page.</p>' : ''}
      <p style="margin-top:22px">Cordialement,<br>L'équipe du consultant — PSD SONES 2026–2030</p>
    </div>
  </div></body></html>`;
  const subject = `${kind === 'cancel' ? 'Annulation' : kind === 'update' ? 'Report' : 'Confirmation'} — Entretien PSD SONES — ${dept.name} — ${when}`;
  return { subject, html };
}

export async function sendMail({ to, cc, subject, html, ics }) {
  if (mailKind === 'none') return { sent: false, reason: 'Envoi e-mail non configuré' };
  const recipients = [to].flat().filter(Boolean);
  const copies = [cc].flat().filter(Boolean).filter((c) => !recipients.includes(c));
  if (mailKind === 'resend') {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM, to: recipients, cc: copies.length ? copies : undefined, subject, html,
        attachments: ics ? [{ filename: 'entretien-psd-sones.ics', content: Buffer.from(ics).toString('base64') }] : undefined,
      }),
    });
    if (!r.ok) return { sent: false, reason: `Resend ${r.status}: ${await r.text()}` };
    return { sent: true };
  }
  const nodemailer = (await import('nodemailer')).default;
  const t = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS || '').replace(/\s+/g, '') },
  });
  await t.sendMail({
    from: FROM, to: recipients, cc: copies, subject, html,
    icalEvent: ics ? { filename: 'entretien-psd-sones.ics', method: ics.includes('METHOD:CANCEL') ? 'CANCEL' : 'REQUEST', content: ics } : undefined,
  });
  return { sent: true };
}
