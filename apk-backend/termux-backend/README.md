# APK Compiler Backend (Termux)

Server API doang (bukan nampilin UI) — nyimpen token GitHub kamu di lokal HP,
biar frontend (yang di-host di Netlify) bisa manggil GitHub API tanpa pernah
pegang token itu sendiri.

## Setup (sekali doang)

1. Install Node.js di Termux:
   ```
   pkg install nodejs -y
   ```
2. Extract folder ini ke penyimpanan Termux, misal ke `~/apk-backend`.
3. Buka `config.env`, isi token/owner/repo/APP_SECRET sesuai punya kamu.
4. Kasih izin eksekusi ke start.sh:
   ```
   chmod +x start.sh
   ```

## Jalanin server

```
./start.sh
```

Biarin Termux tetep kebuka. Kalau mau diakses dari luar HP (misal dari frontend
Netlify), buka tunnel di tab Termux lain:

```
cloudflared tunnel --url http://localhost:8080
```

Copy URL `https://xxxx.trycloudflare.com` yang keluar, masukin ke `CONST_SERVER_URL`
di kode frontend (`index.html` di repo Netlify kamu).

## Catatan

- **Jangan buka URL tunnel ini langsung di browser** — itu cuma API, gak ada
  tampilan apapun disitu. Tampilan compiler-nya selalu dibuka lewat link Netlify.
- URL tunnel `trycloudflare.com` ganti tiap kali `cloudflared` di-restart — kalau
  itu kejadian, update lagi `CONST_SERVER_URL` di kode frontend & push ulang.
- `config.env` isinya token asli, JANGAN pernah di-upload ke GitHub atau
  dishare ke orang lain.

