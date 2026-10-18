/* ---------- Pengaturan Bot AI (khusus admin): nama, foto, prompt, model ---------- */
let btAvatar = null;

function paintBtPick(){
  $("#btPick").innerHTML = btAvatar
    ? `<img src="${esc(btAvatar)}" alt="">`
    : `<img class="lg" src="assets/logo-sm.png" alt="">`;
}

async function openBotSettings(){
  if(!isAdmin()) return toast("Khusus admin");
  const [p, c] = await Promise.all([
    sb.from("bot_profile").select("name,avatar_url").eq("id", 1).maybeSingle(),
    sb.from("bot_config").select("system_prompt,model,enabled").eq("id", 1).maybeSingle()
  ]);
  if(p.error || c.error || !p.data || !c.data) return toast("Jalankan supabase.sql dulu");
  $("#btName").value = p.data.name;
  btAvatar = p.data.avatar_url;
  paintBtPick();
  $("#btPrompt").value = c.data.system_prompt;
  $("#btModel").value = c.data.model;
  $("#btOn").checked = c.data.enabled;
  $("#bt").showModal();
}

$("#btPickWrap").onclick = () => $("#btFile").click();
$("#btPickWrap").addEventListener("keydown", e => { if(e.key==="Enter"||e.key===" "){ e.preventDefault(); $("#btFile").click(); } });
$("#btFile").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if(!f) return;
  try{ btAvatar = await readAvatar(f); paintBtPick(); }
  catch{ toast("Foto tidak bisa dibaca"); }
};
$("#btDelPic").onclick = () => { btAvatar = null; paintBtPick(); };

$("#btForm").onsubmit = async e => {
  e.preventDefault();
  const name = $("#btName").value.trim();
  if(name.length < 2 || name.length > 30) return toast("Nama bot 2–30 karakter");
  const model = $("#btModel").value.trim();
  if(model.length < 3) return toast("Isi nama model Groq");
  const btn = $("#btSave"); btn.disabled = true;
  const now = new Date().toISOString();
  const a = await sb.from("bot_profile").update({ name, avatar_url: btAvatar, updated_at: now }).eq("id", 1);
  const b = await sb.from("bot_config").update({ system_prompt: $("#btPrompt").value.trim(), model, enabled: $("#btOn").checked, updated_at: now }).eq("id", 1);
  btn.disabled = false;
  if(a.error || b.error) return toast("Gagal menyimpan bot");
  BOT = { name, avatar_url: btAvatar };
  $("#bt").close();
  toast("Bot disimpan");
};

$("#btX").onclick = () => $("#bt").close();
$("#bt").addEventListener("click", e => { if(e.target===$("#bt")) $("#bt").close(); });
$("#stBotBtn").onclick = () => openBotSettings();
