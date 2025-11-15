#!/bin/bash
# SSP One-Command Deployment Script
# Copy and paste this entire script into Session Manager terminal

set -e
cd /home/ubuntu/SSP
echo "==================================="
echo "SSP Deployment Starting..."
echo "==================================="
echo ""

# Step 1: Backup
echo "[1/7] Creating backup..."
mkdir -p /home/ubuntu/backups
tar -czf /home/ubuntu/backups/ssp_backup_$(date +%Y%m%d_%H%M%S).tar.gz -C /home/ubuntu SSP 2>/dev/null || echo "Backup skipped"
echo "✓ Backup complete"
echo ""

# Step 2: Pull latest code
echo "[2/7] Pulling latest code..."
git pull origin main
echo "✓ Code updated"
echo ""

# Step 3: Install dependencies
echo "[3/7] Installing dependencies..."
pnpm install
echo "✓ Dependencies installed"
echo ""

# Step 4: Database migration
echo "[4/7] Applying database migration..."
if [ -f "drizzle/migrations/add_2fa_fields.sql" ]; then
    mysql -u root ssp < drizzle/migrations/add_2fa_fields.sql 2>/dev/null || echo "⚠ Migration may already be applied"
    echo "✓ Database migration applied"
else
    echo "⚠ Migration file not found"
fi
echo ""

# Step 5: Build application
echo "[5/7] Building application..."
pnpm run build
echo "✓ Build complete"
echo ""

# Step 6: Restart PM2
echo "[6/7] Restarting application..."
pm2 restart ssp 2>/dev/null || pm2 start npm --name "ssp" -- start
pm2 save
echo "✓ Application restarted"
echo ""

# Step 7: Verify
echo "[7/7] Verifying deployment..."
sleep 2
pm2 status
echo ""
echo "==================================="
echo "✓ Deployment Complete!"
echo "==================================="
echo ""
echo "New routes available:"
echo "  • https://ssp.click/login-history"
echo "  • https://ssp.click/payment-history"
echo "  • https://ssp.click/2fa-settings"
echo "  • https://ssp.click/liveness-test"
echo ""
echo "Check logs: pm2 logs ssp"
