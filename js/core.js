const CATS = [
  ["ChatGPT","#10a37f"],["Claude","#d97757"],["Gemini","#4285f4"],["Grok","#111827"],
  ["DeepSeek","#4d6bfe"],["Copilot","#7c3aed"],["Perplexity","#0891b2"],["Meta AI","#0866ff"],
  ["Mistral","#f97316"],["Qwen","#6d28d9"],["Kimi","#0f172a"],["Midjourney","#e11d48"],
  ["DALL·E","#14b8a6"],["Stable Diffusion","#a855f7"],["Sora","#475569"],["Suno","#f59e0b"],["Lainnya","#94a3b8"]
];
const ROLES = [
  {id:"newbie",name:"Newbie",open:true},
  {id:"gearvault",name:"GearVault"},
  {id:"vearxpro",name:"VearXpro"},
  {id:"oprxpro",name:"OprXpro"},
  {id:"admin",name:"Admin",hidden:true}
];
const color = c => (CATS.find(x=>x[0]===c)||[0,"#94a3b8"])[1];
const roleName = id => (ROLES.find(r=>r.id===id)||ROLES[0]).name;
const MISSION = { role:"gearvault", count:100, chars:5000 };
const charLen = s => [...String(s || "")].length;
const isAdmin = () => !!(profile && profile.role === "admin");
const hasRole = id => (id === "admin" && isAdmin()) || ((profile && profile.unlocked) || ["newbie"]).includes(id);
let dmUnread = 0;   // pesan privat belum dibaca
const PROF = {};   // cache profil: id -> { display_name, avatar_url, role }
function ago(iso){
  const sec = (Date.now() - new Date(iso)) / 1000;
  if(sec < 60) return "baru saja";
  if(sec < 3600) return Math.floor(sec/60) + " mnt";
  if(sec < 86400) return Math.floor(sec/3600) + " jam";
  if(sec < 604800) return Math.floor(sec/86400) + " hr";
  return new Date(iso).toLocaleDateString("id-ID", { day:"numeric", month:"short" });
}
async function ensureProfiles(ids){
  if(!configured) return;
  const miss = [...new Set(ids)].filter(id => id && !PROF[id]);
  for(let i = 0; i < miss.length; i += 50){
    const { data } = await sb.from("profiles").select("id,display_name,avatar_url,role").in("id", miss.slice(i, i + 50));
    (data || []).forEach(p => PROF[p.id] = p);
  }
}

const $ = s => document.querySelector(s);
const configured = !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase);
const sb = configured ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const PAGE = 12;
let user = null, profile = null, rows = [], cat = "Semua", view = "all", term = "", shown = PAGE;
let draft = {name:"",avatar:null}, step = 1, onbMode = "first", picked = false;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("on"),2000)}
const initial = n => (String(n||"?").trim()[0]||"?").toUpperCase();
const googleAvatar = () => { const m=(user&&user.user_metadata)||{}; return m.avatar_url||m.picture||null; };
const avatarTag = (src,name,cls) => src
  ? `<img class="${cls}" src="${esc(src)}" alt="" referrerpolicy="no-referrer">`
  : `<span class="${cls} init">${esc(initial(name))}</span>`;
const syncSeg = () => document.querySelectorAll("#seg button").forEach(x => x.classList.toggle("on", x.dataset.v===view));

const GLOGO = `<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>`;
const LOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>`;
const TICK = `<span class="tick"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg></span>`;
