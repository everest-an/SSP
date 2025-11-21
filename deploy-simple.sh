#!/bin/bash

# SSP DID System - Simple Deployment Script
# No fancy colors, just works!

echo "========================================="
echo "SSP DID System Deployment"
echo "========================================="
echo ""

# Get database credentials
echo "Please enter database credentials:"
read -p "MySQL Username [root]: " DB_USER
DB_USER=${DB_USER:-root}

read -sp "MySQL Password: " DB_PASS
echo ""

read -p "Database Name [ssp]: " DB_NAME
DB_NAME=${DB_NAME:-ssp}

echo ""
echo "Starting deployment..."
echo ""

# Step 1: Check directory
echo "[1/7] Checking directory..."
if [ ! -d "$HOME/SSP" ]; then
    echo "ERROR: SSP directory not found!"
    exit 1
fi
cd ~/SSP
echo "OK: In $(pwd)"
echo ""

# Step 2: Backup database
echo "[2/7] Backing up database..."
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
mysqldump -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null || echo "WARNING: Backup failed or database doesn't exist"
echo "OK: Backup saved to $BACKUP_FILE"
echo ""

# Step 3: Run migration
echo "[3/7] Running database migration..."
if [ -f "drizzle/migrations/001_create_did_tables.sql" ]; then
    mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < drizzle/migrations/001_create_did_tables.sql 2>/dev/null || echo "WARNING: Migration may have already been applied"
    echo "OK: Migration completed"
else
    echo "ERROR: Migration file not found!"
    exit 1
fi
echo ""

# Step 4: Pull code
echo "[4/7] Pulling latest code..."
git pull origin main
echo "OK: Code updated"
echo ""

# Step 5: Install dependencies
echo "[5/7] Installing dependencies..."
pnpm install
echo "OK: Dependencies installed"
echo ""

# Step 6: Build
echo "[6/7] Building project..."
pnpm run build
echo "OK: Build completed"
echo ""

# Step 7: Restart service
echo "[7/7] Restarting service..."
if pm2 describe ssp &> /dev/null; then
    pm2 restart ssp
else
    pm2 start dist/index.js --name ssp
fi
pm2 save
echo "OK: Service restarted"
echo ""

# Show status
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
pm2 status
echo ""
echo "Check logs with: pm2 logs ssp"
echo "Test at: https://ssp.click/did-registration"
echo ""
