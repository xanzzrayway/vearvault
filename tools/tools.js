/* ---------- VearTools: halaman /tools (butuh login Google dan Aktivasi Key) ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function toast(m){ const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("on"), 2400); }

const configured = typeof SUPABASE_URL !== "undefined" && !!SUPABASE_URL && typeof SUPABASE_ANON_KEY !== "undefined" && !!SUPABASE_ANON_KEY && !!window.supabase;
const sb = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/* Daftar tools. Dikosongkan dulu; nanti diisi seperti { id, name, desc, href } */
const TOOLS = [];

const GLOGO = `<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.3.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>`;

let user = null, profile = null, status = { has_key: false, activated: false }, busy = false;

async function login(){
  if(!configured) return toast("Isi SUPABASE_URL dan SUPABASE_ANON_KEY dulu");
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + "/tools/" } });
  if(error) toast("Gagal masuk dengan Google");
}
async function logout(){ await sb.auth.signOut(); }

function renderAuth(){
  const a = $("#auth");
  if(!user){
    a.innerHTML = `<button class="gbtn" id="loginBtn" type="button"><span class="gico">${GLOGO}<b>+</b></span><span class="t">Masuk</span></button>`;
    $("#loginBtn").onclick = login;
    return;
  }
  const name = (profile && profile.display_name) || (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || user.email || "?";
  const img = (profile && profile.avatar_url) || (user.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.picture)) || "";
  const av = img ? `<img class="avatar" src="${esc(img)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar init">${esc(String(name).trim().charAt(0).toUpperCase())}</span>`;
  a.innerHTML = `<button class="user" id="avBtn" type="button" aria-label="Akun">${av}</button>`;
  $("#avBtn").onclick = () => { if(confirm("Keluar dari akun " + name + "?")) logout(); };
}

/* ---------- Tampilan utama ---------- */
function card(inner){ return `<section class="st-card tl-card">${inner}</section>`; }

function paint(){
  const m = $("#tlMain");
  if(!configured){ m.innerHTML = card(`<h3>Belum terhubung</h3><p class="note">Isi SUPABASE_URL dan SUPABASE_ANON_KEY di js/config.js dulu.</p>`); return; }
  if(!user){
    m.innerHTML = card(`<h3>Masuk dulu</h3>
      <p class="note">VearTools khusus pengguna VearVault. Masuk dengan Google untuk melanjutkan.</p>
      <button class="btn" id="tlLogin" type="button">Masuk dengan Google</button>`);
    $("#tlLogin").onclick = login;
    return;
  }
  if(!status.activated){
    m.innerHTML = card(`<h3>Aktivasi Key</h3>
      <p class="note">Masukkan key aktivasi untuk membuka VearTools.</p>
      <form id="akForm" autocomplete="off">
        <input type="text" id="akIn" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="9" placeholder="VT-123456" aria-label="Key aktivasi">
        <button class="btn" type="submit" id="akGo">Aktifkan</button>
      </form>
      <p class="note">Belum punya key? Buka <a class="tl-link" href="/">VearVault</a>, ketuk menu garis tiga, lalu pilih <b>Aktivasi Key</b>. Satu akun hanya bisa punya satu key.</p>`);
    $("#akIn").addEventListener("input", e => { e.target.value = fmtKey(e.target.value); });
    $("#akForm").onsubmit = activate;
    return;
  }
  if(!TOOLS.length){
    m.innerHTML = card(`<h3>Tools</h3>
      <div class="tl-empty"><img src="/tools/assets/logo-sm.png" width="72" height="72" alt=""><b>Belum ada tools</b><span>Tools akan hadir di sini.</span></div>`);
    return;
  }
  m.innerHTML = card(`<h3>Tools</h3><div class="tl-grid">${TOOLS.map(t =>
    `<a class="tl-tool" href="${esc(t.href)}"><b>${esc(t.name)}</b><span>${esc(t.desc || "")}</span></a>`).join("")}</div>`);
}

/* Bentuk key: VT- diikuti 6 angka. Yang diketik otomatis dirapikan. */
function fmtKey(v){
  const raw = String(v || "").toUpperCase();
  const digits = raw.replace(/^\s*VT-?/, "").replace(/\D/g, "").slice(0, 6);
  if(!digits) return /^V/.test(raw) ? "VT-" : "";
  return "VT-" + digits;
}

async function activate(e){
  e.preventDefault();
  if(busy) return;
  const key = fmtKey($("#akIn").value);
  if(!/^VT-\d{6}$/.test(key)) return toast("Format key: VT- lalu 6 angka");
  busy = true; $("#akGo").disabled = true;
  const { error } = await sb.rpc("activate_tools_key", { p_key: key });
  busy = false;
  const btn = $("#akGo"); if(btn) btn.disabled = false;
  if(error){
    const m = error.message || "";
    return toast(/belum punya key/.test(m) ? "Kamu belum punya key. Buat dulu di VearVault: menu garis tiga, Aktivasi Key"
      : /tidak cocok/.test(m) ? "Key tidak cocok dengan akunmu" : "Gagal mengaktifkan key");
  }
  status.activated = true;
  toast("Key aktif. Selamat datang di VearTools");
  paint();
}

async function loadStatus(){
  status = { has_key: false, activated: false };
  if(!user) return;
  const { data } = await sb.rpc("tools_status");
  if(data) status = { has_key: !!data.has_key, activated: !!data.activated };
}
async function setUser(raw){
  user = raw && !raw.is_anonymous ? raw : null;   // akun tamu dianggap belum login
  profile = null;
  if(user){
    const { data } = await sb.from("profiles").select("display_name,avatar_url").eq("id", user.id).maybeSingle();
    profile = data || null;
  }
  await loadStatus();
  renderAuth();
  paint();
}

(async function init(){
  renderAuth(); paint();
  if(!configured) return;
  const { data } = await sb.auth.getSession();
  await setUser(data.session ? data.session.user : null);
  sb.auth.onAuthStateChange((_ev, s) => {
    const next = s && s.user && !s.user.is_anonymous ? s.user : null;
    if((next && next.id || null) !== (user && user.id || null)) setTimeout(() => setUser(s ? s.user : null), 0);
  });
})();
