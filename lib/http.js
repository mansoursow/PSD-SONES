// Petits utilitaires HTTP compatibles Vercel (req/res Node) et serveur local.
import crypto from 'node:crypto';

export async function readBody(req) {
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export function query(req) {
  return Object.fromEntries(new URL(req.url, 'http://x').searchParams);
}

export function send(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (typeof data === 'string' || Buffer.isBuffer(data)) return res.end(data);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export function handler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      console.error(e);
      send(res, e.status || 500, { error: e.expose || e.status ? e.message : 'Erreur serveur' });
    }
  };
}

export function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  e.expose = true;
  return e;
}

const eq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Code d'accès optionnel commun aux structures (ACCESS_CODE), communiqué par le consultant.
export function checkAccess(req) {
  const code = process.env.ACCESS_CODE;
  if (!code) return;
  const given = req.headers['x-access-code'] || '';
  const admin = process.env.ADMIN_PASSWORD;
  if (eq(given, code) || (admin && eq(given, admin))) return;
  throw fail(401, "Code d'accès requis");
}

export function checkAdmin(req) {
  const admin = process.env.ADMIN_PASSWORD;
  if (!admin) throw fail(503, 'ADMIN_PASSWORD non configuré');
  if (!eq(req.headers['x-admin-password'] || '', admin)) throw fail(401, 'Mot de passe administrateur incorrect');
}

export const siteUrl = (req) =>
  (process.env.SITE_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`).replace(/\/$/, '');
