#!/usr/bin/env node

const cache = require('./cache-simple');
const {
  getUpcomingFixtures,
  fetchMatchData,
  getLeagueStats,
  generatePrediction,
  LEAGUES
} = require('./prediction-generator');

// Configuration
const DAYS_AHEAD = 7; // Generate predictions for next 7 days
const DELAY_BETWEEN_PREDICTIONS = 10000; // 10 seconds delay to avoid rate limits (increased from 2s)
const DELAY_AFTER_RATE_LIMIT = 60000; // 60 seconds after hitting rate limit

// Helper to delay between API calls
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main generation function
async function generateAllPredictions() {
  console.log('\n🚀 PREDICTION GENERATION STARTED');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Time: ${new Date().toLocaleString()}`);
  console.log(`Generating predictions for next ${DAYS_AHEAD} days\n`);

  const startTime = Date.now();
  const stats = {
    total: 0,
    success: 0,
    failed: 0,
    cached: 0,
    leagueStats: {}
  };

  try {
    // Step 1: Fetch upcoming fixtures
    const upcomingFixtures = await getUpcomingFixtures(DAYS_AHEAD);
    stats.total = upcomingFixtures.length;

    if (upcomingFixtures.length === 0) {
      console.log('⚠️  No upcoming fixtures found in the next 7 days\n');
      return stats;
    }

    // Step 2: Generate/fetch league statistics for all leagues
    console.log('📊 Fetching league statistics...\n');
    const leagueStatsCache = {};
    
    for (const [leagueKey, leagueConfig] of Object.entries(LEAGUES)) {
      const cachedStats = cache.getLeagueStats(leagueKey);
      
      if (cachedStats) {
        console.log(`   ✅ ${leagueConfig.name}: Using cached stats`);
        leagueStatsCache[leagueKey] = cachedStats;
        stats.leagueStats[leagueKey] = 'cached';
      } else {
        console.log(`   🔄 ${leagueConfig.name}: Generating fresh stats...`);
        const leagueStats = await getLeagueStats(leagueKey, leagueConfig);
        
        if (leagueStats) {
          cache.setLeagueStats(leagueKey, leagueStats);
          leagueStatsCache[leagueKey] = leagueStats;
          stats.leagueStats[leagueKey] = 'generated';
          console.log(`   ✅ ${leagueConfig.name}: Stats generated and cached`);
        } else {
          console.log(`   ⚠️  ${leagueConfig.name}: Could not generate stats`);
          stats.leagueStats[leagueKey] = 'failed';
        }
        
        await delay(1000); // Small delay between league stat calls
      }
    }

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('🎯 GENERATING MATCH PREDICTIONS');
    console.log('════════════════════════════════════════════════════════════════\n');

    // Step 3: Generate predictions for each match
    for (let i = 0; i < upcomingFixtures.length; i++) {
      const { fixture, leagueKey } = upcomingFixtures[i];
      const fixtureId = fixture.fixture.id;
      const matchName = `${fixture.teams.home.name} vs ${fixture.teams.away.name}`;
      
      console.log(`[${i + 1}/${upcomingFixtures.length}] ${matchName}`);
      console.log(`   League: ${fixture.league.name}`);
      console.log(`   Date: ${new Date(fixture.fixture.date).toLocaleString()}`);

      try {
        // Check if prediction already exists
        const existingPrediction = cache.getPrediction(fixtureId);
        
        if (existingPrediction) {
          console.log(`   💾 Already cached - skipping\n`);
          stats.cached++;
          continue;
        }

        // Fetch comprehensive match data
        console.log(`   📥 Fetching match data...`);
        const matchData = await fetchMatchData(fixture);
        
        // Store match data in cache
        cache.setMatchData(fixtureId, matchData);
        console.log(`   ✅ Match data cached`);

        // Get league stats for this league
        const leagueStatsData = leagueStatsCache[leagueKey] || null;

        // Generate AI prediction (with built-in retry logic)
        console.log(`   🤖 Generating AI prediction...`);
        const prediction = await generatePrediction(fixture, matchData, leagueStatsData);
        
        // Create full prediction object with metadata
        const predictionData = {
          prediction: prediction,
          fixture: {
            id: fixtureId,
            homeTeam: fixture.teams.home.name,
            awayTeam: fixture.teams.away.name,
            date: fixture.fixture.date,
            league: fixture.league.name,
            venue: fixture.fixture.venue?.name || 'TBD'
          },
          formations: {
            home: matchData.predictedLineups?.homeFormation || matchData.homeRecentLineup?.formation || 'N/A',
            away: matchData.predictedLineups?.awayFormation || matchData.awayRecentLineup?.formation || 'N/A'
          },
          winProbability: matchData.predictedLineups?.winPercentage || null,
          injuries: {
            home: matchData.homeInjuries?.map(inj => ({
              name: inj.player?.name || 'Unknown',
              reason: inj.player?.reason || inj.player?.type || 'Injured'
            })) || [],
            away: matchData.awayInjuries?.map(inj => ({
              name: inj.player?.name || 'Unknown',
              reason: inj.player?.reason || inj.player?.type || 'Injured'
            })) || []
          },
          generatedAt: new Date().toISOString()
        };
        
        // Store prediction in cache (7 days)
        cache.setPrediction(fixtureId, predictionData);
        console.log(`   ✅ Prediction generated and cached`);
        console.log(`   📝 Length: ${prediction.length} characters\n`);

        stats.success++;
        
        // Delay between predictions to avoid rate limits
        if (i < upcomingFixtures.length - 1) {
          console.log(`   ⏳ Waiting ${DELAY_BETWEEN_PREDICTIONS/1000}s before next prediction...\n`);
          await delay(DELAY_BETWEEN_PREDICTIONS);
        }

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        
        // If it's a rate limit error, wait longer before continuing
        if (error.response?.status === 429) {
          console.log(`   ⚠️  Rate limit exceeded. Waiting ${DELAY_AFTER_RATE_LIMIT/1000}s before continuing...\n`);
          await delay(DELAY_AFTER_RATE_LIMIT);
        } else {
          console.log('');
        }
        
        stats.failed++;
        
        // Continue with next match
        await delay(1000);
      }
    }

  } catch (error) {
    console.error('\n❌ CRITICAL ERROR:', error.message);
  }

  // Final summary
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(2);

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('📊 GENERATION SUMMARY');
  console.log('════════════════════════════════════════════════════════════════\n');
  console.log(`Total Matches: ${stats.total}`);
  console.log(`✅ Successfully Generated: ${stats.success}`);
  console.log(`💾 Already Cached: ${stats.cached}`);
  console.log(`❌ Failed: ${stats.failed}`);
  console.log(`⏱️  Duration: ${duration} minutes`);
  console.log(`\n📈 League Stats:`);
  Object.entries(stats.leagueStats).forEach(([league, status]) => {
    console.log(`   ${league}: ${status}`);
  });
  
  console.log(`\n✅ PREDICTION GENERATION COMPLETED`);
  console.log(`Time: ${new Date().toLocaleString()}\n`);

  return stats;
}

// Run if called directly
if (require.main === module) {
  generateAllPredictions()
    .then((stats) => {
      process.exit(stats.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { generateAllPredictions };