/* ---------- Moderasi: admin, ban akun, dan peringatan ---------- */
let modCh = null, warnQ = [], amMsg = null, adMode = null, adTarget = null, adName = "";

const mediaPath = url => {
  const k = "/chat-media/", i = (url || "").indexOf(k);
  return i < 0 ? null : decodeURIComponent(url.slice(i + k.length).split("?")[0]);
};

/* ---------- Layar ban (untuk akun yang diblokir) ---------- */
async function checkBan(){
  const d = $("#bn");
  if(profile && profile.banned){
    const r = await sb.from("bans").select("reason").eq("user_id", user.id).maybeSingle();
    $("#bnWhy").textContent = (r.data && r.data.reason) || "";
    if(!d.open) d.showModal();
  } else if(d.open) d.close();
}
$("#bn").addEventListener("cancel", e => e.preventDefault());
$("#bnOut").onclick = () => { $("#bn").close(); logout(); };

/* ---------- Peringatan dari admin ---------- */
async function loadWarnings(){
  const { data } = await sb.from("warnings").select("id,message,created_at").eq("user_id", user.id).eq("seen", false).order("created_at");
  warnQ = data || [];
  showWarn();
}
function showWarn(){
  const d = $("#wn");
  if(!warnQ.length){ if(d.open) d.close(); return; }
  $("#wnMsg").textContent = warnQ[0].message;
  $("#wnCnt").textContent = warnQ.length > 1 ? "1 dari " + warnQ.length : "";
  $("#wnCnt").hidden = warnQ.length < 2;
  if(!d.open) d.showModal();
}
$("#wn").addEventListener("cancel", e => e.preventDefault());
$("#wnOk").onclick = async () => {
  const w = warnQ.shift();
  if(w) await sb.from("warnings").update({ seen:true }).eq("id", w.id);
  showWarn();
};

/* Dipanggil setiap login/logout */
async function syncModeration(){
  if(modCh && sb){ sb.removeChannel(modCh); modCh = null; }
  warnQ = [];
  if(!configured || !user || !profile){
    if($("#bn").open) $("#bn").close();
    if($("#wn").open) $("#wn").close();
    return;
  }
  checkBan();
  loadWarnings();
  modCh = sb.channel("mod-" + user.id)
    .on("postgres_changes", { event:"INSERT", schema:"public", table:"warnings", filter:"user_id=eq." + user.id }, pl => {
      if(!warnQ.some(w => w.id === pl.new.id)){ warnQ.push(pl.new); showWarn(); }
    })
    .on("postgres_changes", { event:"UPDATE", schema:"public", table:"profiles", filter:"id=eq." + user.id }, pl => {
      profile = { ...profile, ...pl.new };
      renderAuth(); checkBan();
    })
    .subscribe();
}

/* ---------- Menu admin untuk satu pesan chat ---------- */
function openAdminMsg(id){
  const m = chatData.get(Number(id));
  if(!m || !isAdmin()) return;
  amMsg = m;
  const p = m.is_bot ? { display_name: BOT.name } : (PROF[m.user_id] || {});
  const name = p.display_name || "Anonim";
  const noTarget = !!m.is_bot || p.role === "admin" || m.user_id === user.id;
  $("#amMsg").innerHTML = `<b>${esc(name)}</b><span>${esc(m.content || (m.media_type==="video" ? "Video" : "Foto"))}</span>`;
  $("#amWarn").hidden = noTarget;
  $("#amBan").hidden = noTarget;
  $("#am").showModal();
}
$("#amX").onclick = () => $("#am").close();
$("#am").addEventListener("click", e => { if(e.target===$("#am")) $("#am").close(); });
$("#amDel").onclick = async () => {
  const m = amMsg; if(!m) return;
  if(!confirm("Hapus pesan ini untuk semua orang?")) return;
  $("#am").close();
  const { error } = await sb.from("chat_messages").delete().eq("id", m.id);
  if(error) return toast("Gagal menghapus pesan");
  const path = mediaPath(m.media_url);
  if(path) sb.storage.from("chat-media").remove([path]);
  removeChat(m.id);
  toast("Pesan dihapus");
};
$("#amWarn").onclick = () => { const m = amMsg; $("#am").close(); openAd("warn", m.user_id, (PROF[m.user_id] || {}).display_name); };
$("#amBan").onclick = () => { const m = amMsg; $("#am").close(); openAd("ban", m.user_id, (PROF[m.user_id] || {}).display_name); };

/* ---------- Form peringatan / ban (dengan pesan) ---------- */
function openAd(mode, uid, name){
  adMode = mode; adTarget = uid; adName = name || "akun ini";
  $("#adH").textContent = (mode==="ban" ? "Ban " : "Peringatkan ") + adName;
  $("#adText").value = "";
  const b = $("#adSend");
  b.textContent = mode==="ban" ? "Ban akun" : "Kirim peringatan";
  b.classList.toggle("danger", mode==="ban");
  $("#ad").showModal();
  setTimeout(() => $("#adText").focus(), 60);
}
$("#adX").onclick = () => $("#ad").close();
$("#ad").addEventListener("click", e => { if(e.target===$("#ad")) $("#ad").close(); });
$("#adForm").onsubmit = async e => {
  e.preventDefault();
  const text = $("#adText").value.trim(); if(!text) return;
  const btn = $("#adSend"); btn.disabled = true;
  const { error } = adMode==="ban"
    ? await sb.rpc("admin_ban", { target: adTarget, reason: text })
    : await sb.rpc("admin_warn", { target: adTarget, msg: text });
  btn.disabled = false;
  if(error) return toast(adMode==="ban" ? "Gagal ban akun" : "Gagal mengirim peringatan");
  $("#ad").close();
  toast(adMode==="ban" ? "Akun diban, semua prompt-nya disembunyikan" : "Peringatan terkirim");
  if(adMode==="ban") load();
  refreshViewing(adTarget);
};

/* ---------- Panel admin di profil orang lain ---------- */
const PROF_COLS = "id,display_name,avatar_url,role,created_at,banned";
async function refreshViewing(uid){
  if(!viewing || viewing.id !== uid || !$("#prof").open) return;
  const { data } = await sb.from("profiles").select(PROF_COLS).eq("id", uid).maybeSingle();
  if(data){ viewing = data; paintProfile(); paintAdminInfo(); }
}
async function paintAdminInfo(){
  const box = $("#profAdmin"), v = viewing;
  const show = isAdmin() && v && !isOwn(v) && v.role !== "admin";
  box.hidden = !show;
  if(!show) return;
  const ban = $("#admBan");
  ban.textContent = v.banned ? "Buka ban" : "Ban akun";
  ban.classList.toggle("danger", !v.banned);
  ban.classList.toggle("line", !!v.banned);
  $("#admInfo").textContent = v.banned ? "Diban" : "Tidak diban";
  const w = await sb.from("warnings").select("id", { count:"exact", head:true }).eq("user_id", v.id);
  let why = "";
  if(v.banned){
    const r = await sb.from("bans").select("reason").eq("user_id", v.id).maybeSingle();
    why = r.data ? r.data.reason : "";
  }
  if(viewing !== v) return;
  $("#admInfo").textContent = (v.banned ? "Diban" + (why ? ": " + why : "") : "Tidak diban") + " · " + (w.count || 0) + " peringatan";
}
$("#admWarn").onclick = () => { if(viewing) openAd("warn", viewing.id, viewing.display_name); };
$("#admBan").onclick = async () => {
  const v = viewing; if(!v) return;
  if(!v.banned){ openAd("ban", v.id, v.display_name); return; }
  if(!confirm("Buka ban akun ini?")) return;
  const { error } = await sb.rpc("admin_unban", { target: v.id });
  if(error) return toast("Gagal membuka ban");
  toast("Ban dibuka");
  load();
  refreshViewing(v.id);
};

/* Cek ulang status ban sendiri (dipakai setelah pesan ditolak karena spam) */
async function recheckBan(){
  const p = await loadProfile();
  if(p){ profile = p; renderAuth(); checkBan(); }
}
