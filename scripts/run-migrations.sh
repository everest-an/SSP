#!/bin/bash

# SSP Database Migration Script
# This script runs all pending database migrations in order

set -e  # Exit on error

echo "==================================="
echo "SSP Database Migration Script"
echo "==================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    echo "Please set it in the format: mysql://user:password@host:port/database"
    exit 1
fi

echo "Database URL: ${DATABASE_URL%%:*}://***:***@${DATABASE_URL##*@}"
echo ""

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
MIGRATIONS_DIR="$PROJECT_ROOT/drizzle"

echo "Project root: $PROJECT_ROOT"
echo "Migrations directory: $MIGRATIONS_DIR"
echo ""

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "Error: Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
fi

# Count migration files
MIGRATION_COUNT=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | grep -E "^.*[0-9]{4}_.*\.sql$" | wc -l)
echo "Found $MIGRATION_COUNT migration files"
echo ""

if [ "$MIGRATION_COUNT" -eq 0 ]; then
    echo "No migration files found. Nothing to do."
    exit 0
fi

# List all migrations
echo "Migration files:"
ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | grep -E "^.*[0-9]{4}_.*\.sql$" | sort | while read -r file; do
    echo "  - $(basename "$file")"
done
echo ""

# Ask for confirmation
read -p "Do you want to run these migrations? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo "Running migrations..."
echo ""

# Parse DATABASE_URL
# Format: mysql://user:password@host:port/database
DB_URL_NO_PROTOCOL="${DATABASE_URL#mysql://}"
DB_USER_PASS="${DB_URL_NO_PROTOCOL%%@*}"
DB_HOST_PORT_DB="${DB_URL_NO_PROTOCOL#*@}"
DB_USER="${DB_USER_PASS%%:*}"
DB_PASS="${DB_USER_PASS#*:}"
DB_HOST="${DB_HOST_PORT_DB%%:*}"
DB_PORT_DB="${DB_HOST_PORT_DB#*:}"
DB_PORT="${DB_PORT_DB%%/*}"
DB_NAME="${DB_PORT_DB#*/}"

# Remove any query parameters from DB_NAME
DB_NAME="${DB_NAME%%\?*}"

echo "Connecting to database: $DB_NAME on $DB_HOST:$DB_PORT"
echo ""

# Run each migration file
for migration_file in $(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | grep -E "^.*[0-9]{4}_.*\.sql$" | sort); do
    migration_name=$(basename "$migration_file")
    echo "Applying migration: $migration_name"
    
    # Execute migration using mysql client
    if command -v mysql &> /dev/null; then
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$migration_file"
        if [ $? -eq 0 ]; then
            echo "  ✓ Success"
        else
            echo "  ✗ Failed"
            exit 1
        fi
    else
        echo "  ⚠ mysql client not found. Skipping..."
        echo "  Please install mysql-client or run migrations manually."
    fi
    echo ""
done

echo "==================================="
echo "All migrations completed successfully!"
echo "==================================="
