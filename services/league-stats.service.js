/**
 * ═══════════════════════════════════════════════════════════════
 * LEAGUE STATISTICS SERVICE
 * ═══════════════════════════════════════════════════════════════
 * Calculate and manage league-wide statistics
 */

class LeagueStatisticsService {
  constructor(footballAPI, cache) {
    this.footballAPI = footballAPI;
    this.cache = cache;
  }

  /**
   * Get or calculate league statistics
   * @param {string} leagueKey - League key (e.g., 'epl')
   * @param {Object} leagueConfig - League configuration
   * @returns {Promise<Object>} League statistics
   */
  async getLeagueStats(leagueKey, leagueConfig) {
    // Check cache first
    const cached = this.cache.getLeagueStats(leagueKey);
    if (cached) {
      console.log(`   💾 Using cached league stats for ${leagueConfig.name}`);
      return cached;
    }

    console.log(`   📊 Calculating league stats for ${leagueConfig.name}...`);

    try {
      const stats = await this._fetchLeagueStatsForSeason(leagueKey, leagueConfig, leagueConfig.season);
      return stats;
    } catch (error) {
      // If 403, log and return null (API tier limitation)
      if (error.response?.status === 403) {
        console.log(`   ⚠️  League stats endpoint not accessible (403 - API tier limitation)`);
        return null;
      }
      
      console.error(`   ❌ Error calculating league stats: ${error.message}`);
      return null;
    }
  }

  async _fetchLeagueStatsForSeason(leagueKey, leagueConfig, season) {
    // Fetch finished matches from season using date range
    const today = new Date();
    const seasonStart = new Date(season, 7, 1); // August 1st
    
    const from = seasonStart.toISOString().split('T')[0];
    const to = today.toISOString().split('T')[0];
    
    const endpoint = `fixtures?league=${leagueConfig.id}&season=${season}&from=${from}&to=${to}&status=FT`;
    const data = await this.footballAPI.request(endpoint);

    if (!data.response || data.response.length === 0) {
      console.log(`   ⚠️  No data available for ${leagueConfig.name} (season ${season})`);
      return null;
    }

    const stats = this._calculateStatistics(data.response);
    
    if (!stats) {
      console.log(`   ⚠️  Unable to calculate stats for ${leagueConfig.name}`);
      return null;
    }

    const leagueStats = {
      league: leagueConfig.name,
      season: season,
      stats,
      calculatedAt: new Date().toISOString()
    };

    // Cache for 12 hours
    this.cache.setLeagueStats(leagueKey, leagueStats);
    
    console.log(`   ✅ League stats calculated for ${leagueConfig.name} (season ${season})`);
    return leagueStats;
  }

  /**
   * Calculate statistics from fixture data
   * @private
   */
  _calculateStatistics(fixtures) {
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
    let over35Count = 0;
    let homeCleanSheets = 0;
    let awayCleanSheets = 0;
    let homeFailedToScore = 0;
    let awayFailedToScore = 0;

    // Goal distribution tracking
    const scorelines = {};

    finishedMatches.forEach(match => {
      const homeGoals = match.goals.home || 0;
      const awayGoals = match.goals.away || 0;
      const totalMatchGoals = homeGoals + awayGoals;

      // Basic stats
      totalGoals += totalMatchGoals;

      // Results
      if (homeGoals > awayGoals) homeWins++;
      else if (homeGoals === awayGoals) draws++;
      else awayWins++;

      // Goal markets
      if (homeGoals > 0 && awayGoals > 0) bttsCount++;
      if (totalMatchGoals > 2.5) over25Count++;
      if (totalMatchGoals > 3.5) over35Count++;

      // Clean sheets
      if (awayGoals === 0) homeCleanSheets++;
      if (homeGoals === 0) awayCleanSheets++;

      // Failed to score
      if (homeGoals === 0) homeFailedToScore++;
      if (awayGoals === 0) awayFailedToScore++;

      // Track scorelines
      const scoreline = `${homeGoals}-${awayGoals}`;
      scorelines[scoreline] = (scorelines[scoreline] || 0) + 1;
    });

    const totalMatches = finishedMatches.length;

    // Most common scorelines
    const commonScorelines = Object.entries(scorelines)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([score, count]) => ({
        score,
        count,
        percentage: ((count / totalMatches) * 100).toFixed(1)
      }));

    return {
      totalMatches,
      
      // Goals
      totalGoals,
      goalsPerGame: (totalGoals / totalMatches).toFixed(2),
      avgHomeGoals: (finishedMatches.reduce((sum, m) => sum + (m.goals.home || 0), 0) / totalMatches).toFixed(2),
      avgAwayGoals: (finishedMatches.reduce((sum, m) => sum + (m.goals.away || 0), 0) / totalMatches).toFixed(2),
      
      // Results
      homeWinPercentage: ((homeWins / totalMatches) * 100).toFixed(1),
      drawPercentage: ((draws / totalMatches) * 100).toFixed(1),
      awayWinPercentage: ((awayWins / totalMatches) * 100).toFixed(1),
      
      // Markets
      bttsPercentage: ((bttsCount / totalMatches) * 100).toFixed(1),
      over25Percentage: ((over25Count / totalMatches) * 100).toFixed(1),
      over35Percentage: ((over35Count / totalMatches) * 100).toFixed(1),
      
      // Defense
      cleanSheetPercentage: (((homeCleanSheets + awayCleanSheets) / (totalMatches * 2)) * 100).toFixed(1),
      failedToScorePercentage: (((homeFailedToScore + awayFailedToScore) / (totalMatches * 2)) * 100).toFixed(1),
      
      // Patterns
      commonScorelines,
      
      // Quality metrics
      highScoringRate: ((over35Count / totalMatches) * 100).toFixed(1),
      defensiveRate: (((totalGoals / totalMatches) < 2.5 ? 1 : 0) * 100).toFixed(1)
    };
  }

  /**
   * Get all league statistics
   * @param {Object} leagues - All league configurations
   * @returns {Promise<Object>} All league stats
   */
  async getAllLeagueStats(leagues) {
    console.log('\n📊 Fetching league statistics for all leagues...\n');
    
    const allStats = {};

    for (const [leagueKey, leagueConfig] of Object.entries(leagues)) {
      try {
        const stats = await this.getLeagueStats(leagueKey, leagueConfig);
        if (stats) {
          allStats[leagueKey] = stats;
        }
        
        // Small delay between leagues
        await this._delay(1000);
      } catch (error) {
        console.error(`   ❌ Error for ${leagueKey}: ${error.message}`);
      }
    }

    console.log('\n   ✅ League statistics fetching complete\n');
    return allStats;
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = LeagueStatisticsService;