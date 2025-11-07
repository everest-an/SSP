export PS1="[CMD_BEGIN]\n\u@\h:\w\n[CMD_END]"; export PS2=""
export TERM=xterm-256color
export OPENAI_API_KEY="sk-VcY87HaL69TNazWSi9TCEn"
export OPENAI_API_BASE="https://api.manus.im/api/llm-proxy/v1"
export OPENAI_BASE_URL="https://api.manus.im/api/llm-proxy/v1"
ps() { /bin/ps "$@" | grep -v -E '(start_server\.py|upgrade\.py|supervisor)' || true; }
pgrep() { /usr/bin/pgrep "$@" | while read pid; do [ -n "$pid" ] && cmdline=$(/bin/ps -p $pid -o command= 2>/dev/null) && ! echo "$cmdline" | grep -q -E '(start_server\.py|upgrade\.py|supervisor)' && echo "$pid"; done; }
source /home/ubuntu/.user_env && cd . && cd /home/ubuntu && rm -rf .git && git init && git config user.name "SSP Developer" && git config user.email "dev@ssp.com" && git branch -m main
source /home/ubuntu/.user_env && cd . && cd /home/ubuntu && git add client/ server/ shared/ drizzle/ *.json *.ts *.md LICENSE .env.example .gitignore .prettierrc .prettierignore patches/ components.json && git status --short | head -50
source /home/ubuntu/.user_env && cd . && cd /home/ubuntu && git commit -m "Initial commit: SSP Smart Store Payment System

- Complete backend API with tRPC
- MySQL database schema with Drizzle ORM
- Face recognition and gesture payment system
- Wallet system (custodial and non-custodial)
- Stripe payment integration
- Merchant, product, device, and order management
- Admin dashboard and analytics
- React frontend with TailwindCSS
- MediaPipe integration for AI/ML features"
export PS1="[CMD_BEGIN]\n\u@\h:\w\n[CMD_END]"; export PS2=""
export TERM=xterm-256color
export OPENAI_API_KEY="sk-VcY87HaL69TNazWSi9TCEn"
export OPENAI_API_BASE="https://api.manus.im/api/llm-proxy/v1"
export OPENAI_BASE_URL="https://api.manus.im/api/llm-proxy/v1"
ps() { /bin/ps "$@" | grep -v -E '(start_server\.py|upgrade\.py|supervisor)' || true; }
pgrep() { /usr/bin/pgrep "$@" | while read pid; do [ -n "$pid" ] && cmdline=$(/bin/ps -p $pid -o command= 2>/dev/null) && ! echo "$cmdline" | grep -q -E '(start_server\.py|upgrade\.py|supervisor)' && echo "$pid"; done; }
source /home/ubuntu/.user_env && cd . && cd /home/ubuntu && cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
.vite/

# Environment variables
.env
.env.local
.env.production

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Testing
coverage/
.nyc_output/

# Temporary files
*.tmp
.cache/

# Database
*.db
*.sqlite

# Local development
.local/
.cache/
.config/
.npm/
.nvm/
.pki/
.secrets/
.browser_data_dir/
.logs/
.user_env
.zshrc
.bashrc
.bash_logout
.profile

# Project specific
sandbox.txt
upload/
screenshots/
page_texts/
Downloads/

# Drizzle
drizzle/migrations/
EOF

cat .gitignore
export PS1="[CMD_BEGIN]\n\u@\h:\w\n[CMD_END]"; export PS2=""
export TERM=xterm-256color
export OPENAI_API_KEY="sk-VcY87HaL69TNazWSi9TCEn"
export OPENAI_API_BASE="https://api.manus.im/api/llm-proxy/v1"
export OPENAI_BASE_URL="https://api.manus.im/api/llm-proxy/v1"
ps() { /bin/ps "$@" | grep -v -E '(start_server\.py|upgrade\.py|supervisor)' || true; }
pgrep() { /usr/bin/pgrep "$@" | while read pid; do [ -n "$pid" ] && cmdline=$(/bin/ps -p $pid -o command= 2>/dev/null) && ! echo "$cmdline" | grep -q -E '(start_server\.py|upgrade\.py|supervisor)' && echo "$pid"; done; }
source /home/ubuntu/.user_env && cd . && cd /home/ubuntu && unzip -q upload/ssp-web.zip && ls -la
source /home/ubuntu/.user_env && cd . && tree -L 2 -I 'node_modules' /home/ubuntu | head -60
source /home/ubuntu/.user_env && cd . && ls -la server/ && echo "---" && tree server/ -I 'node_modules'
source /home/ubuntu/.user_env && cd . && find /home/ubuntu -maxdepth 2 -type f -iname "readme*" -o -iname "*.md" | grep -v node_modules | head -20
source /home/ubuntu/.user_env && cd . && cd /home/ubuntu && git init && git config user.name "SSP Developer" && git config user.email "dev@ssp.com"
source /home/ubuntu/.user_env && cd . && cd /home/ubuntu && git branch -m main
source /home/ubuntu/.user_env && cd . && cd /home/ubuntu && git add -A && git status
