/* ---------- Chat Global (realtime): teks, foto, dan video ---------- */
const CH_COLS = "id,user_id,content,created_at,media_url,media_type";
const CH_MAX = 20 * 1024 * 1024;   // batas ukuran file: 20 MB
const CH_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];
const CH_EXT = { "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp", "image/gif":"gif", "video/mp4":"mp4", "video/webm":"webm", "video/quicktime":"mov" };

let chatCh = null, chatReady = false, chatQ = [], chatIds = new Set(), chatLast = null, chStick = true, chSel = null;
let chCool = 0, chTimer = null;
const CH_COOL = 10000;   // jeda antar pesan: 10 detik
const chatData = new Map();

const I_SEND = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>`;
const I_IMG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/></svg>`;

const I_DOTS = `<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`;

const chNear = () => { const l = $("#chList"); return l.scrollHeight - l.scrollTop - l.clientHeight < 120; };
const chScroll = () => { const l = $("#chList"); l.scrollTop = l.scrollHeight; };

function addChat(m, live){
  if(chatIds.has(m.id)) return;
  chatIds.add(m.id);
  chatData.set(m.id, m);
  const own = user && m.user_id===user.id;
  const p = PROF[m.user_id] || {};
  const name = p.display_name || "Anonim";
  const t = new Date(m.created_at);
  const grouped = chatLast && chatLast.u===m.user_id && (t - chatLast.t) < 300000;
  chatLast = { u: m.user_id, t };
  if(own) chStick = true;
  const head = (!own && !grouped) ? `<button class="nm" data-user="${esc(m.user_id)}" type="button">${esc(name)}${p.role==="admin" ? '<span class="adbadge">Admin</span>' : ""}</button>` : "";
  const av = own ? "" : grouped ? '<span class="av gap"></span>'
    : `<button class="av" data-user="${esc(m.user_id)}" type="button" aria-label="Lihat profil">${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="" referrerpolicy="no-referrer">` : esc(initial(name))}</button>`;
  const okMedia = m.media_url && /^https:\/\//.test(m.media_url);
  const media = !okMedia ? "" : m.media_type==="video"
    ? `<video class="mm" src="${esc(m.media_url)}" controls playsinline preload="metadata"></video>`
    : `<img class="mm" src="${esc(m.media_url)}" alt="" loading="lazy" decoding="async">`;
  const text = m.content ? `<span class="tx">${esc(m.content)}</span>` : "";
  const el = document.createElement("div");
  el.className = "msg" + (own ? " me" : "");
  el.dataset.id = m.id;
  el.innerHTML = `${av}<div class="bub${media ? " hasm" : ""}${isAdmin() ? " isadm" : ""}">${isAdmin() ? `<button class="adm" data-adm="${m.id}" type="button" aria-label="Aksi admin">${I_DOTS}</button>` : ""}${head}${media}${text}<span class="tm">${t.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</span></div>`;
  const mm = el.querySelector(".mm");
  if(mm) mm.addEventListener(mm.tagName==="VIDEO" ? "loadedmetadata" : "load", () => { if(chStick) chScroll(); });
  const list = $("#chList");
  list.appendChild(el);
  while(list.children.length > 200) list.removeChild(list.firstChild);
  if(live && chStick) chScroll();
}

/* ---------- Lampiran foto/video ---------- */
function clearSel(){
  if(chSel) URL.revokeObjectURL(chSel.url);
  chSel = null; paintPrev();
}
function paintPrev(){
  const box = $("#chPrev"); if(!box) return;
  if(!chSel){ box.hidden = true; box.innerHTML = ""; return; }
  box.hidden = false;
  box.innerHTML = `${chSel.kind==="image" ? `<img src="${chSel.url}" alt="">` : `<video src="${chSel.url}#t=0.1" muted playsinline preload="metadata"></video>`}<span>${esc(chSel.file.name)}</span><button class="ch-x" id="chPrevX" type="button" aria-label="Hapus lampiran">&times;</button>`;
  $("#chPrevX").onclick = clearSel;
}
function pickFile(f){
  if(!f) return;
  const kind = f.type.startsWith("video/") ? "video" : f.type.startsWith("image/") ? "image" : null;
  if(!kind) return toast("Pilih foto atau video");
  if(kind==="video" && !CH_VIDEO.includes(f.type)) return toast("Video harus MP4, WebM, atau MOV");
  if(f.size > CH_MAX && (kind==="video" || f.type==="image/gif")) return toast("Ukuran maksimal 20 MB");
  if(chSel) URL.revokeObjectURL(chSel.url);
  chSel = { file:f, kind, url:URL.createObjectURL(f) };
  paintPrev();
}
/* Foto diperkecil (maks 1600px) supaya hemat kuota */
function prepImage(file){
  return new Promise((res, rej) => {
    if(file.type==="image/gif") return res(file);
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, 1600 / Math.max(im.width, im.height));
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const x = c.getContext("2d");
      x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(im, 0, 0, c.width, c.height);
      c.toBlob(b => b ? res(b.size >= file.size && k===1 && file.type==="image/jpeg" ? file : b) : rej(new Error("gambar")), "image/jpeg", .82);
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("gambar")); };
    im.src = url;
  });
}

/* ---------- Kotak pesan ---------- */
function paintChatInput(){
  const box = $("#chIn");
  if(!user){
    box.innerHTML = '<button class="btn" id="chLogin" type="button">Masuk untuk chat</button>';
    $("#chLogin").onclick = login;
    return;
  }
  box.innerHTML = `<div class="ch-prev" id="chPrev" hidden></div>
    <div class="ch-row">
      <button class="ch-btn" id="chAttach" type="button" aria-label="Kirim foto atau video">${I_IMG}</button>
      <textarea id="chText" rows="1" maxlength="500" aria-label="Pesan"></textarea>
      <button class="btn send" id="chSend" type="button" aria-label="Kirim">${I_SEND}</button>
    </div>
    <input type="file" id="chFile" accept="image/*,video/mp4,video/webm,video/quicktime" hidden>`;
  const t = $("#chText");
  /* Enter = baris baru. Kotak melebar ke atas mengikuti isi. */
  t.addEventListener("input", () => { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 160) + "px"; });
  $("#chAttach").onclick = () => $("#chFile").click();
  $("#chFile").onchange = e => { const f = e.target.files[0]; e.target.value = ""; pickFile(f); };
  $("#chSend").onclick = sendChat;
  if(chCool > Date.now()) startCool(chCool - Date.now()); else updCool();
}

async function sendChat(){
  const t = $("#chText"); if(!t) return;
  const text = t.value.trim();
  if(!text && !chSel) return;
  if(!profile){ openOnb("first"); return; }
  if(chCool > Date.now()) return toast("Tunggu " + Math.ceil((chCool - Date.now()) / 1000) + " detik");
  const btn = $("#chSend"); btn.disabled = true;
  const prev = $("#chPrev"); if(prev && chSel) prev.classList.add("up");
  let path = null;
  try{
    let media = null;
    if(chSel){
      const blob = chSel.kind==="image" ? await prepImage(chSel.file) : chSel.file;
      const type = blob.type || chSel.file.type;
      if(!CH_EXT[type]) throw new Error("format");
      if(blob.size > CH_MAX) throw new Error("ukuran");
      path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${CH_EXT[type]}`;
      const up = await sb.storage.from("chat-media").upload(path, blob, { contentType: type, cacheControl: "31536000" });
      if(up.error) throw up.error;
      media = { url: sb.storage.from("chat-media").getPublicUrl(path).data.publicUrl, type: chSel.kind };
    }
    const { data, error } = await sb.from("chat_messages")
      .insert({ user_id: user.id, content: text, media_url: media ? media.url : null, media_type: media ? media.type : null })
      .select(CH_COLS).single();
    if(error) throw error;
    t.value = ""; t.style.height = "auto";
    clearSel();
    addChat(data, true);
    startCool(CH_COOL);
  } catch(err){
    if(path) sb.storage.from("chat-media").remove([path]);
    const msg = (err && err.message) || "";
    if(/terlalu cepat/.test(msg)) startCool(CH_COOL);
    toast(/terlalu cepat/.test(msg) ? "Terlalu cepat, tunggu sebentar" : /format|gambar/.test(msg) ? "Format file tidak didukung" : /ukuran/.test(msg) ? "Ukuran maksimal 20 MB" : "Gagal mengirim");
  } finally {
    const p2 = $("#chPrev"); if(p2) p2.classList.remove("up");
    updCool();
  }
}

async function openChat(){
  if(!configured) return toast("Isi SUPABASE_URL dan SUPABASE_ANON_KEY dulu");
  $("#chList").innerHTML = ""; chatIds.clear(); chatData.clear(); chatLast = null; chatReady = false; chatQ = []; chStick = true;
  clearSel();
  paintChatInput();
  $("#chat").showModal();
  if(chatCh) sb.removeChannel(chatCh);
  chatCh = sb.channel("chat-global")
    .on("postgres_changes", { event:"INSERT", schema:"public", table:"chat_messages" }, async pl => {
      const m = pl.new;
      if(!chatReady){ chatQ.push(m); return; }
      await ensureProfiles([m.user_id]);
      addChat(m, true);
    })
    .on("postgres_changes", { event:"DELETE", schema:"public", table:"chat_messages" }, pl => removeChat(pl.old.id))
    .subscribe();
  const { data, error } = await sb.from("chat_messages").select(CH_COLS).order("created_at", { ascending:false }).limit(80);
  if(error) toast("Gagal memuat chat");
  const list = (data || []).reverse();
  await ensureProfiles([...list, ...chatQ].map(m => m.user_id));
  list.forEach(m => addChat(m, false));
  chatReady = true;
  chatQ.forEach(m => addChat(m, false)); chatQ = [];
  if(user){
    const mine = list.filter(m => m.user_id === user.id).pop();
    if(mine){ const rem = CH_COOL - (Date.now() - new Date(mine.created_at)); if(rem > 0) startCool(rem); }
  }
  chScroll();
}

$("#chList").addEventListener("scroll", () => { chStick = chNear(); }, { passive:true });
$("#chList").addEventListener("click", e => {
  const ab = e.target.closest("[data-adm]");
  if(ab){ openAdminMsg(ab.dataset.adm); return; }
  const img = e.target.closest("img.mm");
  if(img){ $("#mvImg").src = img.src; $("#mv").showModal(); return; }
  const b = e.target.closest("[data-user]"); if(b) openUser(b.dataset.user);
});
$("#mv").addEventListener("click", () => $("#mv").close());
$("#mv").addEventListener("close", () => { $("#mvImg").removeAttribute("src"); });

/* Tinggi kotak pesan berubah (baris baru / lampiran): daftar chat menyesuaikan */
new ResizeObserver(() => {
  $("#chat").style.setProperty("--inh", $("#chIn").offsetHeight + "px");
  if(chStick) chScroll();
}).observe($("#chIn"));

$("#chX").onclick = () => $("#chat").close();
$("#chat").addEventListener("close", () => {
  if(chatCh){ sb.removeChannel(chatCh); chatCh = null; }
  chatReady = false; clearSel();
});

/* ---------- Jeda 10 detik antar pesan ---------- */
function updCool(){
  const b = $("#chSend");
  if(!b){ if(chTimer){ clearInterval(chTimer); chTimer = null; } return; }
  const rem = chCool - Date.now();
  if(rem > 0){
    b.disabled = true;
    b.innerHTML = `<span class="cd">${Math.ceil(rem / 1000)}</span>`;
  } else {
    b.disabled = false;
    b.innerHTML = I_SEND;
    if(chTimer){ clearInterval(chTimer); chTimer = null; }
  }
}
function startCool(ms){
  chCool = Date.now() + ms;
  updCool();
  if(!chTimer) chTimer = setInterval(updCool, 250);
}

/* ---------- Hapus pesan dari tampilan (admin / realtime) ---------- */
function removeChat(id){
  const el = $("#chList").querySelector(`.msg[data-id="${id}"]`);
  if(el) el.remove();
  chatData.delete(id);
}
