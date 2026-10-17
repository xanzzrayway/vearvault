const http = require('http');
const fs = require('fs');
const path = require('path');

const GH_TOKEN = process.env.GH_TOKEN;
const GH_OWNER = process.env.GH_OWNER;
const GH_REPO = process.env.GH_REPO;
const PORT = process.env.PORT || 8080;
const DAILY_LIMIT_PER_IP = 3;
const USAGE_FILE = path.join(__dirname, 'usage.json');

if (!GH_TOKEN || !GH_OWNER || !GH_REPO) {
  console.error('GH_TOKEN, GH_OWNER, GH_REPO belum di-set. Jalanin via start.sh, atau export manual dulu.');
  process.exit(1);
}

const ghHeaders = {
  'Authorization': 'Bearer ' + GH_TOKEN,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
};

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

// ==== rate limit per-IP, disimpen ke file biar gak reset kalau server restart ====
function loadUsage() {
  try { return JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8')); }
  catch (e) { return {}; }
}
function saveUsage(data) {
  try { fs.writeFileSync(USAGE_FILE, JSON.stringify(data)); }
  catch (e) { console.error('Gagal simpan usage.json:', e.message); }
}
function getClientIp(req) {
  const cf = req.headers['cf-connecting-ip'];
  if (cf) return cf;
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}
function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
function checkAndBumpLimit(ip) {
  const usage = loadUsage();
  const today = todayKey();
  if (!usage[ip] || usage[ip].date !== today) {
    usage[ip] = { date: today, count: 0 };
  }
  if (usage[ip].count >= DAILY_LIMIT_PER_IP) {
    return { allowed: false, count: usage[ip].count };
  }
  usage[ip].count += 1;
  saveUsage(usage);
  return { allowed: true, count: usage[ip].count };
}

const server = http.createServer(async (req, res) => {
  // CORS - biar frontend yang di-host di domain lain (misal Netlify) bisa manggil backend ini
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-secret');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');

  try {
    // ==== status doang, bukan buat dibuka di browser - UI-nya ada di Netlify ====
    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('APK Compiler backend jalan. Buka tampilannya lewat link Netlify kamu, bukan link ini.');
      return;
    }

    // ==== trigger build ====
    if (url.pathname === '/api/dispatch' && req.method === 'POST') {
      const ip = getClientIp(req);
      const limitCheck = checkAndBumpLimit(ip);
      if (!limitCheck.allowed) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: `Limit compile harian (${DAILY_LIMIT_PER_IP}x) buat IP kamu udah abis. Coba lagi besok.`
        }));
        return;
      }

      let body = '';
      for await (const chunk of req) body += chunk;
      const payload = JSON.parse(body);

      const ghRes = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/dispatches`, {
        method: 'POST',
        headers: { ...ghHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_type: 'build_apk', client_payload: payload })
      });

      if (ghRes.status !== 204) {
        const text = await ghRes.text();
        res.writeHead(ghRes.status, { 'Content-Type': 'text/plain' });
        res.end(text);
        return;
      }
      sendJson(res, 200, { ok: true });
      return;
    }

    // ==== cari run yang baru muncul ====
    if (url.pathname === '/api/find-run' && req.method === 'GET') {
      const since = url.searchParams.get('since');
      const ghRes = await fetch(
        `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/runs?event=repository_dispatch&per_page=5`,
        { headers: ghHeaders }
      );
      const data = await ghRes.json();
      const sinceTime = new Date(since).getTime() - 15000;
      const found = (data.workflow_runs || []).find(r => new Date(r.created_at).getTime() >= sinceTime);
      sendJson(res, 200, { runId: found ? found.id : null });
      return;
    }

    // ==== cek status run ====
    if (url.pathname === '/api/run-status' && req.method === 'GET') {
      const id = url.searchParams.get('id');
      const ghRes = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/runs/${id}`, {
        headers: ghHeaders
      });
      const data = await ghRes.json();
      sendJson(res, 200, { status: data.status, conclusion: data.conclusion });
      return;
    }

    // ==== download artifact (APK) ====
    if (url.pathname === '/api/download-artifact' && req.method === 'GET') {
      const runId = url.searchParams.get('runId');
      const artRes = await fetch(
        `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/runs/${runId}/artifacts`,
        { headers: ghHeaders }
      );
      const artData = await artRes.json();
      const artifact = (artData.artifacts || [])[0];
      if (!artifact) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Artifact gak ketemu (mungkin udah expired).');
        return;
      }
      const zipRes = await fetch(artifact.archive_download_url, { headers: ghHeaders });
      const buf = Buffer.from(await zipRes.arrayBuffer());
      res.writeHead(200, { 'Content-Type': 'application/zip' });
      res.end(buf);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error: ' + e.message);
  }
});

server.listen(PORT, () => {
  console.log('APK Compiler backend jalan di http://localhost:' + PORT);
});
