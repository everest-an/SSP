#!/usr/bin/env node

/**
 * Database Migration Script
 * 
 * Usage: node scripts/migrate-db.mjs [command]
 * Commands:
 *   generate - Generate migration files
 *   migrate  - Apply migrations
 *   check    - Check migration status
 *   rollback - Rollback migrations
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const command = process.argv[2] || 'migrate';
const projectRoot = process.cwd();
const migrationsDir = join(projectRoot, 'drizzle', 'migrations');

// Ensure migrations directory exists
if (!existsSync(migrationsDir)) {
  mkdirSync(migrationsDir, { recursive: true });
  console.log(`✓ Created migrations directory: ${migrationsDir}`);
}

/**
 * Run a command
 */
function runCommand(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

/**
 * Main migration logic
 */
async function main() {
  try {
    switch (command) {
      case 'generate':
        console.log('🔄 Generating migration files...');
        await runCommand('pnpm', ['drizzle-kit', 'generate:pg']);
        console.log('✅ Migration files generated successfully');
        break;

      case 'migrate':
        console.log('🔄 Applying migrations...');
        await runCommand('pnpm', ['drizzle-kit', 'migrate']);
        console.log('✅ Migrations applied successfully');
        break;

      case 'check':
        console.log('🔍 Checking migration status...');
        await runCommand('pnpm', ['drizzle-kit', 'check:pg']);
        console.log('✅ Migration status checked');
        break;

      case 'studio':
        console.log('🎨 Opening Drizzle Studio...');
        await runCommand('pnpm', ['drizzle-kit', 'studio']);
        break;

      case 'rollback':
        console.log('⚠️  Rolling back migrations...');
        console.log('Note: Drizzle ORM does not support automatic rollback.');
        console.log('Please restore from database backup or manually execute rollback SQL.');
        break;

      case 'help':
        console.log(`
Database Migration Script

Usage: node scripts/migrate-db.mjs [command]

Commands:
  generate  Generate migration files from schema changes
  migrate   Apply pending migrations to database
  check     Check migration status
  studio    Open Drizzle Studio for visual database management
  rollback  Information about rolling back migrations
  help      Show this help message

Examples:
  node scripts/migrate-db.mjs generate
  node scripts/migrate-db.mjs migrate
  node scripts/migrate-db.mjs check
        `);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log('Run "node scripts/migrate-db.mjs help" for usage information');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

main();
