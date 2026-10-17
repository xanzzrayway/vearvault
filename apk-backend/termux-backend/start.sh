#!/data/data/com.termux/files/usr/bin/bash
# Load config dari config.env (file ini gak pernah diupload kemana-mana, aman lokal doang)
set -a
source "$(dirname "$0")/config.env"
set +a

node "$(dirname "$0")/server.js"
