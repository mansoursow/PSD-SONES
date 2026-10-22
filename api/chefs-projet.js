// POST /api/chefs-projet {name, email, project, phone} → inscrit (ou retrouve) l'espace d'un chef de projet
//   et renvoie son identifiant `cp-xxxxxxxxxx` (empreinte de l'e-mail : le même e-mail retrouve les mêmes réponses).
// GET  /api/chefs-projet?slug=cp-… → nom et projet (sans e-mail) pour l'affichage
import crypto from 'node:crypto';
import { handler, send, readBody, query, checkAccess, fail } from '../lib/http.js';
import * as store from '../lib/store.js';
import { isCp } from '../public/js/departments.js';
import { cpIndexKey, cpProfileKey } from '../lib/bookings.js';

const clean = (s, max) => String(s ?? '').trim().slice(0, max);
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cpSlug = (email) => 'cp-' + crypto.createHash('sha256').update(email).digest('hex').slice(0, 10);

export default handler(async (req, res) => {
  checkAccess(req);

  if (req.method === 'GET') {
    const slug = query(req).slug;
    const p = isCp(slug) ? await store.get(cpProfileKey(slug)) : null;
    if (!p) throw fail(404, 'Chef de projet non inscrit');
    return send(res, 200, { name: p.name, project: p.project });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const email = clean(body.email, 160).toLowerCase();
    const name = clean(body.name, 120);
    const project = clean(body.project, 160);
    if (!name) throw fail(400, 'Indiquez votre nom');
    if (!emailRe.test(email)) throw fail(400, 'Adresse e-mail invalide');
    if (!project) throw fail(400, 'Indiquez le projet dont vous avez la charge');
    const slug = cpSlug(email);
    const prev = await store.get(cpProfileKey(slug));
    await store.set(cpProfileKey(slug), { name, project, email, phone: clean(body.phone, 40), createdAt: prev?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
    await store.sadd(cpIndexKey, slug);
    return send(res, 200, { slug, name, project, email });
  }

  throw fail(405, 'Méthode non autorisée');
});
