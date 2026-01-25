const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cache = require('./cache-simple');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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

// ENDPOINT: Generate AI prediction
app.post('/api/predict', async (req, res) => {
  const { fixture, matchData } = req.body;

  if (!fixture || !matchData) {
    return res.status(400).json({ error: 'Missing fixture or match data' });
  }

  const fixtureId = fixture.fixture.id;

  // Check database cache
  const cachedPrediction = cache.getPrediction(fixtureId);
  if (cachedPrediction) {
    console.log(`💾 Returning cached prediction for fixture ${fixtureId}`);
    cache.logAPICall(`prediction/${fixtureId}`, true, true);
    return res.json({ prediction: cachedPrediction });
  }

  try {
    console.log(`Generating AI prediction for ${fixture.teams.home.name} vs ${fixture.teams.away.name}...`);

    // Get league key from fixture
    const leagueKey = Object.keys(LEAGUES).find(key => LEAGUES[key].id === fixture.league.id);
    
    // Fetch league statistics
    let leagueStatsData = null;
    if (leagueKey) {
      const cachedLeagueStats = cache.getLeagueStats(leagueKey);
      if (cachedLeagueStats) {
        leagueStatsData = cachedLeagueStats;
      } else {
        try {
          // Fetch and calculate league stats
          const leagueConfig = LEAGUES[leagueKey];
          const data = await fetchFromAPI(`fixtures?league=${leagueConfig.id}&season=${leagueConfig.season}&last=100`);
          if (data.response && data.response.length > 0) {
            const stats = calculateLeagueStats(data.response);
            if (stats) {
              leagueStatsData = {
                league: leagueConfig.name,
                season: leagueConfig.season,
                stats,
                lastUpdated: new Date().toISOString()
              };
              cache.setLeagueStats(leagueKey, leagueStatsData);
            }
          }
        } catch (err) {
          console.log('Could not fetch league stats, continuing without them');
        }
      }
    }

    // Extract key players for quick reference
    const homeTopScorers = matchData.homePlayers?.slice(0, 10).map(p => {
      const stats = p.statistics?.[0] || {};
      return {
        name: p.player.name,
        position: stats.games?.position || 'Unknown',
        goals: stats.goals?.total || 0,
        assists: stats.goals?.assists || 0,
        rating: stats.games?.rating || 'N/A'
      };
    }).filter(p => p.goals > 0 || p.assists > 0 || p.rating !== 'N/A').slice(0, 5) || [];

    const awayTopScorers = matchData.awayPlayers?.slice(0, 10).map(p => {
      const stats = p.statistics?.[0] || {};
      return {
        name: p.player.name,
        position: stats.games?.position || 'Unknown',
        goals: stats.goals?.total || 0,
        assists: stats.goals?.assists || 0,
        rating: stats.games?.rating || 'N/A'
      };
    }).filter(p => p.goals > 0 || p.assists > 0 || p.rating !== 'N/A').slice(0, 5) || [];

    const predictionPrompt = `You are an elite professional soccer prediction analyst for a top-tier sports analytics firm. Generate a comprehensive match prediction with professional-grade depth and accuracy using ALL available data.

UPCOMING MATCH:
${fixture.teams.home.name} vs ${fixture.teams.away.name}
Date: ${new Date(fixture.fixture.date).toLocaleString()}
Competition: ${fixture.league.name}
Venue: ${fixture.fixture.venue.name}

════════════════════════════════════════════════════════════════
📊 LEAGUE CONTEXT & STATISTICS
════════════════════════════════════════════════════════════════
${leagueStatsData ? `
${leagueStatsData.league} - Season ${leagueStatsData.season} Statistics (Last 100 Matches):

🎯 OVERALL LEAGUE TRENDS:
   • Average Goals Per Game: ${leagueStatsData.stats.goalsPerGame}
   • Both Teams To Score (BTTS): ${leagueStatsData.stats.bttsPercentage}%
   • Over 2.5 Goals: ${leagueStatsData.stats.over25Percentage}%
   • Clean Sheets: ${leagueStatsData.stats.cleanSheetPercentage}%
   • Failed To Score: ${leagueStatsData.stats.failedToScorePercentage}%

📈 RESULT DISTRIBUTION:
   • Home Wins: ${leagueStatsData.stats.homeWinPercentage}%
   • Draws: ${leagueStatsData.stats.drawPercentage}%
   • Away Wins: ${leagueStatsData.stats.awayWinPercentage}%

Use these league averages to contextualize team performance. Teams performing above/below these benchmarks are significant.
` : 'League statistics not available for this match.'}

════════════════════════════════════════════════════════════════
⭐ KEY PLAYERS & PERSONNEL TO WATCH
════════════════════════════════════════════════════════════════

🏠 ${fixture.teams.home.name} - TOP PERFORMERS:
${homeTopScorers.length > 0 ? homeTopScorers.map(p => 
  `   • ${p.name} (${p.position}) - ${p.goals} goals, ${p.assists} assists, Rating: ${p.rating}`
).join('\n') : '   • Data being analyzed from full squad statistics below'}

✈️ ${fixture.teams.away.name} - TOP PERFORMERS:
${awayTopScorers.length > 0 ? awayTopScorers.map(p => 
  `   • ${p.name} (${p.position}) - ${p.goals} goals, ${p.assists} assists, Rating: ${p.rating}`
).join('\n') : '   • Data being analyzed from full squad statistics below'}

COACHING & TACTICAL NOTES:
Analyze the coaching staff's tactical approach based on:
- Formation patterns (from team statistics)
- Recent tactical adjustments (from recent matches)
- Head-to-head tactical battles
- In-game management and substitution patterns

════════════════════════════════════════════════════════════════
COMPREHENSIVE DATA FOR ANALYSIS
════════════════════════════════════════════════════════════════

📊 TEAM SEASON STATISTICS & PERFORMANCE
─────────────────────────────────────────────────────────────────

HOME TEAM (${fixture.teams.home.name}) - FULL SEASON STATS:
${JSON.stringify(matchData.homeTeamStats, null, 2)}

AWAY TEAM (${fixture.teams.away.name}) - FULL SEASON STATS:
${JSON.stringify(matchData.awayTeamStats, null, 2)}

📈 LEAGUE STANDINGS & CONTEXT
─────────────────────────────────────────────────────────────────
${JSON.stringify(matchData.standings, null, 2)}

🔥 RECENT FORM & MOMENTUM (Last 20 Matches)
─────────────────────────────────────────────────────────────────

HOME TEAM RECENT MATCHES:
${JSON.stringify(matchData.homeRecentMatches, null, 2)}

AWAY TEAM RECENT MATCHES:
${JSON.stringify(matchData.awayRecentMatches, null, 2)}

🤝 HEAD-TO-HEAD HISTORY (Last 10 Meetings)
─────────────────────────────────────────────────────────────────
${JSON.stringify(matchData.headToHead, null, 2)}

👥 SQUAD INFORMATION & PLAYER DEPTH
─────────────────────────────────────────────────────────────────

HOME SQUAD:
${JSON.stringify(matchData.homeSquad, null, 2)}

AWAY SQUAD:
${JSON.stringify(matchData.awaySquad, null, 2)}

🏥 INJURIES & SUSPENSIONS (Critical Absences)
─────────────────────────────────────────────────────────────────

HOME TEAM INJURIES:
${JSON.stringify(matchData.homeInjuries, null, 2)}

AWAY TEAM INJURIES:
${JSON.stringify(matchData.awayInjuries, null, 2)}

⚽ PLAYER STATISTICS & KEY PERFORMERS
─────────────────────────────────────────────────────────────────

HOME TEAM PLAYERS (Season Stats):
${JSON.stringify(matchData.homePlayers, null, 2)}

AWAY TEAM PLAYERS (Season Stats):
${JSON.stringify(matchData.awayPlayers, null, 2)}

🏆 LEAGUE TOP PERFORMERS (Context)
─────────────────────────────────────────────────────────────────

TOP SCORERS:
${JSON.stringify(matchData.leagueTopScorers, null, 2)}

TOP ASSISTS:
${JSON.stringify(matchData.leagueTopAssists, null, 2)}

🤖 API PREDICTION ALGORITHMS
─────────────────────────────────────────────────────────────────
${JSON.stringify(matchData.predictions, null, 2)}

════════════════════════════════════════════════════════════════
REQUIRED ANALYSIS FRAMEWORK
════════════════════════════════════════════════════════════════

Based on this comprehensive data, provide a professional match prediction covering ALL sections:

1. **EXECUTIVE SUMMARY**
   - Match outcome prediction with confidence level (%)
   - Predicted scoreline with probability ranges
   - Most likely result (Home Win/Draw/Away Win) with exact percentages
   - Key deciding factors summary

2. **TACTICAL ANALYSIS & COACHING IMPACT**
   - Most used formations and tactical setups
   - Expected tactical approach for this match
   - Key tactical battles and matchups
   - Coaching staff influence and tactical adjustments
   - Set piece threat analysis
   - Predicted in-game strategies

3. **KEY PLAYERS & INDIVIDUAL BATTLES**
   - Top performers to watch from both teams
   - Critical player matchups (striker vs defender, midfielder duels)
   - Form analysis of star players (recent goals/assists/ratings)
   - Impact of injuries on key players
   - Bench strength and potential game-changers
   - Players likely to be decisive in the outcome

4. **TEAM FORM & MOMENTUM**
   - Recent form assessment (W/D/L patterns from last 20 matches)
   - Home vs away performance splits
   - Goals scored/conceded trends
   - Winning/losing streaks analysis
   - Psychological momentum factors
   - Performance under pressure

5. **LEAGUE POSITION & CONTEXT**
   - Current standings analysis
   - Performance vs league averages (goals, BTTS, clean sheets)
   - Points gap and implications
   - What's at stake (relegation/Europe/title race)
   - Pressure and motivation factors

6. **HEAD-TO-HEAD INSIGHTS**
   - Historical record and dominance patterns
   - Recent H2H trends
   - Home advantage impact in this fixture
   - Scoring patterns in past meetings
   - Psychological edge analysis

7. **INJURY & SUSPENSION IMPACT**
   - Critical absences and their impact
   - How missing players affect tactics and personnel
   - Depth analysis for replacements
   - Percentage impact on team strength
   - Historical performance without key players

8. **STATISTICAL PROBABILITIES**
   - Over/Under 2.5 goals (with % and comparison to league average of ${leagueStatsData?.stats.over25Percentage || 'N/A'}%)
   - Both Teams to Score probability (league average: ${leagueStatsData?.stats.bttsPercentage || 'N/A'}%)
   - Clean sheet likelihood for each team
   - Expected corners range
   - Expected cards (yellows/reds)
   - First goal probability
   - Half-time/Full-time predictions

9. **GOALS BY TIME PERIOD ANALYSIS**
   - When each team typically scores (0-15, 16-30, 31-45, 46-60, 61-75, 76-90+ min)
   - When each team is most vulnerable
   - Late goal tendencies
   - Fast start vs slow start patterns

10. **ATTACKING THREAT vs DEFENSIVE SOLIDITY**
    - Home attack vs Away defense rating
    - Away attack vs Home defense rating
    - Offensive efficiency metrics
    - Defensive vulnerability analysis
    - Expected possession split
    - Shot quality comparison

11. **RISK ASSESSMENT & VARIABLES**
    - Confidence level in prediction (%)
    - Key variables that could change outcome
    - Weather/venue factors if relevant
    - Referee tendencies if significant
    - Upset potential and probability
    - Variance factors

12. **FINAL VERDICT & RECOMMENDATIONS**
    - Primary prediction with exact scoreline
    - Alternative scenarios (if X happens)
    - Betting value assessment
    - Recommended markets (1X2, BTTS, O/U, etc.)
    - Risk rating (Low/Medium/High)
    - Confidence summary

════════════════════════════════════════════════════════════════

CRITICAL REQUIREMENTS:
- Use HARD DATA from all provided sources to support every claim
- COMPARE team stats to league averages - highlight over/underperformance
- Be SPECIFIC with percentages, probabilities, and numbers
- Identify KEY PLAYERS who will likely impact the match outcome
- Analyze COACHING and tactical approaches in detail
- Consider INJURIES/SUSPENSIONS impact thoroughly
- Factor in LEAGUE POSITION pressure and motivation
- Reference GOALS BY TIME PERIOD patterns
- Use league statistics to contextualize performance
- Format professionally for a client report
- Be decisive but acknowledge uncertainty where it exists

Provide a comprehensive, data-driven analysis worthy of a premium sports analytics firm with special emphasis on key players, coaching tactics, and league context.`;

    // Call Claude API
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [
        { role: 'user', content: predictionPrompt }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      }
    });

    const predictionText = response.data.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');

    // Store in database cache
    cache.setPrediction(fixtureId, predictionText);
    cache.logAPICall(`prediction/${fixtureId}`, true, false);

    console.log('AI prediction generated successfully');
    res.json({ prediction: predictionText });
  } catch (error) {
    console.error('Error generating prediction:', error.response?.data || error.message);
    cache.logAPICall(`prediction/${fixtureId}`, false, false);
    res.status(500).json({ error: 'Failed to generate prediction', details: error.message });
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
    apiCalls24h: stats.apiCalls24h
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Soccer Prediction Engine Backend running on http://localhost:${PORT}`);
  console.log(`📊 Available leagues: ${Object.keys(LEAGUES).join(', ')}`);
  console.log(`💾 File-based caching enabled (JSON)`);
  console.log(`\n📈 Cache expiration times:`);
  console.log(`   - Fixtures: 1 hour`);
  console.log(`   - Match data: 6 hours`);
  console.log(`   - Predictions: 7 days`);
  console.log(`\n💡 Make sure to configure your .env file with RAPIDAPI_KEY\n`);
  
  // Show current cache stats
  const stats = cache.getStats();
  console.log(`📦 Current cache: ${stats.cache.fixtures} fixtures, ${stats.cache.matchData} match data, ${stats.cache.predictions} predictions`);
  console.log(`📊 API calls (24h): ${stats.apiCalls24h.total} total, ${stats.apiCalls24h.cached} from cache (${stats.apiCalls24h.cacheHitRate})\n`);
});