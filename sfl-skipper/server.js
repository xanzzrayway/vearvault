'use strict';
// SFL Skipper - backend. Jalankan: node server.js  (Node 18+, tanpa npm install)
// Env opsional: PORT, ALLOWED_HOSTS="sfl.gl,tutwuri.id", ORIGIN="https://domainmu.pages.dev"

const http = require('http');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const net = require('net');

const PORT = +process.env.PORT || 8787;
const ALLOWED = (process.env.ALLOWED_HOSTS || 'sfl.gl,tutwuri.id,safelinku.com')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const FILE_HOSTS = [
  'mediafire.com', 'drive.google.com', 'docs.google.com', 'mega.nz', 'mega.io',
  'dropbox.com', 'gofile.io', 'pixeldrain.com', '1drv.ms', 'onedrive.live.com',
  'sourceforge.net', 'workupload.com', 'krakenfiles.com', 'terabox.com', 'github.com'
];
const MAX_HOPS = 8;
const TIMEOUT = 15000;
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const hostMatch = (h, list) => list.some(d => h === d || h.endsWith('.' + d));
const hostOf = u => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };

// ---------- keamanan: blok alamat lokal/privat (anti-SSRF) ----------
function isPrivate(ip) {
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const l = ip.toLowerCase();
  return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80');
}

async function assertPublic(u) {
  const { hostname, protocol } = new URL(u);
  if (protocol !== 'http:' && protocol !== 'https:') throw new Error('Protokol tidak didukung');
  const ips = net.isIP(hostname) ? [{ address: hostname }] : await dns.lookup(hostname, { all: true });
  for (const { address } of ips) if (isPrivate(address)) throw new Error('Alamat lokal/privat diblokir');
}

// ---------- ekstraksi link dari HTML ----------
const clean = s => s.replace(/\\\//g, '/').replace(/\\u0026/g, '&').replace(/&amp;/g, '&');

function tryB64(s) {
  try {
    const d = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return /^https?:\/\/[^\s]+$/.test(d) ? d : null;
  } catch { return null; }
}

function extract(html, base) {
  const h = clean(html);
  const out = new Set();
  const add = u => { try { out.add(new URL(u, base).href); } catch { /* abaikan */ } };
  for (const m of h.matchAll(/https?:\/\/[^\s"'<>\\)]+/g)) add(m[0]);
  for (const m of h.matchAll(/atob\(\s*["']([A-Za-z0-9+/=_-]{12,})["']\s*\)/g)) { const d = tryB64(m[1]); if (d) add(d); }
  for (const m of h.matchAll(/[?&](?:r|url|u|link|go|to|target)=([A-Za-z0-9+/=_%-]{16,})/g)) {
    let v = m[1]; try { v = decodeURIComponent(v); } catch { /* biarkan */ }
    const d = tryB64(v); if (d) add(d);
  }
  for (const m of h.matchAll(/(?:url|u|link|go|to|target)=(https?%3A[^&"'\s]+)/gi)) {
    try { add(decodeURIComponent(m[1])); } catch { /* abaikan */ }
  }
  return [...out];
}

function redirectsFrom(html, base) {
  const h = clean(html);
  const out = [];
  const add = u => { try { out.push(new URL(u, base).href); } catch { /* abaikan */ } };
  const meta = h.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=([^"']+)/i);
  if (meta) add(meta[1]);
  for (const m of h.matchAll(/(?:window\.|document\.|top\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/g)) add(m[1]);
  for (const m of h.matchAll(/location\.(?:replace|assign)\(\s*["']([^"']+)["']\s*\)/g)) add(m[1]);
  return out;
}

// ---------- resolver ----------
async function resolve(input) {
  const trace = [];
  const jar = new Map();
  const seen = new Set();
  let url = input;

  for (let hop = 1; hop <= MAX_HOPS; hop++) {
    if (seen.has(url)) return { ok: false, error: 'Berputar-putar di link yang sama', trace };
    seen.add(url);

    let res;
    try {
      await assertPublic(url);
      res = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT),
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
          ...(jar.size ? { Cookie: [...jar].map(([k, v]) => k + '=' + v).join('; ') } : {})
        }
      });
    } catch (e) {
      trace.push({ url, note: 'gagal: ' + e.message });
      return { ok: false, error: 'Gagal membuka tautan: ' + e.message, trace };
    }

    for (const c of (res.headers.getSetCookie ? res.headers.getSetCookie() : [])) {
      const kv = c.split(';')[0]; const i = kv.indexOf('=');
      if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1));
    }

    const loc = res.headers.get('location');
    if (loc) {
      let next; try { next = new URL(loc, url).href; } catch { next = null; }
      trace.push({ url, status: res.status, note: 'redirect' });
      if (!next) return { ok: false, error: 'Header redirect tidak valid', trace };
      const nh = hostOf(next);
      if (hostMatch(nh, FILE_HOSTS)) { trace.push({ url: next, note: 'link file ditemukan' }); return { ok: true, url: next, kind: 'file', trace }; }
      if (!hostMatch(nh, ALLOWED)) { trace.push({ url: next, note: 'tujuan akhir' }); return { ok: true, url: next, kind: 'other', trace }; }
      url = next; continue;
    }

    if (res.status >= 400) {
      trace.push({ url, status: res.status, note: 'ditolak server' });
      const why = res.status === 403 || res.status === 503 ? ' (kemungkinan diblok anti-bot/Cloudflare)' : '';
      return { ok: false, error: 'Server membalas ' + res.status + why, trace };
    }

    const body = (await res.text()).slice(0, 1500000);
    const title = (body.match(/<title[^>]*>([^<]{0,80})/i) || [])[1];
    const found = extract(body, url);
    const file = found.find(u => hostMatch(hostOf(u), FILE_HOSTS));
    if (file) {
      trace.push({ url, status: res.status, note: 'halaman dibaca' });
      trace.push({ url: file, note: 'link file ditemukan' });
      return { ok: true, url: file, kind: 'file', trace };
    }

    const cands = [...redirectsFrom(body, url), ...found.filter(u => hostMatch(hostOf(u), ALLOWED))]
      .filter(u => !seen.has(u));
    trace.push({ url, status: res.status, note: title ? 'halaman: ' + title.trim() : 'halaman dibaca' });
    if (!cands.length) {
      return {
        ok: false,
        error: 'Halaman ini butuh langkah tambahan (token, klik, atau verifikasi) yang belum dikenali skrip.',
        trace
      };
    }
    url = cands[0];
  }
  return { ok: false, error: 'Terlalu banyak lompatan (' + MAX_HOPS + ')', trace };
}

// ---------- server ----------
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 20;
}

function readBody(req) {
  return new Promise((ok, no) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 4096) { no(new Error('Body terlalu besar')); req.destroy(); } });
    req.on('end', () => ok(b));
    req.on('error', no);
  });
}

http.createServer(async (req, res) => {
  const cors = {
    'Access-Control-Allow-Origin': process.env.ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  const json = (code, obj) => { res.writeHead(code, { ...cors, 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };

  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const u = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) {
    return fs.readFile(path.join(__dirname, 'index.html'), (e, d) => {
      if (e) { res.writeHead(404); return res.end('index.html tidak ditemukan'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(d);
    });
  }

  if (u.pathname === '/api/resolve') {
    const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    if (limited(String(ip))) return json(429, { ok: false, error: 'Terlalu sering. Coba lagi sebentar.', trace: [] });
    let target = u.searchParams.get('url');
    if (req.method === 'POST') {
      try { target = (JSON.parse(await readBody(req)) || {}).url; }
      catch { return json(400, { ok: false, error: 'Body bukan JSON yang valid', trace: [] }); }
    }
    let parsed;
    try { parsed = new URL(String(target || '').trim()); } catch { return json(400, { ok: false, error: 'Link tidak valid', trace: [] }); }
    if (!/^https?:$/.test(parsed.protocol) || !hostMatch(parsed.hostname.toLowerCase(), ALLOWED)) {
      return json(400, { ok: false, error: 'Hanya mendukung: ' + ALLOWED.join(', '), trace: [] });
    }
    try { return json(200, await resolve(parsed.href)); }
    catch (e) { return json(500, { ok: false, error: 'Error server: ' + e.message, trace: [] }); }
  }

  res.writeHead(404, cors); res.end();
}).listen(PORT, () => console.log('SFL Skipper jalan di http://localhost:' + PORT));
