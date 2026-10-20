/* ---------- Tambahkan Misi (admin, di Panel) ---------- */
const MF_BUCKET = "mission-rewards", MF_MAX_BYTES = 52428800, MF_MAX_STEPS = 10;
let mfKind = "progress", mfBusy = false;

const MF_PRESET = {
  tiktok:  { label: "Follow TikTok",     ph: "https://www.tiktok.com/@username" },
  youtube: { label: "Subscribe YouTube", ph: "https://www.youtube.com/@channel" },
  other:   { label: "",                  ph: "https://" }
};

function openMissionForm(){
  if(!isAdmin()) return toast("Khusus admin");
  if(!mfBusy) mfReset();
  $("#mf").showModal();
  mfLoadList();
}
function mfReset(){
  $("#mfForm").reset();
  $("#mfSteps").innerHTML = "";
  mfSetKind("progress");
  $("#mfTarget").value = "10";
}
function mfSetKind(k){
  mfKind = k;
  $("#mfKind").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.k === k));
  $("#mfProg").hidden = k !== "progress";
  $("#mfPage").hidden = k !== "page";
}
$("#mfKind").onclick = e => { const b = e.target.closest("button"); if(b && !mfBusy) mfSetKind(b.dataset.k); };

function mfAddStep(type){
  const box = $("#mfSteps");
  if(box.children.length >= MF_MAX_STEPS) return toast("Maksimal " + MF_MAX_STEPS + " langkah");
  const p = MF_PRESET[type] || MF_PRESET.other;
  const row = document.createElement("div");
  row.className = "mf-step";
  row.innerHTML = `<div class="mf-sn">${box.children.length + 1}</div><div class="mf-sf">
    <input type="text" data-f="label" maxlength="80" placeholder="Nama langkah" value="${esc(p.label)}">
    <input type="text" data-f="url" inputmode="url" autocapitalize="off" autocomplete="off" maxlength="500" placeholder="${esc(p.ph)}"></div>
    <button class="mu-x" type="button" data-del aria-label="Hapus langkah">&times;</button>`;
  box.appendChild(row);
  row.querySelector('[data-f="url"]').focus();
}
function mfRenumber(){ [...$("#mfSteps").children].forEach((r, i) => { r.querySelector(".mf-sn").textContent = i + 1; }); }
$("#mfAdd").onclick = e => { const b = e.target.closest("button"); if(b && !mfBusy) mfAddStep(b.dataset.add); };
$("#mfSteps").onclick = e => { const b = e.target.closest("[data-del]"); if(b && !mfBusy){ b.closest(".mf-step").remove(); mfRenumber(); } };

const mfErr = m => ({
  "khusus admin": "Khusus admin",
  "hadiah kosong": "Isi hadiah: teks, link, atau file",
  "langkah tidak valid": "Langkah tidak valid (nama dan link https wajib)",
}[m] || "Gagal membuat misi");

$("#mfForm").onsubmit = async e => {
  e.preventDefault();
  if(mfBusy) return;
  const title = $("#mfTitle").value.trim(), desc = $("#mfDesc").value.trim();
  const rTitle = $("#mfRTitle").value.trim(), rText = $("#mfRText").value.trim(), rLink = $("#mfRLink").value.trim();
  const file = $("#mfRFile").files[0] || null;
  if(!title || !rTitle) return toast("Judul misi dan nama hadiah wajib diisi");
  if(!rText && !rLink && !file) return toast("Isi hadiah: teks, link, atau file");
  if(rLink && !isHttps(rLink)) return toast("Link hadiah harus diawali https://");
  if(file && file.size > MF_MAX_BYTES) return toast("File hadiah maksimal 50 MB");

  let target = null, steps = [];
  if(mfKind === "progress"){
    target = parseInt($("#mfTarget").value, 10);
    if(!(target >= 1 && target <= 100)) return toast("Target harus 1 sampai 100");
  } else {
    steps = [...$("#mfSteps").children].map(r => ({
      label: r.querySelector('[data-f="label"]').value.trim(),
      url: r.querySelector('[data-f="url"]').value.trim()
    }));
    if(!steps.length) return toast("Tambahkan minimal 1 langkah");
    if(steps.some(s => !s.label || !isHttps(s.url))) return toast("Tiap langkah butuh nama dan link berawalan https://");
  }

  mfBusy = true;
  const btn = $("#mfSend"); btn.disabled = true;
  let path = null;
  if(file){
    btn.textContent = "Mengunggah file…";
    const ext = (file.name.match(/\.[A-Za-z0-9]{1,8}$/) || [""])[0].toLowerCase();
    path = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2)) + ext;
    const up = await sb.storage.from(MF_BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream" });
    if(up.error){ mfBusy = false; btn.disabled = false; btn.textContent = "Buat Misi"; return toast("Gagal mengunggah file hadiah"); }
  }
  btn.textContent = "Menyimpan…";
  const { error } = await sb.rpc("admin_create_mission", {
    p_kind: mfKind, p_title: title, p_desc: desc || null, p_target: target,
    p_reward_title: rTitle, p_reward_text: rText || null, p_reward_link: rLink || null,
    p_reward_path: path, p_reward_name: file ? file.name.slice(0, 200) : null,
    p_steps: steps
  });
  mfBusy = false; btn.disabled = false; btn.textContent = "Buat Misi";
  if(error){
    if(path) sb.storage.from(MF_BUCKET).remove([path]);
    return toast(mfErr(error.message || ""));
  }
  toast("Misi dibuat, langsung tampil di menu Misi");
  mfReset();
  mfLoadList();
};

async function mfLoadList(){
  const l = $("#mfList");
  const { data, error } = await sb.rpc("admin_missions");
  if(error){ l.innerHTML = '<p class="note">Gagal memuat daftar misi.</p>'; return; }
  if(!data || !data.length){ l.innerHTML = '<p class="note">Belum ada misi.</p>'; return; }
  l.innerHTML = data.map(m => `<div class="mf-row" data-id="${m.id}">
    <div class="mf-rt"><b>${esc(m.title)}</b>
      <small>${m.kind === "progress" ? "Progress: " + fmt(m.target) + " prompt" : "Page: " + fmt(m.steps) + " langkah"} · Hadiah: ${esc(m.reward_title)} · ${fmt(m.claims)} sudah klaim</small></div>
    <button class="btn sm danger" type="button" data-a="del">Hapus</button></div>`).join("");
}
$("#mfList").onclick = async e => {
  const b = e.target.closest('button[data-a="del"]'); if(!b || mfBusy) return;
  const id = Number(b.closest(".mf-row").dataset.id);
  if(!confirm("Hapus misi ini? Progres dan klaim pengguna untuk misi ini ikut terhapus.")) return;
  b.disabled = true;
  const rw = await sb.from("mission_rewards").select("file_path").eq("mission_id", id).maybeSingle();
  const del = await sb.from("missions").delete().eq("id", id);
  if(del.error){ b.disabled = false; return toast("Gagal menghapus misi"); }
  if(rw.data && rw.data.file_path) sb.storage.from(MF_BUCKET).remove([rw.data.file_path]);
  toast("Misi dihapus");
  mfLoadList();
};
$("#mfX").onclick = () => { if(mfBusy) return toast("Tunggu proses selesai"); $("#mf").close(); };
$("#mf").addEventListener("cancel", e => { if(mfBusy) e.preventDefault(); });
