// ================================================
// MIGRATION ENDPOINT
// ================================================
// Protected endpoint to run database migrations
// Only accessible with MIGRATION_SECRET

import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import fs from 'fs';
import path from 'path';

const router = Router();

/**
 * POST /api/migrate
 * Runs pending database migrations
 *
 * Security: Requires MIGRATION_SECRET in Authorization header
 */
router.post('/migrate', async (req: Request, res: Response) => {
  try {
    // Check authorization
    const authHeader = req.headers.authorization;
    const migrationSecret = process.env.MIGRATION_SECRET || 'change-me-in-production';

    if (!authHeader || authHeader !== `Bearer ${migrationSecret}`) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid or missing MIGRATION_SECRET'
      });
    }

    console.log('🚀 Starting database migrations...');

    // Get migration files
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const results = [];
    let newMigrations = 0;
    let skippedMigrations = 0;

    // Create migrations tracking table
    await AppDataSource.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check applied migrations
    const appliedResult = await AppDataSource.query(
      'SELECT filename FROM migrations ORDER BY executed_at'
    );
    const appliedMigrations = new Set(appliedResult.map((r: any) => r.filename));

    // Run each migration
    for (const file of files) {
      if (appliedMigrations.has(file)) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        results.push({ file, status: 'skipped', message: 'Already applied' });
        skippedMigrations++;
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`⚙️  Running ${file}...`);

      try {
        // Run in transaction
        await AppDataSource.query('BEGIN');
        await AppDataSource.query(sql);
        await AppDataSource.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [file]
        );
        await AppDataSource.query('COMMIT');

        console.log(`   ✅ ${file} completed`);
        results.push({ file, status: 'success', message: 'Applied successfully' });
        newMigrations++;
      } catch (error: any) {
        await AppDataSource.query('ROLLBACK');

        if (error.message.includes('already exists') ||
            error.message.includes('duplicate')) {
          console.log(`   ⚠️  ${file} - objects already exist`);

          // Still record as applied
          await AppDataSource.query(
            'INSERT INTO migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
            [file]
          );

          results.push({ file, status: 'skipped', message: 'Objects already exist' });
          skippedMigrations++;
        } else {
          console.error(`   ❌ ${file} failed:`, error.message);
          results.push({ file, status: 'error', message: error.message });
        }
      }
    }

    // Verify structure
    const oauthColumns = await AppDataSource.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('amazon_user_id', 'access_token', 'refresh_token', 'profile_id')
      ORDER BY column_name
    `);

    const userIdColumn = await AppDataSource.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'campaigns'
      AND column_name = 'user_id'
    `);

    console.log('✅ Migrations completed');

    return res.json({
      success: true,
      message: 'Migrations completed',
      summary: {
        total: files.length,
        new: newMigrations,
        skipped: skippedMigrations
      },
      details: results,
      verification: {
        oauthColumns: oauthColumns.map((r: any) => r.column_name),
        campaignsUserId: userIdColumn.length > 0
      }
    });

  } catch (error: any) {
    console.error('❌ Migration error:', error);
    return res.status(500).json({
      success: false,
      error: 'Migration failed',
      message: error.message
    });
  }
});

/**
 * GET /api/migrate/status
 * Check migration status
 */
router.get('/migrate/status', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const migrationSecret = process.env.MIGRATION_SECRET || 'change-me-in-production';

    if (!authHeader || authHeader !== `Bearer ${migrationSecret}`) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Check if migrations table exists
    const tableExists = await AppDataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'migrations'
      );
    `);

    if (!tableExists[0].exists) {
      return res.json({
        success: true,
        message: 'No migrations have been run yet',
        applied: []
      });
    }

    // Get applied migrations
    const applied = await AppDataSource.query(
      'SELECT filename, executed_at FROM migrations ORDER BY executed_at'
    );

    return res.json({
      success: true,
      applied: applied,
      count: applied.length
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
