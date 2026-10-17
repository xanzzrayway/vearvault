// ============================================================
// SERVER ENEMRY — PURE NODE.JS, GAK BUTUH NPM INSTALL SAMA SEKALI
// Cukup jalanin: node server.js
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

// ---------- baca file .env manual (gak pake package dotenv) ----------
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const env = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

const env = loadEnv();
const PORT = env.PORT || 3000;
const GEMINI_API_KEY = env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY belum di-set di file .env! Bikin file .env dulu (contoh ada di .env.example)');
  process.exit(1);
}

// Mapping nama model "Enemry" (yang muncul di UI) ke model Gemini asli.
// Ganti value di sini (lewat .env) kalau lo mau pindah ke model Gemini yang lain.
const MODEL_MAP = {
  'enemry-code-5': env.MODEL_CODE_5 || 'gemini-3.1-pro-preview',
  'enemry-monus-2.3': env.MODEL_MONUS_2_3 || 'gemini-3.5-flash',
  'enemry-nex-1.5': env.MODEL_NEX_1_5 || 'gemini-3.5-flash-lite',
};

const DEFAULT_MODEL_KEY = 'enemry-monus-2.3';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, obj) {
  setCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  // preflight CORS
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // dipanggil frontend buat cek server nyala apa nggak
  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { status: 'ok', models: Object.keys(MODEL_MAP) });
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const { messages, model } = parsed;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return sendJson(res, 400, { error: 'messages array wajib diisi' });
        }

        const geminiModel = MODEL_MAP[model] || MODEL_MAP[DEFAULT_MODEL_KEY];

        // ubah format ke yang dipake Gemini: role "assistant" -> "model"
        const contents = messages.map(m => ({
          role: m.role === 'assistant' || m.role === 'ai' ? 'model' : 'user',
          parts: [{ text: String(m.content || '') }]
        }));

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`;

        // Node 18+ udah punya fetch bawaan, gak butuh package tambahan
        const geminiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents })
        });

        const data = await geminiRes.json();

        if (!geminiRes.ok) {
          console.error('Gemini error:', data);
          return sendJson(res, geminiRes.status, { error: data.error?.message || 'Error dari Gemini API' });
        }

        const reply = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '(gak ada jawaban)';
        return sendJson(res, 200, { reply });
      } catch (err) {
        console.error(err);
        return sendJson(res, 500, { error: 'Server error: ' + err.message });
      }
    });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`✅ Server Enemry jalan di http://localhost:${PORT}`);
  console.log(`   Model tersedia: ${Object.keys(MODEL_MAP).join(', ')}`);
  console.log(`   (Pure Node.js — gak ada dependency npm sama sekali)`);
});

