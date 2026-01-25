const fs = require('fs');
const path = require('path');

// Ensure cache directory exists
const cacheDir = path.join(__dirname, 'cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Cache TTL in milliseconds
const TTL = {
  FIXTURES: 60 * 60 * 1000,        // 1 hour
  MATCH_DATA: 6 * 60 * 60 * 1000,  // 6 hours
  PREDICTIONS: 7 * 24 * 60 * 60 * 1000,  // 7 days
  LEAGUE_STATS: 12 * 60 * 60 * 1000  // 12 hours
};

// Helper to read cache file
function readCacheFile(filename) {
  try {
    const filepath = path.join(cacheDir, filename);
    if (!fs.existsSync(filepath)) return null;
    
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    
    // Check if expired
    if (Date.now() > data.expiresAt) {
      fs.unlinkSync(filepath);
      return null;
    }
    
    return data.value;
  } catch (error) {
    return null;
  }
}

// Helper to write cache file
function writeCacheFile(filename, value, ttl) {
  try {
    const filepath = path.join(cacheDir, filename);
    const data = {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl
    };
    
    fs.writeFileSync(filepath, JSON.stringify(data), 'utf8');
  } catch (error) {
    console.error('Error writing cache:', error.message);
  }
}

// Helper to sanitize filenames
function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}

// =====================================================
// FIXTURES CACHE
// =====================================================

function getFixtures(leagueKey) {
  const filename = `fixtures_${sanitizeFilename(leagueKey)}.json`;
  return readCacheFile(filename);
}

function setFixtures(leagueKey, data) {
  const filename = `fixtures_${sanitizeFilename(leagueKey)}.json`;
  writeCacheFile(filename, data, TTL.FIXTURES);
}

// =====================================================
// MATCH DATA CACHE
// =====================================================

function getMatchData(fixtureId) {
  const filename = `matchdata_${fixtureId}.json`;
  return readCacheFile(filename);
}

function setMatchData(fixtureId, data) {
  const filename = `matchdata_${fixtureId}.json`;
  writeCacheFile(filename, data, TTL.MATCH_DATA);
}

// =====================================================
// PREDICTIONS CACHE
// =====================================================

function getPrediction(fixtureId) {
  const filename = `prediction_${fixtureId}.json`;
  return readCacheFile(filename);
}

function setPrediction(fixtureId, prediction) {
  const filename = `prediction_${fixtureId}.json`;
  writeCacheFile(filename, prediction, TTL.PREDICTIONS);
}

// =====================================================
// LEAGUE STATS CACHE
// =====================================================

function getLeagueStats(leagueKey) {
  const filename = `leaguestats_${sanitizeFilename(leagueKey)}.json`;
  return readCacheFile(filename);
}

function setLeagueStats(leagueKey, stats) {
  const filename = `leaguestats_${sanitizeFilename(leagueKey)}.json`;
  writeCacheFile(filename, stats, TTL.LEAGUE_STATS);
}

// =====================================================
// API CALL LOGGING
// =====================================================

function logAPICall(endpoint, success, cached) {
  try {
    const logFile = path.join(cacheDir, 'api_logs.json');
    let logs = [];
    
    if (fs.existsSync(logFile)) {
      logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    }
    
    logs.push({
      endpoint,
      success,
      cached,
      timestamp: Date.now()
    });
    
    // Keep only last 1000 logs
    if (logs.length > 1000) {
      logs = logs.slice(-1000);
    }
    
    fs.writeFileSync(logFile, JSON.stringify(logs), 'utf8');
  } catch (error) {
    // Silent fail for logging
  }
}

// =====================================================
// STATISTICS
// =====================================================

function getStats() {
  try {
    // Count cache files
    const files = fs.readdirSync(cacheDir);
    const fixturesCount = files.filter(f => f.startsWith('fixtures_')).length;
    const matchDataCount = files.filter(f => f.startsWith('matchdata_')).length;
    const predictionsCount = files.filter(f => f.startsWith('prediction_')).length;
    const leagueStatsCount = files.filter(f => f.startsWith('leaguestats_')).length;
    
    // Read API logs
    const logFile = path.join(cacheDir, 'api_logs.json');
    let apiCalls24h = { total: 0, cached: 0, successful: 0 };
    
    if (fs.existsSync(logFile)) {
      const logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      const recentLogs = logs.filter(log => log.timestamp > yesterday);
      
      apiCalls24h = {
        total: recentLogs.length,
        cached: recentLogs.filter(log => log.cached).length,
        successful: recentLogs.filter(log => log.success).length,
        cacheHitRate: recentLogs.length > 0 
          ? ((recentLogs.filter(log => log.cached).length / recentLogs.length) * 100).toFixed(1) + '%'
          : '0%'
      };
    }
    
    return {
      cache: {
        fixtures: fixturesCount,
        matchData: matchDataCount,
        predictions: predictionsCount,
        leagueStats: leagueStatsCount
      },
      apiCalls24h
    };
  } catch (error) {
    return {
      cache: { fixtures: 0, matchData: 0, predictions: 0, leagueStats: 0 },
      apiCalls24h: { total: 0, cached: 0, successful: 0, cacheHitRate: '0%' }
    };
  }
}

// =====================================================
// CLEAR CACHE
// =====================================================

function clearAllCache() {
  try {
    const files = fs.readdirSync(cacheDir);
    files.forEach(file => {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(cacheDir, file));
      }
    });
    console.log('🧹 All cache cleared');
  } catch (error) {
    console.error('Error clearing cache:', error.message);
  }
}

// =====================================================
// CLEANUP EXPIRED
// =====================================================

function cleanupExpired() {
  try {
    const files = fs.readdirSync(cacheDir);
    let deletedCount = 0;
    
    files.forEach(file => {
      if (file.endsWith('.json') && file !== 'api_logs.json') {
        const filepath = path.join(cacheDir, file);
        try {
          const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
          if (Date.now() > data.expiresAt) {
            fs.unlinkSync(filepath);
            deletedCount++;
          }
        } catch (err) {
          // Invalid file, delete it
          fs.unlinkSync(filepath);
          deletedCount++;
        }
      }
    });
    
    if (deletedCount > 0) {
      console.log(`🧹 Cleaned up ${deletedCount} expired cache entries`);
    }
  } catch (error) {
    console.error('Error during cleanup:', error.message);
  }
}

// Run cleanup every hour
setInterval(cleanupExpired, 60 * 60 * 1000);

module.exports = {
  getFixtures,
  setFixtures,
  getMatchData,
  setMatchData,
  getPrediction,
  setPrediction,
  getLeagueStats,
  setLeagueStats,
  logAPICall,
  getStats,
  clearAllCache,
  cleanupExpired
};