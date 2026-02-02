#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════
 * PREDICTION GENERATION SCRIPT
 * ═══════════════════════════════════════════════════════════════
 * Standalone script to generate predictions for upcoming matches
 * Can be run manually or via cron job
 * 
 * Usage:
 *   npm run generate          - Generate predictions for ALL leagues
 *   npm run generate epl      - Generate predictions for Premier League only
 *   npm run generate laliga   - Generate predictions for La Liga only
 *   npm run generate bundesliga - Generate predictions for Bundesliga only
 *   npm run generate seriea   - Generate predictions for Serie A only
 *   npm run generate ligue1   - Generate predictions for Ligue 1 only
 *   npm run generate ucl      - Generate predictions for Champions League only
 *   npm run generate europa   - Generate predictions for Europa League only
 */

const cache = require('./cache-simple');
const PredictionOrchestrator = require('./services/prediction-orchestrator.service');
const { LEAGUES } = require('./config/constants');

// Initialize orchestrator
const orchestrator = new PredictionOrchestrator(cache);

// Available leagues
const AVAILABLE_LEAGUES = Object.keys(LEAGUES);

/**
 * Show help message
 */
function showHelp() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  FOOTBALL PREDICTION GENERATOR - HELP                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log('Usage:');
  console.log('  npm run generate [league]');
  console.log('\nOptions:');
  console.log('  (no argument)  Generate predictions for ALL leagues');
  console.log('  epl            Premier League');
  console.log('  laliga         La Liga');
  console.log('  bundesliga     Bundesliga');
  console.log('  seriea         Serie A');
  console.log('  ligue1         Ligue 1');
  console.log('  ucl            UEFA Champions League');
  console.log('  europa         UEFA Europa League');
  console.log('  --help, -h     Show this help message');
  console.log('\nExamples:');
  console.log('  npm run generate           # All leagues');
  console.log('  npm run generate epl       # Premier League only');
  console.log('  npm run generate ucl       # Champions League only\n');
}

/**
 * Main execution function
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const leagueArg = args[0]?.toLowerCase();

  // Check for help flag
  if (leagueArg === '--help' || leagueArg === '-h') {
    showHelp();
    process.exit(0);
  }

  // Validate league argument if provided
  if (leagueArg && !AVAILABLE_LEAGUES.includes(leagueArg)) {
    console.error(`\n❌ Invalid league: "${leagueArg}"`);
    console.error(`Available leagues: ${AVAILABLE_LEAGUES.join(', ')}`);
    console.error('Use --help for more information.\n');
    process.exit(1);
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  FOOTBALL PREDICTION GENERATOR - STANDALONE SCRIPT         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (leagueArg) {
    console.log(`🎯 Target: ${LEAGUES[leagueArg].name} (${leagueArg})`);
  } else {
    console.log('🎯 Target: ALL LEAGUES');
  }

  try {
    let stats;
    
    if (leagueArg) {
      // Generate predictions for specific league only
      stats = await orchestrator.generateLeaguePredictions(leagueArg);
    } else {
      // Generate all predictions
      stats = await orchestrator.generateAllPredictions();
    }

    // Exit with appropriate code
    const exitCode = stats.failed > 0 ? 1 : 0;
    
    if (exitCode === 0) {
      console.log('✅ All predictions generated successfully!\n');
    } else {
      console.log(`⚠️  Completed with ${stats.failed} failure(s)\n`);
    }

    process.exit(exitCode);

  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };