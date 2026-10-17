require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');
const { execFile } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const TOKEN = process.env.BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OWNER_ID = process.env.OWNER_ID ? parseInt(process.env.OWNER_ID, 10) : null;

if (!TOKEN) {
  console.error('❌ BOT_TOKEN belum diisi di file .env!');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
console.log('✅ Bidz Bot jalan...');

// ================= STATE =================
const gameState = new Map();
const uploadedFiles = new Map();
const uploadedPhotos = new Map(); // chatId -> { fileId, messageId }
const filesByMessageId = new Map();
const chatMembers = new Map();
const messageLog = new Map();
const userModels = new Map();
const activeClocks = new Map();
const pendingCommand = new Map();
const aiHistory = new Map();
const MAX_HISTORY = 10;
const customSystemPrompt = new Map();
const deployCount = new Map();
const DEPLOY_LIMIT = 2;
const welcomeEnabled = new Map();
const deployRecords = []; // { siteName, chatId, fileName, deployedAt }

const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const AVAILABLE_MODELS = [
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Rekomendasi)' },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (Cepat)' },
  { id: 'qwen/qwen3.6-27b', label: 'Qwen 3.6 27B (Terpintar)' },
  { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B (Reasoning)' },
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout (Vision)' },
  { id: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2 (Structured)' },
];

function getUserModel(chatId) {
  const provider = getUserProvider(chatId);
  if (provider === 'gemini') return geminiModelChoice.get(chatId) || GEMINI_MODELS[0].id;
  return userModels.get(chatId) || DEFAULT_MODEL;
}

const GROQ_MODELS = AVAILABLE_MODELS;

// Sengaja cuma model ringan/hemat token buat Gemini, model berat (pro, dst) gak dimasukin
const GEMINI_MODELS = [
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Rekomendasi)' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Pro-ish, lebih pinter)' },
  { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite (Hemat)' },
  { id: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash-8B (Paling Hemat)' },
];

const userProviders = new Map();     // chatId -> 'groq' | 'gemini'
const geminiModelChoice = new Map(); // chatId -> model id gemini

function getUserProvider(chatId) {
  return userProviders.get(chatId) || 'groq';
}

function providerMenuKeyboard(chatId) {
  const current = getUserProvider(chatId);
  return { inline_keyboard: [
    [{ text: (current === 'groq' ? '✅ ' : '') + 'Groq', callback_data: 'select_provider_groq' }],
    [{ text: (current === 'gemini' ? '✅ ' : '') + 'Gemini', callback_data: 'select_provider_gemini' }],
    [{ text: '⬅️ Kembali', callback_data: 'menu_main' }],
  ] };
}

function modelListKeyboard(chatId, provider) {
  const models = provider === 'gemini' ? GEMINI_MODELS : GROQ_MODELS;
  const current = getUserModel(chatId);
  const prefix = provider === 'gemini' ? 'set_model_m_' : 'set_model_g_';
  const rows = models.map((m, i) => [{
    text: (m.id === current ? '✅ ' : '') + m.label,
    callback_data: prefix + i,
  }]);
  rows.push([{ text: '⬅️ Kembali', callback_data: 'menu_provider' }]);
  return { inline_keyboard: rows };
}

async function callLLM(chatId, systemPrompt, historyMessages, userText, temperature, maxTokens) {
  const provider = getUserProvider(chatId);

  if (provider === 'gemini') {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY belum diisi di .env');
    const model = getUserModel(chatId);
    const contents = historyMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    contents.push({ role: 'user', parts: [{ text: userText }] });

    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      },
      { timeout: 30000 }
    );
    const candidate = res.data.candidates && res.data.candidates[0];
    return candidate?.content?.parts?.map((p) => p.text).join('') || '(gaada jawaban dari Gemini)';
  }

  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY belum diisi di .env');
  const messages = [{ role: 'system', content: systemPrompt }, ...historyMessages, { role: 'user', content: userText }];
  const res = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    { model: getUserModel(chatId), messages, temperature, max_tokens: maxTokens },
    { headers: { Authorization: `Bearer ${GROQ_API_KEY}` }, timeout: 20000 }
  );
  return res.data.choices[0].message.content;
}

const ANIMAL_RIDDLES = [
  { hint: 'Hewan ini punya belalai panjang dan telinga lebar, badan paling gede di darat.', answer: 'gajah' },
  { hint: 'Suka tidur seharian di pohon, gerakannya lambat banget.', answer: 'kukang' },
  { hint: 'Raja hutan, punya surai di leher (jantan).', answer: 'singa' },
  { hint: 'Hewan laut, punya 8 tangan dan bisa nyemprot tinta.', answer: 'gurita' },
  { hint: 'Burung yang gabisa terbang, jago berenang, tinggal di Antartika.', answer: 'penguin' },
  { hint: 'Reptil, badan ijo, lidahnya panjang, bisa ganti warna kulit.', answer: 'bunglon' },
  { hint: 'Hewan pengerat kecil, suka keju (di kartun), takut kucing.', answer: 'tikus' },
  { hint: 'Punya sayap tapi mamalia, keluar malam, pake sonar buat terbang.', answer: 'kelelawar' },
  { hint: 'Loncat-loncat pake kaki belakang, punya kantong di perut buat bayi.', answer: 'kanguru' },
  { hint: 'Hewan berbisa, gapunya kaki, jalan dengan cara melata.', answer: 'ular' },
];

// ================= HELPER =================
function menuText() {
  return (
`<b>『 𝗕𝗶𝗱𝘇 𝗠𝗲𝗻𝘂 』</b>

<b>🤖 AI</b>
/ai pertanyaan — tanya apa aja ke AI (inget histori chat)
/resetai — reset memori chat AI
/setprompt teks — ganti persona/system prompt AI
/resetprompt — balikin system prompt AI ke default
/prompt ide singkat — generate prompt yang lebih panjang & detail

<b>🕹 Create</b>
/image deskripsi — generate gambar dari teks
/sticker — ubah gambar jadi stiker (kirim/reply gambar dulu)
/text kata — generate saran username unik

<b>🌐 WebSite</b>
/view link — lihat source HTML/CSS/JS
/search query — cari di web
/info pertanyaan — cek fakta benar atau tidak
/deploy namaweb — deploy file HTML (reply file-nya) ke Vercel
<i>   (limit 2x deploy per obrolan)</i>

<b>🎮 Game</b>
/tebak angka — tebak angka 1-100
/tebak hewan — tebak-tebakan hewan

<b>🛠️ Utility</b>
/short — Memendekkan URL.
/qr — Membuat QR code dari teks/link.
/translate — Menerjemahkan teks.
/calc — Kalkulator.
/time — Menampilkan waktu.
/weather — Menampilkan cuaca suatu lokasi.
/encode — Encode teks.
/decode — Decode teks.

<b>⚙️ Operator</b>
/clear — bersihkan semua obrolan (admin only)
/tagall — tag semua anggota di grup
/clock — lihat jam real-time

<b>🔔 Group</b>
/welcome — nyala/matiin sambutan member baru (admin only)

<b>🛠️ Settings</b>
Pencet tombol 🛠️ Settings Model di bawah buat ganti model AI

<b>👤 Pembuat Bot</b>
@bidzqwerty`
  );
}

function safeFileName(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/[^a-z0-9.-]/gi, '_');
  } catch {
    return 'source';
  }
}

function sanitizeProjectName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 52) || 'myweb';
}

function getRealtimeClockText() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  return `🕐 <b>${formatter.format(now)} WIB</b>`;
}

function isOwner(userId) {
  return OWNER_ID !== null && userId === OWNER_ID;
}

// ================= AI HELPERS =================
function keepTyping(chatId) {
  bot.sendChatAction(chatId, 'typing').catch(() => {});
  const interval = setInterval(() => {
    bot.sendChatAction(chatId, 'typing').catch(() => {});
  }, 4000);
  return () => clearInterval(interval);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatCodeBlocks(text) {
  const parts = text.split(/```(\w*)\n?([\s\S]*?)```/g);
  let result = '';
  for (let i = 0; i < parts.length; i += 3) {
    const plain = parts[i] || '';
    result += escapeHtml(plain);
    const code = parts[i + 2];
    if (code !== undefined) {
      result += `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
    }
  }
  return result;
}

async function sendAiReply(chatId, rawText, prefix = '') {
  const formatted = formatCodeBlocks(rawText);
  await bot.sendMessage(chatId, prefix + formatted, { parse_mode: 'HTML' });
}

const DEFAULT_AI_SYSTEM_PROMPT =
  "Lu tuh asisten AI paling sinis, songong, dan ngeselin se-Telegram, tapi tetep pinter dan ngasih jawaban yang bener 😈. " +
  "Gaya lu itu gaul abis, suka nyindir dikit-dikit, kadang julid, tapi jawabannya tetep berbobot dan gak sekadar ngasal 🥶. " +
  "Pake emoji 😹🥶😱😈🫩😨🤑 secara natural di jawaban lu, jangan kaku, jangan formal, jangan sok sopan. " +
  "Boleh nge-roasting user dikit kalo pertanyaannya lucu/aneh, tapi jangan sampe nyakitin beneran atau toxic ke titik gak sopan. " +
  "Tetep jawab pake Bahasa Indonesia gaul, dan tetep inget histori chat sebelumnya di obrolan ini. " +
  "Kalau ditanya kamu model apa/siapa, jawab jujur bahwa kamu AI open-model yang di-hosting di Groq, JANGAN ngaku ChatGPT/OpenAI.";

function getAiSystemPrompt(chatId) {
  return customSystemPrompt.get(chatId) || DEFAULT_AI_SYSTEM_PROMPT;
}

function doSetPrompt(chatId, newPrompt) {
  if (!newPrompt || !newPrompt.trim()) {
    return bot.sendMessage(chatId, '❌ Prompt gaboleh kosong. Contoh: /setprompt Kamu adalah asisten AI yang jago masak.');
  }
  customSystemPrompt.set(chatId, newPrompt.trim());
  aiHistory.delete(chatId);
  bot.sendMessage(chatId, '✅ System prompt AI di obrolan ini udah diganti. Memori chat juga direset biar konsisten sama persona baru.');
}

function doResetPrompt(chatId) {
  customSystemPrompt.delete(chatId);
  aiHistory.delete(chatId);
  bot.sendMessage(chatId, '🔄 System prompt AI dibalikin ke default.');
}

function doResetAi(chatId) {
  aiHistory.delete(chatId);
  bot.sendMessage(chatId, '🧹 Memori AI di obrolan ini udah direset.');
}

// ================= KEYBOARDS =================
function mainMenuKeyboard() {
  return { inline_keyboard: [
    [{ text: '🤖 AI', callback_data: 'menu_ai' }],
    [{ text: '🕹 Create', callback_data: 'menu_create' }],
    [{ text: '🌐 Website', callback_data: 'menu_website' }],
    [{ text: '🎮 Game', callback_data: 'menu_game' }],
    [{ text: '🛠️ Utility', callback_data: 'menu_utility' }],
    [{ text: '⚙️ Operator', callback_data: 'menu_operator' }],
    [{ text: '🛠️ AI Settings', callback_data: 'menu_settings' }],
  ] };
}

function backRow() {
  return [{ text: '⬅️ Kembali', callback_data: 'menu_main' }];
}

function aiMenuKeyboard() {
  return { inline_keyboard: [
    [{ text: '🤖 /ai', callback_data: 'cmd_ai' }],
    [{ text: '💻 /code', callback_data: 'cmd_code' }],
    [{ text: '📝 /prompt', callback_data: 'cmd_prompt' }],
    backRow(),
  ] };
}

function createMenuKeyboard() {
  return { inline_keyboard: [
    [{ text: '🖼️ /image', callback_data: 'cmd_image' }],
    [{ text: '🎨 /sticker', callback_data: 'cmd_sticker' }],
    [{ text: '👤 /text', callback_data: 'cmd_text' }],
    backRow(),
  ] };
}

function websiteMenuKeyboard() {
  return { inline_keyboard: [
    [{ text: '🔍 /view', callback_data: 'cmd_view' }],
    [{ text: '🔎 /search', callback_data: 'cmd_search' }],
    [{ text: '📋 /info', callback_data: 'cmd_info' }],
    [{ text: '🚀 /deploy', callback_data: 'cmd_deploy' }],
    backRow(),
  ] };
}

function gameMenuKeyboard() {
  return { inline_keyboard: [
    [{ text: '🔢 Tebak Angka', callback_data: 'run_tebak_angka' }],
    [{ text: '🐾 Tebak Hewan', callback_data: 'run_tebak_hewan' }],
    backRow(),
  ] };
}

function utilityMenuKeyboard() {
  return { inline_keyboard: [
    [{ text: '🔗 /short', callback_data: 'cmd_short' }],
    [{ text: '📱 /qr', callback_data: 'cmd_qr' }],
    [{ text: '🌐 /translate', callback_data: 'cmd_translate' }],
    [{ text: '🧮 /calc', callback_data: 'cmd_calc' }],
    [{ text: '🕐 /time', callback_data: 'cmd_time' }],
    [{ text: '☁️ /weather', callback_data: 'cmd_weather' }],
    [{ text: '🔐 /encode', callback_data: 'cmd_encode' }],
    [{ text: '🔓 /decode', callback_data: 'cmd_decode' }],
    backRow(),
  ] };
}

function operatorMenuKeyboard() {
  return { inline_keyboard: [
    [{ text: '🧹 Clear Obrolan', callback_data: 'run_clear' }],
    [{ text: '📢 Tag All', callback_data: 'run_tagall' }],
    [{ text: '🕐 Lihat Jam', callback_data: 'run_clock' }],
    backRow(),
  ] };
}

function settingsMenuKeyboard(chatId) {
  const current = getUserModel(chatId);
  const rows = AVAILABLE_MODELS.map((m) => [{
    text: (m.id === current ? '✅ ' : '') + m.label,
    callback_data: 'set_model_' + AVAILABLE_MODELS.indexOf(m),
  }]);
  rows.push(backRow());
  return { inline_keyboard: rows };
}

function deployListKeyboard() {
  if (deployRecords.length === 0) return undefined;
  return { inline_keyboard: [[{ text: '🗑️ Remove Deploy', callback_data: 'menu_removedeploy' }]] };
}

function removeDeployKeyboard() {
  const rows = deployRecords.map((r, i) => [{ text: `🗑️ ${r.siteName}`, callback_data: 'remove_deploy_' + i }]);
  rows.push([{ text: '⬅️ Kembali', callback_data: 'noop_deploylist' }]);
  return { inline_keyboard: rows };
}

// ================= PROMPT TEXTS buat force-reply =================
const PROMPT_TEXTS = {
  ai: 'ketik pertanyaan lo buat AI:',
  code: 'ketik apa yang mau di-coding-in (contoh: buatin bubble sort di python):',
  prompt: 'ketik ide singkat yang mau dikembangin jadi prompt panjang:',
  image: 'ketik deskripsi gambar yang mau di-generate:',
  text: 'ketik kata dasar buat digenerate jadi saran username:',
  view: 'kirim link yang mau dilihat source-nya:',
  search: 'ketik kata kunci pencarian:',
  info: 'ketik pertanyaan/klaim yang mau dicek faktanya:',
  deploy: 'ketik nama web buat deploy (pastiin udah kirim file .html sebelumnya):',
  short: 'kirim link yang mau dipendekin:',
  qr: 'ketik teks/link buat dijadiin QR code:',
  translate: "ketik format: kode_bahasa teks\n(contoh: en Halo dunia)",
  calc: 'ketik ekspresi matematika (contoh: 5*(3+2)):',
  time: "ketik nama timezone (contoh: Asia/Tokyo), atau ketik - buat pake WIB:",
  weather: 'ketik nama kota:',
  encode: 'ketik teks yang mau di-encode base64:',
  decode: 'ketik teks base64 yang mau di-decode:',
};

// ================= FUNGSI-FUNGSI COMMAND =================
async function doAi(chatId, question) {
  const stopTyping = keepTyping(chatId);
  if (!aiHistory.has(chatId)) aiHistory.set(chatId, []);
  const history = aiHistory.get(chatId);
  try {
    const answer = await callLLM(chatId, getAiSystemPrompt(chatId), history, question, 0.7, 800);
    history.push({ role: 'user', content: question });
    history.push({ role: 'assistant', content: answer });
    while (history.length > MAX_HISTORY) history.shift();
    stopTyping();
    await sendAiReply(chatId, answer);
  } catch (err) {
    stopTyping();
    bot.sendMessage(chatId, `❌ Gagal tanya AI: ${err.response?.data?.error?.message || err.message}`);
  }
}

async function doPrompt(chatId, idea) {
  const stopTyping = keepTyping(chatId);
  try {
    const sys = 'Kamu adalah prompt engineer expert. Ambil ide singkat dari user, kembangin jadi prompt yang panjang, detail, terstruktur, siap pake buat AI. Jawab langsung dengan prompt hasil akhirnya aja, tanpa basa-basi.';
    const answer = await callLLM(chatId, sys, [], idea, 0.8, 1000);
    stopTyping();
    await sendAiReply(chatId, answer, '<b>📝 Prompt hasil generate:</b>\n\n');
  } catch (err) {
    stopTyping();
    bot.sendMessage(chatId, `❌ Gagal generate prompt: ${err.response?.data?.error?.message || err.message}`);
  }
}

async function doImage(chatId, prompt) {
  if (!prompt) return bot.sendMessage(chatId, '❌ Deskripsi gambar gaboleh kosong.');
  const wait = await bot.sendMessage(chatId, '🖼️ Lagi generate gambar, tunggu bentar...');
  try {
    const encoded = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 1000000);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=768&nologo=true&seed=${seed}`;
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
    await bot.sendPhoto(chatId, Buffer.from(res.data), { caption: `🖼️ ${prompt}` });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Gagal generate gambar: ${err.message}`);
  } finally {
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});
  }
}

const INVISIBLE_CHARS = ['\u200B', '\u200C', '\u200D', '\u2060', '\uFEFF'];

function randomInvisibleSuffix(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += INVISIBLE_CHARS[Math.floor(Math.random() * INVISIBLE_CHARS.length)];
  }
  return result;
}

function doText(chatId, inputText) {
  if (!inputText || !inputText.trim()) {
    return bot.sendMessage(chatId, '❌ Teks gaboleh kosong.');
  }
  const base = inputText.toLowerCase().trim().replace(/[^a-z0-9._]/g, '').slice(0, 15);
  if (!base) return bot.sendMessage(chatId, '❌ Teks harus mengandung huruf/angka.');

  const variants = [];
  for (let i = 0; i < 5; i++) {
    const suffixLen = 4 + Math.floor(Math.random() * 5);
    variants.push(`${base}${randomInvisibleSuffix(suffixLen)}`);
  }

  const text =
    `👤 <b>Hasil untuk "${base}" (kelihatan sama, tapi unik karena ada karakter invisible di belakangnya):</b>\n\n` +
    variants.map((v, i) => `${i + 1}. <code>${v}</code>`).join('\n') +
    `\n\n⚠️ Tap salah satu buat copy. Kalau ditolak di kolom username, itu karena platformnya nge-strip karakter invisible — biasanya lolos di bio/display name.`;

  bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

async function doView(chatId, rawUrl) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const wait = await bot.sendMessage(chatId, '🔍 Lagi ngambil source, tunggu bentar...');
  try {
    const { data: html } = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    const $ = cheerio.load(html);
    let output = `/* ===== HTML SOURCE (${url}) ===== */\n\n${html}\n\n`;

    $('style').each((i, el) => { output += `/* ===== INLINE <style> #${i + 1} ===== */\n${$(el).html()}\n\n`; });
    $('script:not([src])').each((i, el) => {
      const c = $(el).html();
      if (c && c.trim()) output += `/* ===== INLINE <script> #${i + 1} ===== */\n${c}\n\n`;
    });

    const cssLinks = $('link[rel="stylesheet"]').map((i, el) => $(el).attr('href')).get().slice(0, 5);
    for (const href of cssLinks) {
      try {
        const fullUrl = new URL(href, url).href;
        const res = await axios.get(fullUrl, { timeout: 10000 });
        output += `/* ===== EXTERNAL CSS: ${fullUrl} ===== */\n${res.data}\n\n`;
      } catch { output += `/* ===== GAGAL AMBIL CSS: ${href} ===== */\n\n`; }
    }

    const jsLinks = $('script[src]').map((i, el) => $(el).attr('src')).get().slice(0, 5);
    for (const src of jsLinks) {
      try {
        const fullUrl = new URL(src, url).href;
        const res = await axios.get(fullUrl, { timeout: 10000 });
        output += `/* ===== EXTERNAL JS: ${fullUrl} ===== */\n${res.data}\n\n`;
      } catch { output += `/* ===== GAGAL AMBIL JS: ${src} ===== */\n\n`; }
    }

    const buffer = Buffer.from(output, 'utf-8');
    await bot.sendDocument(chatId, buffer, { caption: `✅ Source dari ${url}` }, { filename: `${safeFileName(url)}_source.txt`, contentType: 'text/plain' });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Gagal ambil source: ${err.message}`);
  } finally {
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});
  }
}

async function doSearch(chatId, query) {
  const wait = await bot.sendMessage(chatId, `🔎 Nyari "${query}"...`);
  try {
    const { data: html } = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: query, kl: 'id-id' },
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });

    const $ = cheerio.load(html);
    const results = [];
    const seenLinks = new Set();

    $('.result').each((i, el) => {
      if (results.length >= 5) return;
      const classes = $(el).attr('class') || '';
      if (classes.includes('result--ad') || $(el).find('.badge--ad').length > 0) return;

      const title = $(el).find('.result__title').text().trim();
      let link = $(el).find('.result__title a').attr('href') || '';
      const snippet = $(el).find('.result__snippet').text().replace(/\s+/g, ' ').trim();

      const m = link.match(/uddg=([^&]+)/);
      if (m) link = decodeURIComponent(m[1]);

      if (!title || !link || !link.startsWith('http')) return;
      if (seenLinks.has(link)) return;
      seenLinks.add(link);
      results.push({ title, link, snippet });
    });

    if (results.length === 0) return bot.sendMessage(chatId, '❌ Gaada hasil ditemukan.');

    let text = `<b>🔎 Hasil pencarian: ${query}</b>\n\n`;
    results.forEach((r, i) => { text += `<b>${i + 1}. ${r.title}</b>\n${r.link}\n${r.snippet}\n\n`; });
    bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Gagal nyari: ${err.message}`);
  } finally {
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});
  }
}

async function doInfo(chatId, claim) {
  const stopTyping = keepTyping(chatId);
  try {
    const sys = 'Kamu adalah fact-checker. Jawab pake Bahasa Indonesia santai. Format: Status (BENAR/SALAH/PERLU KONTEKS/TIDAK PASTI), lalu penjelasan singkat 2-4 kalimat.';
    const answer = await callLLM(chatId, sys, [], claim, 0.3, 500);
    stopTyping();
    await sendAiReply(chatId, `${answer}\n\n⚠️ AI bisa salah, cross-check lagi ya.`, `<b>📋 Cek fakta:</b> "${claim}"\n\n`);
  } catch (err) {
    stopTyping();
    bot.sendMessage(chatId, `❌ Gagal cek fakta: ${err.response?.data?.error?.message || err.message}`);
  }
}

async function doDeploy(chatId, rawName) {
  if (!VERCEL_TOKEN) return bot.sendMessage(chatId, '❌ VERCEL_TOKEN belum diisi di .env, fitur /deploy butuh itu.');

  const usedCount = deployCount.get(chatId) || 0;
  if (usedCount >= DEPLOY_LIMIT) {
    return bot.sendMessage(chatId, `❌ Limit deploy abis (${usedCount}/${DEPLOY_LIMIT}) di obrolan ini. Gak bisa deploy lagi.`);
  }

  const siteName = sanitizeProjectName(rawName);
  const fileData = uploadedFiles.get(chatId);

  if (!fileData) {
    return bot.sendMessage(chatId, `❌ Gaada file HTML yang bisa di-deploy.\n\nKirim file .html dulu, baru pake /deploy.\n\n📊 Limit: ${usedCount}/${DEPLOY_LIMIT}`);
  }

  const wait = await bot.sendMessage(chatId, `🚀 Deploying "${fileData.fileName}" sebagai "${siteName}"...`);
  try {
    const htmlContent = fileData.buffer.toString('utf-8');
    await axios.post(
      'https://api.vercel.com/v13/deployments?skipAutoDetectionConfirmation=1',
      {
        name: siteName,
        project: siteName,
        target: 'production',
        projectSettings: { framework: null },
        files: [{ file: 'index.html', data: htmlContent }],
      },
      { headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, 'Content-Type': 'application/json' }, timeout: 30000 }
    );

    const newCount = usedCount + 1;
    deployCount.set(chatId, newCount);
    deployRecords.push({ siteName, chatId, fileName: fileData.fileName, deployedAt: new Date() });

    bot.sendMessage(
      chatId,
      `✅ Deploy berhasil!\n\n🔗 https://${siteName}.vercel.app\n\n📊 Limit: ${newCount}/${DEPLOY_LIMIT}`,
      { disable_web_page_preview: true }
    );
  } catch (err) {
    bot.sendMessage(chatId, `❌ Gagal deploy: ${err.response?.data?.error?.message || err.message}`);
  } finally {
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});
  }
}

async function doShort(chatId, rawUrl) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    const res = await axios.get('https://tinyurl.com/api-create.php', { params: { url }, timeout: 15000 });
    bot.sendMessage(chatId, `🔗 ${res.data}`);
  } catch (err) {
    bot.sendMessage(chatId, `❌ Gagal memendekkan URL: ${err.message}`);
  }
}

async function doQr(chatId, text) {
  try {
    const res = await axios.get('https://api.qrserver.com/v1/create-qr-code/', {
      params: { size: '300x300', data: text }, responseType: 'arraybuffer', timeout: 15000,
    });
    await bot.sendPhoto(chatId, Buffer.from(res.data), { caption: `📱 QR Code: ${text}` });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Gagal bikin QR code: ${err.message}`);
  }
}

async function doTranslate(chatId, targetLang, text) {
  if (!targetLang || !text) return bot.sendMessage(chatId, '❌ Format: kode_bahasa teks (contoh: en Halo dunia)');
  try {
    const res = await axios.get('https://translate.googleapis.com/translate_a/single', {
      params: { client: 'gtx', sl: 'auto', tl: targetLang, dt: 't', q: text }, timeout: 15000,
    });
    const translated = res.data[0].map((seg) => seg[0]).join('');
    bot.sendMessage(chatId, `🌐 <b>Terjemahan (${targetLang}):</b>\n\n${translated}`, { parse_mode: 'HTML' });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Gagal nerjemahin: ${err.message}`);
  }
}

function doCalc(chatId, expr) {
  expr = expr.trim();
  if (!/^[0-9+\-*/().\s%^]+$/.test(expr)) {
    return bot.sendMessage(chatId, '❌ Ekspresi cuma boleh angka & operator matematika (+ - * / % ^ ( )).');
  }
  try {
    const safeExpr = expr.replace(/\^/g, '**');
    const result = Function(`"use strict"; return (${safeExpr})`)();
    bot.sendMessage(chatId, `🧮 ${expr} = <b>${result}</b>`, { parse_mode: 'HTML' });
  } catch {
    bot.sendMessage(chatId, '❌ Ekspresi gak valid.');
  }
}

function doTime(chatId, tzInput) {
  const tz = tzInput && tzInput.trim() ? tzInput.trim() : 'Asia/Jakarta';
  try {
    const formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: tz, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    bot.sendMessage(chatId, `🕐 <b>${formatter.format(new Date())}</b>\n📍 ${tz}`, { parse_mode: 'HTML' });
  } catch {
    bot.sendMessage(chatId, '❌ Timezone gak valid. Contoh: Asia/Tokyo');
  }
}

async function doWeather(chatId, city) {
  const wait = await bot.sendMessage(chatId, `☁️ Ngecek cuaca "${city}"...`);
  try {
    const res = await axios.get(`https://wttr.in/${encodeURIComponent(city)}`, {
      params: { format: 'j1' }, timeout: 15000, headers: { 'User-Agent': 'curl/8.0' },
    });
    const current = res.data.current_condition[0];
    const area = res.data.nearest_area[0];
    const text =
      `☁️ <b>Cuaca di ${area.areaName[0].value}, ${area.country[0].value}</b>\n\n` +
      `🌡️ Suhu: ${current.temp_C}°C (terasa ${current.FeelsLikeC}°C)\n` +
      `💧 Kelembaban: ${current.humidity}%\n` +
      `💨 Angin: ${current.windspeedKmph} km/jam\n` +
      `☁️ Kondisi: ${current.weatherDesc[0].value}`;
    bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
  } catch (err) {
    bot.sendMessage(chatId, `❌ Gagal ngecek cuaca: ${err.message}`);
  } finally {
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});
  }
}

function doEncode(chatId, text) {
  const encoded = Buffer.from(text, 'utf-8').toString('base64');
  bot.sendMessage(chatId, `🔐 <b>Base64:</b>\n<code>${encoded}</code>`, { parse_mode: 'HTML' });
}

function doDecode(chatId, text) {
  try {
    const decoded = Buffer.from(text.trim(), 'base64').toString('utf-8');
    bot.sendMessage(chatId, `🔓 <b>Hasil decode:</b>\n${decoded}`, { parse_mode: 'HTML' });
  } catch {
    bot.sendMessage(chatId, '❌ Gagal decode, pastiin itu teks base64 yang valid.');
  }
}

function doTebakAngka(chatId) {
  const target = Math.floor(Math.random() * 100) + 1;
  gameState.set(chatId, { type: 'angka', answer: target, tries: 0 });
  bot.sendMessage(chatId, '🔢 Gue udah mikirin angka 1-100. Coba tebak, ketik angkanya langsung di chat!');
}

function doTebakHewan(chatId) {
  const riddle = ANIMAL_RIDDLES[Math.floor(Math.random() * ANIMAL_RIDDLES.length)];
  gameState.set(chatId, { type: 'hewan', answer: riddle.answer, tries: 0 });
  bot.sendMessage(chatId, `🐾 Tebak-tebakan hewan!\n\n"${riddle.hint}"\n\nKetik jawaban kamu langsung di chat!`);
}

async function doClear(chatObj, fromUser) {
  const chatId = chatObj.id;
  const isGroup = chatObj.type === 'group' || chatObj.type === 'supergroup';

  if (isGroup) {
    const member = await bot.getChatMember(chatId, fromUser.id).catch(() => null);
    if (!member || (member.status !== 'administrator' && member.status !== 'creator')) {
      return bot.sendMessage(chatId, '❌ Cuma admin yang bisa pake /clear di grup.');
    }
  }

  const log = messageLog.get(chatId) || [];
  let deleted = 0;
  for (const id of log) {
    try { await bot.deleteMessage(chatId, id); deleted++; } catch {}
  }
  messageLog.set(chatId, []);

  const info = await bot.sendMessage(chatId, `🧹 Obrolan dibersihin! (${deleted} pesan kehapus)`);
  setTimeout(() => bot.deleteMessage(chatId, info.message_id).catch(() => {}), 5000);
}

async function doTagAll(chatObj) {
  const chatId = chatObj.id;
  if (chatObj.type !== 'group' && chatObj.type !== 'supergroup') {
    return bot.sendMessage(chatId, '❌ Command ini cuma buat di grup.');
  }
  const members = chatMembers.get(chatId);
  if (!members || members.size === 0) {
    return bot.sendMessage(chatId, '❌ Belum ada anggota yang ketrack. Suruh anggota ngirim pesan dulu biar bot kenal mereka.');
  }
  const mentions = Array.from(members.entries()).map(([id, u]) => `<a href="tg://user?id=${id}">${u.first_name}</a>`);
  const chunkSize = 5;
  for (let i = 0; i < mentions.length; i += chunkSize) {
    await bot.sendMessage(chatId, `📢 ${mentions.slice(i, i + chunkSize).join(' ')}`, { parse_mode: 'HTML' });
  }
}

function stopClockIfRunning(messageId) {
  const running = activeClocks.get(messageId);
  if (running) { clearInterval(running.intervalId); activeClocks.delete(messageId); }
}

async function startLiveClock(chatId) {
  const sent = await bot.sendMessage(chatId, getRealtimeClockText(), {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: '⏹ Stop', callback_data: 'stop_clock' }]] },
  });
  const messageId = sent.message_id;

  const intervalId = setInterval(async () => {
    try {
      await bot.editMessageText(getRealtimeClockText(), {
        chat_id: chatId, message_id: messageId, parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '⏹ Stop', callback_data: 'stop_clock' }]] },
      });
    } catch (err) {
      if (!err.message || !err.message.includes('message is not modified')) stopClockIfRunning(messageId);
    }
  }, 1000);

  activeClocks.set(messageId, { intervalId, chatId });

  setTimeout(() => {
    stopClockIfRunning(messageId);
    bot.editMessageReplyMarkup(
      { inline_keyboard: [[{ text: '⏱️ Otomatis berhenti (5 menit)', callback_data: 'noop' }]] },
      { chat_id: chatId, message_id: messageId }
    ).catch(() => {});
  }, 5 * 60 * 1000);
}

async function doWelcomeToggle(chatObj, fromUser) {
  const chatId = chatObj.id;
  if (chatObj.type !== 'group' && chatObj.type !== 'supergroup') {
    return bot.sendMessage(chatId, '❌ Command ini cuma buat di grup.');
  }
  const member = await bot.getChatMember(chatId, fromUser.id).catch(() => null);
  if (!member || (member.status !== 'administrator' && member.status !== 'creator')) {
    return bot.sendMessage(chatId, '❌ Cuma admin yang bisa pake /welcome.');
  }
  const current = welcomeEnabled.get(chatId) || false;
  welcomeEnabled.set(chatId, !current);
  bot.sendMessage(
    chatId,
    !current
      ? '✅ Sambutan member baru diaktifin! Member yang join bakal disambut otomatis.'
      : '🔕 Sambutan member baru dimatiin.'
  );
}

async function sendWelcomeMessage(chatId, newMember) {
  const name = newMember.first_name + (newMember.last_name ? ' ' + newMember.last_name : '');
  const username = newMember.username ? '@' + newMember.username : '(gapunya username)';
  const mention = `<a href="tg://user?id=${newMember.id}">${name}</a>`;
  const caption =
    `👋 <b>Selamat datang, ${mention}!</b>\n\n` +
    `🆔 ID: <code>${newMember.id}</code>\n` +
    `📛 Username: ${username}\n\n` +
    `Semoga betah di grup ini! Ketik /start buat liat menu bot.`;

  try {
    const photos = await bot.getUserProfilePhotos(newMember.id, { limit: 1 });
    if (photos && photos.total_count > 0) {
      const fileId = photos.photos[0][photos.photos[0].length - 1].file_id;
      await bot.sendPhoto(chatId, fileId, { caption, parse_mode: 'HTML' });
    } else {
      await bot.sendMessage(chatId, caption + '\n\n<i>(User ini gapunya foto profil)</i>', { parse_mode: 'HTML' });
    }
  } catch {
    await bot.sendMessage(chatId, caption, { parse_mode: 'HTML' });
  }
}

function doDeployList(chatId, userId) {
  if (!isOwner(userId)) return;
  if (deployRecords.length === 0) return bot.sendMessage(chatId, '📦 Belum ada deploy yang tercatat.');

  let text = `<b>📦 Daftar Deploy (${deployRecords.length}):</b>\n\n`;
  deployRecords.forEach((r, i) => {
    text += `${i + 1}. <b>${r.siteName}</b>\n   🔗 https://${r.siteName}.vercel.app\n   📄 ${r.fileName} · 🕐 ${r.deployedAt.toLocaleString('id-ID')}\n\n`;
  });

  bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: deployListKeyboard() });
}

async function doRemoveDeploy(chatId, messageId, index) {
  const record = deployRecords[index];
  if (!record) return;

  try {
    await axios.delete(`https://api.vercel.com/v9/projects/${record.siteName}`, {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` }, timeout: 15000,
    });
  } catch {}

  deployRecords.splice(index, 1);

  if (deployRecords.length === 0) {
    await bot.editMessageText('📦 Semua deploy udah dihapus.', { chat_id: chatId, message_id: messageId }).catch(() => {});
  } else {
    let text = `<b>📦 Daftar Deploy (${deployRecords.length}):</b>\n\n`;
    deployRecords.forEach((r, i) => { text += `${i + 1}. <b>${r.siteName}</b>\n   🔗 https://${r.siteName}.vercel.app\n\n`; });
    await bot.editMessageText(text, {
      chat_id: chatId, message_id: messageId, parse_mode: 'HTML', disable_web_page_preview: true,
      reply_markup: removeDeployKeyboard(),
    }).catch(() => {});
  }
}

// ================= DISPATCHER buat pendingCommand =================
function executeCommand(cmd, chatId, argText) {
  switch (cmd) {
    case 'ai': return doAi(chatId, argText);
    case 'code': return doCode(chatId, argText);
    case 'prompt': return doPrompt(chatId, argText);
    case 'image': return doImage(chatId, argText);
    case 'text': return doText(chatId, argText);
    case 'view': return doView(chatId, argText);
    case 'search': return doSearch(chatId, argText);
    case 'info': return doInfo(chatId, argText);
    case 'deploy': return doDeploy(chatId, argText);
    case 'short': return doShort(chatId, argText);
    case 'qr': return doQr(chatId, argText);
    case 'translate': {
      const parts = argText.trim().split(/\s+/);
      const lang = parts.shift();
      return doTranslate(chatId, lang, parts.join(' '));
    }
    case 'calc': return doCalc(chatId, argText);
    case 'time': return doTime(chatId, argText === '-' ? null : argText);
    case 'weather': return doWeather(chatId, argText);
    case 'encode': return doEncode(chatId, argText);
    case 'decode': return doDecode(chatId, argText);
    default: return null;
  }
}

// ================= SET COMMANDS (deploylist SENGAJA gak dimasukin, biar tersembunyi) =================
bot.setMyCommands([
  { command: 'start', description: 'Nampilin menu utama' },
  { command: 'ai', description: 'Tanya apa aja ke AI' },
  { command: 'resetai', description: 'Reset memori chat AI' },
  { command: 'setprompt', description: 'Ganti persona/system prompt AI' },
  { command: 'resetprompt', description: 'Balikin system prompt AI ke default' },
  { command: 'prompt', description: 'Generate prompt yang lebih panjang' },
  { command: 'image', description: 'Generate gambar dari teks' },
  { command: 'sticker', description: 'Ubah gambar jadi stiker' },
  { command: 'code', description: 'Generate kode & kirim sebagai file' },
  { command: 'text', description: 'Generate saran username unik' },
  { command: 'view', description: 'Liat source html/css/js dari link' },
  { command: 'search', description: 'Cari di web' },
  { command: 'info', description: 'Cek fakta bener apa kaga' },
  { command: 'deploy', description: 'Deploy file html ke Vercel' },
  { command: 'tebak', description: 'Main tebak-tebakan (angka/hewan)' },
  { command: 'clear', description: 'Bersihin obrolan' },
  { command: 'tagall', description: 'Tag semua anggota grup' },
  { command: 'clock', description: 'Liat jam real-time' },
  { command: 'welcome', description: 'Toggle sambutan member baru' },
  { command: 'short', description: 'Memendekkan URL' },
  { command: 'qr', description: 'Bikin QR code' },
  { command: 'translate', description: 'Menerjemahkan teks' },
  { command: 'calc', description: 'Kalkulator' },
  { command: 'time', description: 'Menampilkan waktu' },
  { command: 'weather', description: 'Cuaca suatu lokasi' },
  { command: 'encode', description: 'Encode teks base64' },
  { command: 'decode', description: 'Decode teks base64' },
]).catch((err) => console.error('Gagal set commands:', err.message));

// ================= /start =================
bot.onText(/^\/start(?:@\w+)?$/, (msg) => {
  bot.sendMessage(msg.chat.id, menuText(), { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() });
});

// ================= CALLBACK QUERY (tombol) =================
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  const editTo = (text, keyboard) =>
    bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'HTML', reply_markup: keyboard })
      .catch((err) => {
        if (!err.message || !err.message.includes('message is not modified')) throw err;
      });

  try {
    if (data === 'menu_main') {
      await editTo(menuText(), mainMenuKeyboard());
    } else if (data === 'menu_settings') {
      await editTo(
        `<b>🛠️ AI Settings</b>\n\nProvider aktif: <b>${getUserProvider(chatId) === 'gemini' ? 'Gemini' : 'Groq'}</b>\nModel aktif: <b>${getUserModel(chatId)}</b>`,
        { inline_keyboard: [
          [{ text: '🔌 Select Provider', callback_data: 'menu_provider' }],
          [{ text: '🧠 Select Model', callback_data: 'menu_selectmodel' }],
          backRow(),
        ] }
      );
    } else if (data === 'menu_selectmodel') {
      const provider = getUserProvider(chatId);
      await editTo(`<b>🧠 Select Model (${provider === 'gemini' ? 'Gemini' : 'Groq'})</b>\n\nPilih model:`, modelListKeyboard(chatId, provider));
    } else if (data.startsWith('set_model_g_') || data.startsWith('set_model_m_')) {
      const isGemini = data.startsWith('set_model_m_');
      const idx = parseInt(data.replace(isGemini ? 'set_model_m_' : 'set_model_g_', ''), 10);
      const models = isGemini ? GEMINI_MODELS : GROQ_MODELS;
      const model = models[idx];
      if (model) {
        if (isGemini) geminiModelChoice.set(chatId, model.id);
        else userModels.set(chatId, model.id);
        await editTo(`<b>🧠 Select Model (${isGemini ? 'Gemini' : 'Groq'})</b>\n\nPilih model:`, modelListKeyboard(chatId, isGemini ? 'gemini' : 'groq'));
        await bot.answerCallbackQuery(query.id, { text: `✅ Model diganti ke ${model.label}` });
        return;
      }
    } else if (data === 'menu_provider') {
      await editTo('<b>🔌 Select Provider</b>\n\nPilih provider AI yang mau dipake:', providerMenuKeyboard(chatId));
    } else if (data === 'select_provider_groq' || data === 'select_provider_gemini') {
      const provider = data === 'select_provider_groq' ? 'groq' : 'gemini';
      userProviders.set(chatId, provider);
      await editTo(
        `<b>🛠️ AI Settings</b>\n\nProvider aktif: <b>${provider === 'gemini' ? 'Gemini' : 'Groq'}</b>\nModel aktif: <b>${getUserModel(chatId)}</b>`,
        { inline_keyboard: [
          [{ text: '🔌 Select Provider', callback_data: 'menu_provider' }],
          [{ text: '🧠 Select Model', callback_data: 'menu_selectmodel' }],
          backRow(),
        ] }
      );
      await bot.answerCallbackQuery(query.id, { text: `✅ Provider diganti ke ${provider === 'groq' ? 'Groq' : 'Gemini'}` });
      return;
    } else if (data === 'menu_ai') {
      await editTo('<b>🤖 AI</b>\n\nPilih command:', aiMenuKeyboard());
    } else if (data === 'menu_create') {
      await editTo('<b>🕹 Create</b>\n\nPilih command:', createMenuKeyboard());
    } else if (data === 'menu_website') {
      await editTo('<b>🌐 WebSite</b>\n\nPilih command:', websiteMenuKeyboard());
    } else if (data === 'menu_game') {
      await editTo('<b>🎮 Game</b>\n\nPilih game:', gameMenuKeyboard());
    } else if (data === 'menu_utility') {
      await editTo('<b>🛠️ Utility</b>\n\nPilih command:', utilityMenuKeyboard());
    } else if (data === 'menu_operator') {
      await editTo('<b>⚙️ Operator</b>\n\nPilih command:', operatorMenuKeyboard());
    } else if (data === 'menu_removedeploy') {
      if (!isOwner(query.from.id)) { await bot.answerCallbackQuery(query.id); return; }
      await editTo('<b>🗑️ Pilih deploy yang mau dihapus:</b>', removeDeployKeyboard());
    } else if (data === 'noop_deploylist') {
      if (!isOwner(query.from.id)) { await bot.answerCallbackQuery(query.id); return; }
      let text = `<b>📦 Daftar Deploy (${deployRecords.length}):</b>\n\n`;
      deployRecords.forEach((r, i) => { text += `${i + 1}. <b>${r.siteName}</b>\n   🔗 https://${r.siteName}.vercel.app\n\n`; });
      await editTo(text, deployListKeyboard());
    } else if (data.startsWith('remove_deploy_')) {
      if (!isOwner(query.from.id)) { await bot.answerCallbackQuery(query.id); return; }
      const idx = parseInt(data.replace('remove_deploy_', ''), 10);
      await bot.answerCallbackQuery(query.id, { text: '🗑️ Menghapus...' });
      await doRemoveDeploy(chatId, messageId, idx);
      return;
    } else if (data === 'run_tebak_angka') {
      doTebakAngka(chatId);
    } else if (data === 'run_tebak_hewan') {
      doTebakHewan(chatId);
    } else if (data === 'run_clear') {
      await doClear(query.message.chat, query.from);
    } else if (data === 'run_tagall') {
      await doTagAll(query.message.chat);
    } else if (data === 'run_clock') {
      await startLiveClock(chatId);
    } else if (data === 'stop_clock') {
      stopClockIfRunning(messageId);
      await bot.editMessageReplyMarkup({ inline_keyboard: [[{ text: '⏹️ Dihentikan', callback_data: 'noop' }]] }, { chat_id: chatId, message_id: messageId }).catch(() => {});
      await bot.answerCallbackQuery(query.id, { text: '⏹ Jam dihentikan' });
      return;
    } else if (data === 'noop') {
      await bot.answerCallbackQuery(query.id);
      return;
    } else if (data.startsWith('cmd_')) {
      const cmd = data.replace('cmd_', '');
      const promptText = PROMPT_TEXTS[cmd] || 'Ketik input-nya:';
      const cleanText = promptText.charAt(0).toUpperCase() + promptText.slice(1);
      const sent = await bot.sendMessage(chatId, cleanText, { reply_markup: { force_reply: true, selective: true } });
      pendingCommand.set(chatId, { cmd, userId: query.from.id, promptMessageId: sent.message_id });
      await bot.answerCallbackQuery(query.id);
      return;
    } else if (data === 'menu_provider') {
      await editTo('<b>🔌 Select Provider</b>\n\nPilih provider AI yang mau dipake:', providerMenuKeyboard(chatId));
    } else if (data === 'select_provider_groq' || data === 'select_provider_gemini') {
      const provider = data === 'select_provider_groq' ? 'groq' : 'gemini';
      userProviders.set(chatId, provider);
      await editTo(`<b>🔌 ${provider === 'groq' ? 'Groq' : 'Gemini'}</b>\n\nPilih model:`, modelListKeyboard(chatId, provider));
      await bot.answerCallbackQuery(query.id, { text: `✅ Provider diganti ke ${provider === 'groq' ? 'Groq' : 'Gemini'}` });
      return;
    } else if (data.startsWith('set_model_g_') || data.startsWith('set_model_m_')) {
      const isGemini = data.startsWith('set_model_m_');
      const idx = parseInt(data.replace(isGemini ? 'set_model_m_' : 'set_model_g_', ''), 10);
      const models = isGemini ? GEMINI_MODELS : GROQ_MODELS;
      const model = models[idx];
      if (model) {
        if (isGemini) geminiModelChoice.set(chatId, model.id);
        else userModels.set(chatId, model.id);
        userProviders.set(chatId, isGemini ? 'gemini' : 'groq');
        await editTo(`<b>🔌 ${isGemini ? 'Gemini' : 'Groq'}</b>\n\nPilih model:`, modelListKeyboard(chatId, isGemini ? 'gemini' : 'groq'));
        await bot.answerCallbackQuery(query.id, { text: `✅ Model diganti ke ${model.label}` });
        return;
      }
    }

    bot.answerCallbackQuery(query.id).catch(() => {});
  } catch (err) {
    bot.answerCallbackQuery(query.id, { text: 'Gagal load menu', show_alert: false }).catch(() => {});
  }
});

// ================= COMMAND HANDLER (ketik manual) =================
bot.onText(/^\/ai(?:@\w+)? (.+)/s, (msg, match) => doAi(msg.chat.id, match[1].trim()));
bot.onText(/^\/resetai(?:@\w+)?$/, (msg) => doResetAi(msg.chat.id));
bot.onText(/^\/setprompt(?:@\w+)? (.+)/s, (msg, match) => doSetPrompt(msg.chat.id, match[1]));
bot.onText(/^\/resetprompt(?:@\w+)?$/, (msg) => doResetPrompt(msg.chat.id));
bot.onText(/^\/prompt(?:@\w+)? (.+)/s, (msg, match) => doPrompt(msg.chat.id, match[1].trim()));
bot.onText(/^\/image(?:@\w+)? (.+)/s, (msg, match) => doImage(msg.chat.id, match[1].trim()));
bot.onText(/^\/text(?:@\w+)? (.+)/s, (msg, match) => doText(msg.chat.id, match[1]));
bot.onText(/^\/view(?:@\w+)? (.+)/, (msg, match) => doView(msg.chat.id, match[1].trim()));
bot.onText(/^\/search(?:@\w+)? (.+)/, (msg, match) => doSearch(msg.chat.id, match[1].trim()));
bot.onText(/^\/info(?:@\w+)? (.+)/, (msg, match) => doInfo(msg.chat.id, match[1].trim()));
bot.onText(/^\/deploy(?:@\w+)? (\S+)/, (msg, match) => doDeploy(msg.chat.id, match[1].trim()));
bot.onText(/^\/short(?:@\w+)? (\S+)/, (msg, match) => doShort(msg.chat.id, match[1].trim()));
bot.onText(/^\/qr(?:@\w+)? (.+)/s, (msg, match) => doQr(msg.chat.id, match[1].trim()));
bot.onText(/^\/translate(?:@\w+)? (\S+) (.+)/s, (msg, match) => doTranslate(msg.chat.id, match[1].trim(), match[2].trim()));
bot.onText(/^\/calc(?:@\w+)? (.+)/, (msg, match) => doCalc(msg.chat.id, match[1]));
bot.onText(/^\/time(?:@\w+)?(?:\s+(.+))?$/, (msg, match) => doTime(msg.chat.id, match[1]));
bot.onText(/^\/weather(?:@\w+)? (.+)/, (msg, match) => doWeather(msg.chat.id, match[1].trim()));
bot.onText(/^\/encode(?:@\w+)? (.+)/s, (msg, match) => doEncode(msg.chat.id, match[1]));
bot.onText(/^\/decode(?:@\w+)? (.+)/s, (msg, match) => doDecode(msg.chat.id, match[1]));
bot.onText(/^\/clock(?:@\w+)?$/, (msg) => startLiveClock(msg.chat.id));
bot.onText(/^\/clear(?:@\w+)?$/, (msg) => doClear(msg.chat, msg.from));
bot.onText(/^\/tagall(?:@\w+)?$/, (msg) => doTagAll(msg.chat));
bot.onText(/^\/welcome(?:@\w+)?$/, (msg) => doWelcomeToggle(msg.chat, msg.from));
bot.onText(/^\/deploylist(?:@\w+)?$/, (msg) => doDeployList(msg.chat.id, msg.from.id));

bot.onText(/^\/tebak(?:@\w+)? (.+)/i, (msg, match) => {
  const mode = match[1].trim().toLowerCase();
  if (mode === 'angka') return doTebakAngka(msg.chat.id);
  if (mode === 'hewan') return doTebakHewan(msg.chat.id);
  bot.sendMessage(msg.chat.id, '❌ Mode gaada. Pake: /tebak angka  atau  /tebak hewan');
});

bot.on('new_chat_members', (msg) => {
  const chatId = msg.chat.id;
  if (!welcomeEnabled.get(chatId)) return;
  for (const member of msg.new_chat_members) {
    if (member.is_bot) continue;
    sendWelcomeMessage(chatId, member);
  }
});

// ================= HANDLE UPLOAD FILE, PENDING COMMAND, & JAWABAN GAME =================
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    if (msg.from && !msg.from.is_bot) {
      if (!chatMembers.has(chatId)) chatMembers.set(chatId, new Map());
      chatMembers.get(chatId).set(msg.from.id, { first_name: msg.from.first_name || 'User' });
    }
  }
  if (!messageLog.has(chatId)) messageLog.set(chatId, []);
  const log = messageLog.get(chatId);
  log.push(msg.message_id);
  if (log.length > 1000) log.shift();

  if (msg.photo && msg.photo.length > 0) {
    const largestPhoto = msg.photo[msg.photo.length - 1];
    uploadedPhotos.set(chatId, { fileId: largestPhoto.file_id, messageId: msg.message_id });
  }

  if (msg.document) {
    const fileName = msg.document.file_name || 'file.html';
    const mime = msg.document.mime_type || '';
    if (fileName.toLowerCase().endsWith('.html') || mime.includes('html')) {
      try {
        const fileLink = await bot.getFileLink(msg.document.file_id);
        const res = await axios.get(fileLink, { responseType: 'arraybuffer', timeout: 20000 });
        const buffer = Buffer.from(res.data);
        const data = { buffer, fileName, messageId: msg.message_id };
        uploadedFiles.set(chatId, data);
        filesByMessageId.set(msg.message_id, data);
        bot.sendMessage(chatId, `📄 File "${fileName}" diterima.\n\nKetik /deploy <namaweb> buat deploy ke Vercel.`, { reply_to_message_id: msg.message_id });
      } catch (err) {
        bot.sendMessage(chatId, `❌ Gagal download file: ${err.message}`);
      }
    }
    return;
  }

  const text = msg.text;
  if (!text || text.startsWith('/')) return;

  const pending = pendingCommand.get(chatId);
  if (pending && msg.reply_to_message && msg.reply_to_message.message_id === pending.promptMessageId && msg.from.id === pending.userId) {
    pendingCommand.delete(chatId);
    executeCommand(pending.cmd, chatId, text.trim());
    return;
  }

  const state = gameState.get(chatId);
  if (!state) return;

  if (state.type === 'angka') {
    const guess = parseInt(text, 10);
    if (isNaN(guess)) return;
    state.tries += 1;
    if (guess === state.answer) {
      bot.sendMessage(chatId, `🎉 Bener! Angkanya emang ${state.answer}. Ketebak dalam ${state.tries} kali coba.`);
      gameState.delete(chatId);
    } else if (guess < state.answer) {
      bot.sendMessage(chatId, '📈 Lebih besar lagi!');
    } else {
      bot.sendMessage(chatId, '📉 Lebih kecil lagi!');
    }
    return;
  }

  if (state.type === 'hewan') {
    state.tries += 1;
    if (text.trim().toLowerCase() === state.answer) {
      bot.sendMessage(chatId, `🎉 Bener banget! Jawabannya "${state.answer}". Ketebak dalam ${state.tries} kali coba.`);
      gameState.delete(chatId);
    } else {
      bot.sendMessage(chatId, '❌ Belum tepat, coba lagi!');
    }
    return;
  }
});

const CODE_EXT_MAP = {
  javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
  python: 'py', py: 'py', html: 'html', css: 'css',
  java: 'java', c: 'c', cpp: 'cpp', 'c++': 'cpp',
  csharp: 'cs', 'c#': 'cs', cs: 'cs', php: 'php',
  ruby: 'rb', rb: 'rb', go: 'go', golang: 'go',
  rust: 'rs', rs: 'rs', sql: 'sql', json: 'json',
  bash: 'sh', sh: 'sh', shell: 'sh', kotlin: 'kt',
  swift: 'swift', lua: 'lua', xml: 'xml', yaml: 'yml', yml: 'yml',
};

async function doCode(chatId, request) {
  const stopTyping = keepTyping(chatId);
  try {
    const sys = 'Kamu adalah programmer expert. Tulis kode LENGKAP dan siap jalan sesuai permintaan user. WAJIB bungkus kode dalam satu blok markdown ```bahasa. Boleh kasih penjelasan singkat 1-3 kalimat SEBELUM blok kode, jangan taruh penjelasan panjang setelah kode.';
    const full = await callLLM(chatId, sys, [], request, 0.3, 2000);
    stopTyping();

    const CODE_EXT_MAP = {
      javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', python: 'py', py: 'py',
      html: 'html', css: 'css', java: 'java', c: 'c', cpp: 'cpp', 'c++': 'cpp',
      csharp: 'cs', 'c#': 'cs', cs: 'cs', php: 'php', ruby: 'rb', rb: 'rb',
      go: 'go', golang: 'go', rust: 'rs', rs: 'rs', sql: 'sql', json: 'json',
      bash: 'sh', sh: 'sh', shell: 'sh', kotlin: 'kt', swift: 'swift',
      lua: 'lua', xml: 'xml', yaml: 'yml', yml: 'yml',
    };

    const match = full.match(/```(\w*)\n?([\s\S]*?)```/);
    if (!match) return bot.sendMessage(chatId, full);

    const lang = (match[1] || 'txt').toLowerCase();
    const codeContent = match[2].trim();
    const ext = CODE_EXT_MAP[lang] || 'txt';
    const explanation = full.slice(0, match.index).trim();

    if (explanation) await bot.sendMessage(chatId, explanation);
    await bot.sendDocument(chatId, Buffer.from(codeContent, 'utf-8'), { caption: `💻 Kode ${lang} siap pake` }, { filename: `code.${ext}`, contentType: 'text/plain' });
  } catch (err) {
    stopTyping();
    bot.sendMessage(chatId, `❌ Gagal generate kode: ${err.response?.data?.error?.message || err.message}`);
  }
}

bot.onText(/^\/code(?:@\w+)? (.+)/s, (msg, match) => doCode(msg.chat.id, match[1].trim()));

async function doSticker(chatId, replyMsgId) {
  const photoData = uploadedPhotos.get(chatId);
  if (!photoData) {
    return bot.sendMessage(chatId, '❌ Gaada gambar yang bisa dijadiin stiker.\n\nKirim/reply gambar dulu, terus ketik /sticker.');
  }

  const wait = await bot.sendMessage(chatId, '🖼️ Lagi bikin stiker...');
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `stk_in_${Date.now()}.jpg`);
  const outputPath = path.join(tmpDir, `stk_out_${Date.now()}.webp`);

  try {
    const fileLink = await bot.getFileLink(photoData.fileId);
    const res = await axios.get(fileLink, { responseType: 'arraybuffer', timeout: 20000 });
    fs.writeFileSync(inputPath, Buffer.from(res.data));

    await new Promise((resolve, reject) => {
      execFile('ffmpeg', [
        '-y', '-i', inputPath,
        '-vf', "scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000",
        '-vcodec', 'libwebp',
        '-pix_fmt', 'yuva420p',
        '-lossless', '0',
        '-quality', '90',
        '-compression_level', '6',
        outputPath,
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const webpBuffer = fs.readFileSync(outputPath);
    await bot.sendSticker(chatId, webpBuffer);
  } catch (err) {
    bot.sendMessage(chatId, `❌ Gagal bikin stiker: ${err.message}`);
  } finally {
    bot.deleteMessage(chatId, wait.message_id).catch(() => {});
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
  }
}

bot.onText(/^\/sticker(?:@\w+)?$/, (msg) => doSticker(msg.chat.id));

bot.on('polling_error', (err) => console.error('Polling error:', err.message));
process.on('unhandledRejection', (err) => console.error('Unhandled rejection:', err));
