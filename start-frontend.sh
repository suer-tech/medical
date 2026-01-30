#!/bin/bash
cd /home/user/apps/medical
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use default
pkill -f 'vite.*4002'
sleep 2
npm run dev:frontend > /tmp/medical-vite.log 2>&1 &
echo "Frontend started on port 4002, PID: $!"
