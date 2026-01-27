/**
 * ═══════════════════════════════════════════════════════════════
 * FOOTBALL API SERVICE
 * ═══════════════════════════════════════════════════════════════
 * Centralized service for all Football API interactions
 * - Smart caching
 * - Rate limit handling
 * - Error recovery
 * - Data validation
 */

const axios = require('axios');
const { 
  API_CONFIG, 
  CURRENT_SEASON, 
  ENDPOINTS, 
  FETCH_CONFIG,
  VALIDATION 
} = require('../config/constants');

class FootballAPIService {
  constructor(cache) {
    this.cache = cache;
    this.requestCount = 0;
    this.lastRequestTime = Date.now();
    
    // Validate API key on initialization
    if (!API_CONFIG.football.key) {
      console.error('⚠️  WARNING: RAPIDAPI_KEY not found in environment variables!');
      console.error('   Please set RAPIDAPI_KEY in your .env file');
    } else {
      console.log(`✅ Football API key loaded: ${API_CONFIG.football.key.substring(0, 10)}...`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CORE API REQUEST METHOD
  // ═══════════════════════════════════════════════════════════════

  /**
   * Make a request to Football API with retry logic and rate limiting
   * @param {string} endpoint - API endpoint
   * @param {number} retryCount - Current retry attempt
   * @returns {Promise<Object>} API response data
   */
  async request(endpoint, retryCount = 0) {
    try {
      // Rate limiting protection
      await this._handleRateLimit();

      const url = `${API_CONFIG.football.baseUrl}/${endpoint}`;
      
      console.log(`   📡 API Request: ${endpoint.substring(0, 50)}...`);
      
      const response = await axios.get(url, {
        headers: {
          'x-apisports-key': API_CONFIG.football.key
        },
        timeout: 10000 // 10 second timeout
      });

      this.requestCount++;
      this.lastRequestTime = Date.now();

      // Log response details for debugging
      console.log(`   📦 Response: ${response.data.results || 0} results`);

      // Validate response
      if (!response.data) {
        throw new Error('API returned no data');
      }

      // Check for actual errors (non-empty errors array or object)
      if (response.data.errors && Object.keys(response.data.errors).length > 0) {
        throw new Error(`API Error: ${JSON.stringify(response.data.errors)}`);
      }

      // Warn if no results
      if (!response.data.response || response.data.response.length === 0) {
        console.log(`   ⚠️  No results returned from API`);
      }

      return response.data;

    } catch (error) {
      // Check for rate limit errors - can come from response body OR status code
      const isRateLimitError = 
        error.response?.status === 429 ||
        error.message?.includes('rateLimit') ||
        error.message?.includes('Too many requests');
      
      if (isRateLimitError && retryCount < 5) {
        const delay = 10000 * Math.pow(2, retryCount); // 10s, 20s, 40s, 80s, 160s
        console.log(`   ⚠️  RATE LIMIT! Waiting ${delay/1000}s before retry (${retryCount + 1}/5)...`);
        await this._delay(delay);
        return this.request(endpoint, retryCount + 1);
      }

      // Handle other errors
      console.error(`   ❌ API Error: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FIXTURES
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get upcoming fixtures for a league
   * @param {number} leagueId - League ID
   * @param {number} season - Season year
   * @param {number} days - Days ahead to fetch
   * @returns {Promise<Array>} Upcoming fixtures
   */
  async getUpcomingFixtures(leagueId, season, days = 7) {
    const today = new Date();
    const future = new Date();
    future.setDate(today.getDate() + days);
    
    const from = today.toISOString().split('T')[0];
    const to = future.toISOString().split('T')[0];

    const endpoint = ENDPOINTS.fixtures.upcoming(leagueId, season, from, to);
    const data = await this.request(endpoint);

    if (!data.response || data.response.length === 0) {
      return [];
    }

    // Filter for not started matches only
    const now = new Date();
    return data.response.filter(fixture => 
      new Date(fixture.fixture.date) > now && 
      fixture.fixture.status.short === 'NS'
    );
  }

  /**
   * Get all upcoming fixtures for all configured leagues
   * @param {Object} leagues - League configurations
   * @param {number} days - Days ahead
   * @returns {Promise<Array>} All upcoming fixtures with league info
   */
  async getAllUpcomingFixtures(leagues, days = 7) {
    console.log(`\n📅 Fetching upcoming fixtures for next ${days} days...\n`);
    
    const allFixtures = [];

    for (const [leagueKey, leagueConfig] of Object.entries(leagues)) {
      try {
        const fixtures = await this.getUpcomingFixtures(
          leagueConfig.id, 
          leagueConfig.season, 
          days
        );

        fixtures.forEach(fixture => {
          allFixtures.push({
            fixture,
            leagueKey,
            leagueConfig
          });
        });

        console.log(`   ✅ ${leagueConfig.name}: ${fixtures.length} upcoming matches`);
        
        // Small delay between leagues
        await this._delay(1000);

      } catch (error) {
        console.error(`   ❌ ${leagueKey}: ${error.message}`);
      }
    }

    console.log(`\n   📊 Total: ${allFixtures.length} upcoming matches\n`);
    return allFixtures;
  }

  /**
   * Get recent matches for a team
   * @param {number} teamId - Team ID
   * @param {number} season - Season year
   * @param {number} count - Number of matches
   * @returns {Promise<Array>} Recent matches
   */
  async getRecentMatches(teamId, season, count = 10) {
    const endpoint = ENDPOINTS.fixtures.last(teamId, season, count);
    const data = await this.request(endpoint);
    return data.response || [];
  }

  /**
   * Get head-to-head history
   * @param {number} homeId - Home team ID
   * @param {number} awayId - Away team ID
   * @param {number} count - Number of matches
   * @returns {Promise<Array>} H2H matches
   */
  async getHeadToHead(homeId, awayId, count = 10) {
    const endpoint = ENDPOINTS.fixtures.h2h(homeId, awayId, count);
    const data = await this.request(endpoint);
    return data.response || [];
  }

  // ═══════════════════════════════════════════════════════════════
  // TEAM DATA
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get team statistics for current season
   * @param {number} teamId - Team ID
   * @param {number} season - Season year
   * @param {number} leagueId - League ID
   * @returns {Promise<Object>} Team statistics
   */
  async getTeamStatistics(teamId, season, leagueId) {
    const endpoint = ENDPOINTS.teams.statistics(teamId, season, leagueId);
    const data = await this.request(endpoint);
    return data.response || null;
  }

  /**
   * Get team squad information
   * @param {number} teamId - Team ID
   * @returns {Promise<Object>} Squad data
   */
  async getTeamSquad(teamId) {
    const endpoint = ENDPOINTS.teams.squad(teamId);
    const data = await this.request(endpoint);
    return data.response || [];
  }

  // ═══════════════════════════════════════════════════════════════
  // PLAYER DATA
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get all players for a team
   * @param {number} teamId - Team ID
   * @param {number} season - Season year
   * @returns {Promise<Array>} Player list
   */
  async getTeamPlayers(teamId, season) {
    const endpoint = ENDPOINTS.players.all(teamId, season);
    const data = await this.request(endpoint);
    return data.response || [];
  }

  /**
   * Get league top scorers
   * @param {number} leagueId - League ID
   * @param {number} season - Season year
   * @returns {Promise<Array>} Top scorers
   */
  async getTopScorers(leagueId, season) {
    const endpoint = ENDPOINTS.players.topScorers(leagueId, season);
    const data = await this.request(endpoint);
    return data.response || [];
  }

  /**
   * Get league top assists
   * @param {number} leagueId - League ID
   * @param {number} season - Season year
   * @returns {Promise<Array>} Top assists
   */
  async getTopAssists(leagueId, season) {
    const endpoint = ENDPOINTS.players.topAssists(leagueId, season);
    const data = await this.request(endpoint);
    return data.response || [];
  }

  // ═══════════════════════════════════════════════════════════════
  // INJURIES & SUSPENSIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get current injuries for a team
   * @param {number} teamId - Team ID
   * @param {number} season - Season year
   * @returns {Promise<Array>} Injury list
   */
  async getTeamInjuries(teamId, season) {
    const endpoint = ENDPOINTS.injuries.byTeam(teamId, season);
    const data = await this.request(endpoint);
    return data.response || [];
  }

  // ═══════════════════════════════════════════════════════════════
  // STANDINGS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get league standings
   * @param {number} leagueId - League ID
   * @param {number} season - Season year
   * @returns {Promise<Object>} Standings data
   */
  async getStandings(leagueId, season) {
    const endpoint = ENDPOINTS.standings.byLeague(leagueId, season);
    const data = await this.request(endpoint);
    return data.response || [];
  }

  // ═══════════════════════════════════════════════════════════════
  // PREDICTIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get API predictions for a fixture
   * @param {number} fixtureId - Fixture ID
   * @returns {Promise<Object>} Prediction data from API
   */
  async getAPIPrediction(fixtureId) {
    const endpoint = ENDPOINTS.predictions.byFixture(fixtureId);
    const data = await this.request(endpoint);
    return data.response?.[0] || null;
  }

  // ═══════════════════════════════════════════════════════════════
  // COMPREHENSIVE MATCH DATA FETCHER
  // ═══════════════════════════════════════════════════════════════

  /**
   * Fetch all relevant data for a match prediction
   * @param {Object} fixture - Fixture object
   * @returns {Promise<Object>} Comprehensive match data
   */
  async getComprehensiveMatchData(fixture) {
    const homeTeamId = fixture.teams.home.id;
    const awayTeamId = fixture.teams.away.id;
    const leagueId = fixture.league.id;
    const fixtureId = fixture.fixture.id;
    const season = CURRENT_SEASON;

    console.log(`   📦 Fetching comprehensive match data...`);

    try {
      // IMPORTANT: Fetch in batches to avoid rate limiting
      // Free tier allows ~30-60 requests per minute
      // With 2 second delay between requests, we can safely do ~20-25 per minute
      
      console.log(`   📊 Batch 1/3: Team statistics and standings...`);
      const [homeStats, awayStats, standings] = await Promise.all([
        this.getTeamStatistics(homeTeamId, season, leagueId),
        this.getTeamStatistics(awayTeamId, season, leagueId),
        this.getStandings(leagueId, season)
      ]);

      console.log(`   📊 Batch 2/3: Recent matches and H2H...`);
      const [h2hMatches, homeRecentMatches, awayRecentMatches] = await Promise.all([
        this.getHeadToHead(homeTeamId, awayTeamId, 10),
        this.getRecentMatches(homeTeamId, season, 10),
        this.getRecentMatches(awayTeamId, season, 10)
      ]);

      console.log(`   📊 Batch 3/3: Injuries, predictions, and top players...`);
      const [homeInjuries, awayInjuries, apiPrediction, topScorers, topAssists] = await Promise.all([
        this.getTeamInjuries(homeTeamId, season),
        this.getTeamInjuries(awayTeamId, season),
        this.getAPIPrediction(fixtureId),
        this.getTopScorers(leagueId, season),
        this.getTopAssists(leagueId, season)
      ]);

      // Process and structure the data
      const matchData = {
        // Team Statistics
        homeStats: this._extractTeamStats(homeStats),
        awayStats: this._extractTeamStats(awayStats),

        // Recent Form
        homeRecentMatches: this._processRecentMatches(homeRecentMatches, homeTeamId),
        awayRecentMatches: this._processRecentMatches(awayRecentMatches, awayTeamId),

        // Head to Head
        h2h: this._processH2H(h2hMatches, homeTeamId),

        // Standings
        standings: this._extractStandings(standings, homeTeamId, awayTeamId),

        // API Predictions (for lineups and win percentages)
        apiPrediction: this._extractAPIPrediction(apiPrediction),

        // Injuries
        homeInjuries: this._processInjuries(homeInjuries),
        awayInjuries: this._processInjuries(awayInjuries),

        // League Context
        topScorers: this._processTopScorers(topScorers, homeTeamId, awayTeamId),
        topAssists: this._processTopAssists(topAssists, homeTeamId, awayTeamId),

        // Metadata
        fetchedAt: new Date().toISOString(),
        season: season
      };

      console.log(`   ✅ Match data fetched successfully`);
      return matchData;

    } catch (error) {
      console.error(`   ❌ Error fetching match data: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DATA PROCESSING HELPERS
  // ═══════════════════════════════════════════════════════════════

  _extractTeamStats(stats) {
    if (!stats) return null;

    const form = stats.form || '';
    const fixtures = stats.fixtures || {};
    const goals = stats.goals || {};

    return {
      form: form,
      played: fixtures.played?.total || 0,
      wins: fixtures.wins?.total || 0,
      draws: fixtures.draws?.total || 0,
      losses: fixtures.loses?.total || 0,
      goalsFor: goals.for?.total?.total || 0,
      goalsAgainst: goals.against?.total?.total || 0,
      avgGoalsFor: goals.for?.average?.total || '0',
      avgGoalsAgainst: goals.against?.average?.total || '0',
      cleanSheets: stats.clean_sheet?.total || 0,
      failedToScore: stats.failed_to_score?.total || 0,
      biggestWin: stats.biggest?.wins?.away || stats.biggest?.wins?.home || 'N/A',
      biggestLoss: stats.biggest?.loses?.away || stats.biggest?.loses?.home || 'N/A'
    };
  }

  _processRecentMatches(matches, teamId) {
    if (!matches || matches.length === 0) return [];

    const recentMatches = matches.slice(0, 5).map(match => {
      const isHome = match.teams.home.id === teamId;
      const teamScore = isHome ? match.goals.home : match.goals.away;
      const oppScore = isHome ? match.goals.away : match.goals.home;
      
      let result = 'D';
      if (teamScore > oppScore) result = 'W';
      else if (teamScore < oppScore) result = 'L';

      // Extract lineup if available (to see who's actually playing)
      let lineup = null;
      if (match.lineups && match.lineups.length > 0) {
        const teamLineup = isHome ? match.lineups[0] : match.lineups[1];
        if (teamLineup) {
          lineup = {
            formation: teamLineup.formation,
            players: teamLineup.startXI ? teamLineup.startXI.slice(0, 11).map(p => p.player?.name).filter(Boolean) : []
          };
        }
      }

      return {
        date: match.fixture.date,
        opponent: isHome ? match.teams.away.name : match.teams.home.name,
        venue: isHome ? 'H' : 'A',
        score: `${teamScore}-${oppScore}`,
        result: result,
        league: match.league.name,
        lineup: lineup
      };
    });

    // Extract players who have played in recent matches
    const recentPlayers = new Set();
    recentMatches.forEach(match => {
      if (match.lineup && match.lineup.players) {
        match.lineup.players.forEach(player => recentPlayers.add(player));
      }
    });

    return {
      matches: recentMatches,
      recentlyPlayedPlayers: Array.from(recentPlayers).slice(0, 15) // Top 15 most recent players
    };
  }

  _processH2H(matches, homeTeamId) {
    if (!matches || matches.length === 0) return { total: 0, homeWins: 0, draws: 0, awayWins: 0, matches: [] };

    let homeWins = 0, draws = 0, awayWins = 0;
    const processedMatches = matches.map(match => {
      const homeScore = match.goals.home;
      const awayScore = match.goals.away;
      const isHomeAtHome = match.teams.home.id === homeTeamId;

      if (homeScore > awayScore) {
        isHomeAtHome ? homeWins++ : awayWins++;
      } else if (homeScore < awayScore) {
        isHomeAtHome ? awayWins++ : homeWins++;
      } else {
        draws++;
      }

      return {
        date: match.fixture.date,
        homeTeam: match.teams.home.name,
        awayTeam: match.teams.away.name,
        score: `${homeScore}-${awayScore}`,
        league: match.league.name
      };
    });

    return {
      total: matches.length,
      homeWins,
      draws,
      awayWins,
      matches: processedMatches
    };
  }

  _extractStandings(standingsData, homeTeamId, awayTeamId) {
    if (!standingsData || standingsData.length === 0) return null;

    const standings = standingsData[0]?.league?.standings?.[0] || [];
    
    const homeStanding = standings.find(s => s.team.id === homeTeamId);
    const awayStanding = standings.find(s => s.team.id === awayTeamId);

    return {
      home: homeStanding ? {
        position: homeStanding.rank,
        points: homeStanding.points,
        played: homeStanding.all.played,
        form: homeStanding.form,
        goalsDiff: homeStanding.goalsDiff
      } : null,
      away: awayStanding ? {
        position: awayStanding.rank,
        points: awayStanding.points,
        played: awayStanding.all.played,
        form: awayStanding.form,
        goalsDiff: awayStanding.goalsDiff
      } : null
    };
  }

  _extractAPIPrediction(prediction) {
    if (!prediction) return null;

    return {
      winProbability: {
        home: prediction.predictions?.percent?.home || 'N/A',
        draw: prediction.predictions?.percent?.draw || 'N/A',
        away: prediction.predictions?.percent?.away || 'N/A'
      },
      predictedLineups: {
        home: prediction.predictions?.lineup?.home || 'N/A',
        away: prediction.predictions?.lineup?.away || 'N/A'
      },
      advice: prediction.predictions?.advice || 'N/A'
    };
  }

  _processInjuries(injuries) {
    if (!injuries || injuries.length === 0) return [];

    return injuries.map(inj => ({
      player: inj.player?.name || 'Unknown',
      position: inj.player?.type || 'Unknown',
      reason: inj.player?.reason || 'Injury',
      expectedReturn: inj.fixture?.date || null
    }));
  }

  _processTopScorers(scorers, homeTeamId, awayTeamId) {
    if (!scorers) return { home: [], away: [] };

    return {
      home: scorers.filter(s => s.statistics?.[0]?.team?.id === homeTeamId).slice(0, 3),
      away: scorers.filter(s => s.statistics?.[0]?.team?.id === awayTeamId).slice(0, 3)
    };
  }

  _processTopAssists(assists, homeTeamId, awayTeamId) {
    if (!assists) return { home: [], away: [] };

    return {
      home: assists.filter(a => a.statistics?.[0]?.team?.id === homeTeamId).slice(0, 3),
      away: assists.filter(a => a.statistics?.[0]?.team?.id === awayTeamId).slice(0, 3)
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════

  async _handleRateLimit() {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    const minDelay = 2000; // 2 seconds minimum between requests (increased from 1s)

    if (timeSinceLastRequest < minDelay) {
      const waitTime = minDelay - timeSinceLastRequest;
      await this._delay(waitTime);
    }
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = FootballAPIService;