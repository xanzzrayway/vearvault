# IdzDeploy

## Install (Termux)
```bash
pkg install nodejs -y
cd idzdeploy
npm install
cp .env.example .env
nano .env   # isi VERCEL_TOKEN
```

## Jalankan
```bash
node server.js
```
Buka `http://localhost:3000` (atau lewat tunnel cloudflared ke idzdeploy.my.id).

## DNS wildcard (di panel domain idzwebghost.my.id)
```
Type: CNAME
Name: *.project
Value: cname.vercel-dns.com
```

## Biar nyala terus
```bash
pkg install pm2 -y
termux-wake-lock
pm2 start server.js --name idzdeploy
pm2 save
echo 'pm2 resurrect' >> ~/.bashrc
echo 'termux-wake-lock' >> ~/.bashrc
```

## Tunnel publik ke idzdeploy.my.id
```bash
pkg install cloudflared -y
cloudflared tunnel login
cloudflared tunnel create idzdeploy
cloudflared tunnel route dns idzdeploy idzdeploy.my.id
cloudflared tunnel run idzdeploy &
```
