/**
 * ═══════════════════════════════════════════════════════════════
 * FOOTBALL PREDICTION ENGINE - CONFIGURATION
 * ═══════════════════════════════════════════════════════════════
 * Centralized configuration for all constants, API keys, and settings
 */

require('dotenv').config();

// ═══════════════════════════════════════════════════════════════
// API CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const API_CONFIG = {
  football: {
    baseUrl: 'https://v3.football.api-sports.io',
    key: process.env.RAPIDAPI_KEY,
    rateLimit: {
      requestsPerDay: 100,      // Free tier limit
      requestsPerMinute: 30,    // Free tier limit
      minDelay: 2000,           // 2 seconds between requests (helps avoid rate limit)
      maxRetries: 5,            // Retry up to 5 times on rate limit errors
      retryBaseDelay: 10000     // Start with 10s, doubles each retry (10s, 20s, 40s, 80s, 160s)
    }
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1/messages',
    key: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 8000,
    version: '2023-06-01',
    timeout: 90000 // 90 seconds (comprehensive analysis takes time)
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    key: process.env.OPENAI_API_KEY,
    model: 'gpt-4-1106-preview', // GPT-4.1 model name
    maxTokens: 4096,
    temperature: 0.7,
    timeout: 90000 // 90 seconds
  }
};

// ═══════════════════════════════════════════════════════════════
// SEASON CALCULATION
// ═══════════════════════════════════════════════════════════════

/**
 * Calculate current football season dynamically
 * Football season runs August-May
 * @returns {number} Current season year
 */
function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  
  // Jan-July = previous year's season
  // Aug-Dec = current year's season
  return month >= 8 ? year : year - 1;
}

const CURRENT_SEASON = getCurrentSeason();

// ═══════════════════════════════════════════════════════════════
// LEAGUE CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════

const LEAGUES = {
  epl: {
    id: 39,
    name: 'Premier League',
    country: 'England',
    season: CURRENT_SEASON,
    emoji: '🏴󠁧󠁢󠁥󠁮󠁿'
  },
  bundesliga: {
    id: 78,
    name: 'Bundesliga',
    country: 'Germany',
    season: CURRENT_SEASON,
    emoji: '🇩🇪'
  },
  seriea: {
    id: 135,
    name: 'Serie A',
    country: 'Italy',
    season: CURRENT_SEASON,
    emoji: '🇮🇹'
  },
  laliga: {
    id: 140,
    name: 'La Liga',
    country: 'Spain',
    season: CURRENT_SEASON,
    emoji: '🇪🇸'
  },
  ligue1: {
    id: 61,
    name: 'Ligue 1',
    country: 'France',
    season: CURRENT_SEASON,
    emoji: '🇫🇷'
  },
  ucl: {
    id: 2,
    name: 'UEFA Champions League',
    country: 'Europe',
    season: CURRENT_SEASON,
    emoji: '⭐'
  },
  europa: {
    id: 3,
    name: 'UEFA Europa League',
    country: 'Europe',
    season: CURRENT_SEASON,
    emoji: '🏆'
  }
};

// ═══════════════════════════════════════════════════════════════
// CACHE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const CACHE_DURATION = {
  fixtures: 60 * 60 * 1000,        // 1 hour
  matchData: 6 * 60 * 60 * 1000,   // 6 hours
  predictions: 7 * 24 * 60 * 60 * 1000, // 7 days
  leagueStats: 12 * 60 * 60 * 1000, // 12 hours
  standings: 6 * 60 * 60 * 1000,    // 6 hours
  injuries: 3 * 60 * 60 * 1000      // 3 hours (updated frequently)
};

// ═══════════════════════════════════════════════════════════════
// DATA FETCHING CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const FETCH_CONFIG = {
  // How many days ahead to fetch fixtures
  daysAhead: 7,
  
  // How many past matches to analyze (for teams)
  recentMatches: 10,
  
  // League statistics: Fetch all finished matches from season start to now
  // (using date range, not a fixed count)
  leagueStatsMethod: 'season-to-date',
  
  // Delays to avoid rate limiting
  delays: {
    betweenPredictions: 10000,  // 10 seconds between predictions
    afterRateLimit: 60000,      // 1 minute after rate limit hit
    betweenAPIRequests: 1000    // 1 second between API requests
  },
  
  // Retry configuration
  retry: {
    maxRetries: 3,
    baseDelay: 5000,  // 5 seconds
    exponentialBackoff: true
  }
};

// ═══════════════════════════════════════════════════════════════
// DATA ENDPOINTS MAPPING
// ═══════════════════════════════════════════════════════════════

const ENDPOINTS = {
  fixtures: {
    upcoming: (leagueId, season, from, to) => 
      `fixtures?league=${leagueId}&season=${season}&from=${from}&to=${to}`,
    next: (leagueId, season, count = 10) => 
      `fixtures?league=${leagueId}&season=${season}&next=${count}`,
    byId: (fixtureId) => 
      `fixtures?id=${fixtureId}`,
    last: (teamId, season, count = 20) => 
      `fixtures?team=${teamId}&season=${season}&last=${count}`,
    h2h: (homeId, awayId, last = 10) => 
      `fixtures/headtohead?h2h=${homeId}-${awayId}&last=${last}`
  },
  
  teams: {
    statistics: (teamId, season, leagueId) => 
      `teams/statistics?team=${teamId}&season=${season}&league=${leagueId}`,
    squad: (teamId) => 
      `players/squads?team=${teamId}`
  },
  
  players: {
    all: (teamId, season) => 
      `players?team=${teamId}&season=${season}`,
    topScorers: (leagueId, season) => 
      `players/topscorers?league=${leagueId}&season=${season}`,
    topAssists: (leagueId, season) => 
      `players/topassists?league=${leagueId}&season=${season}`
  },
  
  injuries: {
    byTeam: (teamId, season) => 
      `injuries?team=${teamId}&season=${season}`,
    byFixture: (fixtureId) => 
      `injuries?fixture=${fixtureId}`
  },
  
  standings: {
    byLeague: (leagueId, season) => 
      `standings?league=${leagueId}&season=${season}`
  },
  
  predictions: {
    byFixture: (fixtureId) => 
      `predictions?fixture=${fixtureId}`
  }
};

// ═══════════════════════════════════════════════════════════════
// PREDICTION ANALYSIS CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const ANALYSIS_CONFIG = {
  // Sections to include in AI prediction
  sections: [
    'EXECUTIVE_SUMMARY',
    'TACTICAL_ANALYSIS',
    'KEY_PLAYERS',
    'TEAM_FORM',
    'LEAGUE_POSITION',
    'HEAD_TO_HEAD',
    'INJURY_IMPACT',
    'STATISTICAL_PROBABILITIES',
    'GOALS_BY_TIME',
    'ATTACK_VS_DEFENSE',
    'RISK_FACTORS',
    'FINAL_VERDICT'
  ],
  
  // Minimum data requirements for prediction
  minimumDataRequired: {
    recentMatches: 3,
    standingsData: true,
    injuriesData: true
  },
  
  // Scoreline prediction rules
  scorelineRules: {
    highScoring: { threshold: 3.0, examples: ['3-1', '3-2', '4-1', '4-2'] },
    defensive: { threshold: 1.5, examples: ['1-0', '0-0', '1-1'] },
    balanced: { threshold: 2.5, examples: ['2-1', '2-2', '1-1'] },
    mismatch: { positionGap: 10, examples: ['3-0', '4-0', '4-1'] }
  }
};

// ═══════════════════════════════════════════════════════════════
// VALIDATION RULES
// ═══════════════════════════════════════════════════════════════

const VALIDATION = {
  fixture: {
    requiredFields: ['fixture.id', 'teams.home.id', 'teams.away.id', 'league.id']
  },
  prediction: {
    minLength: 1000,  // Minimum characters in AI response
    requiredSections: ['EXECUTIVE SUMMARY', 'FINAL VERDICT']
  }
};

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  API_CONFIG,
  CURRENT_SEASON,
  LEAGUES,
  CACHE_DURATION,
  FETCH_CONFIG,
  ENDPOINTS,
  ANALYSIS_CONFIG,
  VALIDATION,
  getCurrentSeason
};