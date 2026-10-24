/* ---------- Video call chat pribadi (WebRTC; sinyal lewat tabel "calls") ---------- */
const ICE_DEFAULT = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443", "turns:openrelay.metered.ca:443?transport=tcp"], username: "openrelayproject", credential: "openrelayproject" }
];
/* Bisa diganti: tambahkan  const ICE_SERVERS = [...]  di config.js untuk memakai server TURN sendiri */
const iceServers = () => (typeof ICE_SERVERS !== "undefined" && Array.isArray(ICE_SERVERS) && ICE_SERVERS.length) ? ICE_SERVERS : ICE_DEFAULT;

let cs = null;            // panggilan yang sedang berlangsung/berdering
let callCh = null, ringCtx = null, ringT = null, wakeLock = null;

const I_VC = {
  cam:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 7a2 2 0 012-2h7a2 2 0 012 2v2.6l4.2-2.7a.8.8 0 011.3.7v9.8a.8.8 0 01-1.3.7L15 14.4V17a2 2 0 01-2 2H6a2 2 0 01-2-2z"/></svg>',
  camOff:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M15 9.5V7a2 2 0 00-2-2H8M5.5 5.5A2 2 0 004 7v10a2 2 0 002 2h7a2 2 0 002-2v-1.5"/><path d="M15 10.5l5.2-3.4a.8.8 0 011.3.7v8.4"/></svg>',
  mic:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>',
  micOff:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M9 9v2a3 3 0 005.1 2.1M15 10V6a3 3 0 00-5.7-1.3"/><path d="M5 11a7 7 0 0011.2 5.6M19 11a7 7 0 01-.6 2.8M12 18v3"/></svg>',
  flip:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V6a2 2 0 012-2h3M20 15v3a2 2 0 01-2 2h-3"/><path d="M4 6l3-3M4 6l3 3M20 18l-3-3M20 18l-3 3"/><circle cx="12" cy="12" r="3"/></svg>',
  end:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-3.2 0-6.3 1-8.5 3.1-.5.5-.5 1.3 0 1.8l1.6 1.6c.4.4 1 .5 1.5.2l2-1.2c.4-.2.6-.6.6-1V12c.9-.3 1.8-.4 2.8-.4s1.9.1 2.8.4v1.5c0 .4.2.8.6 1l2 1.2c.5.3 1.1.2 1.5-.2l1.6-1.6c.5-.5.5-1.3 0-1.8C18.3 10 15.2 9 12 9z"/></svg>',
  back:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>'
};

$("#vcFlip").innerHTML = I_VC.flip;
$("#vcEnd").innerHTML = I_VC.end;

/* ---------- Nada dering dan getar (penerima) ---------- */
function startRing(){
  stopRing();
  try{
    ringCtx = new (window.AudioContext || window.webkitAudioContext)();
    const beep = () => {
      if(!ringCtx) return;
      const t = ringCtx.currentTime, o = ringCtx.createOscillator(), g = ringCtx.createGain();
      o.type = "sine"; o.frequency.value = 480;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.22, t + .05); g.gain.exponentialRampToValueAtTime(.0001, t + .9);
      o.connect(g); g.connect(ringCtx.destination); o.start(t); o.stop(t + 1);
    };
    if(ringCtx.resume) ringCtx.resume();
    beep();
    ringT = setInterval(() => { beep(); if(navigator.vibrate) navigator.vibrate([500, 300, 500]); }, 2200);
  }catch{}
  if(navigator.vibrate) navigator.vibrate([500, 300, 500]);
}
function stopRing(){
  clearInterval(ringT); ringT = null;
  if(ringCtx){ try{ ringCtx.close(); }catch{} ringCtx = null; }
  if(navigator.vibrate) navigator.vibrate(0);
}

/* ---------- Tampilan ---------- */
const vcFmt = s => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
function vcSet(st, status){
  const d = $("#vc");
  d.dataset.st = st;
  if(status !== undefined) $("#vcStat").textContent = status;
}
function vcPaintPeer(){
  const p = cs.peer;
  $("#vcName").textContent = p.name;
  $("#vcAv").innerHTML = p.avatar ? `<img src="${esc(p.avatar)}" alt="" referrerpolicy="no-referrer">` : esc(initial(p.name));
}
function vcCtl(){
  const l = cs.local;
  const mic = l && l.getAudioTracks()[0], cam = l && l.getVideoTracks()[0];
  $("#vcMic").innerHTML = (mic && mic.enabled) ? I_VC.mic : I_VC.micOff;
  $("#vcMic").classList.toggle("off", !(mic && mic.enabled));
  $("#vcCam").innerHTML = (cam && cam.enabled) ? I_VC.cam : I_VC.camOff;
  $("#vcCam").classList.toggle("off", !(cam && cam.enabled));
}
function openCallUI(st, status){
  vcPaintPeer();
  vcSet(st, status);
  if(!$("#vc").open) $("#vc").showModal();
  vcCtl();
}
async function holdScreen(){ try{ if(navigator.wakeLock) wakeLock = await navigator.wakeLock.request("screen"); }catch{} }

/* ---------- Media dan koneksi ---------- */
async function getMedia(facing){
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: { facingMode: facing || "user", width: { ideal: 640 }, height: { ideal: 480 } }
  });
}
const mediaErr = e => (e && (e.name === "NotAllowedError" || e.name === "SecurityError")) ? "Izinkan kamera dan mikrofon dulu"
  : (e && e.name === "NotFoundError") ? "Kamera atau mikrofon tidak ditemukan" : "Kamera tidak bisa dibuka";

function showLocal(){
  const v = $("#vcLocal");
  v.srcObject = cs.local; v.play?.().catch(() => {});
}
function makePC(){
  const pc = new RTCPeerConnection({ iceServers: iceServers() });
  cs.local.getTracks().forEach(t => pc.addTrack(t, cs.local));
  pc.ontrack = e => {
    const v = $("#vcRemote");
    if(v.srcObject !== e.streams[0]) v.srcObject = e.streams[0];
    v.play?.().catch(() => {});
  };
  pc.onconnectionstatechange = () => {
    if(!cs || cs.pc !== pc) return;
    const s = pc.connectionState;
    if(s === "connected"){ clearTimeout(cs.dropT); callConnected(); }
    else if(s === "disconnected"){
      $("#vcStat").textContent = "Menghubungkan ulang…";
      clearTimeout(cs.dropT);
      cs.dropT = setTimeout(() => { if(cs && cs.pc === pc && pc.connectionState !== "connected") closeCall("Koneksi terputus", true); }, 8000);
    }
    else if(s === "failed") closeCall("Koneksi gagal. Coba lagi nanti", true);
  };
  cs.pc = pc;
  return pc;
}
/* Tunggu pengumpulan kandidat ICE selesai (maks. 4 detik) supaya penawaran/jawaban dikirim sekali jalan */
function gatherDone(pc, ms){
  return new Promise(res => {
    if(pc.iceGatheringState === "complete") return res();
    let t;
    const done = () => { clearTimeout(t); pc.removeEventListener("icegatheringstatechange", chk); res(); };
    const chk = () => { if(pc.iceGatheringState === "complete") done(); };
    t = setTimeout(done, ms || 4000);
    pc.addEventListener("icegatheringstatechange", chk);
  });
}
function callConnected(){
  if(!cs || cs.state === "connected") return;
  cs.state = "connected";
  clearTimeout(cs.ringTimer);
  stopRing();
  cs.t0 = Date.now();
  vcSet("connected", "00:00");
  clearInterval(cs.tick);
  cs.tick = setInterval(() => { $("#vcStat").textContent = vcFmt(Math.floor((Date.now() - cs.t0) / 1000)); }, 1000);
  holdScreen();
}

/* ---------- Menelepon ---------- */
async function startVideoCall(peer){
  if(!configured || !user) return;
  if(cs) return toast("Kamu sedang dalam panggilan");
  if(!window.RTCPeerConnection || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return toast("Browser ini belum mendukung video call");
  if(!peer || !peer.id) return;
  const c = cs = { role: "caller", peer: { id: peer.id, name: peer.display_name || "Akun", avatar: peer.avatar_url || null }, state: "calling", id: null, ended: false };
  openCallUI("calling", "Meminta izin kamera…");
  try{ c.local = await getMedia(); }
  catch(e){ if(cs === c) closeCall(mediaErr(e), false); return; }
  if(cs !== c || c.ended){ c.local.getTracks().forEach(t => t.stop()); return; }
  showLocal(); vcCtl();
  $("#vcStat").textContent = "Menyiapkan panggilan…";
  try{
    const pc = makePC();
    await pc.setLocalDescription(await pc.createOffer());
    await gatherDone(pc);
    if(cs !== c || c.ended) return;
    const { data: sess } = await sb.auth.getSession();
    c.token = sess && sess.session ? sess.session.access_token : null;
    const { data, error } = await sb.rpc("start_call", { p_callee: c.peer.id, p_offer: JSON.stringify(pc.localDescription) });
    if(cs !== c || c.ended){ if(!error && data) sb.rpc("end_call", { cid: data }); return; }
    if(error) return closeCall(/terlalu banyak/.test(error.message || "") ? "Terlalu banyak panggilan, tunggu sebentar" : "Gagal memulai panggilan", false);
    c.id = data;
    $("#vcStat").textContent = "Memanggil…";
    c.ringTimer = setTimeout(() => { if(cs === c && c.state === "calling") closeCall("Tidak dijawab", true); }, 45000);
  }catch{
    if(cs === c) closeCall("Gagal memulai panggilan", false);
  }
}

/* ---------- Menerima ---------- */
async function incomingCall(r){
  if(Date.now() - new Date(r.created_at).getTime() > 60000) return;      // sudah lewat
  if(cs){ if(cs.id !== r.id) sb.rpc("decline_call", { cid: r.id, reason: "busy" }); return; }
  const c = cs = { role: "callee", id: r.id, row: r, state: "incoming", peer: { id: r.caller, name: "Akun", avatar: null }, ended: false };
  await ensureProfiles([r.caller]);
  if(cs !== c) return;
  const p = PROF[r.caller] || {};
  c.peer = { id: r.caller, name: p.display_name || "Akun", avatar: p.avatar_url || null };
  openCallUI("incoming", "Panggilan video masuk");
  startRing();
  c.ringTimer = setTimeout(() => { if(cs === c && c.state === "incoming") closeCall("", false); }, 55000);
}
async function acceptCall(){
  const c = cs;
  if(!c || c.role !== "callee" || c.state !== "incoming") return;
  c.state = "answering";
  stopRing();
  vcSet("calling", "Meminta izin kamera…");
  try{ c.local = await getMedia(); }
  catch(e){
    sb.rpc("decline_call", { cid: c.id });
    if(cs === c) closeCall(mediaErr(e), false);
    return;
  }
  if(cs !== c || c.ended){ c.local.getTracks().forEach(t => t.stop()); return; }
  showLocal(); vcCtl();
  $("#vcStat").textContent = "Menghubungkan…";
  try{
    const pc = makePC();
    await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(c.row.offer)));
    await pc.setLocalDescription(await pc.createAnswer());
    await gatherDone(pc);
    if(cs !== c || c.ended) return;
    const { data: sess } = await sb.auth.getSession();
    c.token = sess && sess.session ? sess.session.access_token : null;
    const { error } = await sb.rpc("answer_call", { cid: c.id, p_answer: JSON.stringify(pc.localDescription) });
    if(error && cs === c) return closeCall("Panggilan sudah tidak tersedia", false);
    c.dropT = setTimeout(() => { if(cs === c && c.state !== "connected") closeCall("Koneksi gagal. Coba lagi nanti", true); }, 25000);
  }catch{
    if(cs === c) closeCall("Gagal menyambung panggilan", true);
  }
}
function declineCall(){
  const c = cs; if(!c || c.role !== "callee" || c.state !== "incoming") return;
  sb.rpc("decline_call", { cid: c.id });
  closeCall("", false);
}

/* ---------- Mengakhiri ---------- */
function closeCall(msg, tellServer){
  const c = cs; if(!c) return;
  cs = null; c.ended = true;
  [c.ringTimer, c.dropT].forEach(t => clearTimeout(t));
  clearInterval(c.tick);
  stopRing();
  if(tellServer && c.id) sb.rpc("end_call", { cid: c.id });
  if(c.local) c.local.getTracks().forEach(t => t.stop());
  if(c.pc){ c.pc.ontrack = null; c.pc.onconnectionstatechange = null; try{ c.pc.close(); }catch{} }
  ["#vcRemote", "#vcLocal"].forEach(s => { const v = $(s); v.srcObject = null; });
  if(wakeLock){ try{ wakeLock.release(); }catch{} wakeLock = null; }
  if($("#vc").open) $("#vc").close();
  if(msg) toast(msg);
}
function hangUp(){
  const c = cs; if(!c) return;
  if(c.role === "callee" && c.state === "incoming") return declineCall();
  closeCall("", true);
}

/* ---------- Tombol kontrol ---------- */
$("#vcMic").onclick = () => { const t = cs && cs.local && cs.local.getAudioTracks()[0]; if(t){ t.enabled = !t.enabled; vcCtl(); } };
$("#vcCam").onclick = () => { const t = cs && cs.local && cs.local.getVideoTracks()[0]; if(t){ t.enabled = !t.enabled; vcCtl(); $("#vcLocal").classList.toggle("camoff", !t.enabled); } };
$("#vcFlip").onclick = async () => {
  const c = cs; if(!c || !c.local || c.flipping) return;
  c.flipping = true;
  try{
    const cur = c.local.getVideoTracks()[0];
    const facing = (cur && cur.getSettings().facingMode === "environment") ? "user" : "environment";
    const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facing }, width: { ideal: 640 }, height: { ideal: 480 } } });
    const nt = ns.getVideoTracks()[0];
    nt.enabled = cur ? cur.enabled : true;
    const sender = c.pc && c.pc.getSenders().find(s => s.track && s.track.kind === "video");
    if(sender) await sender.replaceTrack(nt);
    if(cur){ c.local.removeTrack(cur); cur.stop(); }
    c.local.addTrack(nt);
    $("#vcLocal").classList.toggle("rear", facing === "environment");
    showLocal();
  }catch{ toast("Kamera lain tidak tersedia"); }
  c.flipping = false;
};
$("#vcEnd").onclick = hangUp;
$("#vcDecline").onclick = declineCall;
$("#vcAccept").onclick = acceptCall;
$("#vcBack").onclick = () => toast("Ketuk tombol merah untuk mengakhiri panggilan");
$("#vc").addEventListener("cancel", e => e.preventDefault());

/* ---------- Tombol di chat pribadi ---------- */
$("#dmCall").onclick = () => { if(dmPeer) startVideoCall(dmPeer); };

/* ---------- Mendengarkan panggilan (selama login) ---------- */
function onCallRow(pl){
  const r = pl.new; if(!r || !user) return;
  if(pl.eventType === "INSERT"){
    if(r.callee === user.id && r.status === "ringing") incomingCall(r);
    return;
  }
  const c = cs; if(!c || c.id !== r.id) return;
  if(c.role === "caller"){
    if(r.status === "accepted" && r.answer && c.pc && c.state === "calling" && !c.gotAnswer){
      c.gotAnswer = true;
      $("#vcStat").textContent = "Menghubungkan…";
      c.pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(r.answer)))
        .then(() => { c.dropT = setTimeout(() => { if(cs === c && c.state !== "connected") closeCall("Koneksi gagal. Coba lagi nanti", true); }, 25000); })
        .catch(() => { if(cs === c) closeCall("Gagal menyambung panggilan", true); });
    }
    else if(r.status === "declined") closeCall("Panggilan ditolak", false);
    else if(r.status === "busy") closeCall("Sedang dalam panggilan lain", false);
    else if(r.status === "ended") closeCall(c.state === "connected" ? "Panggilan berakhir" : "", false);
  } else {
    if(r.status === "missed") closeCall(c.state === "incoming" ? "Panggilan tidak terjawab" : "", false);
    else if(r.status === "ended") closeCall(c.state === "connected" ? "Panggilan berakhir" : "", false);
    else if(r.status === "accepted" && c.state === "incoming") closeCall("", false);   // sudah dijawab di perangkat lain
  }
}
async function syncCall(){
  if(callCh && sb){ sb.removeChannel(callCh); callCh = null; }
  if(!configured || !user || !profile){ if(cs) closeCall("", false); return; }
  callCh = sb.channel("calls-" + user.id)
    .on("postgres_changes", { event: "*", schema: "public", table: "calls", filter: "callee=eq." + user.id }, onCallRow)
    .on("postgres_changes", { event: "*", schema: "public", table: "calls", filter: "caller=eq." + user.id }, onCallRow)
    .subscribe();
  /* Panggilan yang baru masuk saat halaman baru dibuka */
  const since = new Date(Date.now() - 45000).toISOString();
  const { data } = await sb.from("calls").select("id,caller,callee,status,offer,created_at").eq("callee", user.id).eq("status", "ringing").gt("created_at", since).order("created_at", { ascending: false }).limit(1);
  if(data && data[0]) incomingCall(data[0]);
}

/* Tutup tab di tengah panggilan: beri tahu server supaya lawan bicara tidak menunggu */
window.addEventListener("pagehide", () => {
  const c = cs;
  if(!c || !c.id || !c.token || typeof SUPABASE_URL === "undefined" || !SUPABASE_URL) return;
  try{
    fetch(SUPABASE_URL + "/rest/v1/rpc/end_call", {
      method: "POST", keepalive: true,
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + c.token },
      body: JSON.stringify({ cid: c.id })
    });
  }catch{}
});
