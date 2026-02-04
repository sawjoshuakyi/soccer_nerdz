/**
 * ═══════════════════════════════════════════════════════════════
 * FOOTBALL PREDICTION ENGINE - SERVER
 * ═══════════════════════════════════════════════════════════════
 * Refactored server with clean architecture and service-based design
 */

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

// Import services
const cache = require('./cache-simple'); // Keep existing cache for now
const PredictionOrchestrator = require('./services/prediction-orchestrator.service');
const oddsApi = require('./services/odds-api.service');
const { LEAGUES, CURRENT_SEASON, API_CONFIG } = require('./config/constants');

// Initialize
const app = express();
const PORT = process.env.PORT || 3000;
const orchestrator = new PredictionOrchestrator(cache);

// Track generation status
let generationStatus = {
  isRunning: false,
  lastRun: null,
  lastStats: null,
  nextRun: null
};

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ═══════════════════════════════════════════════════════════════
// API ENDPOINTS - FIXTURES
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/fixtures/:league
 * Get upcoming fixtures for a league (frontend compatible - returns array)
 */
app.get('/api/fixtures/:league', async (req, res) => {
  const { league } = req.params;
  // If no limit is provided, return all fixtures
  const limit = req.query.limit ? parseInt(req.query.limit) : undefined;

  if (!LEAGUES[league]) {
    return res.status(400).json({ 
      error: 'Invalid league',
      availableLeagues: Object.keys(LEAGUES)
    });
  }

  try {
    console.log(`📅 Fetching fixtures for ${league}...`);

    const fixtures = await orchestrator.getUpcomingFixtures(league, limit);

    if (!fixtures || fixtures.length === 0) {
      console.log(`⚠️  No fixtures found for ${league}`);
      // Return empty array for frontend compatibility
      return res.json([]);
    }

    console.log(`✅ Returning ${fixtures.length} fixtures for ${league}`);
    
    // Return fixtures array directly for frontend compatibility
    res.json(fixtures);

  } catch (error) {
    console.error(`❌ Error fetching fixtures for ${league}: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to fetch fixtures',
      message: error.message
    });
  }
});

/**
 * GET /api/v2/fixtures/:league
 * Get upcoming fixtures with metadata (API clients - returns object)
 */
app.get('/api/v2/fixtures/:league', async (req, res) => {
  const { league } = req.params;
  const limit = parseInt(req.query.limit) || 10;

  if (!LEAGUES[league]) {
    return res.status(400).json({ 
      error: 'Invalid league',
      availableLeagues: Object.keys(LEAGUES)
    });
  }

  try {
    const fixtures = await orchestrator.getUpcomingFixtures(league, limit);

    res.json({
      league: LEAGUES[league].name,
      leagueKey: league,
      season: CURRENT_SEASON,
      count: fixtures.length,
      fixtures: fixtures,
      fetchedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Error fetching fixtures: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to fetch fixtures',
      message: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// API ENDPOINTS - LEAGUE STATISTICS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/league-stats/:league
 * Get comprehensive league statistics
 */
app.get('/api/league-stats/:league', async (req, res) => {
  const { league } = req.params;

  if (!LEAGUES[league]) {
    return res.status(400).json({ 
      error: 'Invalid league',
      availableLeagues: Object.keys(LEAGUES)
    });
  }

  try {
    console.log(`📊 Fetching league stats for ${league}...`);

    const stats = await orchestrator.getLeagueStatistics(league);

    if (!stats) {
      return res.status(404).json({ 
        error: 'League statistics not available',
        league: LEAGUES[league].name
      });
    }

    res.json(stats);

  } catch (error) {
    console.error(`Error fetching league stats: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to fetch league statistics',
      message: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// API ENDPOINTS - PREDICTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/predict
 * Get prediction for a match (READ-ONLY - no generation)
 */
app.post('/api/predict', async (req, res) => {
  const { fixture } = req.body;

  if (!fixture || !fixture.fixture?.id) {
    return res.status(400).json({ 
      error: 'Invalid request',
      message: 'Fixture data is required'
    });
  }

  const fixtureId = fixture.fixture.id;

  try {
    console.log(`🔍 Looking for prediction: Fixture ${fixtureId}`);

    // Check if prediction exists
    const prediction = orchestrator.getPrediction(fixtureId);

    if (prediction) {
      console.log(`✅ Prediction found for fixture ${fixtureId}`);
      return res.json({
        prediction: prediction,
        generated: true,
        cached: true
      });
    }

    // Prediction not available
    console.log(`⚠️  Prediction not available for fixture ${fixtureId}`);
    
    return res.status(404).json({
      error: 'Prediction not available yet',
      message: 'This prediction will be available soon. Our system generates predictions daily.',
      generated: false,
      fixtureId: fixtureId,
      match: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
      date: fixture.fixture.date
    });

  } catch (error) {
    console.error(`Error fetching prediction: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to fetch prediction',
      message: error.message
    });
  }
});

/**
 * GET /api/predictions/status/:fixtureId
 * Check if prediction exists for a fixture
 */
app.get('/api/predictions/status/:fixtureId', (req, res) => {
  const { fixtureId } = req.params;
  const exists = orchestrator.hasPrediction(parseInt(fixtureId));

  res.json({
    fixtureId: parseInt(fixtureId),
    available: exists,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/predictions/:fixtureId
 * Get prediction for a specific fixture by ID
 */
app.get('/api/predictions/:fixtureId', (req, res) => {
  const { fixtureId } = req.params;
  const prediction = orchestrator.getPrediction(parseInt(fixtureId));

  if (!prediction) {
    return res.status(404).json({
      error: 'Prediction not found',
      message: 'No prediction available for this fixture yet'
    });
  }

  res.json(prediction);
});

/**
 * POST /api/predictions/:fixtureId/generate
 * Generate prediction on-demand for a specific fixture
 */
app.post('/api/predictions/:fixtureId/generate', async (req, res) => {
  const { fixtureId } = req.params;
  const parsedFixtureId = parseInt(fixtureId);

  // Check if prediction already exists
  const existing = orchestrator.getPrediction(parsedFixtureId);
  if (existing) {
    return res.json(existing);
  }

  try {
    console.log(`[API] On-demand prediction requested for fixture ${parsedFixtureId}`);
    
    // Find the fixture in cache
    const allFixtures = [];
    const leagues = ['epl', 'laliga', 'bundesliga', 'seriea', 'ligue1', 'ucl', 'europa'];
    
    for (const league of leagues) {
      const fixtures = cache.getFixtures(league) || [];
      allFixtures.push(...fixtures);
    }
    
    const fixture = allFixtures.find(f => f.fixture.id === parsedFixtureId);
    
    if (!fixture) {
      return res.status(404).json({
        error: 'Fixture not found',
        message: 'Cannot find fixture data for this match'
      });
    }

    // Generate prediction
    const prediction = await orchestrator.generatePrediction(fixture);
    
    if (prediction) {
      console.log(`[API] Successfully generated prediction for fixture ${parsedFixtureId}`);
      res.json(prediction);
    } else {
      res.status(500).json({
        error: 'Generation failed',
        message: 'Failed to generate prediction for this fixture'
      });
    }
  } catch (error) {
    console.error(`[API] Error generating prediction:`, error.message);
    res.status(500).json({
      error: 'Generation failed',
      message: error.message
    });
  }
});

/**
 * GET /api/match-data/:fixtureId
 * Get comprehensive match data including squad stats
 */
app.get('/api/match-data/:fixtureId', (req, res) => {
  const { fixtureId } = req.params;
  const matchData = cache.getMatchData(parseInt(fixtureId));

  if (!matchData) {
    return res.status(404).json({
      error: 'Match data not found',
      message: 'Match data not available yet'
    });
  }

  res.json(matchData);
});

/**
 * GET /api/odds/:homeTeam/:awayTeam
 * Get betting odds from multiple bookmakers for a fixture
 */
app.get('/api/odds/:homeTeam/:awayTeam', async (req, res) => {
  try {
    const { homeTeam, awayTeam } = req.params;
    const league = req.query.league || 'epl';
    
    const odds = await oddsApi.getFixtureOdds(
      decodeURIComponent(homeTeam),
      decodeURIComponent(awayTeam),
      league
    );
    
    res.json(odds);
  } catch (error) {
    console.error('[API] Error fetching odds:', error.message);
    res.status(500).json({
      error: 'Failed to fetch odds',
      message: error.message
    });
  }
});

/**
 * GET /api/league-stats/:league
 * Get league statistics and averages
 */
app.get('/api/league-stats/:league', async (req, res) => {
  const { league } = req.params;
  
  try {
    // Check cache first
    const cached = cache.getLeagueStats(league);
    if (cached) {
      return res.json(cached);
    }

    // Fetch fresh stats
    const leagueStatsService = require('./services/league-stats.service');
    const stats = await leagueStatsService.getLeagueStats(league);
    
    if (stats) {
      res.json(stats);
    } else {
      res.status(404).json({
        error: 'League stats not found',
        message: `No statistics available for ${league}`
      });
    }
  } catch (error) {
    console.error(`[API] Error fetching league stats:`, error.message);
    res.status(500).json({
      error: 'Failed to fetch league stats',
      message: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// SYSTEM ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  const stats = cache.getStats();
  
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    season: CURRENT_SEASON,
    leagues: Object.keys(LEAGUES),
    cache: {
      predictions: stats.cache.predictions,
      fixtures: stats.cache.fixtures,
      matchData: stats.cache.matchData,
      leagueStats: stats.cache.leagueStats
    },
    generation: generationStatus,
    apiConfig: {
      footballAPI: API_CONFIG.football.key ? 'configured' : 'missing',
      anthropicAPI: API_CONFIG.anthropic.key ? 'configured' : 'missing'
    }
  });
});

/**
 * GET /api/stats
 * Detailed system statistics
 */
app.get('/api/stats', (req, res) => {
  const stats = cache.getStats();
  res.json(stats);
});

/**
 * POST /api/clear-cache
 * Clear all cache (admin only - add auth in production)
 */
app.post('/api/clear-cache', (req, res) => {
  cache.clearAllCache();
  res.json({ 
    message: 'Cache cleared successfully',
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /admin/generate-predictions
 * Manually trigger prediction generation
 */
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

  // Run asynchronously
  runPredictionGeneration();
});

/**
 * GET /admin/generation-status
 * Get current generation status
 */
app.get('/admin/generation-status', (req, res) => {
  res.json(generationStatus);
});

/**
 * GET /admin/predictions
 * List all available predictions
 */
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
          match: data.value?.fixture ? 
            `${data.value.fixture.homeTeam} vs ${data.value.fixture.awayTeam}` : 
            'Unknown',
          league: data.value?.fixture?.league || 'Unknown',
          date: data.value?.fixture?.date || null,
          createdAt: new Date(data.createdAt).toISOString(),
          expiresAt: new Date(data.expiresAt).toISOString(),
          isExpired: Date.now() > data.expiresAt,
          size: (stats.size / 1024).toFixed(2) + ' KB'
        };
      });

    res.json({
      total: predictions.length,
      predictions: predictions.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      )
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// PREDICTION GENERATION FUNCTION
// ═══════════════════════════════════════════════════════════════

async function runPredictionGeneration() {
  generationStatus.isRunning = true;
  generationStatus.lastRun = new Date().toISOString();

  try {
    const stats = await orchestrator.generateAllPredictions();
    generationStatus.lastStats = stats;
    generationStatus.isRunning = false;
    
    console.log('\n✅ Scheduled generation completed successfully\n');
  } catch (error) {
    console.error('\n❌ Scheduled generation failed:', error.message, '\n');
    generationStatus.isRunning = false;
    generationStatus.lastStats = { error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// CRON JOB SCHEDULER
// ═══════════════════════════════════════════════════════════════

const CRON_SCHEDULE = '0 3 * * *'; // Every day at 3:00 AM

cron.schedule(CRON_SCHEDULE, async () => {
  console.log('\n⏰ SCHEDULED PREDICTION GENERATION TRIGGERED');
  console.log(`Time: ${new Date().toLocaleString()}\n`);

  if (generationStatus.isRunning) {
    console.log('⚠️  Generation already in progress, skipping...\n');
    return;
  }

  await runPredictionGeneration();
}, {
  timezone: "America/New_York"
});

// Calculate next run time
function getNextCronRun() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(3, 0, 0, 0);

  if (now.getHours() >= 3) {
    return tomorrow.toISOString();
  } else {
    const today = new Date(now);
    today.setHours(3, 0, 0, 0);
    return today.toISOString();
  }
}

generationStatus.nextRun = getNextCronRun();

// ═══════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('🚀 FOOTBALL PREDICTION ENGINE - PROFESSIONAL EDITION');
  console.log('════════════════════════════════════════════════════════════════\n');
  console.log(`🌐 Server: http://localhost:${PORT}`);
  console.log(`📊 Season: ${CURRENT_SEASON}/${CURRENT_SEASON + 1}`);
  console.log(`🏆 Leagues: ${Object.values(LEAGUES).map(l => l.name).join(', ')}\n`);

  console.log('🔑 API Configuration:');
  console.log(`   Football API: ${API_CONFIG.football.key ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   Anthropic API: ${API_CONFIG.anthropic.key ? '✅ Configured' : '❌ Missing'}\n`);

  console.log('📈 Cache Settings:');
  console.log('   - Fixtures: 1 hour');
  console.log('   - Match data: 6 hours');
  console.log('   - Predictions: 7 days');
  console.log('   - League stats: 12 hours\n');

  console.log('⏰ Scheduled Generation:');
  console.log(`   - Schedule: Daily at 3:00 AM EST`);
  console.log(`   - Next run: ${generationStatus.nextRun}`);
  console.log(`   - Status: ${generationStatus.isRunning ? 'Running' : 'Idle'}\n`);

  const stats = cache.getStats();
  console.log('📦 Current Cache:');
  console.log(`   - Predictions: ${stats.cache.predictions} ⭐`);
  console.log(`   - Fixtures: ${stats.cache.fixtures}`);
  console.log(`   - Match data: ${stats.cache.matchData}`);
  console.log(`   - League stats: ${stats.cache.leagueStats}\n`);

  console.log('🔧 Available Endpoints:');
  console.log('   Public:');
  console.log('   - GET  /api/fixtures/:league');
  console.log('   - GET  /api/league-stats/:league');
  console.log('   - POST /api/predict');
  console.log('   - GET  /api/health');
  console.log('\n   Admin:');
  console.log('   - POST /admin/generate-predictions');
  console.log('   - GET  /admin/generation-status');
  console.log('   - GET  /admin/predictions\n');

  console.log('💡 Quick Actions:');
  console.log('   - Generate predictions: npm run generate');
  console.log('   - Clear cache: POST /api/clear-cache\n');

  console.log('════════════════════════════════════════════════════════════════\n');
});

module.exports = app;