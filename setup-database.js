const Database = require('better-sqlite3');
const path = require('path');

console.log('🗄️  Setting up database...\n');

// Create database
const dbPath = path.join(__dirname, 'data', 'cache.db');
const db = new Database(dbPath);

console.log(`📁 Database location: ${dbPath}\n`);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
console.log('Creating tables...');

// 1. Fixtures cache table
db.exec(`
  CREATE TABLE IF NOT EXISTS fixtures_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_key TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    UNIQUE(league_key)
  )
`);
console.log('✅ Created fixtures_cache table');

// 2. Match data cache table (team stats, injuries, players, etc.)
db.exec(`
  CREATE TABLE IF NOT EXISTS match_data_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fixture_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    UNIQUE(fixture_id)
  )
`);
console.log('✅ Created match_data_cache table');

// 3. Predictions cache table
db.exec(`
  CREATE TABLE IF NOT EXISTS predictions_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fixture_id INTEGER NOT NULL,
    prediction TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    UNIQUE(fixture_id)
  )
`);
console.log('✅ Created predictions_cache table');

// 4. API call logs (for monitoring)
db.exec(`
  CREATE TABLE IF NOT EXISTS api_call_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    success INTEGER NOT NULL,
    cached INTEGER NOT NULL,
    timestamp INTEGER NOT NULL
  )
`);
console.log('✅ Created api_call_logs table');

// Create indexes for better performance
db.exec(`CREATE INDEX IF NOT EXISTS idx_fixtures_expires ON fixtures_cache(expires_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_match_data_expires ON match_data_cache(expires_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_predictions_expires ON predictions_cache(expires_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp ON api_call_logs(timestamp)`);

console.log('✅ Created indexes\n');

console.log('🎉 Database setup complete!\n');
console.log('Cache expiration times:');
console.log('  - Fixtures: 1 hour');
console.log('  - Match data: 6 hours');
console.log('  - Predictions: 7 days');
console.log('');

db.close();