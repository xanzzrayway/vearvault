/* ---------- Misi (semua pengguna): dibuat admin di Panel ---------- */
let msData = [], msTick = null, msBusy = false;
const MS_WAIT_MS = {};   // id langkah -> waktu (ms) kapan tombol "Sudah" aktif

const GIFT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8a1 1 0 001 1h12a1 1 0 001-1v-8M7.5 8a2.5 2.5 0 110-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 110 5"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>`;
const isHttps = u => /^https:\/\//i.test(u || "");

function syncMissions(){
  if(!user){ msData = []; if($("#ms").open) $("#ms").close(); if($("#mr").open) $("#mr").close(); }
}
async function openMissions(){
  if(!configured) return toast("Belum terhubung ke server");
  if(!user){ login(); return; }
  $("#ms").showModal();
  if(!msData.length) $("#msList").innerHTML = '<div class="skel"></div><div class="skel"></div>';
  await loadMissions();
}
async function loadMissions(){
  const { data, error } = await sb.rpc("my_missions");
  if(error){ if(!msData.length) $("#msList").innerHTML = ""; return toast("Gagal memuat misi"); }
  msData = data || [];
  msData.forEach(m => (m.steps || []).forEach(s => { if(s.wait > 0) MS_WAIT_MS[s.id] = Date.now() + s.wait * 1000; }));
  paintMissions();
}

const msLeft = s => Math.max(0, Math.ceil(((MS_WAIT_MS[s.id] || 0) - Date.now()) / 1000));

function stepAction(s){
  if(s.done) return '<span class="ms-ok">Selesai</span>';
  if(!s.opened) return '<button class="btn sm" type="button" data-a="open">Buka</button>';
  const left = msLeft(s);
  return left > 0
    ? `<button class="btn sm line" type="button" disabled>Tunggu ${left} dtk</button>`
    : '<button class="btn sm" type="button" data-a="fin">Sudah</button>';
}

function paintMissions(){
  const l = $("#msList");
  if(!msData.length){
    l.innerHTML = `<div class="empty"><img src="assets/logo-sm.png" width="72" height="72" alt=""><h3>Belum ada misi</h3><p>Misi baru dari admin akan muncul di sini.</p></div>`;
    return;
  }
  l.innerHTML = msData.map(m => {
    const total = Number(m.total) || 0, prog = Math.min(Number(m.progress) || 0, total);
    const pct = total ? Math.round(prog / total * 100) : 0;
    const complete = total > 0 && prog >= total;
    const pill = m.claimed ? "Selesai" : complete ? "Siap diklaim" : "Aktif";
    let body = "", act = "";
    if(m.kind === "page"){
      body = `<div class="ms-steps">${(m.steps || []).map((s, i) =>
        `<div class="ms-step ${s.done ? "done" : ""}" data-sid="${s.id}"><span class="ms-sn">${s.done ? CHECK : i + 1}</span><span class="ms-sl">${esc(s.label)}</span>${stepAction(s)}</div>`
      ).join("")}</div><div class="note">Buka link, selesaikan langkahnya, lalu kembali dan ketuk "Sudah".</div>`;
    } else {
      body = `<div class="note">Hanya prompt publik yang sudah disetujui admin dan dibuat setelah misi ini muncul yang dihitung.</div>`;
    }
    if(m.claimed) act = `<button class="btn" type="button" data-a="reward">Lihat hadiah</button>`;
    else if(complete) act = `<button class="btn" type="button" data-a="claim">Klaim hadiah</button>`;
    else if(m.kind === "progress") act = `<button class="btn" type="button" data-a="add">Tambah prompt</button>`;
    return `<div class="mcard" data-id="${m.id}">
      <div class="mtop"><b>${esc(m.title)}</b><span class="pill">${pill}</span></div>
      ${m.description ? `<p>${esc(m.description)}</p>` : ""}
      <div class="ms-rew">${GIFT}<span>Hadiah: <b>${esc(m.reward_title)}</b></span></div>
      <div class="bar2"><i style="width:${pct}%"></i></div>
      <div class="mnum"><b>${fmt(prog)}</b> / ${fmt(total)}</div>
      ${body}${act}</div>`;
  }).join("");
  msTimer();
}
/* Hitung mundur: segarkan tampilan tiap detik selama masih ada langkah yang menunggu */
function msTimer(){
  clearInterval(msTick); msTick = null;
  const waiting = () => msData.some(m => (m.steps || []).some(s => !s.done && s.opened && msLeft(s) > 0));
  if(!waiting()) return;
  msTick = setInterval(() => {
    if(!$("#ms").open){ clearInterval(msTick); msTick = null; return; }
    const was = waiting(); paintMissionSteps();
    if(!was) { clearInterval(msTick); msTick = null; }
  }, 1000);
}
function paintMissionSteps(){
  msData.forEach(m => {
    if(m.kind !== "page") return;
    const card = $("#msList").querySelector(`.mcard[data-id="${m.id}"]`); if(!card) return;
    (m.steps || []).forEach(s => {
      const row = card.querySelector(`.ms-step[data-sid="${s.id}"]`); if(!row) return;
      const old = row.querySelector("button, .ms-ok"); if(!old) return;
      const tmp = document.createElement("div"); tmp.innerHTML = stepAction(s);
      old.replaceWith(tmp.firstElementChild);
    });
  });
  if(!msData.some(m => (m.steps || []).some(s => !s.done && s.opened && msLeft(s) > 0))){ clearInterval(msTick); msTick = null; }
}

$("#msList").onclick = async e => {
  const b = e.target.closest("button"); if(!b || b.disabled) return;
  const card = b.closest(".mcard"); if(!card) return;
  const m = msData.find(x => String(x.id) === card.dataset.id); if(!m) return;
  const a = b.dataset.a;
  if(a === "add"){ $("#ms").close(); $("#addBtn").click(); return; }
  if(a === "open" || a === "fin"){
    const row = b.closest(".ms-step");
    const s = (m.steps || []).find(x => String(x.id) === row.dataset.sid); if(!s) return;
    if(a === "open"){
      if(!isHttps(s.url)) return toast("Link tidak valid");
      window.open(s.url, "_blank", "noopener");           // harus langsung dari ketukan, supaya tidak diblokir browser
      MS_WAIT_MS[s.id] = Date.now() + 10000; s.opened = true; s.wait = 10;
      paintMissions();
      const r = await sb.rpc("mission_open_step", { sid: s.id });
      if(r.error){ s.opened = false; delete MS_WAIT_MS[s.id]; paintMissions(); toast("Gagal memulai langkah"); }
      return;
    }
    if(msBusy) return; msBusy = true; b.disabled = true;
    const r = await sb.rpc("mission_finish_step", { sid: s.id });
    msBusy = false;
    if(r.error){ toast(/terlalu cepat/.test(r.error.message || "") ? "Selesaikan langkahnya dulu, lalu coba lagi" : "Gagal menyimpan"); await loadMissions(); return; }
    await loadMissions();
    return;
  }
  if(a === "claim"){
    if(msBusy) return; msBusy = true; b.disabled = true;
    const r = await sb.rpc("claim_mission", { mid: m.id });
    msBusy = false;
    if(r.error){ toast(/belum selesai/.test(r.error.message || "") ? "Misi belum selesai" : "Gagal klaim hadiah"); await loadMissions(); return; }
    await loadMissions();
    toast("Hadiah diklaim");
    showReward(m);
    return;
  }
  if(a === "reward") showReward(m);
};
$("#msX").onclick = () => $("#ms").close();

/* ---------- Hadiah ---------- */
async function showReward(m){
  $("#mrT").textContent = m.reward_title;
  $("#mrBody").innerHTML = '<div class="skel"></div>';
  $("#mr").showModal();
  const { data, error } = await sb.from("mission_rewards").select("reward_text,reward_link,file_path,file_name").eq("mission_id", m.id).maybeSingle();
  if(error || !data){ $("#mrBody").innerHTML = '<p class="wn-msg">Hadiah belum bisa dibuka. Coba lagi nanti.</p>'; return; }
  let h = "";
  if(data.reward_text) h += `<div class="mr-t" id="mrText">${esc(data.reward_text)}</div><button class="btn line" type="button" data-a="copy">Salin teks</button>`;
  if(data.reward_link && isHttps(data.reward_link)) h += `<a class="btn" href="${esc(data.reward_link)}" target="_blank" rel="noopener noreferrer">Buka link hadiah</a>`;
  if(data.file_path) h += `<button class="btn" type="button" data-a="file" data-p="${esc(data.file_path)}" data-n="${esc(data.file_name || "hadiah")}">Unduh ${esc(data.file_name || "file")}</button>`;
  $("#mrBody").innerHTML = h || '<p class="wn-msg">Hadiah kosong.</p>';
}
$("#mrBody").onclick = async e => {
  const b = e.target.closest("button"); if(!b) return;
  if(b.dataset.a === "copy"){
    const t = $("#mrText").textContent;
    try{ await navigator.clipboard.writeText(t); toast("Tersalin"); }catch{ toast("Gagal menyalin"); }
  }
  if(b.dataset.a === "file"){
    b.disabled = true;
    const r = await sb.storage.from("mission-rewards").createSignedUrl(b.dataset.p, 120, { download: b.dataset.n });
    b.disabled = false;
    if(r.error || !r.data) return toast("Gagal mengunduh file");
    const a = document.createElement("a");
    a.href = r.data.signedUrl; a.rel = "noopener"; a.download = b.dataset.n;
    document.body.appendChild(a); a.click(); a.remove();
  }
};
$("#mrX").onclick = () => $("#mr").close();
$("#mr").addEventListener("click", e => { if(e.target === $("#mr")) $("#mr").close(); });
