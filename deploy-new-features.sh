#!/bin/bash

# SSP Deployment Script - New Features
# This script deploys the latest changes including:
# - Login/Payment history
# - Export functionality
# - Email service
# - Liveness detection UI
# - 2FA support

set -e  # Exit on error

echo "========================================="
echo "SSP Deployment Script"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/home/ubuntu/SSP"
BACKUP_DIR="/home/ubuntu/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${YELLOW}Step 1: Creating backup...${NC}"
mkdir -p $BACKUP_DIR
if [ -d "$APP_DIR" ]; then
    tar -czf "$BACKUP_DIR/ssp_backup_$TIMESTAMP.tar.gz" -C /home/ubuntu SSP
    echo -e "${GREEN}✓ Backup created: $BACKUP_DIR/ssp_backup_$TIMESTAMP.tar.gz${NC}"
else
    echo -e "${YELLOW}⚠ No existing app directory found, skipping backup${NC}"
fi
echo ""

echo -e "${YELLOW}Step 2: Pulling latest code from GitHub...${NC}"
cd $APP_DIR || exit 1
git fetch origin
git pull origin main
echo -e "${GREEN}✓ Code updated to latest version${NC}"
echo ""

echo -e "${YELLOW}Step 3: Installing dependencies...${NC}"
pnpm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

echo -e "${YELLOW}Step 4: Applying database migrations...${NC}"

# Check if MySQL is running
if ! systemctl is-active --quiet mysql; then
    echo -e "${RED}✗ MySQL is not running. Starting MySQL...${NC}"
    sudo systemctl start mysql
    sleep 3
fi

# Apply 2FA migration
if [ -f "drizzle/migrations/add_2fa_fields.sql" ]; then
    echo "Applying 2FA fields migration..."
    mysql -u root -p"${MYSQL_ROOT_PASSWORD:-}" ssp < drizzle/migrations/add_2fa_fields.sql 2>/dev/null || {
        echo -e "${YELLOW}⚠ Migration may have already been applied or password needed${NC}"
        echo "Please run manually: mysql -u root -p ssp < drizzle/migrations/add_2fa_fields.sql"
    }
    echo -e "${GREEN}✓ Database migration applied${NC}"
else
    echo -e "${YELLOW}⚠ Migration file not found${NC}"
fi
echo ""

echo -e "${YELLOW}Step 5: Building application...${NC}"
pnpm run build
echo -e "${GREEN}✓ Application built successfully${NC}"
echo ""

echo -e "${YELLOW}Step 6: Checking environment variables...${NC}"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠ .env file not found. Creating from template...${NC}"
    cat > .env << 'EOF'
# Database
DATABASE_URL=mysql://root:password@localhost:3306/ssp

# Email Service (Optional - will log to console if not configured)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=noreply@ssp.click

# AWS (if using)
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=

# Session
SESSION_SECRET=your-secret-key-here

# Node Environment
NODE_ENV=production
PORT=5000
EOF
    echo -e "${YELLOW}⚠ Please edit .env file with your actual credentials${NC}"
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi
echo ""

echo -e "${YELLOW}Step 7: Managing PM2 process...${NC}"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

# Stop existing process
pm2 stop ssp 2>/dev/null || echo "No existing process to stop"

# Start new process
pm2 start npm --name "ssp" -- start
pm2 save

echo -e "${GREEN}✓ Application restarted with PM2${NC}"
echo ""

echo -e "${YELLOW}Step 8: Verifying deployment...${NC}"
sleep 3

# Check if app is running
if pm2 list | grep -q "ssp.*online"; then
    echo -e "${GREEN}✓ Application is running${NC}"
else
    echo -e "${RED}✗ Application failed to start${NC}"
    echo "Check logs with: pm2 logs ssp"
    exit 1
fi

# Check if port is listening
if netstat -tuln | grep -q ":5000"; then
    echo -e "${GREEN}✓ Application is listening on port 5000${NC}"
else
    echo -e "${YELLOW}⚠ Port 5000 not detected, application may still be starting${NC}"
fi
echo ""

echo "========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "========================================="
echo ""
echo "New Features Deployed:"
echo "  • Login History Tracking"
echo "  • Payment History Display"
echo "  • CSV/PDF Export"
echo "  • Email Service"
echo "  • Liveness Detection UI"
echo "  • Two-Factor Authentication"
echo ""
echo "New Routes Available:"
echo "  • https://ssp.click/payment-history"
echo "  • https://ssp.click/login-history"
echo "  • https://ssp.click/liveness-test"
echo "  • https://ssp.click/2fa-settings"
echo ""
echo "Post-Deployment Tasks:"
echo "  1. Configure email credentials in .env"
echo "  2. Test new features"
echo "  3. Monitor logs: pm2 logs ssp"
echo ""
echo "Useful Commands:"
echo "  • View logs: pm2 logs ssp"
echo "  • Restart app: pm2 restart ssp"
echo "  • Stop app: pm2 stop ssp"
echo "  • Check status: pm2 status"
echo ""
echo -e "${GREEN}Deployment completed successfully!${NC}"
