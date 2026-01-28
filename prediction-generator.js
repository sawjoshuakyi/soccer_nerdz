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

    // Filter player stats to only include those in the current squad
    const filterPlayersBySquad = (players, squadList) => {
      const validSquadIds = new Set((squadList || []).flatMap(sq => sq.players ? sq.players.map(pl => pl.id) : [sq.id]));
      return (players || []).filter(p => validSquadIds.has(p.player.id));
    };

    const filteredHomePlayers = filterPlayersBySquad(homePlayersData.response, homeSquadData.response);
    const filteredAwayPlayers = filterPlayersBySquad(awayPlayersData.response, awaySquadData.response);

    // Extract top 5 by FIFA stats for display and analysis
    function extractFifaStats(player) {
      return {
        name: player.name,
        position: player.position || 'Unknown',
        pace: player.pace !== undefined ? player.pace : 'N/A',
        shot: player.shot !== undefined ? player.shot : 'N/A',
        pass: player.pass !== undefined ? player.pass : 'N/A',
        dribble: player.dribble !== undefined ? player.dribble : 'N/A',
        def: player.def !== undefined ? player.def : 'N/A',
        physical: player.physical !== undefined ? player.physical : 'N/A',
        rating: typeof player.rating === 'number' && !isNaN(player.rating) ? player.rating.toFixed(2) : 'N/A'
      };
    }

    const homeFifaStats = (homeSquadData.response || []).slice(0, 11).map(extractFifaStats);
    const awayFifaStats = (awaySquadData.response || []).slice(0, 11).map(extractFifaStats);

    // Extract PREDICTED lineups for upcoming match (MOST IMPORTANT!)
    const extractPredictedLineup = (predictionsData) => {
      if (!predictionsData || !predictionsData[0]) return null;
      const prediction = predictionsData[0];
      return {
        homeFormation: prediction.predictions?.lineup?.home,
        awayFormation: prediction.predictions?.lineup?.away,
        advice: prediction.predictions?.advice,
        winPercentage: {
          home: prediction.predictions?.percent?.home,
          draw: prediction.predictions?.percent?.draw,
          away: prediction.predictions?.percent?.away
        }
      };
    };

    const predictedLineups = extractPredictedLineup(predictionsData.response || []);

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
      homePlayers: filteredHomePlayers,
      awayPlayers: filteredAwayPlayers,
      leagueTopScorers: topScorersData.response || [],
      leagueTopAssists: topAssistsData.response || [],
      predictedLineups: predictedLineups,
      homeFifaStats: homeFifaStats,
      awayFifaStats: awayFifaStats
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
  
  // Use backend squad+stats output for analysis
  const homeTopScorers = (matchData.homeSquad || []).filter(p => p.goals > 0 || p.assists > 0 || (typeof p.rating === 'number' && !isNaN(p.rating))).slice(0, 5).map(p => ({
    name: p.name,
    position: p.position || 'Unknown',
    goals: p.goals || 0,
    assists: p.assists || 0,
    rating: typeof p.rating === 'number' && !isNaN(p.rating) ? p.rating.toFixed(2) : 'N/A'
  }));

  const awayTopScorers = (matchData.awaySquad || []).filter(p => p.goals > 0 || p.assists > 0 || (typeof p.rating === 'number' && !isNaN(p.rating))).slice(0, 5).map(p => ({
    name: p.name,
    position: p.position || 'Unknown',
    goals: p.goals || 0,
    assists: p.assists || 0,
    rating: typeof p.rating === 'number' && !isNaN(p.rating) ? p.rating.toFixed(2) : 'N/A'
  }));

  const predictionPrompt = `You are an elite professional soccer prediction analyst for a top-tier sports analytics firm. Generate a comprehensive match prediction with professional-grade depth and accuracy using ALL available data.

For each starting player, compare their FIFA-style stats (Pace, Shot, Pass, Dribble, Def, Physical) to their direct opponent in the opposing lineup. Highlight any clear mismatches or advantages in these attributes. Use these comparisons to inform your tactical and personnel analysis.

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

Use these league averages to contextualize team performance. Teams performing above/below these benchmarks are significant.` : 'League statistics not available for this match.'}

════════════════════════════════════════════════════════════════
⭐ KEY PLAYERS & PERSONNEL TO WATCH
════════════════════════════════════════════════════════════════

🏠 ${fixture.teams.home.name} - STARTING XI FIFA STATS:
${matchData.homeFifaStats.map((p, i) => `   • ${p.name} (${p.position}) - Pace: ${p.pace}, Shot: ${p.shot}, Pass: ${p.pass}, Dribble: ${p.dribble}, Def: ${p.def}, Physical: ${p.physical}, Rating: ${p.rating}
      vs ${matchData.awayFifaStats[i] ? `${matchData.awayFifaStats[i].name} (${matchData.awayFifaStats[i].position}) - Pace: ${matchData.awayFifaStats[i].pace}, Shot: ${matchData.awayFifaStats[i].shot}, Pass: ${matchData.awayFifaStats[i].pass}, Dribble: ${matchData.awayFifaStats[i].dribble}, Def: ${matchData.awayFifaStats[i].def}, Physical: ${matchData.awayFifaStats[i].physical}, Rating: ${matchData.awayFifaStats[i].rating}` : 'No direct opponent'}
`).join('\n')}

✈️ ${fixture.teams.away.name} - STARTING XI FIFA STATS:
${matchData.awayFifaStats.map((p, i) => `   • ${p.name} (${p.position}) - Pace: ${p.pace}, Shot: ${p.shot}, Pass: ${p.pass}, Dribble: ${p.dribble}, Def: ${p.def}, Physical: ${p.physical}, Rating: ${p.rating}
      vs ${matchData.homeFifaStats[i] ? `${matchData.homeFifaStats[i].name} (${matchData.homeFifaStats[i].position}) - Pace: ${matchData.homeFifaStats[i].pace}, Shot: ${matchData.homeFifaStats[i].shot}, Pass: ${matchData.homeFifaStats[i].pass}, Dribble: ${matchData.homeFifaStats[i].dribble}, Def: ${matchData.homeFifaStats[i].def}, Physical: ${matchData.homeFifaStats[i].physical}, Rating: ${matchData.homeFifaStats[i].rating}` : 'No direct opponent'}
`).join('\n')}

════════════════════════════════════════════════════════════════
⚽ PREDICTED LINEUPS FOR THIS MATCH (UPCOMING GAME)
════════════════════════════════════════════════════════════════

🎯 THIS IS THE MOST IMPORTANT SECTION - USE THIS FOR YOUR ANALYSIS!

${matchData.predictedLineups ? `
PREDICTED FORMATIONS:
🏠 ${fixture.teams.home.name}: ${matchData.predictedLineups.homeFormation}
✈️ ${fixture.teams.away.name}: ${matchData.predictedLineups.awayFormation}

API PREDICTION CONFIDENCE:
- Home Win: ${matchData.predictedLineups.winPercentage.home}%
- Draw: ${matchData.predictedLineups.winPercentage.draw}%
- Away Win: ${matchData.predictedLineups.winPercentage.away}%

EXPERT ADVICE: ${matchData.predictedLineups.advice}

⚠️  CRITICAL INSTRUCTIONS FOR YOUR ANALYSIS:
1. Use these PREDICTED formations in your tactical analysis
2. These are the expected lineups for the UPCOMING match
3. Cross-reference with injuries - if key player is injured, formation may adjust
4. Base your KEY PLAYERS section on who is EXPECTED to play (from this prediction)
5. Your formation diagram should match these predicted formations
` : `
⚠️  API PREDICTED LINEUPS NOT YET AVAILABLE FOR THIS MATCH

This can happen when:
- Match is >5 days away (predictions generated 2-3 days before match)
- Match is <2 hours away (too close to kickoff)
- API data not yet updated

FALLBACK - USE RECENT MATCH FORMATIONS:
🏠 ${fixture.teams.home.name}: ${matchData.homeRecentLineup?.formation || 'Formation data unavailable'}
✈️ ${fixture.teams.away.name}: ${matchData.awayRecentLineup?.formation || 'Formation data unavailable'}

⚠️  CRITICAL INSTRUCTIONS:
1. Use these RECENT formations as baseline for your tactical analysis
2. Note that these are from last match, not specifically predicted for this game
3. Teams may adjust formation based on opponent, injuries, or tactical preference
4. Cross-reference with injuries to anticipate likely changes
5. Mention in your analysis that formations are based on recent matches
`}

// ...existing prompt continues...
`;

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