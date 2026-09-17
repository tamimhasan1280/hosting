
const fs = require('fs');
fs.writeFileSync('/etc/nginx/sites-available/default', `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    location /assets/ {
        alias /var/www/cpanel/frontend/dist/assets/;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /json-api/ {
        proxy_pass http://127.0.0.1:5000/json-api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /execute/ {
        proxy_pass http://127.0.0.1:5000/execute/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~* ^/cpsess_([a-zA-Z0-9_-]+)/ {
        rewrite ^/cpsess_([a-zA-Z0-9_-]+)/(.*)$ /?session=cpsess_$1&$2 break;
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
    }

    location / {
        root /var/www/cpanel/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
`);
console.log('Nginx config updated successfully.');
