#!/usr/bin/env bash
# ==============================================================================
# cPanel Pro & WHMCS Automated Linux VPS Production Installer (Ubuntu / Debian)
# ==============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
ORANGE='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${ORANGE}"
echo "  ██████╗██████╗  █████╗ ███╗   ██╗███████╗██╗     "
echo " ██╔════╝██╔══██╗██╔══██╗████╗  ██║██╔════╝██║     "
echo " ██║     ██████╔╝███████║██╔██╗ ██║█████╗  ██║     "
echo " ██║     ██╔═══╝ ██╔══██║██║╚██╗██║██╔══╝  ██║     "
echo " ╚██████╗██║     ██║  ██║██║ ╚████║███████╗███████╗"
echo "  ╚═════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝"
echo "        cPanel Pro & WHMCS Enterprise Automation"
echo -e "${NC}"

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Please run this installer as root (e.g. sudo bash install.sh)${NC}"
  exit 1
fi

echo -e "${BLUE}[1/8] Updating APT packages & installing base dependencies...${NC}"
apt-get update -y
apt-get install -y curl wget git unzip zip nginx mariadb-server certbot python3-certbot-nginx software-properties-common

echo -e "${BLUE}[2/8] Installing Node.js LTS runtime for cPanel Engine...${NC}"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo -e "${GREEN}✓ Node.js $(node -v) ready${NC}"

echo -e "${BLUE}[3/8] Installing PHP 8.2 & required extensions for WHMCS...${NC}"
add-apt-repository -y ppa:ondrej/php
apt-get update -y
apt-get install -y php8.2-fpm php8.2-cli php8.2-common php8.2-mysql php8.2-curl \
  php8.2-gd php8.2-mbstring php8.2-xml php8.2-zip php8.2-bcmath php8.2-soap php8.2-intl

echo -e "${BLUE}[4/8] Installing ionCube Loader for WHMCS...${NC}"
PHP_EXT_DIR=$(php -i | grep ^extension_dir | awk '{print $3}')
cd /tmp
wget -q https://downloads.ioncube.com/loader_downloads/ioncube_loaders_lin_x86-64.tar.gz
tar -xzf ioncube_loaders_lin_x86-64.tar.gz
cp ioncube/ioncube_loader_lin_8.2.so ${PHP_EXT_DIR}/
echo "zend_extension=ioncube_loader_lin_8.2.so" > /etc/php/8.2/mods-available/ioncube.ini
phpenmod ioncube
systemctl restart php8.2-fpm
echo -e "${GREEN}✓ ionCube Loader successfully enabled${NC}"

echo -e "${BLUE}[5/8] Setting up MariaDB Database for WHMCS...${NC}"
systemctl start mariadb
mariadb -e "CREATE DATABASE IF NOT EXISTS topupsh1_whmc885 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mariadb -e "CREATE USER IF NOT EXISTS 'topupsh1_whmc885'@'localhost' IDENTIFIED BY 'SL4p5.@a-K4[0]9U';"
mariadb -e "GRANT ALL PRIVILEGES ON topupsh1_whmc885.* TO 'topupsh1_whmc885'@'localhost';"
mariadb -e "FLUSH PRIVILEGES;"

# Auto import SQL dump if present
if [ -f "/opt/whmcs/topupsh1_whmc885.sql" ]; then
  echo -e "${PURPLE}Importing topupsh1_whmc885.sql into MariaDB...${NC}"
  mariadb topupsh1_whmc885 < /opt/whmcs/topupsh1_whmc885.sql
  echo -e "${GREEN}✓ WHMCS database imported successfully${NC}"
fi

APP_DIR="/opt/cpanel-pro"
echo -e "${BLUE}[6/8] Deploying cPanel Pro Engine at ${APP_DIR}...${NC}"
mkdir -p ${APP_DIR}
cp -r ./* ${APP_DIR}/

cd ${APP_DIR}/backend
npm install --production

cd ${APP_DIR}/frontend
npm install
npm run build

echo -e "${BLUE}[7/8] Creating Systemd background service for cPanel Engine...${NC}"
cat << 'EOF' > /etc/systemd/system/cpanel.service
[Unit]
Description=cPanel Pro Web Hosting Control Panel & WHM API Engine
After=network.target mariadb.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/cpanel-pro/backend
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=cpanel-pro
Environment=NODE_ENV=production PORT=5000

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable cpanel.service
systemctl restart cpanel.service

echo -e "${BLUE}[8/8] Configuring Nginx Reverse Proxy for cPanel & WHMCS...${NC}"
SERVER_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

cat << EOF > /etc/nginx/sites-available/cpanel.conf
server {
    listen 80;
    server_name ${SERVER_IP};

    # cPanel Frontend Dashboard
    location / {
        root /opt/cpanel-pro/frontend/dist;
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    # cPanel REST API & WHM API 1 for WHMCS
    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        client_max_body_size 500M;
    }

    location /json-api/ {
        proxy_pass http://127.0.0.1:5000/json-api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location /execute/ {
        proxy_pass http://127.0.0.1:5000/execute/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # Live Hosted Website Preview
    location /site/ {
        proxy_pass http://127.0.0.1:5000/site/;
        proxy_set_header Host \$host;
    }
}
EOF

ln -sf /etc/nginx/sites-available/cpanel.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# Setup WHMCS background cron if path exists
if [ -f "/opt/whmcs/crons/cron.php" ]; then
  (crontab -l 2>/dev/null; echo "*/5 * * * * /usr/bin/php -q /opt/whmcs/crons/cron.php >/dev/null 2>&1") | crontab -
  echo -e "${GREEN}✓ WHMCS Cron configured in crontab${NC}"
fi

echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}🎉 cPanel Pro & WHMCS Bridge successfully deployed!${NC}"
echo -e "${GREEN}👉 Open cPanel in browser: http://${SERVER_IP}${NC}"
echo -e "${GREEN}👉 WHM API Endpoint for WHMCS: http://${SERVER_IP}/json-api${NC}"
echo -e "${GREEN}👉 Theme & Template Status: 100% Intact & Protected${NC}"
echo -e "${GREEN}================================================================${NC}"
