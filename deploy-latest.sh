#!/bin/bash

# SSP Latest Code Deployment Script
# Deploy the latest code changes from GitHub

set -e  # Exit on error

echo "========================================="
echo "SSP Latest Code Deployment"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_info() { echo -e "${YELLOW}ℹ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }

# Navigate to project directory
print_info "Navigating to SSP directory..."
cd ~/SSP || cd /home/ec2-user/SSP || cd /var/www/SSP || {
    print_error "Cannot find SSP directory"
    exit 1
}
print_success "Current directory: $(pwd)"
echo ""

# Check current branch and status
print_info "Checking Git status..."
git status
echo ""

# Fetch and pull latest code
print_info "Fetching latest code from GitHub..."
git fetch origin main
print_success "Fetched latest changes"
echo ""

print_info "Pulling latest code..."
git pull origin main
print_success "Code updated"
echo ""

# Show latest commits
print_info "Latest commits:"
git log --oneline -5
echo ""

# Install dependencies
print_info "Installing dependencies..."
if command -v pnpm &> /dev/null; then
    pnpm install
    print_success "Dependencies installed with pnpm"
else
    npm install
    print_success "Dependencies installed with npm"
fi
echo ""

# Build project
print_info "Building project..."
if command -v pnpm &> /dev/null; then
    pnpm run build
else
    npm run build
fi
print_success "Build completed"
echo ""

# Restart application
print_info "Restarting application..."
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "ssp"; then
        pm2 restart ssp
        print_success "PM2 restarted"
    else
        pm2 start npm --name "ssp" -- start
        pm2 save
        print_success "PM2 started"
    fi
    echo ""
    pm2 list
    echo ""
    print_info "Recent logs:"
    pm2 logs ssp --lines 20 --nostream
else
    print_error "PM2 not found"
fi
echo ""

# Verify
print_info "Verifying deployment..."
sleep 3
if curl -f -s http://localhost:5000 > /dev/null 2>&1; then
    print_success "Application is running"
else
    print_error "Application may not be running properly"
fi
echo ""

echo "========================================="
print_success "Deployment Complete!"
echo "========================================="
echo ""
print_info "Visit: https://ssp.click"
print_info "Check logs: pm2 logs ssp"
echo ""
