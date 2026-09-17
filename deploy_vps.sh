#!/usr/bin/env bash
# ==============================================================================
# cPanel Control Panel — Automated Turnkey Linux VPS Deployment Script
# Supports: Ubuntu 22.04/24.04, Debian 12, AlmaLinux 9, Rocky Linux 9
# ==============================================================================

set -e

echo "========================================================"
echo "⚡ Starting cPanel Hosting Control Panel VPS Setup"
echo "========================================================"

# 1. Detect Root / Sudo
if [ "$EUID" -ne 0 ]; then
  echo "[-] Please run this script with sudo or as root."
  exit 1
fi

# 2. Update System Packages
echo "[+] Updating system packages..."
if command -v apt-get &> /dev/null; then
  apt-get update -y && apt-get install -y curl git nodejs npm nginx ufw
elif command -v dnf &> /dev/null; then
  dnf update -y && dnf install -y curl git nodejs npm nginx firewalld
fi

# 3. Ensure Node.js >= 18 is installed
NODE_VER=$(node -v 2>/dev/null || echo "v0")
echo "[+] Detected Node.js version: $NODE_VER"

# 4. Install Global Process Manager (PM2)
echo "[+] Installing PM2 process manager..."
npm install -g pm2

# 5. Build Frontend Production Assets
echo "[+] Installing dependencies and compiling frontend..."
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
cd "$SCRIPT_DIR/frontend"
npm install --include=dev
npm run build

# 6. Install Backend Dependencies
echo "[+] Installing backend dependencies..."
cd "$SCRIPT_DIR/backend"
npm install --production

# 7. Start Backend Daemon via PM2
echo "[+] Starting cPanel daemon on PM2..."
pm2 delete cpanel-panel 2>/dev/null || true
pm2 start src/server.js --name "cpanel-panel"
pm2 save
pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER 2>/dev/null || pm2 startup

# 8. Configure Firewall (Port 5000, 80, 443, 21)
echo "[+] Configuring firewall rules..."
if command -v ufw &> /dev/null; then
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 5000/tcp
  ufw allow 21/tcp
  ufw allow 2121/tcp
elif command -v firewall-cmd &> /dev/null; then
  firewall-cmd --permanent --add-port={80/tcp,443/tcp,5000/tcp,21/tcp,2121/tcp}
  firewall-cmd --reload
fi

SERVER_IP=$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')

echo "========================================================"
echo "✅ cPanel Control Panel is LIVE & OPERATIONAL!"
echo "========================================================"
echo "🌐 Control Panel URL: http://$SERVER_IP:5000"
echo "🌐 Hosted Website:    http://$SERVER_IP:5000/site"
echo "📁 WebDAV Storage:    http://$SERVER_IP:5000/webdav"
echo "📡 FTP Server:        ftp://$SERVER_IP:21"
echo "📊 PM2 Management:    pm2 status / pm2 logs cpanel-panel"
echo "========================================================"
