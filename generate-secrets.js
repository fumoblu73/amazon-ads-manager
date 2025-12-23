#!/usr/bin/env node

/**
 * Generate Secrets Script
 *
 * Genera tutti i secrets necessari per deploy su Render
 *
 * Usage:
 *   node generate-secrets.js
 */

const crypto = require('crypto');

console.log('🔐 Generating secrets for Render deployment...\n');
console.log('Copy and paste these into your Render Environment Variables:\n');
console.log('='.repeat(70));

// Generate secrets
const jwtSecret = crypto.randomBytes(32).toString('base64');
const sessionSecret = crypto.randomBytes(32).toString('base64');
const automationSecret = crypto.randomBytes(32).toString('base64');
const adminToken = crypto.randomBytes(32).toString('base64');
const migrationSecret = crypto.randomBytes(32).toString('base64');

// ENCRYPTION_KEY is already generated (64 hex chars)
const encryptionKey = 'a33e863b996026f4aed3997006bc628326d3451307034a78102bffba88bb3e47';

// Display all secrets
console.log('\n# Security Secrets');
console.log('JWT_SECRET=' + jwtSecret);
console.log('SESSION_SECRET=' + sessionSecret);
console.log('AUTOMATION_SECRET=' + automationSecret);
console.log('ADMIN_TOKEN=' + adminToken);
console.log('MIGRATION_SECRET=' + migrationSecret);
console.log('ENCRYPTION_KEY=' + encryptionKey);

console.log('\n' + '='.repeat(70));
console.log('\n✅ Secrets generated successfully!\n');
console.log('📋 Next steps:');
console.log('1. Go to Render Dashboard → Your Service → Environment');
console.log('2. Add each variable above');
console.log('3. Click "Save Changes"');
console.log('4. Render will automatically redeploy\n');

console.log('⚠️  IMPORTANT: Save these secrets securely!');
console.log('   You will need ADMIN_TOKEN and AUTOMATION_SECRET for API calls.\n');
