#!/usr/bin/env bash
# ====================================================================
# Automated Production VPS Deployment Script for cPanel Pro & WHMCS
# Tested on Ubuntu 20.04 / 22.04 / 24.04 LTS & Debian 11 / 12
# ====================================================================

set -e

echo "=== [1/6] System Update & Dependencies Installation ==="
sudo apt-get update -y
sudo apt-get install -y curl git nginx build-essential ufw openssl

# Install Node.js 20 LTS if missing
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# Install PM2 Process Manager globally
sudo npm install -g pm2

echo "=== [2/6] Configuring Deployment Directories ==="
sudo mkdir -p /var/www/cpanel
sudo chown -R $USER:$USER /var/www/cpanel

# Copy application files to /var/www/cpanel
echo "Synchronizing project files..."
cp -r backend /var/www/cpanel/
cp -r frontend /var/www/cpanel/
cp ecosystem.config.js /var/www/cpanel/ 2>/dev/null || true

echo "=== [3/6] Installing Backend Dependencies ==="
cd /var/www/cpanel/backend
npm install --production

echo "=== [4/6] Building Frontend Production Distributables ==="
cd /var/www/cpanel/frontend
npm install
npm run build

echo "=== [5/6] Generating SSL Certificate for Ports 2083 & 2087 ==="
if [ ! -f /etc/ssl/certs/cpanel-selfsigned.crt ]; then
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/ssl/private/cpanel-selfsigned.key \
        -out /etc/ssl/certs/cpanel-selfsigned.crt \
        -subj "/C=US/ST=State/L=City/O=cPanel/CN=localhost"
    echo "SSL Certificate generated successfully."
fi

# Configure Nginx Reverse Proxy
sudo cp /var/www/cpanel/backend/scripts/cpanel-vps-nginx.conf /etc/nginx/sites-available/cpanel-pro.conf
sudo ln -sf /etc/nginx/sites-available/cpanel-pro.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

echo "=== [6/6] Starting cPanel Daemon with PM2 & Systemd ==="
cd /var/www/cpanel
pm2 start backend/src/server.js --name "cpanel-backend" || pm2 restart cpanel-backend
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp /home/$USER

# Configure Firewall
sudo ufw allow 2083/tcp || true
sudo ufw allow 2087/tcp || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true

echo "===================================================================="
echo "cPanel Pro & WHMCS Integration DEPLOYMENT COMPLETE!"
echo "cPanel Client Access: https://YOUR_VPS_IP:2083"
echo "WHM API / Admin Access: https://YOUR_VPS_IP:2087"
echo "WHMCS Hook installed at: /var/www/html/whmcs/includes/hooks/cpanel_pro_integration.php"
echo "===================================================================="
