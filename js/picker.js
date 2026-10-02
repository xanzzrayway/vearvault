/* ---------- Pilih AI (tampilan sendiri, bukan select bawaan) ---------- */
const CHEV = `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;

function setCat(name){
  $("#fCat").value = name;
  $("#catBtn").innerHTML = `<i class="dot" style="background:${color(name)}"></i><span>${esc(name)}</span>${CHEV}`;
}
function paintCP(){
  const cur = $("#fCat").value;
  $("#cpList").innerHTML = CATS.map(([n,c]) =>
    `<button type="button" class="ai ${n===cur?"on":""}" data-c="${esc(n)}"><i style="background:${c}"></i><span>${esc(n)}</span>${n===cur?TICK:""}</button>`
  ).join("");
}
$("#catBtn").onclick = () => {
  paintCP();
  $("#cp").showModal();
  setTimeout(() => { const on = $("#cpList .on"); if(on) on.scrollIntoView({ block:"nearest" }); }, 0);
};
$("#cpList").onclick = e => {
  const b = e.target.closest(".ai"); if(!b) return;
  setCat(b.dataset.c); $("#cp").close();
};
$("#cpX").onclick = () => $("#cp").close();
$("#cp").addEventListener("click", e => { if(e.target===$("#cp")) $("#cp").close(); });
setCat(CATS[0][0]);
