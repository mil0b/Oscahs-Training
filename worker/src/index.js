import { AwsClient } from 'aws4fetch';

const FREE_TIER_BYTES = 10 * 1024 * 1024 * 1024;
const SESSION_TTL_SECONDS = 2 * 60 * 60;
const PBKDF2_ITERATIONS = 100000; // if login/setup starts hitting Worker CPU-limit errors, lower this
const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_SECONDS = 15 * 60;

const RESERVED_KEYS = new Set(['videos.json', 'admin.json', 'categories.json']);

const DEFAULT_CATEGORIES = [
  { name: 'MagicBooking', accent: '#E6007E', bg: '#FFF0F9' },
  { name: 'Health & Safety', accent: '#E94E1B', bg: '#FFF3EE' },
  { name: 'Finance', accent: '#00B2CF', bg: '#E6F8FC' },
  { name: 'HR', accent: '#95C11F', bg: '#F2FAE6' },
  { name: 'Customer Service', accent: '#951B81', bg: '#F9EDF8' },
  { name: 'Operations', accent: '#FFCA00', bg: '#FFFBE6' },
];

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return handleOptions();

    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (request.method === 'GET' && pathname === '/') {
        return withCors(json({ ok: true, service: 'oscahs-training-api' }));
      }
      if (request.method === 'GET' && pathname === '/manifest') {
        return withCors(json(await buildManifest(env)));
      }
      if (request.method === 'GET' && pathname.startsWith('/video/')) {
        return withCors(await handleVideo(request, env, decodeURIComponent(pathname.slice('/video/'.length))));
      }
      if (request.method === 'GET' && pathname.startsWith('/thumbnail/')) {
        return withCors(await handleThumbnail(env, decodeURIComponent(pathname.slice('/thumbnail/'.length))));
      }
      if (request.method === 'GET' && pathname === '/admin/status') {
        const obj = await env.BUCKET.head('admin.json');
        return withCors(json({ exists: !!obj }));
      }
      if (request.method === 'POST' && pathname === '/admin/setup') {
        return withCors(await handleAdminSetup(request, env));
      }
      if (request.method === 'POST' && pathname === '/admin/login') {
        return withCors(await handleAdminLogin(request, env));
      }
      if (request.method === 'POST' && pathname === '/admin/change-password') {
        return withCors(await handleChangePassword(request, env));
      }
      if (request.method === 'POST' && pathname === '/admin/manifest') {
        return withCors(await handleSaveManifest(request, env));
      }
      if (request.method === 'POST' && pathname === '/admin/categories') {
        return withCors(await handleSaveCategories(request, env));
      }
      if (request.method === 'POST' && pathname === '/admin/storage') {
        return withCors(await handleStorage(request, env));
      }
      if (request.method === 'POST' && pathname === '/admin/upload-url') {
        return withCors(await handleUploadUrl(request, env));
      }
      if (request.method === 'POST' && pathname === '/admin/thumbnail-upload-url') {
        return withCors(await handleThumbnailUploadUrl(request, env));
      }
      if (request.method === 'POST' && pathname === '/admin/video/delete') {
        return withCors(await handleDeleteVideo(request, env));
      }
      return withCors(json({ error: 'Not found' }, 404));
    } catch (err) {
      return withCors(json({ error: String((err && err.message) || err) }, 500));
    }
  },
};

/* ── HTTP helpers ── */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

/* ── Manifest / categories ── */

async function readJsonArray(env, key, fallback) {
  const obj = await env.BUCKET.get(key);
  if (!obj) return fallback;
  try {
    const data = await obj.json();
    return Array.isArray(data) ? data : fallback;
  } catch {
    return fallback;
  }
}

async function listAllObjects(env) {
  let truncated = true;
  let cursor;
  const out = [];
  while (truncated) {
    const listing = await env.BUCKET.list({ cursor, limit: 1000 });
    for (const obj of listing.objects) out.push({ key: obj.key, size: obj.size });
    truncated = listing.truncated;
    cursor = listing.truncated ? listing.cursor : undefined;
  }
  return out;
}

function titleFromFilename(name) {
  const stem = name.replace(/\.mp4$/i, '');
  return stem
    .replace(/[-_]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

async function buildManifest(env) {
  const manifestEntries = await readJsonArray(env, 'videos.json', []);
  const categories = await readJsonArray(env, 'categories.json', DEFAULT_CATEGORIES);
  const objects = await listAllObjects(env);

  const mp4Map = new Map();
  for (const obj of objects) {
    if (/\.mp4$/i.test(obj.key)) mp4Map.set(obj.key, obj.size);
  }

  const results = [];
  for (const entry of manifestEntries) {
    if (entry.filename && mp4Map.has(entry.filename)) {
      results.push({
        filename: entry.filename,
        title: entry.title || titleFromFilename(entry.filename),
        description: entry.description || null,
        category: entry.category || null,
        chapters: entry.chapters || [],
        size: mp4Map.get(entry.filename),
      });
      mp4Map.delete(entry.filename);
    }
  }

  const remaining = Array.from(mp4Map.keys()).sort();
  for (const filename of remaining) {
    results.push({
      filename,
      title: titleFromFilename(filename),
      description: null,
      category: null,
      chapters: [],
      size: mp4Map.get(filename),
    });
  }

  return { videos: results, categories };
}

async function handleSaveManifest(request, env) {
  const body = await readJson(request);
  const auth = await requireToken(env, body.token);
  if (!auth.ok) return json({ error: auth.error }, 401);
  if (!Array.isArray(body.videos)) return json({ error: 'videos must be an array' }, 400);
  await env.BUCKET.put('videos.json', JSON.stringify(body.videos));
  return json({ ok: true });
}

async function handleSaveCategories(request, env) {
  const body = await readJson(request);
  const auth = await requireToken(env, body.token);
  if (!auth.ok) return json({ error: auth.error }, 401);
  if (!Array.isArray(body.categories)) return json({ error: 'categories must be an array' }, 400);
  await env.BUCKET.put('categories.json', JSON.stringify(body.categories));
  return json({ ok: true });
}

async function handleStorage(request, env) {
  const body = await readJson(request);
  const auth = await requireToken(env, body.token);
  if (!auth.ok) return json({ error: auth.error }, 401);
  const objects = await listAllObjects(env);
  const usedBytes = objects.reduce((sum, o) => sum + o.size, 0);
  return json({ usedBytes, totalBytes: FREE_TIER_BYTES });
}

/* ── Video streaming with Range support ── */

function parseRange(rangeHeader, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;
  const [, startStr, endStr] = match;
  if (startStr === '' && endStr === '') return null;

  let start, end;
  if (startStr === '') {
    const suffixLength = parseInt(endStr, 10);
    if (Number.isNaN(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = parseInt(startStr, 10);
    end = endStr === '' ? size - 1 : parseInt(endStr, 10);
  }

  if (Number.isNaN(start) || Number.isNaN(end) || start < 0) return null;
  if (end >= size) end = size - 1;
  if (start > end) return null;
  return { start, end };
}

async function handleVideo(request, env, filename) {
  const key = sanitizeFilename(filename);
  if (!key) return new Response('Not found', { status: 404 });

  const head = await env.BUCKET.head(key);
  if (!head) return new Response('Not found', { status: 404 });
  const size = head.size;

  const rangeHeader = request.headers.get('range');
  let rangeOpt;
  let status = 200;
  let contentRange = null;

  if (rangeHeader) {
    const parsed = parseRange(rangeHeader, size);
    if (!parsed) {
      return new Response('Range Not Satisfiable', { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    rangeOpt = { offset: parsed.start, length: parsed.end - parsed.start + 1 };
    status = 206;
    contentRange = `bytes ${parsed.start}-${parsed.end}/${size}`;
  }

  const obj = await env.BUCKET.get(key, rangeOpt ? { range: rangeOpt } : undefined);
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  headers.set('Content-Type', 'video/mp4');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('Content-Length', String(rangeOpt ? rangeOpt.length : size));
  if (contentRange) headers.set('Content-Range', contentRange);

  return new Response(obj.body, { status, headers });
}

/* ── Admin: setup / login / change password ── */

function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function randomHex(numBytes) {
  const bytes = new Uint8Array(numBytes);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function pbkdf2Hash(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    256
  );
  return toHex(new Uint8Array(bits));
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function handleAdminSetup(request, env) {
  const body = await readJson(request);
  const password = String(body.password || '');
  if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

  const existing = await env.BUCKET.head('admin.json');
  if (existing) return json({ error: 'An admin password is already set up for this team' }, 400);

  const salt = randomHex(16);
  const hash = await pbkdf2Hash(password, salt);
  await env.BUCKET.put('admin.json', JSON.stringify({ salt, hash }));
  const token = await signToken(env.SESSION_SECRET, { exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
  return json({ ok: true, token });
}

async function isRateLimited(env, ip) {
  const raw = await env.RATE_LIMIT.get(`login:${ip}`);
  const count = raw ? parseInt(raw, 10) : 0;
  return count >= LOGIN_MAX_ATTEMPTS;
}

async function recordFailedAttempt(env, ip) {
  const key = `login:${ip}`;
  const raw = await env.RATE_LIMIT.get(key);
  const count = raw ? parseInt(raw, 10) + 1 : 1;
  await env.RATE_LIMIT.put(key, String(count), { expirationTtl: LOGIN_WINDOW_SECONDS });
}

async function clearRateLimit(env, ip) {
  await env.RATE_LIMIT.delete(`login:${ip}`);
}

function base64urlEncode(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) padded += '=';
  return decodeURIComponent(escape(atob(padded)));
}

async function hmacHex(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return toHex(new Uint8Array(sig));
}

async function signToken(secret, payload) {
  const payloadB64 = base64urlEncode(JSON.stringify(payload));
  const sig = await hmacHex(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

async function verifyToken(secret, token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expected = await hmacHex(secret, payloadB64);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    return JSON.parse(base64urlDecode(payloadB64));
  } catch {
    return null;
  }
}

async function requireToken(env, token) {
  if (!token) return { ok: false, error: 'Missing session token' };
  const payload = await verifyToken(env.SESSION_SECRET, token);
  if (!payload) return { ok: false, error: 'Invalid session, please log in again' };
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, error: 'Session expired, please log in again' };
  }
  return { ok: true };
}

async function handleAdminLogin(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (await isRateLimited(env, ip)) {
    return json({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
  }

  const body = await readJson(request);
  const password = String(body.password || '');

  const obj = await env.BUCKET.get('admin.json');
  if (!obj) return json({ error: 'Admin password has not been set up yet' }, 400);
  const stored = await obj.json();

  const hash = await pbkdf2Hash(password, stored.salt);
  if (!timingSafeEqual(hash, stored.hash)) {
    await recordFailedAttempt(env, ip);
    return json({ error: 'Incorrect password' }, 401);
  }

  await clearRateLimit(env, ip);
  const token = await signToken(env.SESSION_SECRET, { exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
  return json({ token });
}

async function handleChangePassword(request, env) {
  const body = await readJson(request);
  const auth = await requireToken(env, body.token);
  if (!auth.ok) return json({ error: auth.error }, 401);

  const newPassword = String(body.newPassword || '');
  if (newPassword.length < 6) return json({ error: 'New password must be at least 6 characters' }, 400);

  const obj = await env.BUCKET.get('admin.json');
  if (!obj) return json({ error: 'Admin not set up' }, 400);
  const stored = await obj.json();

  const currentHash = await pbkdf2Hash(String(body.currentPassword || ''), stored.salt);
  if (!timingSafeEqual(currentHash, stored.hash)) return json({ error: 'Current password is incorrect' }, 400);

  const salt = randomHex(16);
  const hash = await pbkdf2Hash(newPassword, salt);
  await env.BUCKET.put('admin.json', JSON.stringify({ salt, hash }));
  return json({ ok: true });
}

/* ── Uploads / deletes ── */

function sanitizeFilename(name) {
  if (typeof name !== 'string') return null;
  if (name.length === 0 || name.length > 200) return null;
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return null;
  if (!/\.mp4$/i.test(name)) return null;
  if (RESERVED_KEYS.has(name.toLowerCase())) return null;
  return name;
}

async function presignUpload(env, key, contentType) {
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });
  const url = new URL(`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.BUCKET_NAME}/${encodeURIComponent(key)}`);
  url.searchParams.set('X-Amz-Expires', String(UPLOAD_URL_TTL_SECONDS));
  const signed = await client.sign(url.toString(), {
    method: 'PUT',
    aws: { signQuery: true },
    headers: contentType ? { 'content-type': contentType } : {},
  });
  return signed.url;
}

async function handleUploadUrl(request, env) {
  const body = await readJson(request);
  const auth = await requireToken(env, body.token);
  if (!auth.ok) return json({ error: auth.error }, 401);

  const filename = sanitizeFilename(body.filename);
  if (!filename) return json({ error: 'Invalid filename (must be a plain .mp4 name)' }, 400);

  const size = Number(body.size || 0);
  if (!size || size > MAX_UPLOAD_BYTES) {
    return json({ error: `File must be under ${MAX_UPLOAD_BYTES / 1024 / 1024 / 1024}GB` }, 400);
  }

  const uploadUrl = await presignUpload(env, filename, 'video/mp4');
  return json({ uploadUrl, key: filename, expiresInSeconds: UPLOAD_URL_TTL_SECONDS });
}

async function handleDeleteVideo(request, env) {
  const body = await readJson(request);
  const auth = await requireToken(env, body.token);
  if (!auth.ok) return json({ error: auth.error }, 401);

  const filename = sanitizeFilename(body.filename);
  if (!filename) return json({ error: 'Invalid filename' }, 400);

  await env.BUCKET.delete(filename);
  await env.BUCKET.delete(thumbnailKeyFor(filename)); // best-effort; fine if it never existed
  const entries = await readJsonArray(env, 'videos.json', []);
  const updated = entries.filter((e) => e.filename !== filename);
  await env.BUCKET.put('videos.json', JSON.stringify(updated));
  return json({ ok: true });
}

/* ── Thumbnails ── */

function thumbnailKeyFor(videoFilename) {
  return 'thumbnails/' + videoFilename.replace(/\.mp4$/i, '.jpg');
}

async function handleThumbnail(env, filename) {
  const videoFilename = sanitizeFilename(filename);
  if (!videoFilename) return new Response('Not found', { status: 404 });

  const obj = await env.BUCKET.get(thumbnailKeyFor(videoFilename));
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  headers.set('Content-Type', 'image/jpeg');
  headers.set('Cache-Control', 'private, max-age=3600');
  return new Response(obj.body, { status: 200, headers });
}

async function handleThumbnailUploadUrl(request, env) {
  const body = await readJson(request);
  const auth = await requireToken(env, body.token);
  if (!auth.ok) return json({ error: auth.error }, 401);

  const videoFilename = sanitizeFilename(body.filename);
  if (!videoFilename) return json({ error: 'Invalid filename (must be a plain .mp4 name)' }, 400);

  const uploadUrl = await presignUpload(env, thumbnailKeyFor(videoFilename), 'image/jpeg');
  return json({ uploadUrl, expiresInSeconds: UPLOAD_URL_TTL_SECONDS });
}
