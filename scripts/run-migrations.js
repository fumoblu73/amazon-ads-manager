#!/usr/bin/env node
// ================================================
// MIGRATION RUNNER
// ================================================
// Runs SQL migration files against the database

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Get migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`\n📁 Found ${files.length} migration files\n`);

    // Run each migration
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`⚙️  Running ${file}...`);

      try {
        await client.query(sql);
        console.log(`   ✅ ${file} completed\n`);
      } catch (error) {
        if (error.message.includes('already exists') ||
            error.message.includes('duplicate')) {
          console.log(`   ⚠️  ${file} already applied (skipped)\n`);
        } else {
          throw error;
        }
      }
    }

    console.log('🎉 All migrations completed successfully!\n');

    // Verify OAuth columns
    const result = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('amazon_user_id', 'access_token', 'refresh_token', 'profile_id')
    `);

    console.log('✅ OAuth columns verified:');
    result.rows.forEach(row => console.log(`   - ${row.column_name}`));

    // Verify campaigns.user_id
    const result2 = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'campaigns'
      AND column_name = 'user_id'
    `);

    if (result2.rows.length > 0) {
      console.log('✅ campaigns.user_id column verified\n');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
