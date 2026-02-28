#!/usr/bin/env node
// scripts/apply-migrations.js
//
// Applies all SQL migration files in supabase/migrations/ to the Supabase
// (Postgres) database in filename order.
//
// Usage:
//   node scripts/apply-migrations.js
//
// Required environment variable:
//   DATABASE_URL  — Postgres connection string, e.g.
//                   postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
//
// Optional:
//   MIGRATIONS_DIR — path to directory containing *.sql files
//                    (defaults to supabase/migrations)

'use strict';

const fs   = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('Error: DATABASE_URL environment variable is not set.');
        console.error('Set it to your Supabase Postgres connection string, e.g.');
        console.error('  postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres');
        process.exit(1);
    }

    const migrationsDir = process.env.MIGRATIONS_DIR
        || path.join(__dirname, '..', 'supabase', 'migrations');

    if (!fs.existsSync(migrationsDir)) {
        console.error(`Error: migrations directory not found: ${migrationsDir}`);
        process.exit(1);
    }

    // Collect .sql files, sort numerically by filename prefix
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    if (files.length === 0) {
        console.log('No migration files found — nothing to do.');
        return;
    }

    const client = new Client({ connectionString: databaseUrl });
    await client.connect();
    console.log('Connected to database.');

    try {
        for (const file of files) {
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            console.log(`Applying: ${file}`);
            try {
                await client.query(sql);
                console.log(`  ✓ ${file} applied successfully.`);
            } catch (err) {
                console.error(`  ✗ ${file} failed: ${err.message}`);
                throw err;
            }
        }

        console.log('\nAll migrations applied successfully.');
    } finally {
        await client.end();
    }
}

main().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
