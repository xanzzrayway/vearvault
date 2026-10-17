#!/usr/bin/env python3
"""
Hacker Simulation Terminal (Fake Only)
Script ini cuma simulasi visual ala 'Hollywood hacking'.
Gak ada request ke jaringan, gak scan apa pun, pure buat seru-seruan / demo UI.
"""

import sys
import time
import random
import string
import itertools
import threading

# Optional: kalau punya colorama, nanti teks bakal berwarna
try:
    from colorama import init, Fore, Style
    init(autoreset=True)
    COLOR_ENABLED = True
except ImportError:
    COLOR_ENABLED = False


def slow_print(text, min_delay=0.002, max_delay=0.01, newline=True, color=None):
    """Typewriter effect."""
    if COLOR_ENABLED and color:
        sys.stdout.write(color)
    for ch in text:
        sys.stdout.write(ch)
        sys.stdout.flush()
        time.sleep(random.uniform(min_delay, max_delay))
    if COLOR_ENABLED and color:
        sys.stdout.write(Style.RESET_ALL)
    if newline:
        sys.stdout.write("\n")
    sys.stdout.flush()


def progress_bar(task, total=40, delay=0.08, color=None):
    """Simple progress bar."""
    slow_print(f"[+] {task}", min_delay=0.0005, max_delay=0.001, newline=True, color=color)
    for i in range(total + 1):
        filled = "█" * i
        empty = " " * (total - i)
        percent = int(i / total * 100)
        bar = f"[{filled}{empty}] {percent:3d}%"
        sys.stdout.write("\r" + bar)
        sys.stdout.flush()
        time.sleep(delay)
    sys.stdout.write("\n\n")
    sys.stdout.flush()


class LogStreamer(threading.Thread):
    """Background fake log generator."""
    def __init__(self, stop_event):
        super().__init__(daemon=True)
        self.stop_event = stop_event
        self.events = [
            "Negotiating TLS session...",
            "Bypassing rate limiter...",
            "Enumerating internal services...",
            "Syncing system time with target...",
            "Loading in-memory payload stub...",
            "Generating ephemeral RSA keypair...",
            "Fingerprinting OS and kernel...",
            "Checking for misconfigured ACL...",
        ]

    def run(self):
        while not self.stop_event.is_set():
            evt = random.choice(self.events)
            ts = time.strftime("%H:%M:%S")
            line = f"[{ts}] LOG :: {evt}"
            slow_print(line, min_delay=0.0008, max_delay=0.003, color=Fore.BLUE if COLOR_ENABLED else None)
            time.sleep(random.uniform(0.3, 1.0))


class HackerSimulator:
    def __init__(self, target="192.168.0.42"):
        self.target = target
        self.stop_logs = threading.Event()
        self.logger = LogStreamer(self.stop_logs)

    def banner(self):
        title = "OXY HACKER SIM"
        border = "=" * (len(title) + 10)
        color = Fore.GREEN if COLOR_ENABLED else None

        slow_print(border, color=color)
        slow_print(f"   ::: {title} :::", color=color)
        slow_print(border, color=color)
        slow_print("", newline=True)

    def simulate_handshake(self):
        color = Fore.CYAN if COLOR_ENABLED else None
        steps = [
            f"Resolving target {self.target}...",
            "Establishing encrypted channel...",
            "Performing key exchange (X25519)...",
            "Calibrating network latency...",
            "Validating spoofed fingerprint...",
        ]
        for s in steps:
            slow_print(f"[~] {s}", color=color)
            time.sleep(random.uniform(0.3, 0.8))
        slow_print("[OK] Secure session established", color=Fore.GREEN if COLOR_ENABLED else None)
        slow_print("", newline=True)

    def simulate_port_scan(self):
        color = Fore.MAGENTA if COLOR_ENABLED else None
        slow_print(f"[+] Scanning ports on {self.target}", color=color)
        ports = [21, 22, 80, 135, 443, 3306, 5432, 8080, 27017]
        for p in ports:
            state = random.choices(
                population=["open", "filtered", "closed"],
                weights=[0.4, 0.3, 0.3],
            )[0]
            banner = random.choice([
                "nginx/1.18.0",
                "OpenSSH_8.2p1",
                "Microsoft-IIS/10.0",
                "Apache/2.4.54",
                "Unknown service"
            ]) if state == "open" else "-"
            line = f"   -> Port {p:5d} : {state:<8}  banner: {banner}"
            slow_print(line, min_delay=0.0005, max_delay=0.002, color=color)
            time.sleep(random.uniform(0.05, 0.15))
        slow_print("", newline=True)

    def simulate_vuln_enumeration(self):
        color = Fore.YELLOW if COLOR_ENABLED else None
        progress_bar("Enumerating vulnerabilities...", total=30, delay=0.07, color=color)

        vulns = [
            "CVE-2023-9999 :: Remote Code Execution",
            "CVE-2022-1337 :: Privilege Escalation",
            "CVE-2021-4242 :: Auth Bypass",
            "Weak SSH configuration detected",
            "Leaky debug endpoint /debug/trace",
        ]
        slow_print("[+] Potential issues discovered:", color=color)
        for v in vulns:
            if random.random() < 0.65:  # fake 'found' subset
                slow_print(f"    - {v}", min_delay=0.0007, max_delay=0.002, color=color)
                time.sleep(random.uniform(0.1, 0.3))
        slow_print("", newline=True)

    def simulate_bruteforce(self):
        color = Fore.RED if COLOR_ENABLED else None
        slow_print("[+] Launching credential attack on admin@target", color=color)

        charset = string.ascii_lowercase + string.digits + "!@#$%"
        max_length = 6
        max_attempts = 300

        attempts = 0
        found_password = "p@ssw0"
        display_found = False

        for length in range(3, max_length + 1):
            for combo in itertools.product(charset, repeat=length):
                attempts += 1
                candidate = "".join(combo)

                # Fake print only subset of attempts biar ga kelamaan
                if attempts % 7 == 0:
                    slow_print(f"    Trying: {candidate}", min_delay=0.0002, max_delay=0.001, color=color)

                # Fake "found" condition
                if attempts == random.randint(120, max_attempts):
                    display_found = True
                    break

                if attempts >= max_attempts:
                    display_found = True
                    break

            if display_found:
                break

        slow_print("", newline=True)
        slow_print(f"[OK] Password found -> {found_password}", color=Fore.GREEN if COLOR_ENABLED else None)
        slow_print(f"[i] Total attempts (simulated): {attempts}", color=color)
        slow_print("", newline=True)

    def simulate_data_exfiltration(self):
        color = Fore.CYAN if COLOR_ENABLED else None
        slow_print("[+] Initiating data exfiltration over covert channel...", color=color)
        total_chunks = 35
        for i in range(1, total_chunks + 1):
            size = random.randint(128, 2048)
            unit = random.choice(["KB", "KB", "KB", "MB"])
            filename = random.choice([
                "users.db",
                "vault.enc",
                "finance_q4.xlsx",
                "prod_config.yml",
                "secrets.json",
                "backup_2026-07-26.tar.gz"
            ])
            percent = int(i / total_chunks * 100)
            line = f"[{percent:3d}%] {filename:<25}  +{size:4d}{unit}"
            slow_print(line, min_delay=0.0005, max_delay=0.002, color=color)
            time.sleep(random.uniform(0.09, 0.2))

        slow_print("", newline=True)
        slow_print("[OK] Exfiltration complete. Session will self-destruct in 5 seconds.", color=Fore.GREEN if COLOR_ENABLED else None)
        for i in range(5, 0, -1):
            slow_print(f"    Cleaning traces in {i}...", min_delay=0.001, max_delay=0.003, color=color)
            time.sleep(1.0)

    def run(self):
        self.banner()
        # start background fake logs
        self.logger.start()

        try:
            self.simulate_handshake()
            self.simulate_port_scan()
            self.simulate_vuln_enumeration()
            self.simulate_bruteforce()
            self.simulate_data_exfiltration()
        finally:
            # stop background logs
            self.stop_logs.set()
            time.sleep(0.5)
            slow_print("\n[!] Session terminated. (Remember: this was just a simulation!)\n",
                       color=Fore.YELLOW if COLOR_ENABLED else None)


if __name__ == "__main__":
    # Lu bisa ganti target IP/host di sini kalau mau
    target = "10.0.0.13"
    if len(sys.argv) > 1:
        target = sys.argv[1]

    sim = HackerSimulator(target=target)
    sim.run()