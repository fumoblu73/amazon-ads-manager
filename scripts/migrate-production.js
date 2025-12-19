#!/usr/bin/env node
// ================================================
// PRODUCTION MIGRATION RUNNER (Remote)
// ================================================
// Runs migrations on production database from local machine
// Usage: node scripts/migrate-production.js

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runProductionMigrations() {
  console.log('🚀 Production Database Migration');
  console.log('=====================================');
  console.log('');

  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL environment variable not set');
    console.error('');
    console.error('Set it in your .env file or as an environment variable:');
    console.error('DATABASE_URL=postgresql://user:pass@host:5432/dbname');
    process.exit(1);
  }

  // Show connection info (masked)
  const dbUrl = process.env.DATABASE_URL;
  const maskedUrl = dbUrl.replace(/\/\/.*@/, '//***:***@');
  console.log(`📡 Connecting to: ${maskedUrl}`);
  console.log('');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Required for Supabase and most cloud providers
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to production database');
    console.log('');

    // Get migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📁 Found ${files.length} migration files`);
    console.log('');

    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check which migrations have already been applied
    const appliedResult = await client.query(
      'SELECT filename FROM migrations ORDER BY executed_at'
    );
    const appliedMigrations = new Set(appliedResult.rows.map(r => r.filename));

    if (appliedMigrations.size > 0) {
      console.log(`📋 Already applied migrations:`);
      appliedMigrations.forEach(m => console.log(`   - ${m}`));
      console.log('');
    }

    // Run each migration
    let newMigrations = 0;
    let skippedMigrations = 0;

    for (const file of files) {
      if (appliedMigrations.has(file)) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        skippedMigrations++;
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`⚙️  Running ${file}...`);

      try {
        // Run migration in a transaction
        await client.query('BEGIN');
        await client.query(sql);

        // Record migration as applied
        await client.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [file]
        );

        await client.query('COMMIT');
        console.log(`   ✅ ${file} completed`);
        newMigrations++;
      } catch (error) {
        await client.query('ROLLBACK');

        // Check if error is due to already existing objects
        if (error.message.includes('already exists') ||
            error.message.includes('duplicate')) {
          console.log(`   ⚠️  ${file} - objects already exist (safe to ignore)`);

          // Still record it as applied
          await client.query(
            'INSERT INTO migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
            [file]
          );
          skippedMigrations++;
        } else {
          throw error;
        }
      }

      console.log('');
    }

    console.log('=====================================');
    console.log('🎉 Migration Summary');
    console.log('=====================================');
    console.log(`   New migrations: ${newMigrations}`);
    console.log(`   Skipped: ${skippedMigrations}`);
    console.log(`   Total: ${files.length}`);
    console.log('');

    // Verify OAuth columns
    console.log('🔍 Verifying database structure...');
    console.log('');

    const oauthColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('amazon_user_id', 'access_token', 'refresh_token', 'profile_id')
      ORDER BY column_name
    `);

    if (oauthColumns.rows.length > 0) {
      console.log('✅ OAuth columns in users table:');
      oauthColumns.rows.forEach(row => console.log(`   - ${row.column_name}`));
    } else {
      console.log('⚠️  Warning: OAuth columns not found in users table');
    }

    const userIdColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'campaigns'
      AND column_name = 'user_id'
    `);

    if (userIdColumn.rows.length > 0) {
      console.log('✅ campaigns.user_id column exists');
    } else {
      console.log('⚠️  Warning: user_id column not found in campaigns table');
    }

    console.log('');
    console.log('✅ All migrations completed successfully!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('   1. Test OAuth login on your production app');
    console.log('   2. Sync campaigns from Amazon');
    console.log('   3. Verify per-user automation');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runProductionMigrations();
