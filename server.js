const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cache = require('./cache-simple');
const cron = require('node-cron');
const { generateAllPredictions } = require('./generate-predictions');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Track generation status
let generationStatus = {
  isRunning: false,
  lastRun: null,
  lastStats: null,
  nextRun: null
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased from default 100kb to 50mb
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// League configurations
const LEAGUES = {
  epl: { id: 39, name: 'Premier League', season: 2025 },
  bundesliga: { id: 78, name: 'Bundesliga', season: 2025 },
  seriea: { id: 135, name: 'Serie A', season: 2025 },
  laliga: { id: 140, name: 'La Liga', season: 2025 }
};

// Helper function to calculate league statistics
function calculateLeagueStats(fixtures) {
  if (!fixtures || fixtures.length === 0) {
    return null;
  }

  // Filter only finished matches
  const finishedMatches = fixtures.filter(f => f.fixture.status.short === 'FT');
  
  if (finishedMatches.length === 0) {
    return null;
  }

  let totalGoals = 0;
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;
  let bttsCount = 0;
  let over25Count = 0;
  let homeCleanSheets = 0;
  let awayCleanSheets = 0;
  let homeFailedToScore = 0;
  let awayFailedToScore = 0;

  finishedMatches.forEach(match => {
    const homeGoals = match.goals.home || 0;
    const awayGoals = match.goals.away || 0;
    const totalMatchGoals = homeGoals + awayGoals;

    totalGoals += totalMatchGoals;

    // Result
    if (homeGoals > awayGoals) homeWins++;
    else if (homeGoals === awayGoals) draws++;
    else awayWins++;

    // BTTS
    if (homeGoals > 0 && awayGoals > 0) bttsCount++;

    // Over 2.5
    if (totalMatchGoals > 2.5) over25Count++;

    // Clean sheets
    if (awayGoals === 0) homeCleanSheets++;
    if (homeGoals === 0) awayCleanSheets++;

    // Failed to score
    if (homeGoals === 0) homeFailedToScore++;
    if (awayGoals === 0) awayFailedToScore++;
  });

  const totalMatches = finishedMatches.length;

  return {
    totalMatches,
    goalsPerGame: (totalGoals / totalMatches).toFixed(2),
    homeWinPercentage: ((homeWins / totalMatches) * 100).toFixed(1),
    drawPercentage: ((draws / totalMatches) * 100).toFixed(1),
    awayWinPercentage: ((awayWins / totalMatches) * 100).toFixed(1),
    bttsPercentage: ((bttsCount / totalMatches) * 100).toFixed(1),
    over25Percentage: ((over25Count / totalMatches) * 100).toFixed(1),
    cleanSheetPercentage: (((homeCleanSheets + awayCleanSheets) / (totalMatches * 2)) * 100).toFixed(1),
    failedToScorePercentage: (((homeFailedToScore + awayFailedToScore) / (totalMatches * 2)) * 100).toFixed(1)
  };
}

// ENDPOINT: Get league statistics (like Predictz.com)
app.get('/api/league-stats/:league', async (req, res) => {
  const { league } = req.params;
  
  if (!LEAGUES[league]) {
    return res.status(400).json({ error: 'Invalid league' });
  }

  // Check cache first
  const cachedStats = cache.getLeagueStats(league);
  if (cachedStats) {
    console.log(`💾 Returning cached league stats for ${league}`);
    return res.json(cachedStats);
  }

  try {
    const leagueConfig = LEAGUES[league];
    console.log(`\n📊 Calculating league statistics for ${leagueConfig.name}...`);

    // Fetch last 100 finished matches for accurate stats
    const data = await fetchFromAPI(`fixtures?league=${leagueConfig.id}&season=${leagueConfig.season}&last=100`);
    
    if (!data.response || data.response.length === 0) {
      return res.status(404).json({ error: 'No data available for league statistics' });
    }

    const stats = calculateLeagueStats(data.response);
    
    if (!stats) {
      return res.status(404).json({ error: 'Unable to calculate league statistics' });
    }

    const leagueStats = {
      league: leagueConfig.name,
      season: leagueConfig.season,
      stats,
      lastUpdated: new Date().toISOString()
    };

    // Cache for 12 hours
    cache.setLeagueStats(league, leagueStats);
    
    console.log(`✅ League stats calculated for ${league}`);
    res.json(leagueStats);
  } catch (error) {
    console.error('Error calculating league stats:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// API-Football configuration
const API_KEY = process.env.RAPIDAPI_KEY;
const API_BASE_URL = 'https://v3.football.api-sports.io';

// Check if API key is loaded
console.log('\n🔑 API Configuration:');
console.log('   API Key loaded:', API_KEY ? 'YES ✅' : 'NO ❌');
if (API_KEY) {
  console.log('   API Key (first 10 chars):', API_KEY.substring(0, 10) + '...');
} else {
  console.log('   ⚠️  WARNING: RAPIDAPI_KEY not found in .env file!');
}
console.log('   API Base URL:', API_BASE_URL);
console.log('');

// Helper function to fetch from API-Football
async function fetchFromAPI(endpoint) {
  try {
    const url = `${API_BASE_URL}/${endpoint}`;
    
    console.log(`   Using API key: ${API_KEY ? API_KEY.substring(0, 10) + '...' : 'MISSING!'}`);
    
    const response = await axios.get(url, {
      headers: {
        'x-apisports-key': API_KEY
      }
    });
    
    return response.data;
  } catch (error) {
    console.error(`API Error for ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

// ENDPOINT: Get upcoming fixtures for a league
app.get('/api/fixtures/:league', async (req, res) => {
  const { league } = req.params;
  
  if (!LEAGUES[league]) {
    return res.status(400).json({ error: 'Invalid league' });
  }

  // Check database cache first
  const cachedFixtures = cache.getFixtures(league);
  if (cachedFixtures) {
    console.log(`💾 Returning cached fixtures for ${league} (${cachedFixtures.length} fixtures)`);
    cache.logAPICall(`fixtures/${league}`, true, true);
    return res.json(cachedFixtures);
  }

  try {
    const leagueConfig = LEAGUES[league];
    console.log(`\n🔍 Fetching fixtures for ${leagueConfig.name} (ID: ${leagueConfig.id}, Season: ${leagueConfig.season})`);
    
    // Try method 1: Using 'next' parameter
    let endpoint = `fixtures?league=${leagueConfig.id}&season=${leagueConfig.season}&next=10`;
    console.log(`📍 Trying endpoint: ${endpoint}`);
    
    let data = await fetchFromAPI(endpoint);
    
    // If no results, try method 2: Using date range
    if (!data.response || data.response.length === 0) {
      console.log(`⚠️ No fixtures with 'next' parameter, trying date range...`);
      
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + 60); // Next 60 days
      
      const fromDate = today.toISOString().split('T')[0];
      const toDate = futureDate.toISOString().split('T')[0];
      
      endpoint = `fixtures?league=${leagueConfig.id}&season=${leagueConfig.season}&from=${fromDate}&to=${toDate}`;
      console.log(`📍 Trying date range: ${endpoint}`);
      
      data = await fetchFromAPI(endpoint);
    }
    
    // LOG THE FULL RESPONSE
    console.log('📦 API Response structure:', {
      hasErrors: !!data.errors,
      errors: data.errors,
      resultsCount: data.results,
      responseLength: data.response?.length || 0
    });
    
    // Check if we got valid response data
    if (!data.response) {
      console.log('❌ No response data from API');
      cache.logAPICall(`fixtures/${league}`, false, false);
      return res.status(500).json({ error: 'Invalid API response' });
    }

    let fixtures = data.response;
    
    // Filter for only upcoming fixtures and limit to 10
    const now = new Date();
    fixtures = fixtures
      .filter(f => new Date(f.fixture.date) > now)
      .slice(0, 10);
    
    console.log(`✅ Found ${fixtures.length} upcoming fixtures`);
    
    // Store in database cache
    cache.setFixtures(league, fixtures);
    cache.logAPICall(`fixtures/${league}`, true, false);
    
    res.json(fixtures);
  } catch (error) {
    console.error('❌ Error fetching fixtures:', error.message);
    cache.logAPICall(`fixtures/${league}`, false, false);
    res.status(500).json({ error: error.message });
  }
});

// ENDPOINT: Get comprehensive match data for prediction
app.get('/api/match-data/:fixtureId', async (req, res) => {
  const { fixtureId } = req.params;
  const { homeTeamId, awayTeamId, leagueId } = req.query;

  if (!homeTeamId || !awayTeamId || !leagueId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // Check database cache first
  const cachedMatchData = cache.getMatchData(fixtureId);
  if (cachedMatchData) {
    console.log(`💾 Returning cached match data for fixture ${fixtureId}`);
    cache.logAPICall(`match-data/${fixtureId}`, true, true);
    return res.json(cachedMatchData);
  }

  try {
    const currentSeason = 2025;

    console.log(`\nFetching comprehensive data for fixture ${fixtureId}...`);
    console.log('This includes: stats, H2H, predictions, form, standings, injuries, squads, and player data');

    // Fetch all data in parallel - COMPREHENSIVE DATA COLLECTION
    const [
      // Core match data
      homeStatsData,
      awayStatsData,
      h2hData,
      predictionsData,
      
      // Recent form (extended to 20 matches)
      homeMatchesData,
      awayMatchesData,
      
      // League context
      standingsData,
      
      // Squad and player information
      homeSquadData,
      awaySquadData,
      
      // Injuries and suspensions
      homeInjuriesData,
      awayInjuriesData,
      
      // Top scorers for context
      topScorersData,
      topAssistsData
    ] = await Promise.all([
      // Team season statistics
      fetchFromAPI(`teams/statistics?team=${homeTeamId}&season=${currentSeason}&league=${leagueId}`),
      fetchFromAPI(`teams/statistics?team=${awayTeamId}&season=${currentSeason}&league=${leagueId}`),
      
      // Head to head (last 10 meetings)
      fetchFromAPI(`fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}&last=10`),
      
      // API predictions
      fetchFromAPI(`predictions?fixture=${fixtureId}`),
      
      // Recent matches (last 20 for better analysis)
      fetchFromAPI(`fixtures?team=${homeTeamId}&season=${currentSeason}&last=20`),
      fetchFromAPI(`fixtures?team=${awayTeamId}&season=${currentSeason}&last=20`),
      
      // League standings
      fetchFromAPI(`standings?league=${leagueId}&season=${currentSeason}`),
      
      // Squad information
      fetchFromAPI(`players/squads?team=${homeTeamId}`),
      fetchFromAPI(`players/squads?team=${awayTeamId}`),
      
      // Injuries and suspensions
      fetchFromAPI(`injuries?team=${homeTeamId}&season=${currentSeason}`),
      fetchFromAPI(`injuries?team=${awayTeamId}&season=${currentSeason}`),
      
      // League top scorers for context
      fetchFromAPI(`players/topscorers?league=${leagueId}&season=${currentSeason}`),
      fetchFromAPI(`players/topassists?league=${leagueId}&season=${currentSeason}`)
    ]);

    // Now fetch detailed player statistics for both teams
    console.log('Fetching detailed player statistics...');
    
    const [homePlayersData, awayPlayersData] = await Promise.all([
      fetchFromAPI(`players?team=${homeTeamId}&season=${currentSeason}`),
      fetchFromAPI(`players?team=${awayTeamId}&season=${currentSeason}`)
    ]);

    // Compile comprehensive match data
    const matchData = {
      // Core team statistics
      homeTeamStats: homeStatsData.response || null,
      awayTeamStats: awayStatsData.response || null,
      
      // Historical context
      headToHead: h2hData.response || [],
      
      // API predictions
      predictions: predictionsData.response || [],
      
      // Recent form
      homeRecentMatches: homeMatchesData.response || [],
      awayRecentMatches: awayMatchesData.response || [],
      
      // League context
      standings: standingsData.response || [],
      
      // Squad information
      homeSquad: homeSquadData.response || [],
      awaySquad: awaySquadData.response || [],
      
      // Injuries and suspensions
      homeInjuries: homeInjuriesData.response || [],
      awayInjuries: awayInjuriesData.response || [],
      
      // Player statistics
      homePlayers: homePlayersData.response || [],
      awayPlayers: awayPlayersData.response || [],
      
      // League top performers for context
      leagueTopScorers: topScorersData.response || [],
      leagueTopAssists: topAssistsData.response || []
    };

    console.log('✅ Successfully fetched comprehensive data:');
    console.log(`   - Team statistics: ${matchData.homeTeamStats ? 'Yes' : 'No'}`);
    console.log(`   - H2H matches: ${matchData.headToHead.length}`);
    console.log(`   - Recent matches: Home ${matchData.homeRecentMatches.length}, Away ${matchData.awayRecentMatches.length}`);
    console.log(`   - Standings: ${matchData.standings.length > 0 ? 'Yes' : 'No'}`);
    console.log(`   - Injuries: Home ${matchData.homeInjuries.length}, Away ${matchData.awayInjuries.length}`);
    console.log(`   - Players: Home ${matchData.homePlayers.length}, Away ${matchData.awayPlayers.length}`);
    
    // Store in database cache
    cache.setMatchData(fixtureId, matchData);
    cache.logAPICall(`match-data/${fixtureId}`, true, false);
    
    res.json(matchData);
  } catch (error) {
    console.error('Error fetching match data:', error);
    cache.logAPICall(`match-data/${fixtureId}`, false, false);
    res.status(500).json({ error: error.message });
  }
});

// ENDPOINT: Get prediction (READ-ONLY - No generation)
app.post('/api/predict', async (req, res) => {
  const { fixture } = req.body;

  if (!fixture) {
    return res.status(400).json({ error: 'Missing fixture data' });
  }

  const fixtureId = fixture.fixture.id;

  try {
    // Check cache for pre-generated prediction
    const cachedPrediction = cache.getPrediction(fixtureId);
    
    if (cachedPrediction) {
      console.log(`✅ Returning pre-generated prediction for fixture ${fixtureId}`);
      cache.logAPICall(`prediction/${fixtureId}`, true, true);
      return res.json({ 
        prediction: cachedPrediction,
        generated: true,
        cached: true
      });
    }

    // Prediction not yet generated
    console.log(`⚠️  No prediction available for fixture ${fixtureId}`);
    cache.logAPICall(`prediction/${fixtureId}`, false, false);
    
    return res.status(404).json({ 
      error: 'Prediction not available yet',
      message: 'This prediction will be available soon. Our system generates predictions for upcoming matches daily.',
      generated: false,
      fixtureId: fixtureId,
      match: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
      date: fixture.fixture.date
    });

  } catch (error) {
    console.error('Error fetching prediction:', error.message);
    res.status(500).json({ error: 'Failed to fetch prediction' });
  }
});

// Cache statistics endpoint
app.get('/api/stats', (req, res) => {
  const stats = cache.getStats();
  res.json(stats);
});

// Clear cache endpoint (for admin)
app.post('/api/clear-cache', (req, res) => {
  cache.clearAllCache();
  res.json({ message: 'Cache cleared successfully' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const stats = cache.getStats();
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    leagues: Object.keys(LEAGUES),
    cache: stats.cache,
    apiCalls24h: stats.apiCalls24h,
    generation: generationStatus
  });
});

// ═══════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS (Add authentication in production!)
// ═══════════════════════════════════════════════════════════════

// Manually trigger prediction generation
app.post('/admin/generate-predictions', async (req, res) => {
  if (generationStatus.isRunning) {
    return res.status(429).json({ 
      error: 'Generation already in progress',
      status: generationStatus
    });
  }

  // Start generation in background
  res.json({ 
    message: 'Prediction generation started',
    status: 'running',
    checkStatusAt: '/admin/generation-status'
  });

  // Run generation asynchronously
  generationStatus.isRunning = true;
  generationStatus.lastRun = new Date().toISOString();

  try {
    const stats = await generateAllPredictions();
    generationStatus.lastStats = stats;
    generationStatus.isRunning = false;
  } catch (error) {
    console.error('Generation error:', error);
    generationStatus.isRunning = false;
    generationStatus.lastStats = { error: error.message };
  }
});

// Get generation status
app.get('/admin/generation-status', (req, res) => {
  res.json(generationStatus);
});

// Get list of available predictions
app.get('/admin/predictions', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const cacheDir = path.join(__dirname, 'cache');
  
  try {
    const files = fs.readdirSync(cacheDir);
    const predictions = files
      .filter(f => f.startsWith('prediction_'))
      .map(f => {
        const fixtureId = f.replace('prediction_', '').replace('.json', '');
        const filepath = path.join(cacheDir, f);
        const stats = fs.statSync(filepath);
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        
        return {
          fixtureId,
          createdAt: new Date(data.createdAt).toISOString(),
          expiresAt: new Date(data.expiresAt).toISOString(),
          size: stats.size,
          isExpired: Date.now() > data.expiresAt
        };
      });
    
    res.json({
      total: predictions.length,
      predictions: predictions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// CRON JOB SCHEDULER
// ═══════════════════════════════════════════════════════════════

// Schedule daily prediction generation at 3:00 AM
// Cron format: minute hour day month dayOfWeek
const CRON_SCHEDULE = '0 3 * * *'; // Every day at 3:00 AM

cron.schedule(CRON_SCHEDULE, async () => {
  console.log('\n⏰ SCHEDULED PREDICTION GENERATION TRIGGERED');
  console.log(`Time: ${new Date().toLocaleString()}\n`);

  if (generationStatus.isRunning) {
    console.log('⚠️  Generation already in progress, skipping...\n');
    return;
  }

  generationStatus.isRunning = true;
  generationStatus.lastRun = new Date().toISOString();

  try {
    const stats = await generateAllPredictions();
    generationStatus.lastStats = stats;
    generationStatus.isRunning = false;
    
    console.log('\n✅ Scheduled generation completed successfully\n');
  } catch (error) {
    console.error('\n❌ Scheduled generation failed:', error.message, '\n');
    generationStatus.isRunning = false;
    generationStatus.lastStats = { error: error.message };
  }
}, {
  timezone: "America/New_York" // Adjust to your timezone
});

// Calculate next run time
function getNextCronRun() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(3, 0, 0, 0);
  
  // If it's past 3 AM today, next run is tomorrow
  if (now.getHours() >= 3) {
    return tomorrow.toISOString();
  } else {
    // Next run is today at 3 AM
    const today = new Date(now);
    today.setHours(3, 0, 0, 0);
    return today.toISOString();
  }
}

generationStatus.nextRun = getNextCronRun();

// Start server
app.listen(PORT, () => {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('🚀 SOCCER PREDICTION ENGINE - SAAS EDITION');
  console.log('════════════════════════════════════════════════════════════════\n');
  console.log(`🌐 Server running: http://localhost:${PORT}`);
  console.log(`📊 Leagues: ${Object.keys(LEAGUES).join(', ')}`);
  console.log(`💾 Caching: File-based (JSON)\n`);
  
  console.log('📈 Cache Expiration:');
  console.log('   - Fixtures: 1 hour');
  console.log('   - Match data: 6 hours');
  console.log('   - Predictions: 7 days');
  console.log('   - League stats: 12 hours\n');
  
  console.log('⏰ Scheduled Generation:');
  console.log(`   - Schedule: Every day at 3:00 AM`);
  console.log(`   - Next run: ${generationStatus.nextRun}`);
  console.log(`   - Status: ${generationStatus.isRunning ? 'Running' : 'Idle'}\n`);
  
  const stats = cache.getStats();
  console.log('📦 Current Cache:');
  console.log(`   - Fixtures: ${stats.cache.fixtures}`);
  console.log(`   - Match data: ${stats.cache.matchData}`);
  console.log(`   - Predictions: ${stats.cache.predictions} ⭐`);
  console.log(`   - League stats: ${stats.cache.leagueStats}\n`);
  
  console.log('📊 API Calls (24h):');
  console.log(`   - Total: ${stats.apiCalls24h.total}`);
  console.log(`   - Cached: ${stats.apiCalls24h.cached}`);
  console.log(`   - Hit rate: ${stats.apiCalls24h.cacheHitRate}\n`);
  
  console.log('🔧 Admin Endpoints:');
  console.log('   - POST /admin/generate-predictions (trigger generation)');
  console.log('   - GET  /admin/generation-status (check status)');
  console.log('   - GET  /admin/predictions (list all predictions)\n');
  
  console.log('💡 To manually generate predictions:');
  console.log('   npm run generate\n');
  
  console.log('════════════════════════════════════════════════════════════════\n');
});