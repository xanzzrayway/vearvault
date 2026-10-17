require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const AdmZip = require('adm-zip');
const { nanoid } = require('nanoid');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });
const TOKEN = process.env.VERCEL_TOKEN;
const TEAM = process.env.VERCEL_TEAM_ID;
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'project.idzwebghost.my.id';
const HISTORY_FILE = path.join(__dirname, 'data', 'history.json');

app.use(express.json());
app.use(express.static('public'));

// ---------- Helpers ----------
function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8')); }
  catch { return []; }
}

function saveHistory(list) {
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(list, null, 2));
}

function vercelUrl(p) {
  return `https://api.vercel.com${p}${TEAM ? (p.includes('?') ? '&' : '?') + 'teamId=' + TEAM : ''}`;
}

async function vercelFetch(p, opts = {}) {
  const res = await fetch(vercelUrl(p), {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || JSON.stringify(data));
  return data;
}

function collectFiles(dir, base = '') {
  let out = [];
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const rel = base ? `${base}/${item}` : item;
    if (fs.statSync(full).isDirectory()) {
      out = out.concat(collectFiles(full, rel));
    } else {
      out.push({
        file: rel,
        data: fs.readFileSync(full).toString('base64'),
        encoding: 'base64'
      });
    }
  }
  return out;
}

function extractUpload(file, workDir) {
  fs.mkdirSync(workDir, { recursive: true });
  if (file.originalname.toLowerCase().endsWith('.zip')) {
    new AdmZip(file.path).extractAllTo(workDir, true);
  } else {
    fs.copyFileSync(file.path, path.join(workDir, 'index.html'));
  }
}

// ---------- Routes ----------

// Deploy baru
app.post('/api/deploy', upload.single('file'), async (req, res) => {
  try {
    const nama = (req.body.nama || nanoid(6)).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const workDir = path.join('uploads', nama + '-' + Date.now());
    extractUpload(req.file, workDir);

    const files = collectFiles(workDir);
    const projectName = `idzghost-${nama}`;

    const deployment = await vercelFetch('/v13/deployments', {
      method: 'POST',
      body: JSON.stringify({
        name: projectName,
        files,
        target: 'production',
        projectSettings: { framework: null }
      })
    });

    const domain = `${nama}.${BASE_DOMAIN}`;
    await vercelFetch(`/v10/projects/${deployment.projectId}/domains`, {
      method: 'POST',
      body: JSON.stringify({ name: domain })
    }).catch(() => {});

    fs.rmSync(workDir, { recursive: true, force: true });
    fs.unlinkSync(req.file.path);

    const history = loadHistory();
    const entry = {
      id: nanoid(10),
      nama,
      projectId: deployment.projectId,
      projectName,
      domain,
      url: `https://${domain}`,
      vercelUrl: `https://${deployment.url}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deployCount: 1
    };
    history.unshift(entry);
    saveHistory(history);

    res.json({ ok: true, entry });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Update / redeploy project yang sudah ada (pakai id dari history)
app.post('/api/update/:id', upload.single('file'), async (req, res) => {
  try {
    const history = loadHistory();
    const idx = history.findIndex(h => h.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Riwayat tidak ditemukan' });

    const entry = history[idx];
    const workDir = path.join('uploads', entry.nama + '-update-' + Date.now());
    extractUpload(req.file, workDir);

    const files = collectFiles(workDir);

    const deployment = await vercelFetch('/v13/deployments', {
      method: 'POST',
      body: JSON.stringify({
        name: entry.projectName,
        files,
        target: 'production',
        projectSettings: { framework: null }
      })
    });

    fs.rmSync(workDir, { recursive: true, force: true });
    fs.unlinkSync(req.file.path);

    entry.vercelUrl = `https://${deployment.url}`;
    entry.updatedAt = new Date().toISOString();
    entry.deployCount = (entry.deployCount || 1) + 1;
    history[idx] = entry;
    saveHistory(history);

    res.json({ ok: true, entry });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// List riwayat
app.get('/api/history', (req, res) => {
  res.json({ ok: true, history: loadHistory() });
});

// Hapus satu riwayat (hanya dari catatan lokal, tidak menghapus project di Vercel)
app.delete('/api/history/:id', (req, res) => {
  const history = loadHistory().filter(h => h.id !== req.params.id);
  saveHistory(history);
  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => {
  console.log('IdzDeploy jalan di port', process.env.PORT || 3000);
});
