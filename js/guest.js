/* ---------- Akun tamu: hanya untuk Chat Global (nama otomatis user1, user2, ...) ---------- */
/* false = akun tamu dibuat saat Chat Global dibuka. true = dibuat begitu website dibuka (menambah banyak akun dari pengunjung yang hanya lewat). */
const GUEST_EAGER = false;

const chatMe = () => user ? { id: user.id } : (guest ? { id: guest.id } : null);

async function loadGuest(){
  if(!guest) return;
  const id = guest.id;
  let { data } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
  if(!data){
    const r = await sb.rpc("ensure_guest_profile");
    data = r.data || null;
  }
  if(guest && guest.id === id && data){ guest.profile = data; PROF[data.id] = data; }
}

/* Pastikan ada sesi tamu. Mengembalikan true kalau sudah login Google atau tamu siap dipakai. */
async function ensureGuest(){
  if(!configured) return false;
  if(user || guest) return true;
  const { data, error } = await sb.auth.signInAnonymously();
  if(error || !data || !data.user){
    toast(/anonymous|disabled|not enabled/i.test((error && error.message) || "") ? "Login tamu belum diaktifkan admin" : "Gagal masuk sebagai tamu");
    return false;
  }
  await setUser(data.user);
  return !!guest;
}

/* Tamu yang mencoba hal yang khusus akun Google */
function needGoogle(msg){
  toast(msg || "Masuk dengan Google untuk fitur ini");
  login();
}

if(GUEST_EAGER){
  window.addEventListener("load", async () => {
    if(!configured) return;
    const { data } = await sb.auth.getSession();
    if(!(data && data.session)) ensureGuest();
  });
}
