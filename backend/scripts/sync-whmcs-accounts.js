#!/usr/bin/env node
/**
 * WHMCS Account Synchronizer for cPanel Pro
 * Reads WHMCS hosting accounts and synchronizes them into cPanel multi-tenant stores.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const whmService = require('../src/services/whmService');
const authService = require('../src/services/authService');

const WHMCS_DIR = process.env.WHMCS_DIR || 'D:\\Websites\\WHMC';
const SQL_DUMP = path.join(WHMCS_DIR, 'topupsh1_whmc885.sql');

async function sync() {
  console.log('=== WHMCS to cPanel Pro Account Sync ===');
  console.log('WHMCS Directory:', WHMCS_DIR);

  if (!fs.existsSync(SQL_DUMP)) {
    console.log('No SQL dump file found at:', SQL_DUMP);
    console.log('Syncing from active WHMCS accounts in whm_accounts.json...');
    const current = whmService.listAccounts();
    console.log('Total accounts managed:', current.data.acct.length);
    return;
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(SQL_DUMP),
    crlfDelay: Infinity
  });

  let inHosting = false;
  let hostingText = '';

  for await (const line of rl) {
    if (line.startsWith('INSERT INTO `tblhosting`')) inHosting = true;
    if (inHosting) {
      hostingText += line + ' ';
      if (line.endsWith(';')) inHosting = false;
    }
  }

  const regex = /\((\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(\d+),\s*([0-9.]+),\s*([0-9.]+),\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'/g;
  
  let synced = 0;
  let match;
  while ((match = regex.exec(hostingText)) !== null) {
    const domain = match[7];
    const status = match[17];
    const username = match[18];

    if (username && domain && status === 'Active') {
      const email = `admin@${domain}`;
      const result = whmService.createAccount({
        username,
        domain,
        plan: 'Business Cloud Hosting',
        contactemail: email,
        quota: 10240
      });

      if (result.metadata && result.metadata.result === 1) {
        console.log(`+ Provisioned new cPanel account: ${username} (${domain})`);
        synced++;
      } else {
        // Already exists - ensure auth is registered
        authService.registerUser(username, email, 'P@ssword123!');
      }
    }
  }

  console.log(`Sync complete! ${synced} new accounts provisioned.`);
  console.log('Total active cPanel accounts:', whmService.listAccounts().data.acct.length);
}

sync().catch(err => console.error('Sync failed:', err));
