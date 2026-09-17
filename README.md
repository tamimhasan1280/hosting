# 🚀 TAMIM HOSTING — Next-Gen cPanel & Cloud Web Hosting Control Panel

A comprehensive, turnkey Web Hosting Control Panel, Client Ordering Portal, and WHM Server Management Platform built with **React 19, Vite, Tailwind CSS** and **Node.js / Express**.

---

## 🌟 Key Features

### 1. Client Portal & Automated Hosting Billing
- **Package Selection**: Starter Cloud (5 GB), Pro Cloud (10 GB), Business Cloud (15 GB), and Enterprise Cloud (20 GB) NVMe SSD tiers.
- **Domain Management**: Real-time domain syntax validation, existing domain mapping, and subdomain allocations.
- **Promotions & Coupons**: Server-side coupon verification with percentage or fixed discount calculation.
- **Payment Gateways**: Manual & Automated support for bKash, Nagad, Rocket, and Bank Transfer with transaction verification.
- **Admin Approval Gatekeeper**: Instant order and invoice generation in `pending` state; File Manager and cPanel tools are securely locked until Main Admin reviews and approves the order.

### 2. Main Admin Dashboard & WHM Operations
- **Interactive Orders Listing**:
  - **Select All & Deselect All** in one click.
  - **Bulk Action Floating Toolbar** with live selection counter, `Approve Selected`, and `Delete Selected`.
  - **Action Column**: Individual bold **Approve**, **Reject**, and **Delete** buttons on every row.
- **Invoices & Settlements**:
  - Transaction ID verification.
  - **Select All** & **Bulk Delete** for invoices.
- **User Management**: Search, view client details, edit info, reset passwords, suspend, or delete accounts.
- **Dynamic File Upload Limiter**: Admin controls max upload file size dynamically in MB (auto-calculated in GB) for client uploads.
- **IP Firewall & Blocker**: Instant IP banning by scope and reason to prevent abusive traffic.
- **Package & Promo Management**: Full CRUD for hosting packages and discount coupons.
- **Live Hardware Telemetry**: Real-time physical and logical CPU core utilization and RAM polling.
- **Operational Audit Logs**: Full forensic audit trails for all critical admin actions.

### 3. Full-Featured cPanel User Suite
- **File Manager**:
  - Dark purple & emerald glassmorphism UI.
  - Multi-gigabyte file upload support (2 GB, 3 GB+).
  - Built-in Monaco-style Code Editor with syntax highlighting.
  - Zip compression, extraction, recursive deletion, copy, move, rename, and permissions management.
- **MySQL Databases**: Database creation, user privileges, and phpMyAdmin integration.
- **Business Email & Webmail**: Email accounts management, forwarders, autoresponders, and webmail modal.
- **Cron Jobs**: Visual schedule builder, preset selectors, and real-time terminal output console.
- **DNS Zone Editor**: Full A, CNAME, MX, TXT, and SRV record management.
- **FTP Accounts**: User isolation and quota management.
- **SSL / TLS**: Automated Let's Encrypt / ZeroSSL provisioning status.

---

## 🛠️ Quick Start (Local Development)

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### 1. Clone the Repository
```bash
git clone https://github.com/tamimhasan1280/hosting.git
cd hosting
```

### 2. Install & Start Backend
```bash
cd backend
npm install
npm start
```
*Backend API runs on `http://localhost:5000`*

### 3. Install & Start Frontend
```bash
cd ../frontend
npm install
npm run dev
```
*Frontend client runs on `http://localhost:3000`*

---

## 🌐 Turnkey Linux VPS Deployment

To deploy on an Ubuntu, Debian, AlmaLinux, or Rocky Linux VPS:

```bash
# 1. Clone repository to /var/www or your chosen directory
git clone https://github.com/tamimhasan1280/hosting.git
cd hosting

# 2. Grant execute permission and run automated turnkey script
chmod +x deploy_vps.sh
sudo ./deploy_vps.sh
```

The script automatically:
1. Installs Node.js, npm, git, nginx, and pm2.
2. Builds the frontend production bundle (`npm run build`).
3. Installs backend production dependencies.
4. Starts backend daemon with PM2 process manager and enables systemd auto-restart on reboot.
5. Configures firewall ports (`80`, `443`, `5000`).

---

## 🔑 Default Credentials

- **Main Admin Dashboard**:
  - URL: `http://<your-ip-or-domain>:3000/admin`
  - Username: `tamimhasan1281@gmail.com` (or `cpanel_user`)
  - Password: `admin`

- **Demo Client Account**:
  - URL: `http://<your-ip-or-domain>:3000`
  - Username: `usera_1789663018510@example.com`
  - Password: *(set via register or admin reset)*

---

## 📄 License
ISC License © TAMIM HOSTING.
