#!/bin/bash

###############################################################################
# SSP DID System - One-Click Deployment Script
# 
# This script deploys the complete DID system to EC2
# 
# Usage:
#   bash deploy-did-system.sh
#
# Author: SSP Development Team
# Date: 2025-11-21
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Banner
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║           SSP DID System Deployment Script               ║"
echo "║                                                           ║"
echo "║   Privacy-First Decentralized Identity Wallet            ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    log_warning "Please do not run as root. Run as ec2-user or ubuntu."
    exit 1
fi

# Get database credentials
log_info "Database Configuration"
echo ""
read -p "MySQL Username [root]: " DB_USER
DB_USER=${DB_USER:-root}

read -sp "MySQL Password: " DB_PASS
echo ""

read -p "Database Name [ssp]: " DB_NAME
DB_NAME=${DB_NAME:-ssp}

echo ""
log_info "Starting deployment..."
echo ""

# Step 1: Check prerequisites
log_info "Step 1/8: Checking prerequisites..."

# Check if git is installed
if ! command -v git &> /dev/null; then
    log_error "git is not installed. Please install git first."
    exit 1
fi

# Check if node is installed
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    log_warning "pnpm is not installed. Installing pnpm..."
    npm install -g pnpm
fi

# Check if pm2 is installed
if ! command -v pm2 &> /dev/null; then
    log_warning "PM2 is not installed. Installing PM2..."
    npm install -g pm2
fi

# Check if mysql client is installed
if ! command -v mysql &> /dev/null; then
    log_error "MySQL client is not installed. Please install mysql-client first."
    exit 1
fi

log_success "Prerequisites check passed!"
echo ""

# Step 2: Navigate to project directory
log_info "Step 2/8: Navigating to project directory..."

if [ ! -d "$HOME/SSP" ]; then
    log_error "SSP directory not found at $HOME/SSP"
    log_info "Please clone the repository first:"
    log_info "  git clone https://github.com/everest-an/SSP.git ~/SSP"
    exit 1
fi

cd ~/SSP
log_success "Changed to $(pwd)"
echo ""

# Step 3: Backup database
log_info "Step 3/8: Backing up database..."

BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
if mysqldump -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null; then
    log_success "Database backed up to $BACKUP_FILE"
else
    log_warning "Database backup failed or database doesn't exist yet. Continuing..."
fi
echo ""

# Step 4: Run database migration
log_info "Step 4/8: Running database migration..."

if [ -f "drizzle/migrations/001_create_did_tables.sql" ]; then
    if mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < drizzle/migrations/001_create_did_tables.sql 2>/dev/null; then
        log_success "Database migration completed!"
    else
        log_warning "Migration may have already been applied. Continuing..."
    fi
    
    # Verify tables
    log_info "Verifying tables..."
    TABLE_COUNT=$(mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SHOW TABLES LIKE 'did_%';" 2>/dev/null | wc -l)
    if [ "$TABLE_COUNT" -ge 5 ]; then
        log_success "Found $TABLE_COUNT DID tables"
    else
        log_warning "Expected 5 DID tables, found $TABLE_COUNT"
    fi
else
    log_error "Migration file not found!"
    exit 1
fi
echo ""

# Step 5: Pull latest code
log_info "Step 5/8: Pulling latest code from GitHub..."

git fetch origin
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
log_info "Current branch: $CURRENT_BRANCH"

if git pull origin main; then
    log_success "Code updated successfully!"
    git log --oneline -5
else
    log_error "Failed to pull latest code"
    exit 1
fi
echo ""

# Step 6: Install dependencies
log_info "Step 6/8: Installing dependencies..."

if pnpm install; then
    log_success "Dependencies installed!"
else
    log_error "Failed to install dependencies"
    exit 1
fi
echo ""

# Step 7: Build project
log_info "Step 7/8: Building project..."

if pnpm run build; then
    log_success "Project built successfully!"
    
    # Check build output
    if [ -d "dist" ] && [ -d "client/dist" ]; then
        log_success "Build artifacts verified"
    else
        log_warning "Build artifacts may be incomplete"
    fi
else
    log_error "Build failed"
    exit 1
fi
echo ""

# Step 8: Restart service
log_info "Step 8/8: Restarting service..."

# Check if ssp is already running
if pm2 describe ssp &> /dev/null; then
    log_info "Restarting existing PM2 process..."
    pm2 restart ssp
else
    log_info "Starting new PM2 process..."
    pm2 start dist/index.js --name ssp
fi

# Save PM2 configuration
pm2 save

log_success "Service restarted!"
echo ""

# Display status
log_info "Service Status:"
pm2 status ssp
echo ""

# Display logs
log_info "Recent Logs:"
pm2 logs ssp --lines 20 --nostream
echo ""

# Verification
log_info "Verifying deployment..."
echo ""

# Check if server is responding
sleep 3
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000 | grep -q "200"; then
    log_success "Server is responding!"
else
    log_warning "Server may not be responding yet. Check logs with: pm2 logs ssp"
fi

# Display summary
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║              Deployment Completed Successfully!           ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

log_success "SSP DID System has been deployed!"
echo ""
log_info "Next Steps:"
echo "  1. Check service status: pm2 status"
echo "  2. View logs: pm2 logs ssp"
echo "  3. Test registration: https://ssp.click/did-registration"
echo "  4. Test login: https://ssp.click/did-login"
echo ""
log_info "Database Backup: $BACKUP_FILE"
log_info "Git Commit: $(git rev-parse --short HEAD)"
echo ""

# Display useful commands
echo -e "${BLUE}Useful Commands:${NC}"
echo "  pm2 status              - Check service status"
echo "  pm2 logs ssp            - View live logs"
echo "  pm2 restart ssp         - Restart service"
echo "  pm2 stop ssp            - Stop service"
echo "  pm2 monit               - Monitor resources"
echo ""

log_success "Deployment complete! 🎉"
