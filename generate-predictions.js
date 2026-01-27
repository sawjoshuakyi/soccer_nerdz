#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════
 * PREDICTION GENERATION SCRIPT
 * ═══════════════════════════════════════════════════════════════
 * Standalone script to generate predictions for upcoming matches
 * Can be run manually or via cron job
 */

const cache = require('./cache-simple');
const PredictionOrchestrator = require('./services/prediction-orchestrator.service');

// Initialize orchestrator
const orchestrator = new PredictionOrchestrator(cache);

/**
 * Main execution function
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  FOOTBALL PREDICTION GENERATOR - STANDALONE SCRIPT         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Generate all predictions
    const stats = await orchestrator.generateAllPredictions();

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