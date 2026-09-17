#!/bin/bash
pkill -f cloudflared || true
nohup cloudflared tunnel --url http://localhost:80 > /home/ubuntu/tunnel.log 2>&1 &
sleep 6
grep -o 'https://[-a-z0-9.]*\.trycloudflare\.com' /home/ubuntu/tunnel.log | head -n 1
