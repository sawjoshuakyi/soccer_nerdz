/**
 * ═══════════════════════════════════════════════════════════════
 * PREDICTION ORCHESTRATOR
 * ═══════════════════════════════════════════════════════════════
 * Main service that coordinates all prediction generation
 * - Fetches match data
 * - Generates AI predictions
 * - Manages caching
 * - Handles errors and retries
 */

const FootballAPIService = require('./football-api.service');
const AIAnalysisService = require('./ai-analysis.service');
const LeagueStatisticsService = require('./league-stats.service');
const { LEAGUES, FETCH_CONFIG } = require('../config/constants');

class PredictionOrchestrator {
  constructor(cache) {
    this.cache = cache;
    this.footballAPI = new FootballAPIService(cache);
    this.aiAnalysis = new AIAnalysisService();
    this.leagueStats = new LeagueStatisticsService(this.footballAPI, cache);
  }

  // ═══════════════════════════════════════════════════════════════
  // GENERATE ALL PREDICTIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Generate predictions for all upcoming fixtures
   * @returns {Promise<Object>} Generation statistics
   */
  async generateAllPredictions() {
    console.log('\n🚀 PREDICTION GENERATION STARTED');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`Time: ${new Date().toLocaleString()}`);
    console.log(`Generating predictions for next ${FETCH_CONFIG.daysAhead} days\n`);

    const startTime = Date.now();
    const stats = {
      total: 0,
      success: 0,
      failed: 0,
      cached: 0,
      skipped: 0,
      leagueStats: {},
      errors: []
    };

    try {
      // Step 1: Fetch all league statistics
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('📊 FETCHING LEAGUE STATISTICS');
      console.log('═══════════════════════════════════════════════════════════════\n');

      const leagueStatsCache = await this.leagueStats.getAllLeagueStats(LEAGUES);
      
      // Step 2: Fetch upcoming fixtures
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('📅 FETCHING UPCOMING FIXTURES');
      console.log('═══════════════════════════════════════════════════════════════\n');

      const upcomingFixtures = await this.footballAPI.getAllUpcomingFixtures(
        LEAGUES, 
        FETCH_CONFIG.daysAhead
      );

      stats.total = upcomingFixtures.length;

      if (upcomingFixtures.length === 0) {
        console.log('⚠️  No upcoming fixtures found\n');
        return stats;
      }

      // Step 3: Generate predictions
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('🎯 GENERATING MATCH PREDICTIONS');
      console.log('═══════════════════════════════════════════════════════════════\n');

      for (let i = 0; i < upcomingFixtures.length; i++) {
        const { fixture, leagueKey, leagueConfig } = upcomingFixtures[i];
        const fixtureId = fixture.fixture.id;
        const matchName = `${fixture.teams.home.name} vs ${fixture.teams.away.name}`;

        console.log(`[${i + 1}/${upcomingFixtures.length}] ${matchName}`);
        console.log(`   League: ${leagueConfig.name}`);
        console.log(`   Date: ${new Date(fixture.fixture.date).toLocaleString()}`);

        try {
          // Check if prediction already exists
          const existingPrediction = this.cache.getPrediction(fixtureId);
          
          if (existingPrediction) {
            console.log(`   💾 Already cached - skipping\n`);
            stats.cached++;
            continue;
          }

          // Generate new prediction
          const predictionData = await this.generateSinglePrediction(
            fixture,
            leagueKey,
            leagueStatsCache[leagueKey]
          );

          if (predictionData) {
            stats.success++;
            console.log(`   ✅ Prediction generated successfully\n`);
          } else {
            stats.skipped++;
            console.log(`   ⚠️  Prediction skipped\n`);
          }

          // Delay before next prediction
          if (i < upcomingFixtures.length - 1) {
            const delay = FETCH_CONFIG.delays.betweenPredictions;
            console.log(`   ⏳ Waiting ${delay/1000}s...\n`);
            await this._delay(delay);
          }

        } catch (error) {
          console.error(`   ❌ Error: ${error.message}\n`);
          stats.failed++;
          stats.errors.push({
            match: matchName,
            error: error.message
          });

          // If rate limit, wait longer
          if (error.response?.status === 429) {
            const delay = FETCH_CONFIG.delays.afterRateLimit;
            console.log(`   ⚠️  Rate limit. Waiting ${delay/1000}s...\n`);
            await this._delay(delay);
          }
        }
      }

    } catch (error) {
      console.error('\n❌ CRITICAL ERROR:', error.message);
      stats.errors.push({
        critical: true,
        error: error.message
      });
    }

    // Final summary
    this._printSummary(stats, startTime);

    return stats;
  }

  // ═══════════════════════════════════════════════════════════════
  // GENERATE SINGLE PREDICTION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Generate prediction for a single match
   * @param {Object} fixture - Fixture object
   * @param {string} leagueKey - League key
   * @param {Object} leagueStats - League statistics
   * @returns {Promise<Object>} Prediction data
   */
  async generateSinglePrediction(fixture, leagueKey, leagueStats = null) {
    const fixtureId = fixture.fixture.id;

    try {
      // Step 1: Fetch comprehensive match data
      console.log(`   📥 Fetching match data...`);
      const matchData = await this.footballAPI.getComprehensiveMatchData(fixture);
      
      // Cache match data
      this.cache.setMatchData(fixtureId, matchData);
      console.log(`   ✅ Match data cached`);

      // Step 2: Generate AI prediction
      console.log(`   🤖 Generating AI analysis...`);
      const prediction = await this.aiAnalysis.generatePrediction(
        fixture,
        matchData,
        leagueStats
      );

      // Step 3: Create comprehensive prediction object
      const predictionData = {
        prediction: prediction.analysis,
        metadata: prediction.metadata,
        fixture: {
          id: fixtureId,
          homeTeam: fixture.teams.home.name,
          awayTeam: fixture.teams.away.name,
          date: fixture.fixture.date,
          league: fixture.league.name,
          venue: fixture.fixture.venue?.name || 'TBD'
        },
        formations: {
          home: matchData.apiPrediction?.predictedLineups?.home || 'N/A',
          away: matchData.apiPrediction?.predictedLineups?.away || 'N/A'
        },
        winProbability: matchData.apiPrediction?.winProbability || null,
        injuries: {
          home: matchData.homeInjuries || [],
          away: matchData.awayInjuries || []
        },
        standings: matchData.standings || null,
        form: {
          home: matchData.homeRecentMatches || [],
          away: matchData.awayRecentMatches || []
        },
        squad: {
          home: matchData.homeSquad || [],
          away: matchData.awaySquad || []
        },
        generatedAt: new Date().toISOString()
      };

      // Step 4: Cache prediction (7 days)
      this.cache.setPrediction(fixtureId, predictionData);
      console.log(`   💾 Prediction cached (7 days)`);

      return predictionData;

    } catch (error) {
      console.error(`   ❌ Prediction generation failed: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // GET EXISTING PREDICTION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get existing prediction from cache
   * @param {number} fixtureId - Fixture ID
   * @returns {Object|null} Cached prediction or null
   */
  getPrediction(fixtureId) {
    return this.cache.getPrediction(fixtureId);
  }

  /**
   * Check if prediction exists
   * @param {number} fixtureId - Fixture ID
   * @returns {boolean} True if prediction exists
   */
  hasPrediction(fixtureId) {
    return this.cache.getPrediction(fixtureId) !== null;
  }

  // ═══════════════════════════════════════════════════════════════
  // FIXTURE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get upcoming fixtures for a specific league
   * @param {string} leagueKey - League key
   * @param {number} limit - Maximum number of fixtures
   * @returns {Promise<Array>} Fixtures (raw API format for frontend compatibility)
   */
  async getUpcomingFixtures(leagueKey, limit = 10) {
    const leagueConfig = LEAGUES[leagueKey];
    if (!leagueConfig) {
      throw new Error(`Invalid league: ${leagueKey}`);
    }

    const fixtures = await this.footballAPI.getUpcomingFixtures(
      leagueConfig.id,
      leagueConfig.season,
      FETCH_CONFIG.daysAhead
    );

    // Return raw fixtures in API format (frontend expects this structure)
    return fixtures.slice(0, limit);
  }

  /**
   * Get league statistics
   * @param {string} leagueKey - League key
   * @returns {Promise<Object>} League statistics
   */
  async getLeagueStatistics(leagueKey) {
    const leagueConfig = LEAGUES[leagueKey];
    if (!leagueConfig) {
      throw new Error(`Invalid league: ${leagueKey}`);
    }

    return await this.leagueStats.getLeagueStats(leagueKey, leagueConfig);
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════

  _printSummary(stats, startTime) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 GENERATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`Total Matches: ${stats.total}`);
    console.log(`✅ Successfully Generated: ${stats.success}`);
    console.log(`💾 Already Cached: ${stats.cached}`);
    console.log(`⚠️  Skipped: ${stats.skipped}`);
    console.log(`❌ Failed: ${stats.failed}`);
    console.log(`⏱️  Duration: ${duration} minutes`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      stats.errors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err.match || 'System'}: ${err.error}`);
      });
    }

    console.log(`\n✅ PREDICTION GENERATION COMPLETED`);
    console.log(`Time: ${new Date().toLocaleString()}\n`);
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PredictionOrchestrator;