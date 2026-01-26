const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.RAPIDAPI_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const API_BASE_URL = 'https://v3.football.api-sports.io';

// Auto-detect current football season
function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  
  // Football season runs Aug-May
  // Jan 2026 = 2025-2026 season (return 2025)
  // Aug 2026 = 2026-2027 season (return 2026)
  return month >= 8 ? year : year - 1;
}

const CURRENT_SEASON = getCurrentSeason();

const LEAGUES = {
  epl: { id: 39, name: 'Premier League', season: CURRENT_SEASON },
  bundesliga: { id: 78, name: 'Bundesliga', season: CURRENT_SEASON },
  seriea: { id: 135, name: 'Serie A', season: CURRENT_SEASON },
  laliga: { id: 140, name: 'La Liga', season: CURRENT_SEASON }
};

// Helper function to fetch from API-Football
async function fetchFromAPI(endpoint) {
  try {
    const url = `${API_BASE_URL}/${endpoint}`;
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

// Helper to calculate league statistics
function calculateLeagueStats(fixtures) {
  if (!fixtures || fixtures.length === 0) return null;

  const finishedMatches = fixtures.filter(f => f.fixture.status.short === 'FT');
  if (finishedMatches.length === 0) return null;

  let totalGoals = 0, homeWins = 0, draws = 0, awayWins = 0;
  let bttsCount = 0, over25Count = 0;
  let homeCleanSheets = 0, awayCleanSheets = 0;
  let homeFailedToScore = 0, awayFailedToScore = 0;

  finishedMatches.forEach(match => {
    const homeGoals = match.goals.home || 0;
    const awayGoals = match.goals.away || 0;
    const totalMatchGoals = homeGoals + awayGoals;

    totalGoals += totalMatchGoals;
    if (homeGoals > awayGoals) homeWins++;
    else if (homeGoals === awayGoals) draws++;
    else awayWins++;
    if (homeGoals > 0 && awayGoals > 0) bttsCount++;
    if (totalMatchGoals > 2.5) over25Count++;
    if (awayGoals === 0) homeCleanSheets++;
    if (homeGoals === 0) awayCleanSheets++;
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

// Get upcoming fixtures for all leagues
async function getUpcomingFixtures(daysAhead = 7) {
  console.log(`\n📅 Fetching upcoming fixtures for next ${daysAhead} days...\n`);
  
  const allFixtures = [];
  
  for (const [leagueKey, leagueConfig] of Object.entries(LEAGUES)) {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + daysAhead);
      
      const fromDate = today.toISOString().split('T')[0];
      const toDate = futureDate.toISOString().split('T')[0];
      
      const data = await fetchFromAPI(`fixtures?league=${leagueConfig.id}&season=${leagueConfig.season}&from=${fromDate}&to=${toDate}`);
      
      if (data.response && data.response.length > 0) {
        // Filter for upcoming matches only
        const now = new Date();
        const upcomingMatches = data.response.filter(f => 
          new Date(f.fixture.date) > now && 
          f.fixture.status.short === 'NS' // Not Started
        );
        
        upcomingMatches.forEach(fixture => {
          allFixtures.push({
            fixture,
            leagueKey,
            leagueConfig
          });
        });
        
        console.log(`✅ ${leagueConfig.name}: ${upcomingMatches.length} upcoming matches`);
      }
    } catch (error) {
      console.error(`❌ Error fetching ${leagueKey}:`, error.message);
    }
  }
  
  console.log(`\n📊 Total upcoming matches: ${allFixtures.length}\n`);
  return allFixtures;
}

// Fetch comprehensive match data
async function fetchMatchData(fixture) {
  const homeTeamId = fixture.teams.home.id;
  const awayTeamId = fixture.teams.away.id;
  const leagueId = fixture.league.id;
  const currentSeason = getCurrentSeason();

  console.log(`   Fetching data for ${fixture.teams.home.name} vs ${fixture.teams.away.name}...`);

  try {
    const [
      homeStatsData, awayStatsData, h2hData, predictionsData,
      homeMatchesData, awayMatchesData, standingsData,
      homeSquadData, awaySquadData,
      homeInjuriesData, awayInjuriesData,
      topScorersData, topAssistsData
    ] = await Promise.all([
      fetchFromAPI(`teams/statistics?team=${homeTeamId}&season=${currentSeason}&league=${leagueId}`),
      fetchFromAPI(`teams/statistics?team=${awayTeamId}&season=${currentSeason}&league=${leagueId}`),
      fetchFromAPI(`fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}&last=10`),
      fetchFromAPI(`predictions?fixture=${fixture.fixture.id}`),
      fetchFromAPI(`fixtures?team=${homeTeamId}&season=${currentSeason}&last=20`),
      fetchFromAPI(`fixtures?team=${awayTeamId}&season=${currentSeason}&last=20`),
      fetchFromAPI(`standings?league=${leagueId}&season=${currentSeason}`),
      fetchFromAPI(`players/squads?team=${homeTeamId}`),
      fetchFromAPI(`players/squads?team=${awayTeamId}`),
      fetchFromAPI(`injuries?team=${homeTeamId}&season=${currentSeason}`),
      fetchFromAPI(`injuries?team=${awayTeamId}&season=${currentSeason}`),
      fetchFromAPI(`players/topscorers?league=${leagueId}&season=${currentSeason}`),
      fetchFromAPI(`players/topassists?league=${leagueId}&season=${currentSeason}`)
    ]);

    const [homePlayersData, awayPlayersData] = await Promise.all([
      fetchFromAPI(`players?team=${homeTeamId}&season=${currentSeason}`),
      fetchFromAPI(`players?team=${awayTeamId}&season=${currentSeason}`)
    ]);

    // Extract recent lineups to get CURRENT squad (most reliable during transfer windows)
    const getRecentLineup = (matches, teamId) => {
      if (!matches || matches.length === 0) return null;
      const recentMatch = matches.find(m => m.lineups && m.lineups.length > 0);
      if (!recentMatch) return null;
      const isHome = recentMatch.teams.home.id === teamId;
      const lineup = isHome ? recentMatch.lineups[0] : recentMatch.lineups[1];
      return {
        formation: lineup?.formation || "N/A",
        startXI: lineup?.startXI || [],
        substitutes: lineup?.substitutes || [],
        matchDate: recentMatch.fixture.date,
        opponent: isHome ? recentMatch.teams.away.name : recentMatch.teams.home.name
      };
    };

    const homeRecentLineup = getRecentLineup(homeMatchesData.response || [], homeTeamId);
    const awayRecentLineup = getRecentLineup(awayMatchesData.response || [], awayTeamId);

    return {
      homeTeamStats: homeStatsData.response || null,
      awayTeamStats: awayStatsData.response || null,
      headToHead: h2hData.response || [],
      predictions: predictionsData.response || [],
      homeRecentMatches: homeMatchesData.response || [],
      awayRecentMatches: awayMatchesData.response || [],
      standings: standingsData.response || [],
      homeSquad: homeSquadData.response || [],
      awaySquad: awaySquadData.response || [],
      homeInjuries: homeInjuriesData.response || [],
      awayInjuries: awayInjuriesData.response || [],
      homePlayers: homePlayersData.response || [],
      awayPlayers: awayPlayersData.response || [],
      leagueTopScorers: topScorersData.response || [],
      leagueTopAssists: topAssistsData.response || [],
      homeRecentLineup: homeRecentLineup,
      awayRecentLineup: awayRecentLineup
    };
  } catch (error) {
    console.error(`   ❌ Error fetching match data:`, error.message);
    throw error;
  }
}

// Generate league statistics
async function getLeagueStats(leagueKey, leagueConfig) {
  try {
    const data = await fetchFromAPI(`fixtures?league=${leagueConfig.id}&season=${leagueConfig.season}&last=100`);
    
    if (!data.response || data.response.length === 0) {
      return null;
    }

    const stats = calculateLeagueStats(data.response);
    
    if (!stats) {
      return null;
    }

    return {
      league: leagueConfig.name,
      season: leagueConfig.season,
      stats,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error fetching league stats for ${leagueKey}:`, error.message);
    return null;
  }
}

// Generate AI prediction with retry logic
async function generatePrediction(fixture, matchData, leagueStatsData, retryCount = 0) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 5000; // 5 seconds base delay
  
  // Extract key players
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

  const predictionPrompt = `You are an elite professional soccer prediction analyst. Generate comprehensive match prediction.

MATCH: ${fixture.teams.home.name} vs ${fixture.teams.away.name}
Date: ${new Date(fixture.fixture.date).toLocaleString()}
League: ${fixture.league.name}

Provide detailed 12-section analysis covering tactics, players, form, probabilities, and final verdict.`;

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content: predictionPrompt }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });

    const predictionText = response.data.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');

    return predictionText;
    
  } catch (error) {
    // Handle rate limit errors with exponential backoff
    if (error.response?.status === 429 && retryCount < MAX_RETRIES) {
      const retryDelay = BASE_DELAY * Math.pow(2, retryCount);
      console.log(`   ⚠️  Rate limit hit. Retrying in ${retryDelay/1000}s... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return generatePrediction(fixture, matchData, leagueStatsData, retryCount + 1);
    }
    
    console.error('Error generating AI prediction:', error.message);
    throw error;
  }
}

// Export all functions
module.exports = {
  getUpcomingFixtures,
  fetchMatchData,
  getLeagueStats,
  generatePrediction,
  LEAGUES
};

// Helper function to fetch from API-Football
async function fetchFromAPI(endpoint) {
  try {
    const url = `${API_BASE_URL}/${endpoint}`;
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

// Helper to calculate league statistics
function calculateLeagueStats(fixtures) {
  if (!fixtures || fixtures.length === 0) return null;

  const finishedMatches = fixtures.filter(f => f.fixture.status.short === 'FT');
  if (finishedMatches.length === 0) return null;

  let totalGoals = 0, homeWins = 0, draws = 0, awayWins = 0;
  let bttsCount = 0, over25Count = 0;
  let homeCleanSheets = 0, awayCleanSheets = 0;
  let homeFailedToScore = 0, awayFailedToScore = 0;

  finishedMatches.forEach(match => {
    const homeGoals = match.goals.home || 0;
    const awayGoals = match.goals.away || 0;
    const totalMatchGoals = homeGoals + awayGoals;

    totalGoals += totalMatchGoals;
    if (homeGoals > awayGoals) homeWins++;
    else if (homeGoals === awayGoals) draws++;
    else awayWins++;
    if (homeGoals > 0 && awayGoals > 0) bttsCount++;
    if (totalMatchGoals > 2.5) over25Count++;
    if (awayGoals === 0) homeCleanSheets++;
    if (homeGoals === 0) awayCleanSheets++;
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

// Get upcoming fixtures for all leagues
async function getUpcomingFixtures(daysAhead = 7) {
  console.log(`\n📅 Fetching upcoming fixtures for next ${daysAhead} days...\n`);
  
  const allFixtures = [];
  
  for (const [leagueKey, leagueConfig] of Object.entries(LEAGUES)) {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + daysAhead);
      
      const fromDate = today.toISOString().split('T')[0];
      const toDate = futureDate.toISOString().split('T')[0];
      
      const data = await fetchFromAPI(`fixtures?league=${leagueConfig.id}&season=${leagueConfig.season}&from=${fromDate}&to=${toDate}`);
      
      if (data.response && data.response.length > 0) {
        // Filter for upcoming matches only
        const now = new Date();
        const upcomingMatches = data.response.filter(f => 
          new Date(f.fixture.date) > now && 
          f.fixture.status.short === 'NS' // Not Started
        );
        
        upcomingMatches.forEach(fixture => {
          allFixtures.push({
            fixture,
            leagueKey,
            leagueConfig
          });
        });
        
        console.log(`✅ ${leagueConfig.name}: ${upcomingMatches.length} upcoming matches`);
      }
    } catch (error) {
      console.error(`❌ Error fetching ${leagueKey}:`, error.message);
    }
  }
  
  console.log(`\n📊 Total upcoming matches: ${allFixtures.length}\n`);
  return allFixtures;
}

// Fetch comprehensive match data
async function fetchMatchData(fixture) {
  const homeTeamId = fixture.teams.home.id;
  const awayTeamId = fixture.teams.away.id;
  const leagueId = fixture.league.id;
  const currentSeason = getCurrentSeason();

  console.log(`   Fetching data for ${fixture.teams.home.name} vs ${fixture.teams.away.name}...`);

  try {
    const [
      homeStatsData, awayStatsData, h2hData, predictionsData,
      homeMatchesData, awayMatchesData, standingsData,
      homeSquadData, awaySquadData,
      homeInjuriesData, awayInjuriesData,
      topScorersData, topAssistsData
    ] = await Promise.all([
      fetchFromAPI(`teams/statistics?team=${homeTeamId}&season=${currentSeason}&league=${leagueId}`),
      fetchFromAPI(`teams/statistics?team=${awayTeamId}&season=${currentSeason}&league=${leagueId}`),
      fetchFromAPI(`fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}&last=10`),
      fetchFromAPI(`predictions?fixture=${fixture.fixture.id}`),
      fetchFromAPI(`fixtures?team=${homeTeamId}&season=${currentSeason}&last=20`),
      fetchFromAPI(`fixtures?team=${awayTeamId}&season=${currentSeason}&last=20`),
      fetchFromAPI(`standings?league=${leagueId}&season=${currentSeason}`),
      fetchFromAPI(`players/squads?team=${homeTeamId}`),
      fetchFromAPI(`players/squads?team=${awayTeamId}`),
      fetchFromAPI(`injuries?team=${homeTeamId}&season=${currentSeason}`),
      fetchFromAPI(`injuries?team=${awayTeamId}&season=${currentSeason}`),
      fetchFromAPI(`players/topscorers?league=${leagueId}&season=${currentSeason}`),
      fetchFromAPI(`players/topassists?league=${leagueId}&season=${currentSeason}`)
    ]);

    const [homePlayersData, awayPlayersData] = await Promise.all([
      fetchFromAPI(`players?team=${homeTeamId}&season=${currentSeason}`),
      fetchFromAPI(`players?team=${awayTeamId}&season=${currentSeason}`)
    ]);

    // Extract recent lineups to get CURRENT squad (most reliable during transfer windows)
    const getRecentLineup = (matches, teamId) => {
      if (!matches || matches.length === 0) return null;
      const recentMatch = matches.find(m => m.lineups && m.lineups.length > 0);
      if (!recentMatch) return null;
      const isHome = recentMatch.teams.home.id === teamId;
      const lineup = isHome ? recentMatch.lineups[0] : recentMatch.lineups[1];
      return {
        formation: lineup?.formation || 'N/A',
        startXI: lineup?.startXI || [],
        substitutes: lineup?.substitutes || [],
        matchDate: recentMatch.fixture.date,
        opponent: isHome ? recentMatch.teams.away.name : recentMatch.teams.home.name
      };
    };

    const homeRecentLineup = getRecentLineup(homeMatchesData.response || [], homeTeamId);
    const awayRecentLineup = getRecentLineup(awayMatchesData.response || [], awayTeamId);

    return {
      homeTeamStats: homeStatsData.response || null,
      awayTeamStats: awayStatsData.response || null,
      headToHead: h2hData.response || [],
      predictions: predictionsData.response || [],
      homeRecentMatches: homeMatchesData.response || [],
      awayRecentMatches: awayMatchesData.response || [],
      standings: standingsData.response || [],
      homeSquad: homeSquadData.response || [],
      awaySquad: awaySquadData.response || [],
      homeInjuries: homeInjuriesData.response || [],
      awayInjuries: awayInjuriesData.response || [],
      homePlayers: homePlayersData.response || [],
      awayPlayers: awayPlayersData.response || [],
      leagueTopScorers: topScorersData.response || [],
      leagueTopAssists: topAssistsData.response || [],
      homeRecentLineup: homeRecentLineup,
      awayRecentLineup: awayRecentLineup
    };
  } catch (error) {
    console.error(`   ❌ Error fetching match data:`, error.message);
    throw error;
  }
}

// Generate league statistics
async function getLeagueStats(leagueKey, leagueConfig) {
  try {
    const data = await fetchFromAPI(`fixtures?league=${leagueConfig.id}&season=${leagueConfig.season}&last=100`);
    
    if (!data.response || data.response.length === 0) {
      return null;
    }

    const stats = calculateLeagueStats(data.response);
    
    if (!stats) {
      return null;
    }

    return {
      league: leagueConfig.name,
      season: leagueConfig.season,
      stats,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error fetching league stats for ${leagueKey}:`, error.message);
    return null;
  }
}

// Generate AI prediction with retry logic
async function generatePrediction(fixture, matchData, leagueStatsData, retryCount = 0) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 5000; // 5 seconds base delay
  
  // Extract team IDs for reference
  const homeTeamId = fixture.teams.home.id;
  const awayTeamId = fixture.teams.away.id;
  
  // Extract key players
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
🔄 CURRENT SQUAD - RECENT MATCH LINEUPS
════════════════════════════════════════════════════════════════

IMPORTANT: Use this data to identify CURRENT playing squad (most reliable during transfer windows)

${matchData.homeRecentLineup ? `
🏠 ${fixture.teams.home.name} - Last Match Lineup:
   Formation: ${matchData.homeRecentLineup.formation}
   Match: vs ${matchData.homeRecentLineup.opponent} (${new Date(matchData.homeRecentLineup.matchDate).toLocaleDateString()})
   Starting XI: ${matchData.homeRecentLineup.startXI?.map(p => p.player.name).slice(0, 11).join(', ') || 'Not available'}
   
   ⚠️  CRITICAL: Only reference players from this recent lineup - they are confirmed current squad members
` : `🏠 ${fixture.teams.home.name} - Recent lineup data not available`}

${matchData.awayRecentLineup ? `
✈️ ${fixture.teams.away.name} - Last Match Lineup:
   Formation: ${matchData.awayRecentLineup.formation}
   Match: vs ${matchData.awayRecentLineup.opponent} (${new Date(matchData.awayRecentLineup.matchDate).toLocaleDateString()})
   Starting XI: ${matchData.awayRecentLineup.startXI?.map(p => p.player.name).slice(0, 11).join(', ') || 'Not available'}
   
   ⚠️  CRITICAL: Only reference players from this recent lineup - they are confirmed current squad members
` : `✈️ ${fixture.teams.away.name} - Recent lineup data not available`}

NOTE: Season player statistics (above) may include transferred players. ALWAYS cross-reference 
with recent lineups before mentioning specific players. If a player isn't in the recent lineup, 
they may have transferred - focus on tactical analysis instead of naming unavailable players.

════════════════════════════════════════════════════════════════
COMPREHENSIVE DATA FOR ANALYSIS
════════════════════════════════════════════════════════════════

📊 TEAM STATISTICS (Current Season):
Home Team: ${fixture.teams.home.name}
- Form: ${matchData.homeRecentMatches?.slice(0, 5).map(m => {
  const homeGoals = m.teams.home.id === homeTeamId ? m.goals.home : m.goals.away;
  const awayGoals = m.teams.home.id === homeTeamId ? m.goals.away : m.goals.home;
  return homeGoals > awayGoals ? 'W' : homeGoals === awayGoals ? 'D' : 'L';
}).join(' ') || 'N/A'}
- Recent Scorelines: ${matchData.homeRecentMatches?.slice(0, 5).map(m => {
  const isHome = m.teams.home.id === homeTeamId;
  const teamGoals = isHome ? m.goals.home : m.goals.away;
  const oppGoals = isHome ? m.goals.away : m.goals.home;
  return `${teamGoals}-${oppGoals}`;
}).join(', ') || 'N/A'}
- Home Record: ${matchData.homeTeamStats?.fixtures?.wins?.home || 0}W-${matchData.homeTeamStats?.fixtures?.draws?.home || 0}D-${matchData.homeTeamStats?.fixtures?.loses?.home || 0}L
- Goals Scored (Home): ${matchData.homeTeamStats?.goals?.for?.average?.home || 'N/A'} avg (${matchData.homeTeamStats?.goals?.for?.total?.home || 0} total)
- Goals Conceded (Home): ${matchData.homeTeamStats?.goals?.against?.average?.home || 'N/A'} avg (${matchData.homeTeamStats?.goals?.against?.total?.home || 0} total)
- Biggest Win (Home): ${matchData.homeTeamStats?.biggest?.wins?.home || 'N/A'}
- Biggest Loss (Home): ${matchData.homeTeamStats?.biggest?.loses?.home || 'N/A'}

Away Team: ${fixture.teams.away.name}
- Form: ${matchData.awayRecentMatches?.slice(0, 5).map(m => {
  const awayId = m.teams.away.id;
  const teamGoals = awayId === awayTeamId ? m.goals.away : m.goals.home;
  const oppGoals = awayId === awayTeamId ? m.goals.home : m.goals.away;
  return teamGoals > oppGoals ? 'W' : teamGoals === oppGoals ? 'D' : 'L';
}).join(' ') || 'N/A'}
- Recent Scorelines: ${matchData.awayRecentMatches?.slice(0, 5).map(m => {
  const isAway = m.teams.away.id === awayTeamId;
  const teamGoals = isAway ? m.goals.away : m.goals.home;
  const oppGoals = isAway ? m.goals.home : m.goals.away;
  return `${teamGoals}-${oppGoals}`;
}).join(', ') || 'N/A'}
- Away Record: ${matchData.awayTeamStats?.fixtures?.wins?.away || 0}W-${matchData.awayTeamStats?.fixtures?.draws?.away || 0}D-${matchData.awayTeamStats?.fixtures?.loses?.away || 0}L
- Goals Scored (Away): ${matchData.awayTeamStats?.goals?.for?.average?.away || 'N/A'} avg (${matchData.awayTeamStats?.goals?.for?.total?.away || 0} total)
- Goals Conceded (Away): ${matchData.awayTeamStats?.goals?.against?.average?.away || 'N/A'} avg (${matchData.awayTeamStats?.goals?.against?.total?.away || 0} total)
- Biggest Win (Away): ${matchData.awayTeamStats?.biggest?.wins?.away || 'N/A'}
- Biggest Loss (Away): ${matchData.awayTeamStats?.biggest?.loses?.away || 'N/A'}

🤝 HEAD-TO-HEAD (Last 5 meetings):
${matchData.headToHead?.slice(0, 5).map(h2h => 
  `${h2h.teams.home.name} ${h2h.goals.home}-${h2h.goals.away} ${h2h.teams.away.name} (${new Date(h2h.fixture.date).toLocaleDateString()})`
).join('\n') || 'No recent H2H data'}

🏥 INJURIES & SUSPENSIONS:
Home: ${matchData.homeInjuries?.length > 0 ? matchData.homeInjuries.map(inj => `${inj.player.name} (${inj.player.reason})`).join(', ') : 'None reported'}
Away: ${matchData.awayInjuries?.length > 0 ? matchData.awayInjuries.map(inj => `${inj.player.name} (${inj.player.reason})`).join(', ') : 'None reported'}

📊 LEAGUE STANDINGS & CONTEXT:
${matchData.standings?.[0]?.league?.standings?.[0] ? (() => {
  const table = matchData.standings[0].league.standings[0];
  const homeTeam = table.find(t => t.team.id === homeTeamId);
  const awayTeam = table.find(t => t.team.id === awayTeamId);
  
  let standingsInfo = '';
  
  if (homeTeam && awayTeam) {
    standingsInfo += `
${fixture.teams.home.name}: Position ${homeTeam.rank}/${table.length}
   • Points: ${homeTeam.points} | W:${homeTeam.all.win} D:${homeTeam.all.draw} L:${homeTeam.all.lose}
   • Goal Difference: ${homeTeam.goalsDiff > 0 ? '+' : ''}${homeTeam.goalsDiff}
   • Form: ${homeTeam.form || 'N/A'}
   • Last Update: ${homeTeam.update || 'N/A'}

${fixture.teams.away.name}: Position ${awayTeam.rank}/${table.length}
   • Points: ${awayTeam.points} | W:${awayTeam.all.win} D:${awayTeam.all.draw} L:${awayTeam.all.lose}
   • Goal Difference: ${awayTeam.goalsDiff > 0 ? '+' : ''}${awayTeam.goalsDiff}
   • Form: ${awayTeam.form || 'N/A'}
   • Last Update: ${awayTeam.update || 'N/A'}

Position Gap: ${Math.abs(homeTeam.rank - awayTeam.rank)} places
Points Gap: ${Math.abs(homeTeam.points - awayTeam.points)} points

WHAT'S AT STAKE:
`;
    
    // Determine what's at stake based on position
    const analyzeStake = (team, rank) => {
      if (rank <= 4) return `${team} fighting for Champions League qualification (Top 4)`;
      if (rank <= 7) return `${team} competing for Europa League spots (5th-7th)`;
      if (rank >= table.length - 3) return `${team} in RELEGATION BATTLE - every point crucial`;
      if (rank >= table.length - 5) return `${team} fighting to avoid relegation zone`;
      return `${team} mid-table - positioning important`;
    };
    
    standingsInfo += `- Home: ${analyzeStake(fixture.teams.home.name, homeTeam.rank)}
- Away: ${analyzeStake(fixture.teams.away.name, awayTeam.rank)}
- Pressure Level: ${Math.abs(homeTeam.rank - awayTeam.rank) > 10 ? 'HIGH (big gap in quality)' : 
                   (homeTeam.rank <= 4 || awayTeam.rank <= 4) ? 'HIGH (European race)' :
                   (homeTeam.rank >= table.length - 5 || awayTeam.rank >= table.length - 5) ? 'VERY HIGH (relegation threat)' :
                   'MODERATE (mid-table clash)'}
`;
  } else {
    standingsInfo = 'Full standings data not available - teams in competitive league positions';
  }
  
  return standingsInfo;
})() : 'League standings data not available for this match.'}

🎯 CONTEXT-SPECIFIC ANALYSIS REQUIREMENTS:
- Relegation battles → Teams more defensive, cautious, fighting for survival
- Champions League race → High pressure, need to win, more attacking intent
- Big position gap → Favorite should dominate, expect wider margin
- Close positions → Evenly matched, tighter game expected
- Mid-table security → Less pressure, more open game possible

════════════════════════════════════════════════════════════════
🎯 CRITICAL SCORELINE PREDICTION INSTRUCTIONS
════════════════════════════════════════════════════════════════

ANALYZE SCORING PATTERNS:
- Review recent scorelines (NOT just form letters)
- High-scoring teams (3+ goals avg) → Predict higher scorelines (3-1, 3-2, 4-1)
- Defensive teams (<1.5 goals avg) → Predict lower scorelines (1-0, 0-0, 1-1)
- Mismatched teams (table position gap >10) → Predict wider margins (3-0, 4-1)
- Evenly matched → Predict close games (2-2, 1-1, 2-1)

USE STANDINGS CONTEXT:
- Champions League chasers (Top 4 battle) → More attacking, need wins
- Europa League race (5th-7th) → Competitive, balanced approach
- Relegation battle (Bottom 3-5) → VERY defensive, cagey games
- Mid-table safety → More freedom to attack, potentially higher scoring
- Position gap >10 places → Expect quality gap to show (wider margins)

COMPARE TO LEAGUE AVERAGE:
- League avg goals/game: ${leagueStatsData?.stats?.goalsPerGame || '2.7'}
- If BOTH teams score >league avg → High-scoring game likely
- If BOTH teams concede <league avg → Low-scoring game likely

AVOID GENERIC PREDICTIONS:
- Do NOT default to 2-1 or 1-2 for every match
- Base scoreline on ACTUAL team statistics AND league position pressure
- Vary predictions based on match context
- Be bold when data supports it (don't play it safe)

EXAMPLES OF GOOD VARIANCE:
- Man City (1st, 3.2 goals/game) vs Southampton (20th, 0.8 goals/game) → 4-0 or 3-1
- Two relegation teams (both <1.2 goals/game, bottom 3) → 1-0 or 0-0 (desperate for points)
- Two attacking teams in European race (both >2.5 goals/game) → 3-2 or 4-2
- Evenly matched mid-table (both positions 8-12) → 2-1, 1-1, or 2-2

════════════════════════════════════════════════════════════════
REQUIRED ANALYSIS FRAMEWORK
════════════════════════════════════════════════════════════════

Based on this data, provide a professional 12-section analysis:

1. EXECUTIVE SUMMARY - Match outcome prediction, SPECIFIC scoreline (not generic 2-1), confidence %
2. TACTICAL ANALYSIS - Formations (use recent lineup formations), tactical approach, key battles
3. KEY PLAYERS - ⚠️ CRITICAL: ONLY mention players from recent match lineups (CURRENT SQUAD section above). Do NOT mention players from season stats who aren't in recent lineups - they may have transferred. Focus on tactical roles rather than specific unavailable players.
4. TEAM FORM - Recent results, momentum, scoring/conceding patterns
5. LEAGUE POSITION & STAKES - CRITICAL: Analyze current standings, position gap, what each team is fighting for (Champions League/Europa/Relegation/Mid-table), how pressure affects approach
6. HEAD-TO-HEAD - Historical patterns, typical scorelines
7. INJURY IMPACT - Key absences, how they affect tactics
8. STATISTICAL PROBABILITIES - Over/Under, BTTS, Clean sheets (compare to league avg)
9. GOALS BY TIME - When teams score/concede most
10. ATTACK VS DEFENSE - Offensive threat vs defensive solidity, expected goals
11. RISK FACTORS - Variables that could change outcome
12. FINAL VERDICT - JUSTIFIED predicted score based on: (a) actual scoring patterns, (b) standings pressure/motivation, (c) quality gap shown by league position. Vary from 0-0 to 5-2 based on data. Include betting recommendations and confidence rating.

SCORELINE REQUIREMENT: Your predicted scoreline MUST consider BOTH statistical data AND league position context:
- Recent scorelines of both teams
- Average goals scored/conceded
- H2H scoring patterns
- Tactical approach (attacking vs defensive)
- **LEAGUE POSITION PRESSURE** (Champions League chase = attacking, relegation battle = defensive, big gap = wider margin)
- Then predict a scoreline that MATCHES this complete analysis

Be specific with numbers, percentages, and probabilities. Always reference league position and what's at stake.`;

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{ role: 'user', content: predictionPrompt }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });

    const predictionText = response.data.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');

    return predictionText;
    
  } catch (error) {
    // Handle rate limit errors with exponential backoff
    if (error.response?.status === 429 && retryCount < MAX_RETRIES) {
      const retryDelay = BASE_DELAY * Math.pow(2, retryCount); // Exponential backoff
      console.log(`   ⚠️  Rate limit hit. Retrying in ${retryDelay/1000}s... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return generatePrediction(fixture, matchData, leagueStatsData, retryCount + 1);
    }
    
    console.error('Error generating AI prediction:', error.message);
    throw error;
  }
}

module.exports = {
  getUpcomingFixtures,
  fetchMatchData,
  getLeagueStats,
  generatePrediction,
  LEAGUES
};