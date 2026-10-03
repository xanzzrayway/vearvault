/* ---------- Menu samping (tombol garis 3) ---------- */
$("#menuBtn").onclick = () => $("#drawer").showModal();
$("#drX").onclick = () => $("#drawer").close();
$("#drawer").addEventListener("click", e => { if(e.target===$("#drawer")) $("#drawer").close(); });
$("#drawer").querySelectorAll("[data-go]").forEach(b => b.onclick = () => {
  $("#drawer").close();
  ({ chat: openChat, box: openBox, find: openFind })[b.dataset.go]();
});
