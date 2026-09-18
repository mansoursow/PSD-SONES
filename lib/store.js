// Stockage clé/valeur minimal.
// - En production (Vercel) : Upstash Redis via son API REST (variables KV_REST_API_URL / KV_REST_API_TOKEN
//   créées automatiquement par l'intégration Upstash du Marketplace Vercel, ou UPSTASH_REDIS_REST_URL / _TOKEN).
// - En local : fichier JSON .data/db.json.
import fs from 'node:fs/promises';
import path from 'node:path';

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX = 'sones-psd:';

export const storeKind = URL_ && TOKEN ? 'redis' : process.env.VERCEL ? 'none' : 'file';

async function redis(...cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error('Redis: ' + j.error);
  return j.result;
}

// ---- fichier local ----
const FILE = path.join(process.cwd(), '.data', 'db.json');
let fileLock = Promise.resolve();
async function readFile() {
  try { return JSON.parse(await fs.readFile(FILE, 'utf8')); } catch { return {}; }
}
function withFile(fn) {
  const run = fileLock.then(async () => {
    const db = await readFile();
    const { result, changed } = await fn(db);
    if (changed) {
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      await fs.writeFile(FILE, JSON.stringify(db, null, 1));
    }
    return result;
  });
  fileLock = run.catch(() => {});
  return run;
}

function ensure() {
  if (storeKind === 'none') {
    const e = new Error("Stockage non configuré : ajoutez une base Upstash Redis au projet Vercel.");
    e.status = 503;
    throw e;
  }
}

export async function get(key) {
  ensure();
  if (storeKind === 'redis') {
    const v = await redis('GET', PREFIX + key);
    return v == null ? null : JSON.parse(v);
  }
  return withFile((db) => ({ result: db[key] ?? null }));
}

export async function set(key, value) {
  ensure();
  if (storeKind === 'redis') return redis('SET', PREFIX + key, JSON.stringify(value));
  return withFile((db) => { db[key] = value; return { result: 'OK', changed: true }; });
}

export async function del(key) {
  ensure();
  if (storeKind === 'redis') return redis('DEL', PREFIX + key);
  return withFile((db) => { delete db[key]; return { result: 1, changed: true }; });
}

// Pose la valeur seulement si la clé n'existe pas (verrou de créneau). Renvoie true si posée.
export async function setNX(key, value) {
  ensure();
  if (storeKind === 'redis') return (await redis('SET', PREFIX + key, JSON.stringify(value), 'NX')) === 'OK';
  return withFile((db) => {
    if (db[key] != null) return { result: false };
    db[key] = value;
    return { result: true, changed: true };
  });
}

export async function mget(keys) {
  ensure();
  if (!keys.length) return [];
  if (storeKind === 'redis') {
    const vs = await redis('MGET', ...keys.map((k) => PREFIX + k));
    return vs.map((v) => (v == null ? null : JSON.parse(v)));
  }
  return withFile((db) => ({ result: keys.map((k) => db[k] ?? null) }));
}

// Fusionne des champs dans un objet stocké (réponses) : dernier écrivain par question.
export async function mergeFields(key, fields, meta) {
  ensure();
  if (storeKind === 'redis') {
    const args = [];
    for (const [k, v] of Object.entries(fields)) args.push('a:' + k, JSON.stringify(v));
    for (const [k, v] of Object.entries(meta)) args.push('m:' + k, JSON.stringify(v));
    if (args.length) await redis('HSET', PREFIX + key, ...args);
    return;
  }
  return withFile((db) => {
    const cur = db[key] || { answers: {}, meta: {} };
    Object.assign(cur.answers, fields);
    Object.assign(cur.meta, meta);
    db[key] = cur;
    return { result: 'OK', changed: true };
  });
}

export async function getFields(key) {
  ensure();
  if (storeKind === 'redis') {
    const flat = (await redis('HGETALL', PREFIX + key)) || [];
    const out = { answers: {}, meta: {} };
    for (let i = 0; i < flat.length; i += 2) {
      const [kind, ...rest] = flat[i].split(':');
      const name = rest.join(':');
      (kind === 'a' ? out.answers : out.meta)[name] = JSON.parse(flat[i + 1]);
    }
    return out;
  }
  return withFile((db) => ({ result: db[key] || { answers: {}, meta: {} } }));
}
