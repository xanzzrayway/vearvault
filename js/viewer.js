/* ---------- Popup detail prompt ---------- */
let pvRow = null;
const I_COPY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/></svg>`;
const I_DL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>`;
const I_DEL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`;

function openPrompt(id){
  const r = rows.find(x => String(x.id)===String(id)); if(!r) return;
  pvRow = r;
  const p = r.profiles || {};
  const name = p.display_name || "Anonim";
  $("#pvTag").innerHTML = `<i style="background:${color(r.category)}"></i>${esc(r.category)}${r.is_public ? "" : ' <span class="lock">Pribadi</span>'}`;
  $("#pvTitle").textContent = r.title;
  const d = $("#pvDesc"); d.textContent = r.description || ""; d.hidden = !r.description;
  const by = $("#pvBy");
  by.dataset.user = r.user_id;
  by.innerHTML = `${p.avatar_url ? `<img src="${esc(p.avatar_url)}" alt="" referrerpolicy="no-referrer">` : `<span class="ph">${esc(initial(name))}</span>`}<em>${esc(name)}</em>`;
  $("#pvBody").textContent = r.content;
  $("#pvBody").scrollTop = 0;
  $("#pvN").textContent = fmt(charLen(r.content)) + " karakter";
  const mine = user && r.user_id===user.id;
  $("#pvActs").innerHTML =
    (mine ? `<button class="del" data-a="del" aria-label="Hapus">${I_DEL}</button>` : "") +
    `<button class="btn sm line" data-a="dl" aria-label="Unduh">${I_DL}</button>` +
    `<button class="btn sm" data-a="copy">${I_COPY}Salin</button>`;
  if(!$("#pv").open) $("#pv").showModal();
}

$("#pvActs").onclick = async e => {
  const b = e.target.closest("button"); if(!b || !pvRow) return;
  if(b.dataset.a==="copy"){ await copyText(pvRow.content); toast("Prompt disalin"); }
  if(b.dataset.a==="dl") downloadPrompt(pvRow);
  if(b.dataset.a==="del"){ if(await deletePrompt(pvRow.id)) $("#pv").close(); }
};
$("#pvBy").onclick = () => { const u = $("#pvBy").dataset.user; $("#pv").close(); openUser(u); };
$("#pvX").onclick = () => $("#pv").close();
$("#pv").addEventListener("click", e => { if(e.target===$("#pv")) $("#pv").close(); });
$("#pv").addEventListener("close", () => { pvRow = null; });
