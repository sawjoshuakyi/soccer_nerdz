const fs = require('fs');
const path = require('path');

// Ensure cache directory exists
const cacheDir = path.join(__dirname, 'cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Cache TTL in milliseconds - Optimized for API efficiency
const TTL = {
  FIXTURES: 30 * 60 * 1000,        // 30 minutes - fixtures change rarely
  MATCH_DATA: 4 * 60 * 60 * 1000,  // 4 hours - team data relatively stable
  PREDICTIONS: 24 * 60 * 60 * 1000,  // 24 hours - predictions valid until match
  LEAGUE_STATS: 24 * 60 * 60 * 1000,  // 24 hours - league stats stable
  TEAM_STATS: 24 * 60 * 60 * 1000,   // 24 hours - team season statistics
  SQUAD_STATS: 24 * 60 * 60 * 1000,  // 24 hours - squad with player stats
  RECENT_MATCHES: 4 * 60 * 60 * 1000, // 4 hours - team recent matches
  H2H: 24 * 60 * 60 * 1000           // 24 hours - head-to-head history
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
// TEAM STATS CACHE (Season statistics per team)
// =====================================================

function getTeamStats(teamId, leagueId, season) {
  const filename = `teamstats_${teamId}_${leagueId}_${season}.json`;
  return readCacheFile(filename);
}

function setTeamStats(teamId, leagueId, season, stats) {
  const filename = `teamstats_${teamId}_${leagueId}_${season}.json`;
  writeCacheFile(filename, stats, TTL.TEAM_STATS);
}

// =====================================================
// SQUAD STATS CACHE (Squad with player ratings/stats)
// =====================================================

function getSquadStats(teamId, leagueId, season) {
  const filename = `squadstats_${teamId}_${leagueId}_${season}.json`;
  return readCacheFile(filename);
}

function setSquadStats(teamId, leagueId, season, squad) {
  const filename = `squadstats_${teamId}_${leagueId}_${season}.json`;
  writeCacheFile(filename, squad, TTL.SQUAD_STATS);
}

// =====================================================
// RECENT MATCHES CACHE (Last N matches for a team)
// =====================================================

function getRecentMatches(teamId, season) {
  const filename = `recentmatches_${teamId}_${season}.json`;
  return readCacheFile(filename);
}

function setRecentMatches(teamId, season, matches) {
  const filename = `recentmatches_${teamId}_${season}.json`;
  writeCacheFile(filename, matches, TTL.RECENT_MATCHES);
}

// =====================================================
// HEAD-TO-HEAD CACHE
// =====================================================

function getH2H(homeId, awayId) {
  // Sort IDs to ensure consistent key regardless of home/away order
  const key = [homeId, awayId].sort((a, b) => a - b).join('_');
  const filename = `h2h_${key}.json`;
  return readCacheFile(filename);
}

function setH2H(homeId, awayId, h2hData) {
  const key = [homeId, awayId].sort((a, b) => a - b).join('_');
  const filename = `h2h_${key}.json`;
  writeCacheFile(filename, h2hData, TTL.H2H);
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
    const teamStatsCount = files.filter(f => f.startsWith('teamstats_')).length;
    const squadStatsCount = files.filter(f => f.startsWith('squadstats_')).length;
    const recentMatchesCount = files.filter(f => f.startsWith('recentmatches_')).length;
    const h2hCount = files.filter(f => f.startsWith('h2h_')).length;
    
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
        leagueStats: leagueStatsCount,
        teamStats: teamStatsCount,
        squadStats: squadStatsCount,
        recentMatches: recentMatchesCount,
        h2h: h2hCount
      },
      apiCalls24h
    };
  } catch (error) {
    return {
      cache: { fixtures: 0, matchData: 0, predictions: 0, leagueStats: 0, teamStats: 0, squadStats: 0, recentMatches: 0, h2h: 0 },
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
  // Fixtures
  getFixtures,
  setFixtures,
  // Match data
  getMatchData,
  setMatchData,
  // Predictions
  getPrediction,
  setPrediction,
  // League stats
  getLeagueStats,
  setLeagueStats,
  // Team stats (NEW)
  getTeamStats,
  setTeamStats,
  // Squad stats (NEW)
  getSquadStats,
  setSquadStats,
  // Recent matches (NEW)
  getRecentMatches,
  setRecentMatches,
  // Head-to-head (NEW)
  getH2H,
  setH2H,
  // Utilities
  logAPICall,
  getStats,
  clearAllCache,
  cleanupExpired
};