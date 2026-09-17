module.exports = {
  apps: [
    {
      name: 'cpanel-backend',
      script: 'src/server.js',
      cwd: __dirname + '/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        WHMCS_DIR: '/var/www/html/whmcs',
        CPANEL_BASE_URL: 'https://cpanel.yourdomain.com:2083'
      }
    }
  ]
};
