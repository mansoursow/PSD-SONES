import crypto from 'node:crypto';
import { bySlug, isActive, isDone, isCp, cpDept, SLOTS, BLOCKED_DATES } from '../public/js/departments.js';
import * as store from './store.js';
import { fail } from './http.js';

const iso = (d) => d.toISOString().slice(0, 10);

// Fenêtre de réservation : BOOKING_START / BOOKING_END (AAAA-MM-JJ), sinon J+1 → J+60.
export function bookingWindow() {
  const tomorrow = new Date(Date.now() + 86400000);
  const start = process.env.BOOKING_START && process.env.BOOKING_START > iso(tomorrow) ? process.env.BOOKING_START : iso(tomorrow);
  const end = process.env.BOOKING_END || iso(new Date(Date.now() + 60 * 86400000));
  return { start, end };
}

export function validSlot(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(time || '')) return false;
  const { start, end } = bookingWindow();
  if (date < start || date > end) return false;
  if (BLOCKED_DATES.includes(date)) return false;
  const dow = new Date(date + 'T12:00:00Z').getUTCDay();
  return (SLOTS[dow] || []).includes(time);
}

export const cpIndexKey = 'cp:index';
export const cpProfileKey = (slug) => `cp:profile:${slug}`;

// Structure de l'organigramme, ou espace d'un chef de projet inscrit (async : le profil est lu dans le stockage).
export async function getDept(slug) {
  if (isCp(slug)) {
    const profile = await store.get(cpProfileKey(slug));
    if (!profile) throw fail(404, "Chef de projet non inscrit : utilisez le formulaire « Chefs de projet » de l'accueil.");
    return cpDept(slug, profile);
  }
  const d = bySlug[slug];
  if (!isActive(d)) throw fail(404, 'Structure non ouverte aux entretiens');
  return d;
}

// Les structures dont l'entretien est déjà réalisé ne prennent plus de rendez-vous.
export async function bookableDept(slug) {
  const d = await getDept(slug);
  if (isDone(d)) throw fail(409, "L'entretien de cette structure est déjà terminé.");
  return d;
}

export const slotKey = (date, time) => `slot:${date}T${time}`;
export const bookingKey = (slug) => `booking:${slug}`;
export const progressKey = (slug) => `progress:${slug}`;
export const answersKey = (slug) => `answers:${slug}`;

const clean = (s, max = 200) => String(s ?? '').trim().slice(0, max);
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function sanitizeBooking(input) {
  const b = {
    date: clean(input.date, 10),
    time: clean(input.time, 5),
    name: clean(input.name, 120),
    role: clean(input.role, 160),
    email: clean(input.email, 160).toLowerCase(),
    phone: clean(input.phone, 40),
    participants: clean(input.participants, 600),
    mode: input.mode === 'visio' ? 'visio' : 'presentiel',
    notes: clean(input.notes, 1000),
  };
  if (!b.name) throw fail(400, 'Indiquez le nom de la personne interviewée');
  if (!emailRe.test(b.email)) throw fail(400, 'Adresse e-mail invalide');
  if (!validSlot(b.date, b.time)) throw fail(400, 'Créneau non disponible');
  return b;
}

export const ccList = (b) =>
  (b.participants.match(/[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+/g) || []).map((x) => x.toLowerCase());

// Tous les créneaux pris (pour griser le calendrier), sans données personnelles.
export async function allBookings() {
  const cps = ((await store.smembers(cpIndexKey)) || []).filter(isCp).sort();
  const slugs = [...Object.keys(bySlug).filter((s) => isActive(bySlug[s])), ...cps];
  const [bookings, progress, profiles] = await Promise.all([
    store.mget(slugs.map(bookingKey)),
    store.mget(slugs.map(progressKey)),
    store.mget(slugs.map(cpProfileKey)),
  ]);
  return slugs.map((slug, i) => ({ slug, booking: bookings[i], progress: progress[i], ...(isCp(slug) ? { profile: profiles[i] || {} } : {}) }));
}

export const newId = () => crypto.randomUUID();
