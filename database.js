const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'cache.db');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Cache TTL in milliseconds
const TTL = {
  FIXTURES: 60 * 60 * 1000,        // 1 hour
  MATCH_DATA: 6 * 60 * 60 * 1000,  // 6 hours
  PREDICTIONS: 7 * 24 * 60 * 60 * 1000  // 7 days
};

// Initialize database tables if they don't exist
function initDatabase() {
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS api_call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      success INTEGER NOT NULL,
      cached INTEGER NOT NULL,
      timestamp INTEGER NOT NULL
    )
  `);

  // Create indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_fixtures_expires ON fixtures_cache(expires_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_match_data_expires ON match_data_cache(expires_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_predictions_expires ON predictions_cache(expires_at)`);
}

// Initialize on module load
initDatabase();

// Clean up expired entries periodically
function cleanupExpired() {
  const now = Date.now();
  
  const fixturesDeleted = db.prepare('DELETE FROM fixtures_cache WHERE expires_at < ?').run(now);
  const matchDataDeleted = db.prepare('DELETE FROM match_data_cache WHERE expires_at < ?').run(now);
  const predictionsDeleted = db.prepare('DELETE FROM predictions_cache WHERE expires_at < ?').run(now);
  
  const total = fixturesDeleted.changes + matchDataDeleted.changes + predictionsDeleted.changes;
  
  if (total > 0) {
    console.log(`🧹 Cleaned up ${total} expired cache entries`);
  }
}

// Run cleanup every hour
setInterval(cleanupExpired, 60 * 60 * 1000);

// =====================================================
// FIXTURES CACHE
// =====================================================

function getFixtures(leagueKey) {
  const row = db.prepare('SELECT data, expires_at FROM fixtures_cache WHERE league_key = ?').get(leagueKey);
  
  if (!row) return null;
  
  if (Date.now() > row.expires_at) {
    // Expired, delete it
    db.prepare('DELETE FROM fixtures_cache WHERE league_key = ?').run(leagueKey);
    return null;
  }
  
  return JSON.parse(row.data);
}

function setFixtures(leagueKey, data) {
  const now = Date.now();
  const expiresAt = now + TTL.FIXTURES;
  
  const stmt = db.prepare(`
    INSERT INTO fixtures_cache (league_key, data, created_at, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(league_key) DO UPDATE SET
      data = excluded.data,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at
  `);
  
  stmt.run(leagueKey, JSON.stringify(data), now, expiresAt);
}

// =====================================================
// MATCH DATA CACHE
// =====================================================

function getMatchData(fixtureId) {
  const row = db.prepare('SELECT data, expires_at FROM match_data_cache WHERE fixture_id = ?').get(fixtureId);
  
  if (!row) return null;
  
  if (Date.now() > row.expires_at) {
    db.prepare('DELETE FROM match_data_cache WHERE fixture_id = ?').run(fixtureId);
    return null;
  }
  
  return JSON.parse(row.data);
}

function setMatchData(fixtureId, data) {
  const now = Date.now();
  const expiresAt = now + TTL.MATCH_DATA;
  
  const stmt = db.prepare(`
    INSERT INTO match_data_cache (fixture_id, data, created_at, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(fixture_id) DO UPDATE SET
      data = excluded.data,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at
  `);
  
  stmt.run(fixtureId, JSON.stringify(data), now, expiresAt);
}

// =====================================================
// PREDICTIONS CACHE
// =====================================================

function getPrediction(fixtureId) {
  const row = db.prepare('SELECT prediction, expires_at FROM predictions_cache WHERE fixture_id = ?').get(fixtureId);
  
  if (!row) return null;
  
  if (Date.now() > row.expires_at) {
    db.prepare('DELETE FROM predictions_cache WHERE fixture_id = ?').run(fixtureId);
    return null;
  }
  
  return row.prediction;
}

function setPrediction(fixtureId, prediction) {
  const now = Date.now();
  const expiresAt = now + TTL.PREDICTIONS;
  
  const stmt = db.prepare(`
    INSERT INTO predictions_cache (fixture_id, prediction, created_at, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(fixture_id) DO UPDATE SET
      prediction = excluded.prediction,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at
  `);
  
  stmt.run(fixtureId, prediction, now, expiresAt);
}

// =====================================================
// API CALL LOGGING
// =====================================================

function logAPICall(endpoint, success, cached) {
  const stmt = db.prepare(`
    INSERT INTO api_call_logs (endpoint, success, cached, timestamp)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run(endpoint, success ? 1 : 0, cached ? 1 : 0, Date.now());
}

// =====================================================
// STATISTICS
// =====================================================

function getStats() {
  const fixturesCount = db.prepare('SELECT COUNT(*) as count FROM fixtures_cache').get().count;
  const matchDataCount = db.prepare('SELECT COUNT(*) as count FROM match_data_cache').get().count;
  const predictionsCount = db.prepare('SELECT COUNT(*) as count FROM predictions_cache').get().count;
  
  const apiCalls24h = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) as cached,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful
    FROM api_call_logs 
    WHERE timestamp > ?
  `).get(Date.now() - 24 * 60 * 60 * 1000);
  
  return {
    cache: {
      fixtures: fixturesCount,
      matchData: matchDataCount,
      predictions: predictionsCount
    },
    apiCalls24h: {
      total: apiCalls24h.total || 0,
      cached: apiCalls24h.cached || 0,
      successful: apiCalls24h.successful || 0,
      cacheHitRate: apiCalls24h.total > 0 
        ? ((apiCalls24h.cached / apiCalls24h.total) * 100).toFixed(1) + '%'
        : '0%'
    }
  };
}

// =====================================================
// CLEAR CACHE
// =====================================================

function clearAllCache() {
  db.prepare('DELETE FROM fixtures_cache').run();
  db.prepare('DELETE FROM match_data_cache').run();
  db.prepare('DELETE FROM predictions_cache').run();
  console.log('🧹 All cache cleared');
}

module.exports = {
  getFixtures,
  setFixtures,
  getMatchData,
  setMatchData,
  getPrediction,
  setPrediction,
  logAPICall,
  getStats,
  clearAllCache,
  cleanupExpired
};