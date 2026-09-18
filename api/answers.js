// GET /api/answers?dept=slug                         → réponses préliminaires de la structure
// PUT /api/answers {dept, answers:{id:texte}, filled, total, by} → fusion question par question
import { handler, send, readBody, query, checkAccess, fail } from '../lib/http.js';
import * as store from '../lib/store.js';
import { getDept, answersKey, progressKey } from '../lib/bookings.js';

const MAX = 20000;

export default handler(async (req, res) => {
  checkAccess(req);

  if (req.method === 'GET') {
    const dept = getDept(query(req).dept);
    return send(res, 200, await store.getFields(answersKey(dept.slug)));
  }

  if (req.method === 'PUT') {
    const body = await readBody(req);
    const dept = getDept(body.dept);
    const answers = {};
    for (const [k, v] of Object.entries(body.answers || {})) {
      if (!/^s\d+q\d+(c\d+)?$/.test(k)) continue;
      answers[k] = String(v ?? '').slice(0, MAX);
    }
    const now = new Date().toISOString();
    const by = String(body.by || '').slice(0, 120);
    await store.mergeFields(answersKey(dept.slug), answers, { updatedAt: now, updatedBy: by });
    const total = Number(body.total) || 0;
    const filled = Math.min(Number(body.filled) || 0, total);
    await store.set(progressKey(dept.slug), { filled, total, updatedAt: now });
    return send(res, 200, { ok: true, updatedAt: now });
  }

  throw fail(405, 'Méthode non autorisée');
});
