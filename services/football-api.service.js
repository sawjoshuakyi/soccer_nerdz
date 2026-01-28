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
    
    try {
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
    } catch (error) {
      // If 403, log and return empty (API tier limitation)
      if (error.response?.status === 403) {
        console.log(`   ⚠️  Fixtures endpoint not accessible (403 - API tier limitation)`);
        return [];
      }
      throw error;
    }
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
        await this._delay(0);

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

  /**
   * Get starting 11 from last played fixture for a team (using API lineups endpoint)
   * @param {number} teamId - Team ID
   * @param {number} season - Season year
   * @returns {Promise<Array>} Array of player names in starting 11
   */
  async getLastStarting11(teamId, season) {
    // 1. Get last played fixture for this team
    const fixturesEndpoint = `fixtures?team=${teamId}&season=${season}&last=1`;
    const fixturesData = await this.request(fixturesEndpoint);
    const lastFixture = fixturesData.response && fixturesData.response[0];
    if (!lastFixture) return [];
    const fixtureId = lastFixture.fixture.id;
    // 2. Get lineups for that fixture
    const lineupsEndpoint = `fixtures/lineups?fixture=${fixtureId}&team=${teamId}`;
    const lineupsData = await this.request(lineupsEndpoint);
    const lineup = lineupsData.response && lineupsData.response[0];
    if (!lineup || !lineup.startXI) return [];
    // 3. Return array of player names in starting 11
    return lineup.startXI.map(p => p.player.name).filter(Boolean);
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

  /**
   * Get current squad with league-specific stats and ratings
   * @param {number} teamId - Team ID
   * @param {number} season - Season year
   * @param {number} leagueId - League ID (EPL, UCL, etc.)
   * @returns {Promise<Array>} Squad with league-specific stats
   */
  async getSquadWithStats(teamId, season, leagueId) {
    try {
      // 1. Get CURRENT squad roster (excludes transferred out)
      const squadEndpoint = `players/squads?team=${teamId}`;
      const squadData = await this.request(squadEndpoint);
      if (!squadData.response || squadData.response.length === 0) return [];
      const currentSquad = squadData.response[0]?.players || [];
      // DEBUG: Log the entire squad received from the API
      console.log('==== DEBUG: Full current squad from API ====');
      currentSquad.forEach(player => {
        console.log(`ID: ${player.id}, Name: ${player.name}, Age: ${player.age}, Number: ${player.number}, Position: ${player.position}`);
      });
      console.log('==== END SQUAD ====');
      const currentPlayerIds = new Set(currentSquad.map(p => Number(p.id)));

      // 2. Get player stats for this team/season (bulk)
      const statsEndpoint = `players?team=${teamId}&season=${season}`;
      const statsData = await this.request(statsEndpoint);
      // Map playerId => stats filtered by league
      const statsMap = new Map();
      (statsData.response || []).forEach(player => {
        const playerId = Number(player.player.id);
        // Only stats for the current league
        const leagueStats = (player.statistics || []).find(stat => stat.league?.id === leagueId);
        if (leagueStats && currentPlayerIds.has(playerId)) {
          statsMap.set(playerId, leagueStats);
        }
      });

      // Helper to sanitize player names for API search (alphanumeric and spaces only, remove accents)
      function sanitizePlayerName(name) {
        let sanitized = name.normalize('NFD').replace(/\p{Diacritic}/gu, '');
        sanitized = sanitized.replace(/[^a-zA-Z0-9 ]/g, '');
        sanitized = sanitized.replace(/ +/g, ' ').trim();
        return sanitized;
      }

      // Helper to get surname (last word)
      function getSurname(name) {
        const parts = name.trim().split(' ');
        return parts.length > 1 ? parts[parts.length - 1] : name;
      }

      // 3. For any squad player missing from statsMap, fetch individually using search
      for (const squadPlayer of currentSquad) {
        const playerId = Number(squadPlayer.id);
        if (!statsMap.has(playerId)) {
          // Use surname if >= 4 chars, else use full name
          let surname = sanitizePlayerName(getSurname(squadPlayer.name));
          let searchName;
          if (surname.length >= 4) {
            searchName = surname;
          } else {
            searchName = sanitizePlayerName(squadPlayer.name);
          }
          if (!searchName) continue;
          const searchEndpoint = `players?team=${teamId}&search=${encodeURIComponent(searchName)}&season=${season}`;
          const searchData = await this.request(searchEndpoint);
          const found = (searchData.response || []).find(p => Number(p.player.id) === playerId);
          if (found) {
            const leagueStats = (found.statistics || []).find(stat => stat.league?.id === leagueId);
            if (leagueStats) {
              statsMap.set(playerId, leagueStats);
            }
          }
        }
      }

      // 4. Merge squad with league-specific stats
      const squadWithStats = currentSquad.map(squadPlayer => {
        const stat = statsMap.get(Number(squadPlayer.id));
        const appearances = stat?.games?.appearences ? Number(stat.games.appearences) : 0;
        const lineups = stat?.games?.lineups ? Number(stat.games.lineups) : 0;
        return {
          id: squadPlayer.id,
          name: squadPlayer.name,
          photo: squadPlayer.photo,
          age: squadPlayer.age,
          number: squadPlayer.number,
          position: squadPlayer.position,
          rating: stat?.games?.rating ? Number(stat.games.rating) : 0,
          appearances,
          lineups,
          goals: stat?.goals?.total || 0,
          assists: stat?.goals?.assists || 0,
          shots: stat?.shots?.total || 0,
          shotsOn: stat?.shots?.on || 0,
          passes: stat?.passes?.total || 0,
          passAccuracy: stat?.passes?.accuracy || 0,
          keyPasses: stat?.passes?.key || 0,
          tackles: stat?.tackles?.total || 0,
          interceptions: stat?.tackles?.interceptions || 0,
          duelsWon: stat?.duels?.won || 0,
          duelsTotal: stat?.duels?.total || 0,
          saves: stat?.goals?.saves || 0,
          conceded: stat?.goals?.conceded || 0,
          cleanSheets: stat?.goals?.cleansheet || 0,
          yellowCards: stat?.cards?.yellow || 0,
          redCards: stat?.cards?.red || 0,
          hasStats: !!stat
        };
      }).filter(p => p.lineups > 0 || p.appearances > 1);
      return squadWithStats;
    } catch (error) {
      return [];
    }
  }

  /**
   * DEPRECATED: Use getSquadWithStats instead. This function is no longer used.
   */
  async getActivePlayersWithStats(teamId, season, leagueId) {
    // Deprecated: Use getSquadWithStats for current squad only
    return await this.getSquadWithStats(teamId, season, leagueId);
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
    try {
      // Enhancement: Get injuries from the date of the team's most recent match
      // This is more accurate than season-based queries
      console.log(`   🏥 Finding most recent match for injury data...`);
      
      const recentMatchEndpoint = `fixtures?team=${teamId}&season=${season}&last=1`;
      const recentMatchData = await this.request(recentMatchEndpoint);
      
      if (!recentMatchData.response || recentMatchData.response.length === 0) {
        console.log(`   ⚠️  No recent matches found, falling back to season query`);
        const endpoint = ENDPOINTS.injuries.byTeam(teamId, season);
        const data = await this.request(endpoint);
        return data.response || [];
      }

      // Get the date of the most recent match
      const lastMatch = recentMatchData.response[0];
      const matchDate = lastMatch.fixture.date.split('T')[0]; // Format: YYYY-MM-DD
      const opponent = lastMatch.teams.home.id === teamId 
        ? lastMatch.teams.away.name 
        : lastMatch.teams.home.name;
      
      console.log(`   🏥 Fetching injuries from last match vs ${opponent} (${matchDate})...`);
      
      // Fetch injuries by specific date - more accurate than by season!
      const endpoint = `injuries?date=${matchDate}&team=${teamId}&timezone=UTC`;
      const data = await this.request(endpoint);
      
      console.log(`   📋 Found ${data.response?.length || 0} injuries from ${matchDate}`);
      
      return data.response || [];
      
    } catch (error) {
      console.error(`   ⚠️  Could not fetch injuries by match date: ${error.message}`);
      console.log(`   ⚠️  Falling back to season-based injury query...`);
      
      // Fallback to season-based query if date-based fails
      const endpoint = ENDPOINTS.injuries.byTeam(teamId, season);
      const data = await this.request(endpoint);
      return data.response || [];
    }
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
   * Fetch comprehensive match data, including last starting 11 for both teams
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
      const [homeInjuries, awayInjuries, apiPrediction, topScorers, topAssists, homeSquad, awaySquad] = await Promise.all([
        this.getTeamInjuries(homeTeamId, season),
        this.getTeamInjuries(awayTeamId, season),
        this.getAPIPrediction(fixtureId),
        this.getTopScorers(leagueId, season),
        this.getTopAssists(leagueId, season),
        this.getSquadWithStats(homeTeamId, season, leagueId),
        this.getSquadWithStats(awayTeamId, season, leagueId)
      ]);

      // Fetch last starting 11 for both teams
      const [homeLastXI, awayLastXI] = await Promise.all([
        this.getLastStarting11(homeTeamId, season),
        this.getLastStarting11(awayTeamId, season)
      ]);

      // Process and structure the data
      const processedHomeRecent = this._processRecentMatches(homeRecentMatches, homeTeamId);
      const processedAwayRecent = this._processRecentMatches(awayRecentMatches, awayTeamId);

      const matchData = {
        // Team Statistics
        homeStats: this._extractTeamStats(homeStats),
        awayStats: this._extractTeamStats(awayStats),

        // Recent Form
        homeRecentMatches: processedHomeRecent,
        awayRecentMatches: processedAwayRecent,

        // Head to Head
        h2h: this._processH2H(h2hMatches, homeTeamId),

        // Standings
        standings: this._extractStandings(standings, homeTeamId, awayTeamId),

        // API Predictions (for lineups and win percentages) - with lineup fallback
        apiPrediction: this._extractAPIPrediction(apiPrediction, processedHomeRecent, processedAwayRecent),

        // Injuries
        homeInjuries: this._processInjuries(homeInjuries),
        awayInjuries: this._processInjuries(awayInjuries),

        // League Context
        topScorers: this._processTopScorers(topScorers, homeTeamId, awayTeamId),
        topAssists: this._processTopAssists(topAssists, homeTeamId, awayTeamId),

        // Squad Stats & Ratings (for detailed player analysis)
        homeSquad: homeSquad || [],
        awaySquad: awaySquad || [],

        // Add last starting 11 for both teams
        lastLineup: {
          homePlayers: homeLastXI,
          awayPlayers: awayLastXI
        },

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

  _extractAPIPrediction(prediction, homeRecentMatches = null, awayRecentMatches = null) {
    if (!prediction) return null;

    // Get predicted lineups from API
    let homePredictedLineup = prediction.predictions?.lineup?.home || null;
    let awayPredictedLineup = prediction.predictions?.lineup?.away || null;

    // Fallback to last game's lineup if no prediction available
    if (!homePredictedLineup && homeRecentMatches && homeRecentMatches.matches && homeRecentMatches.matches.length > 0) {
      const lastMatch = homeRecentMatches.matches[0];
      if (lastMatch.lineup && lastMatch.lineup.formation) {
        homePredictedLineup = lastMatch.lineup.formation;
        console.log(`   ℹ️  Using home team's last game formation: ${homePredictedLineup}`);
      }
    }

    if (!awayPredictedLineup && awayRecentMatches && awayRecentMatches.matches && awayRecentMatches.matches.length > 0) {
      const lastMatch = awayRecentMatches.matches[0];
      if (lastMatch.lineup && lastMatch.lineup.formation) {
        awayPredictedLineup = lastMatch.lineup.formation;
        console.log(`   ℹ️  Using away team's last game formation: ${awayPredictedLineup}`);
      }
    }

    return {
      winProbability: {
        home: prediction.predictions?.percent?.home || 'N/A',
        draw: prediction.predictions?.percent?.draw || 'N/A',
        away: prediction.predictions?.percent?.away || 'N/A'
      },
      predictedLineups: {
        home: homePredictedLineup || 'N/A',
        away: awayPredictedLineup || 'N/A'
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