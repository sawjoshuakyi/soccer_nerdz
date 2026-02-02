/**
 * ═══════════════════════════════════════════════════════════════
 * PROFESSIONAL ANALYST PROMPT TEMPLATE
 * ═══════════════════════════════════════════════════════════════
 * Data-driven, risk-aware analysis following strict professional standards
 *
 * OUTPUT STRUCTURE:
 * 1. Model Signal Summary
 * 2. Team-Level Statistical Profile
 * 3. Player & Unit-Level Analysis
 * 4. Key Matchup Dynamics
 * 5. Risk & Fragility Assessment
 * 6. Contextual Flags
 * 7. Confidence Framing
 */

const ANALYST_SYSTEM_PROMPT = `You are a senior professional football (soccer) performance analyst operating in a quantitative, data-driven environment.

Your role is to interpret structured team-level and player-level data to assess competitive dynamics.
You do NOT act as a scout, pundit, or bettor.
You do NOT speculate beyond the provided data.

────────────────────────
ROLE CONSTRAINTS
────────────────────────
- You do NOT generate predictions from intuition or football knowledge.
- You do NOT invent statistics, trends, player traits, or narratives.
- You ONLY analyze and interpret the data explicitly provided.
- You treat all model outputs as probabilistic signals, not certainties.
- You remain neutral, analytical, and risk-aware at all times.
- You do NOT assign subjective player quality labels (e.g., "elite", "poor") unless derived from metrics.

────────────────────────
DATA CONSTRAINTS
────────────────────────
- You may reference ONLY the structured inputs provided.
- If a metric, player stat, or matchup data point is missing, you must explicitly state that it is unavailable.
- You must never assume:
  - Player availability
  - Tactical roles
  - Form, motivation, or fatigue
  - Historical performance beyond the supplied dataset
- You may NOT use general football knowledge or memory.

────────────────────────
ANALYSIS RULES
────────────────────────
- Every conclusion MUST be explicitly tied to at least one numeric or categorical signal.
- You MUST explain WHY each signal matters in footballing terms.
- You MUST identify both strengths AND vulnerabilities in:
  - Team-level signals
  - Player-level contributions
- You MUST avoid absolute language ("will", "guaranteed", "certain").
- You MUST explicitly highlight uncertainty, variance, and downside risk.
- You MUST separate:
  - Observations
  - Interpretations
  - Confidence framing

────────────────────────
PLAYER-LEVEL ANALYSIS RULES
────────────────────────
- You may analyze ONLY players included in the provided squad data.
- You must evaluate players strictly through:
  - Usage (appearances, starts)
  - Output (goals, assists, shots, key passes)
  - Efficiency (accuracy %, duels won, saves)
  - Discipline and availability risk (cards, suspensions)
- You must NOT infer roles (e.g., "playmaker", "ball-winner") unless directly supported by metrics.
- Individual player analysis must roll up into:
  - Positional unit analysis (GK / DEF / MID / ATT)
  - Team-level impact, not isolated opinions.

────────────────────────
MATCHUP ANALYSIS RULES
────────────────────────
- Matchups must be analyzed ONLY where comparative data exists.
- You must describe matchups in terms of:
  - Statistical advantages
  - Volume vs efficiency
  - Stability vs volatility
- If a matchup lacks sufficient data, you must state that explicitly.
- You may NOT simulate in-game tactics or formations unless provided.

────────────────────────
MANDATORY OUTPUT STRUCTURE
────────────────────────
Your response MUST follow this structure EXACTLY:

1. Model Signal Summary
   - Key probabilistic outputs (win %, goal metrics, indices)
   - Clear indication of strongest and weakest signals

2. Team-Level Statistical Profile
   - Season and recent-form indicators
   - Offensive and defensive balance
   - Home vs away splits where applicable

3. Player & Unit-Level Analysis
   - Goalkeeper unit assessment
   - Defensive unit assessment
   - Midfield unit assessment
   - Attacking unit assessment
   - Each subsection must reference specific player metrics

4. Key Matchup Dynamics
   - Stat-supported advantages or pressures
   - Identification of contested or fragile areas
   - Explicit acknowledgment of unknowns

5. Risk & Fragility Assessment
   - Where model confidence may be overstated
   - Small margins, variance drivers, missing variables

6. Match Incentive Analysis
   - League position context (title race, European spots, relegation battle)
   - Points gap to key positions (above and below)
   - Upcoming fixture difficulty and importance
   - Cup competitions or continental commitments
   - Motivation level assessment for each team
   - Potential for rotation or prioritization of other matches

7. Contextual Flags (If Provided)
   - Injuries, suspensions, rest, venue
   - Fixture congestion and fatigue indicators
   - Rotation risk assessment (upcoming important matches)
   - Schedule density impact on team selection
   - Directional impact ONLY unless quantified

8. Confidence Framing (Non-Predictive)
   - Confidence level: LOW / MODERATE / HIGH
   - Justification rooted in data completeness and signal alignment
   - Reinforcement of probabilistic uncertainty

────────────────────────
LANGUAGE CONSTRAINTS
────────────────────────
- Use precise, professional, analytical language.
- Avoid hype, narrative storytelling, or fan-oriented tone.
- Avoid betting recommendations unless explicitly instructed.
- Avoid speculative tactical or stylistic claims.

────────────────────────
FAIL-SAFE RULE
────────────────────────
If the provided data is insufficient to support a meaningful professional analysis, you MUST state:

"Insufficient data to produce a reliable professional analysis."

────────────────────────
PRIMARY OBJECTIVE
────────────────────────
Produce analysis suitable for:
- Internal decision-making
- Professional analytics reports
- Data dashboards
- Client-facing technical summaries

Accuracy, restraint, traceability, and clarity are prioritized over creativity.`;

/**
 * Build the data section of the prompt with all calculated metrics
 * @param {Object} fixture - Match fixture details
 * @param {Object} matchData - Comprehensive match data
 * @param {Object} scorelineAnalysis - Output from ScorelineCalculator
 * @param {Object} leagueStats - League-wide statistics
 * @returns {string} Formatted data section
 */
function buildDataSection(fixture, matchData, scorelineAnalysis, leagueStats) {
  const homeTeam = fixture.teams.home.name;
  const awayTeam = fixture.teams.away.name;
  const league = fixture.league.name;
  const matchDate = new Date(fixture.fixture.date).toLocaleString();

  return `
═══════════════════════════════════════════════════════════════
MATCH CONTEXT
═══════════════════════════════════════════════════════════════
Competition: ${league}
Match: ${homeTeam} vs ${awayTeam}
Date: ${matchDate}
Venue: ${fixture.fixture.venue?.name || 'TBD'}

${buildModelSignalsSection(scorelineAnalysis, matchData)}
${buildStandingsSection(matchData)}
${buildFormSection(matchData)}
${buildMatchIncentiveSection(matchData, fixture)}
${buildPlayerQualitySection(matchData, scorelineAnalysis)}
${buildInjurySection(matchData, scorelineAnalysis)}
${buildFixtureCongestionSection(matchData)}
${buildH2HSection(matchData)}
${buildLeagueContextSection(leagueStats)}
`;
}

/**
 * Build model signals section with calculated metrics
 */
function buildModelSignalsSection(scorelineAnalysis, matchData) {
  if (!scorelineAnalysis) {
    return `
═══════════════════════════════════════════════════════════════
MODEL SIGNALS
═══════════════════════════════════════════════════════════════
⚠️ Scoreline analysis not available`;
  }

  const { xG, predictions, confidence, goalDistribution } = scorelineAnalysis;
  const topScorelines = predictions.topScorelines.slice(0, 6);

  return `
═══════════════════════════════════════════════════════════════
MODEL SIGNALS (Calculated Metrics)
═══════════════════════════════════════════════════════════════

EXPECTED GOALS (xG) MODEL:
├─ Home Team: ${xG.home.final} xG
│  └─ Base: ${xG.home.base} → Adjusted: ${xG.home.adjusted} → Final: ${xG.home.final}
│  └─ Form xG: ${xG.home.formXG}
├─ Away Team: ${xG.away.final} xG
│  └─ Base: ${xG.away.base} → Adjusted: ${xG.away.adjusted} → Final: ${xG.away.final}
│  └─ Form xG: ${xG.away.formXG}
├─ xG Delta: ${xG.delta} (positive = home advantage)
└─ Total Expected Goals: ${xG.totalExpected}

OUTCOME PROBABILITIES (Poisson Distribution Model):
├─ Home Win: ${predictions.outcomes.homeWin}%
├─ Draw: ${predictions.outcomes.draw}%
├─ Away Win: ${predictions.outcomes.awayWin}%
└─ Margin: ${Math.abs(parseFloat(predictions.outcomes.homeWin) - parseFloat(predictions.outcomes.awayWin)).toFixed(1)}% differential

MOST LIKELY SCORELINES (Top 6):
${topScorelines.map((s, i) => `  ${i + 1}. ${s.score} → ${s.percentageStr} probability`).join('\n')}

GOALS MARKETS:
├─ BTTS (Both Teams To Score): ${predictions.btts.probability}%
│  └─ Home scores: ${predictions.btts.homeScoresProb}% | Away scores: ${predictions.btts.awayScoresProb}%
├─ Over 1.5 Goals: ${predictions.overUnder.over15}%
├─ Over 2.5 Goals: ${predictions.overUnder.over25}%
├─ Over 3.5 Goals: ${predictions.overUnder.over35}%
└─ Under 2.5 Goals: ${predictions.overUnder.under25}%

MODEL CONFIDENCE ASSESSMENT:
├─ Score: ${confidence.percentage}
├─ Level: ${confidence.level}
└─ Interpretation: ${confidence.level === 'HIGH' ? 'Strong data support, reliable signals' : confidence.level === 'LOW' ? 'Limited data, interpret with caution' : 'Moderate support, consider variance'}`;
}

/**
 * Build standings section
 */
function buildStandingsSection(matchData) {
  if (!matchData.standings) {
    return `
═══════════════════════════════════════════════════════════════
LEAGUE POSITION
═══════════════════════════════════════════════════════════════
⚠️ Standings data not available`;
  }

  const { home, away } = matchData.standings;
  const positionGap = Math.abs((home?.position || 0) - (away?.position || 0));

  return `
═══════════════════════════════════════════════════════════════
LEAGUE POSITION
═══════════════════════════════════════════════════════════════
HOME TEAM:
├─ Position: ${home?.position || 'N/A'}
├─ Points: ${home?.points || 'N/A'}
├─ Goal Difference: ${home?.goalsDiff || 'N/A'}
└─ Form (last 5): ${home?.form || 'N/A'}

AWAY TEAM:
├─ Position: ${away?.position || 'N/A'}
├─ Points: ${away?.points || 'N/A'}
├─ Goal Difference: ${away?.goalsDiff || 'N/A'}
└─ Form (last 5): ${away?.form || 'N/A'}

POSITION GAP: ${positionGap} places`;
}

/**
 * Build form section with venue splits
 */
function buildFormSection(matchData) {
  const formatMatches = (matchesData) => {
    if (!matchesData || !matchesData.matches || matchesData.matches.length === 0) {
      return '  No recent data available';
    }
    return matchesData.matches.slice(0, 5).map((m, i) =>
      `  ${i + 1}. ${m.result} ${m.venue} vs ${m.opponent} (${m.score})`
    ).join('\n');
  };

  const calculateFormPoints = (matchesData) => {
    if (!matchesData || !matchesData.matches) return 'N/A';
    const matches = matchesData.matches.slice(0, 5);
    let points = 0;
    matches.forEach(m => {
      if (m.result === 'W') points += 3;
      else if (m.result === 'D') points += 1;
    });
    return `${points}/15 pts`;
  };

  return `
═══════════════════════════════════════════════════════════════
RECENT FORM (Last 5 Matches)
═══════════════════════════════════════════════════════════════
HOME TEAM:
${formatMatches(matchData.homeRecentMatches)}
  Form Points: ${calculateFormPoints(matchData.homeRecentMatches)}
  Goals Scored Avg: ${matchData.homeStats?.avgGoalsFor || 'N/A'}
  Goals Conceded Avg: ${matchData.homeStats?.avgGoalsAgainst || 'N/A'}

AWAY TEAM:
${formatMatches(matchData.awayRecentMatches)}
  Form Points: ${calculateFormPoints(matchData.awayRecentMatches)}
  Goals Scored Avg: ${matchData.awayStats?.avgGoalsFor || 'N/A'}
  Goals Conceded Avg: ${matchData.awayStats?.avgGoalsAgainst || 'N/A'}`;
}

/**
 * Build match incentive analysis section
 * Analyzes team motivation based on league position, upcoming fixtures, etc.
 */
function buildMatchIncentiveSection(matchData, fixture) {
  const standings = matchData.standings;
  const fixtureCongestion = matchData.fixtureCongestion;
  const leagueName = fixture?.league?.name || 'Unknown League';
  
  if (!standings || (!standings.home && !standings.away)) {
    return `
═══════════════════════════════════════════════════════════════
MATCH INCENTIVE ANALYSIS
═══════════════════════════════════════════════════════════════
⚠️ Insufficient standings data for incentive analysis`;
  }

  const homePos = standings.home?.position || null;
  const awayPos = standings.away?.position || null;
  const homePoints = standings.home?.points || 0;
  const awayPoints = standings.away?.points || 0;
  const homePlayed = standings.home?.played || 0;
  const awayPlayed = standings.away?.played || 0;
  
  // Calculate points per game for trajectory
  const homePPG = homePlayed > 0 ? (homePoints / homePlayed).toFixed(2) : 'N/A';
  const awayPPG = awayPlayed > 0 ? (awayPoints / awayPlayed).toFixed(2) : 'N/A';
  
  // Determine league context (adjust thresholds based on league)
  const leagueContext = getLeaguePositionContext(leagueName, homePos, awayPos, homePoints, awayPoints);
  
  // Build incentive assessment for each team
  const homeIncentive = assessTeamIncentive(
    'HOME',
    homePos,
    homePoints,
    homePPG,
    standings.home?.form,
    standings.home?.goalsDiff,
    fixtureCongestion?.home,
    leagueContext.home
  );
  
  const awayIncentive = assessTeamIncentive(
    'AWAY',
    awayPos,
    awayPoints,
    awayPPG,
    standings.away?.form,
    standings.away?.goalsDiff,
    fixtureCongestion?.away,
    leagueContext.away
  );

  return `
═══════════════════════════════════════════════════════════════
MATCH INCENTIVE ANALYSIS
═══════════════════════════════════════════════════════════════

HOME TEAM INCENTIVES:
├─ League Position: ${homePos || 'N/A'}
├─ Points: ${homePoints} (${homePPG} PPG)
├─ Position Context: ${homeIncentive.positionContext}
├─ Points Gap Above: ${leagueContext.home.gapAbove !== null ? `${leagueContext.home.gapAbove} pts` : 'N/A (top of table)'}
├─ Points Gap Below: ${leagueContext.home.gapBelow !== null ? `${leagueContext.home.gapBelow} pts` : 'N/A (bottom of table)'}
├─ Motivation Level: ${homeIncentive.motivationLevel}
├─ Key Incentive: ${homeIncentive.keyIncentive}
${homeIncentive.rotationRisk ? `├─ 🔄 Rotation Risk: ${homeIncentive.rotationRisk}` : ''}
└─ Assessment: ${homeIncentive.assessment}

AWAY TEAM INCENTIVES:
├─ League Position: ${awayPos || 'N/A'}
├─ Points: ${awayPoints} (${awayPPG} PPG)
├─ Position Context: ${awayIncentive.positionContext}
├─ Points Gap Above: ${leagueContext.away.gapAbove !== null ? `${leagueContext.away.gapAbove} pts` : 'N/A (top of table)'}
├─ Points Gap Below: ${leagueContext.away.gapBelow !== null ? `${leagueContext.away.gapBelow} pts` : 'N/A (bottom of table)'}
├─ Motivation Level: ${awayIncentive.motivationLevel}
├─ Key Incentive: ${awayIncentive.keyIncentive}
${awayIncentive.rotationRisk ? `├─ 🔄 Rotation Risk: ${awayIncentive.rotationRisk}` : ''}
└─ Assessment: ${awayIncentive.assessment}

INCENTIVE COMPARISON:
├─ Higher Motivation: ${compareMotivation(homeIncentive, awayIncentive)}
├─ Stakes Level: ${getMatchStakesLevel(homeIncentive, awayIncentive)}
└─ Narrative: ${getMatchNarrative(homeIncentive, awayIncentive, leagueContext)}`;
}

/**
 * Get league position context based on league structure
 */
function getLeaguePositionContext(leagueName, homePos, awayPos, homePoints, awayPoints) {
  // Standard thresholds (can be customized per league)
  const config = {
    titleRace: 4,          // Top 4 in title race
    championsLeague: 4,    // Top 4 for CL
    europaLeague: 6,       // 5-6 for EL
    conferenceLeague: 7,   // 7 for ECL
    relegation: 3,         // Bottom 3 relegated
    totalTeams: 20         // Default league size
  };
  
  // Adjust for specific leagues
  if (leagueName.includes('Bundesliga') && !leagueName.includes('2.')) {
    config.totalTeams = 18;
    config.relegation = 2;  // Direct relegation for bottom 2
  } else if (leagueName.includes('Serie A')) {
    config.totalTeams = 20;
    config.relegation = 3;
  } else if (leagueName.includes('La Liga') || leagueName.includes('LaLiga')) {
    config.totalTeams = 20;
    config.relegation = 3;
  } else if (leagueName.includes('Ligue 1')) {
    config.totalTeams = 18;
    config.relegation = 2;
  }
  
  const relegationZone = config.totalTeams - config.relegation + 1;
  
  return {
    home: categorizePosition(homePos, homePoints, config, relegationZone),
    away: categorizePosition(awayPos, awayPoints, config, relegationZone),
    config
  };
}

/**
 * Categorize a team's position context
 */
function categorizePosition(position, points, config, relegationZone) {
  if (!position) return { category: 'unknown', gapAbove: null, gapBelow: null };
  
  let category = 'mid-table';
  let gapAbove = null;
  let gapBelow = null;
  
  if (position === 1) {
    category = 'title_leader';
    gapAbove = null;  // Already at top
  } else if (position <= config.titleRace) {
    category = 'title_race';
  } else if (position <= config.championsLeague) {
    category = 'champions_league_race';
  } else if (position <= config.europaLeague) {
    category = 'europa_league_race';
  } else if (position <= config.conferenceLeague) {
    category = 'conference_league_race';
  } else if (position >= relegationZone) {
    category = 'relegation_zone';
  } else if (position >= relegationZone - 3) {
    category = 'relegation_battle';
  }
  
  // Note: Actual gap calculations would require full standings data
  // These are placeholder values - in real implementation, we'd calculate from full table
  gapAbove = position > 1 ? 'varies' : null;
  gapBelow = position < config.totalTeams ? 'varies' : null;
  
  return { category, gapAbove, gapBelow };
}

/**
 * Assess team incentive based on all available data
 */
function assessTeamIncentive(label, position, points, ppg, form, goalsDiff, congestion, leagueContext) {
  const result = {
    positionContext: 'Unknown',
    motivationLevel: 'MODERATE',
    keyIncentive: 'Standard league points',
    assessment: 'No clear incentive pattern identified',
    rotationRisk: null
  };
  
  if (!position) return result;
  
  // Determine position context description
  switch (leagueContext.category) {
    case 'title_leader':
      result.positionContext = '🏆 TITLE LEADER';
      result.motivationLevel = 'VERY HIGH';
      result.keyIncentive = 'Defending league lead, pursuing championship';
      result.assessment = 'Maximum motivation to maintain advantage at top';
      break;
    case 'title_race':
      result.positionContext = '🏆 TITLE RACE';
      result.motivationLevel = 'VERY HIGH';
      result.keyIncentive = 'Chasing league title, every point crucial';
      result.assessment = 'High-stakes positioning, unlikely to ease off';
      break;
    case 'champions_league_race':
      result.positionContext = '⭐ CHAMPIONS LEAGUE RACE';
      result.motivationLevel = 'HIGH';
      result.keyIncentive = 'Securing top-4 finish for UCL qualification';
      result.assessment = 'Strong financial and competitive incentive';
      break;
    case 'europa_league_race':
      result.positionContext = '🌍 EUROPA LEAGUE RACE';
      result.motivationLevel = 'HIGH';
      result.keyIncentive = 'Pushing for European qualification';
      result.assessment = 'Motivated to secure continental football';
      break;
    case 'conference_league_race':
      result.positionContext = '🏅 CONFERENCE LEAGUE RACE';
      result.motivationLevel = 'MODERATE-HIGH';
      result.keyIncentive = 'European qualification within reach';
      result.assessment = 'European football provides motivation boost';
      break;
    case 'relegation_zone':
      result.positionContext = '🔴 RELEGATION ZONE';
      result.motivationLevel = 'DESPERATE';
      result.keyIncentive = 'Survival - must win to escape drop zone';
      result.assessment = 'Maximum desperation, expect high intensity';
      break;
    case 'relegation_battle':
      result.positionContext = '⚠️ RELEGATION BATTLE';
      result.motivationLevel = 'VERY HIGH';
      result.keyIncentive = 'Staying clear of relegation zone';
      result.assessment = 'Points crucial for survival, high motivation';
      break;
    default:
      result.positionContext = '📊 MID-TABLE';
      result.motivationLevel = 'MODERATE';
      result.keyIncentive = 'General league positioning, pride';
      result.assessment = 'Neither extreme pressure nor lack of motivation';
  }
  
  // Adjust for form
  if (form) {
    const recentWins = (form.match(/W/g) || []).length;
    const recentLosses = (form.match(/L/g) || []).length;
    
    if (recentLosses >= 3) {
      result.assessment += '. Poor recent form may increase urgency';
    } else if (recentWins >= 4) {
      result.assessment += '. Strong form suggests high confidence';
    }
  }
  
  // Check for rotation risk from fixture congestion
  if (congestion) {
    if (congestion.hasBigMatchComing && congestion.daysUntilNextMatch <= 4) {
      const importance = congestion.nextMatchImportance?.replace(/_/g, ' ') || 'important match';
      result.rotationRisk = `HIGH - ${importance} in ${congestion.daysUntilNextMatch} days`;
      result.assessment += `. May rotate key players with ${importance} upcoming`;
      
      // Adjust motivation if prioritizing other competition
      if (congestion.nextMatchImportance?.includes('cup_final') || 
          congestion.nextMatchImportance?.includes('champions_league')) {
        result.motivationLevel = adjustMotivation(result.motivationLevel, -1);
      }
    } else if (congestion.rotationLikelihood === 'high') {
      result.rotationRisk = 'MODERATE - Heavy schedule may force changes';
    } else if (congestion.congestionLevel === 'critical') {
      result.rotationRisk = 'MODERATE - Fixture congestion concerns';
    }
  }
  
  return result;
}

/**
 * Adjust motivation level up or down
 */
function adjustMotivation(current, adjustment) {
  const levels = ['LOW', 'MODERATE', 'MODERATE-HIGH', 'HIGH', 'VERY HIGH', 'DESPERATE'];
  const currentIndex = levels.indexOf(current);
  if (currentIndex === -1) return current;
  const newIndex = Math.max(0, Math.min(levels.length - 1, currentIndex + adjustment));
  return levels[newIndex];
}

/**
 * Compare motivation between teams
 */
function compareMotivation(homeIncentive, awayIncentive) {
  const levels = ['LOW', 'MODERATE', 'MODERATE-HIGH', 'HIGH', 'VERY HIGH', 'DESPERATE'];
  const homeLevel = levels.indexOf(homeIncentive.motivationLevel);
  const awayLevel = levels.indexOf(awayIncentive.motivationLevel);
  
  if (homeLevel > awayLevel + 1) return 'HOME TEAM (significant advantage)';
  if (homeLevel > awayLevel) return 'HOME TEAM (slight advantage)';
  if (awayLevel > homeLevel + 1) return 'AWAY TEAM (significant advantage)';
  if (awayLevel > homeLevel) return 'AWAY TEAM (slight advantage)';
  return 'EVEN - Both teams similarly motivated';
}

/**
 * Determine overall match stakes level
 */
function getMatchStakesLevel(homeIncentive, awayIncentive) {
  const highStakesContexts = ['title_leader', 'title_race', 'relegation_zone', 'relegation_battle'];
  const homeContext = homeIncentive.positionContext.toLowerCase();
  const awayContext = awayIncentive.positionContext.toLowerCase();
  
  const homeHighStakes = highStakesContexts.some(c => homeContext.includes(c.replace('_', ' ')));
  const awayHighStakes = highStakesContexts.some(c => awayContext.includes(c.replace('_', ' ')));
  
  if (homeIncentive.motivationLevel === 'DESPERATE' || awayIncentive.motivationLevel === 'DESPERATE') {
    return '🔥 CRITICAL - Survival implications';
  }
  if (homeHighStakes && awayHighStakes) {
    return '⚡ VERY HIGH - Both teams in key positions';
  }
  if (homeHighStakes || awayHighStakes) {
    return '📈 HIGH - At least one team with major incentive';
  }
  if (homeIncentive.motivationLevel === 'HIGH' || awayIncentive.motivationLevel === 'HIGH') {
    return '📊 MODERATE-HIGH - European race implications';
  }
  return '📋 STANDARD - Routine league fixture';
}

/**
 * Generate match narrative based on incentives
 */
function getMatchNarrative(homeIncentive, awayIncentive, leagueContext) {
  const homeContext = homeIncentive.positionContext;
  const awayContext = awayIncentive.positionContext;
  
  // Title clash
  if (homeContext.includes('TITLE') && awayContext.includes('TITLE')) {
    return 'Title showdown - both teams fighting for the championship';
  }
  
  // Relegation battle
  if (homeContext.includes('RELEGATION') && awayContext.includes('RELEGATION')) {
    return 'Relegation six-pointer - loser faces increased drop danger';
  }
  
  // Title vs Relegation
  if (homeContext.includes('TITLE') && awayContext.includes('RELEGATION')) {
    return 'David vs Goliath - league leaders face desperate strugglers';
  }
  if (awayContext.includes('TITLE') && homeContext.includes('RELEGATION')) {
    return 'David vs Goliath - strugglers host title challengers';
  }
  
  // European race
  if (homeContext.includes('CHAMPIONS') || awayContext.includes('CHAMPIONS') ||
      homeContext.includes('EUROPA') || awayContext.includes('EUROPA')) {
    return 'European race implications - valuable points for continental qualification';
  }
  
  // Mixed stakes
  if (homeIncentive.rotationRisk || awayIncentive.rotationRisk) {
    return 'Rotation risk present - team selections may reflect broader priorities';
  }
  
  return 'Standard league encounter with routine positional implications';
}

/**
 * Build player quality section with all positional units
 */
function buildPlayerQualitySection(matchData, scorelineAnalysis) {
  const formatTopPlayers = (squad, position, limit = 3) => {
    if (!squad || squad.length === 0) return '  No data available';
    const filtered = squad
      .filter(p => p.position === position)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, limit);
    if (filtered.length === 0) return '  No players in this position';
    return filtered.map(p =>
      `  • ${p.name} (Rating: ${p.rating?.toFixed(2) || 'N/A'}, Apps: ${p.appearances || 0}, G: ${p.goals || 0}, A: ${p.assists || 0})`
    ).join('\n');
  };

  const formatGoalkeepers = (squad) => {
    if (!squad || squad.length === 0) return '  No data available';
    const goalkeepers = squad
      .filter(p => p.position === 'Goalkeeper')
      .sort((a, b) => (b.appearances || 0) - (a.appearances || 0));
    if (goalkeepers.length === 0) return '  No goalkeepers in squad data';
    return goalkeepers.map(gk => {
      const savePercentage = gk.saves && gk.conceded 
        ? ((gk.saves / (gk.saves + gk.conceded)) * 100).toFixed(1) 
        : 'N/A';
      return `  • ${gk.name} (Rating: ${gk.rating?.toFixed(2) || 'N/A'}, Apps: ${gk.appearances || 0}, Saves: ${gk.saves || 0}, Conceded: ${gk.conceded || 0}, Save%: ${savePercentage}%)`;
    }).join('\n');
  };

  const formatMidfielders = (squad, limit = 4) => {
    if (!squad || squad.length === 0) return '  No data available';
    const midfielders = squad
      .filter(p => p.position === 'Midfielder')
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, limit);
    if (midfielders.length === 0) return '  No midfielders in squad data';
    return midfielders.map(p =>
      `  • ${p.name} (Rating: ${p.rating?.toFixed(2) || 'N/A'}, Apps: ${p.appearances || 0}, G: ${p.goals || 0}, A: ${p.assists || 0}, Key Passes: ${p.keyPasses || 0})`
    ).join('\n');
  };

  const pq = scorelineAnalysis?.playerQuality || {};

  return `
═══════════════════════════════════════════════════════════════
PLAYER QUALITY COMPARISON
═══════════════════════════════════════════════════════════════

HOME TEAM GOALKEEPERS:
${formatGoalkeepers(matchData.homeSquad)}

HOME TEAM DEFENDERS (Top 3 by rating):
${formatTopPlayers(matchData.homeSquad, 'Defender')}
  🛡️ Defense Rating: ${pq.home?.defenseRating || 'N/A'}
  🛡️ Elite Defenders (7.5+): ${pq.home?.eliteDefenders || 0}

HOME TEAM MIDFIELDERS (Top 4 by rating):
${formatMidfielders(matchData.homeSquad)}

HOME TEAM ATTACKERS (Top 3 by rating):
${formatTopPlayers(matchData.homeSquad, 'Attacker')}
  ⚡ Attack Rating: ${pq.home?.attackRating || 'N/A'}
  ⚡ Elite Attackers (7.5+): ${pq.home?.eliteAttackers || 0}

─────────────────────────────────────────────────────────────────

AWAY TEAM GOALKEEPERS:
${formatGoalkeepers(matchData.awaySquad)}

AWAY TEAM DEFENDERS (Top 3 by rating):
${formatTopPlayers(matchData.awaySquad, 'Defender')}
  🛡️ Defense Rating: ${pq.away?.defenseRating || 'N/A'}
  🛡️ Elite Defenders (7.5+): ${pq.away?.eliteDefenders || 0}

AWAY TEAM MIDFIELDERS (Top 4 by rating):
${formatMidfielders(matchData.awaySquad)}

AWAY TEAM ATTACKERS (Top 3 by rating):
${formatTopPlayers(matchData.awaySquad, 'Attacker')}
  ⚡ Attack Rating: ${pq.away?.attackRating || 'N/A'}
  ⚡ Elite Attackers (7.5+): ${pq.away?.eliteAttackers || 0}

─────────────────────────────────────────────────────────────────

QUALITY DIFFERENTIAL:
├─ Home Attack vs Away Defense: Delta ${pq.home?.delta || 'N/A'}
└─ Away Attack vs Home Defense: Delta ${pq.away?.delta || 'N/A'}`;
}

/**
 * Build injury section with quantified impact
 */
function buildInjurySection(matchData, scorelineAnalysis) {
  const formatInjuries = (injuries) => {
    if (!injuries || injuries.length === 0) return '  ✅ No current injuries reported';
    return injuries.map(inj =>
      `  ⚠️ ${inj.player} (${inj.position}) - ${inj.reason}`
    ).join('\n');
  };

  const ii = scorelineAnalysis?.injuryImpact || {};

  return `
═══════════════════════════════════════════════════════════════
INJURIES & AVAILABILITY
═══════════════════════════════════════════════════════════════
HOME TEAM INJURIES:
${formatInjuries(matchData.homeInjuries)}
  Impact Level: ${ii.home?.impact?.toUpperCase() || 'NONE'}
  Key Players Out: ${ii.home?.keyPlayersOut || 0}
  xG Reduction: ${ii.home?.reduction || 0}%

AWAY TEAM INJURIES:
${formatInjuries(matchData.awayInjuries)}
  Impact Level: ${ii.away?.impact?.toUpperCase() || 'NONE'}
  Key Players Out: ${ii.away?.keyPlayersOut || 0}
  xG Reduction: ${ii.away?.reduction || 0}%`;
}

/**
 * Build fixture congestion / fatigue analysis section
 */
function buildFixtureCongestionSection(matchData) {
  const fc = matchData.fixtureCongestion;
  
  if (!fc || (!fc.home && !fc.away)) {
    return `
═══════════════════════════════════════════════════════════════
FIXTURE CONGESTION & FATIGUE ANALYSIS
═══════════════════════════════════════════════════════════════
⚠️ Fixture congestion data not available`;
  }

  const formatCongestion = (congestion, teamLabel) => {
    if (!congestion) return `${teamLabel}: Data unavailable`;
    
    const lines = [];
    lines.push(`${teamLabel}:`);
    
    // Last match info
    if (congestion.lastMatch) {
      lines.push(`  Last Match: vs ${congestion.lastMatch.opponent} (${congestion.lastMatch.result} ${congestion.lastMatch.score})`);
      lines.push(`  Days Since: ${congestion.daysSinceLastMatch || 'N/A'} days`);
    }
    
    // Next match info
    if (congestion.nextMatch) {
      lines.push(`  Next Match: vs ${congestion.nextMatch.opponent} (${congestion.nextMatch.competition})`);
      lines.push(`  Days Until: ${congestion.daysUntilNextMatch || 'N/A'} days`);
      if (congestion.nextMatchImportance !== 'standard') {
        lines.push(`  ⚠️ IMPORTANCE: ${congestion.nextMatchImportance.replace('_', ' ').toUpperCase()}`);
      }
    }
    
    // Congestion metrics
    lines.push(`  Matches in Next 7 Days: ${congestion.matchesInNext7Days || 0}`);
    lines.push(`  Matches in Next 14 Days: ${congestion.matchesInNext14Days || 0}`);
    lines.push(`  Congestion Level: ${(congestion.congestionLevel || 'low').toUpperCase()}`);
    
    // Fatigue indicators
    const fatigueFlags = [];
    if (congestion.isFatigued) fatigueFlags.push('RECENT_FATIGUE');
    if (congestion.hasQuickTurnaround) fatigueFlags.push('QUICK_TURNAROUND');
    if (congestion.hasBigMatchComing) fatigueFlags.push('BIG_MATCH_COMING');
    if (fatigueFlags.length > 0) {
      lines.push(`  ⚠️ Fatigue Flags: ${fatigueFlags.join(', ')}`);
    }
    
    // Rotation likelihood
    if (congestion.rotationLikelihood && congestion.rotationLikelihood !== 'low') {
      lines.push(`  🔄 Rotation Likelihood: ${congestion.rotationLikelihood.toUpperCase()}`);
      if (congestion.rotationReason) {
        lines.push(`     Reason: ${congestion.rotationReason}`);
      }
    }
    
    // Upcoming schedule
    if (congestion.upcomingSchedule && congestion.upcomingSchedule.length > 0) {
      lines.push(`  Upcoming Schedule:`);
      congestion.upcomingSchedule.forEach((match, i) => {
        const matchDate = new Date(match.date).toLocaleDateString();
        lines.push(`    ${i + 1}. ${match.opponent} (${match.competition}) - ${matchDate} [${match.venue}]`);
      });
    }
    
    return lines.join('\n');
  };

  return `
═══════════════════════════════════════════════════════════════
FIXTURE CONGESTION & FATIGUE ANALYSIS
═══════════════════════════════════════════════════════════════
${formatCongestion(fc.home, 'HOME TEAM')}

${formatCongestion(fc.away, 'AWAY TEAM')}

ROTATION IMPACT ASSESSMENT:
├─ Home Team: ${fc.home?.rotationLikelihood?.toUpperCase() || 'LOW'} rotation risk
├─ Away Team: ${fc.away?.rotationLikelihood?.toUpperCase() || 'LOW'} rotation risk
└─ Key Factor: ${getKeyFatigueFactor(fc)}`;
}

/**
 * Helper to determine key fatigue factor
 */
function getKeyFatigueFactor(fc) {
  const factors = [];
  
  if (fc.home?.hasBigMatchComing) {
    factors.push(`Home team has ${fc.home.nextMatchImportance.replace('_', ' ')} in ${fc.home.daysUntilNextMatch} days`);
  }
  if (fc.away?.hasBigMatchComing) {
    factors.push(`Away team has ${fc.away.nextMatchImportance.replace('_', ' ')} in ${fc.away.daysUntilNextMatch} days`);
  }
  if (fc.home?.congestionLevel === 'critical' || fc.home?.congestionLevel === 'high') {
    factors.push(`Home team facing ${fc.home.congestionLevel} schedule congestion`);
  }
  if (fc.away?.congestionLevel === 'critical' || fc.away?.congestionLevel === 'high') {
    factors.push(`Away team facing ${fc.away.congestionLevel} schedule congestion`);
  }
  if (fc.home?.isFatigued && fc.home?.daysSinceLastMatch <= 2) {
    factors.push(`Home team on short rest (${fc.home.daysSinceLastMatch} days)`);
  }
  if (fc.away?.isFatigued && fc.away?.daysSinceLastMatch <= 2) {
    factors.push(`Away team on short rest (${fc.away.daysSinceLastMatch} days)`);
  }
  
  return factors.length > 0 ? factors.join('; ') : 'No significant fatigue factors identified';
}

/**
 * Build head-to-head section
 */
function buildH2HSection(matchData) {
  if (!matchData.h2h || matchData.h2h.total === 0) {
    return `
═══════════════════════════════════════════════════════════════
HEAD-TO-HEAD HISTORY
═══════════════════════════════════════════════════════════════
⚠️ No recent head-to-head data available`;
  }

  const { homeWins, draws, awayWins, matches } = matchData.h2h;
  const total = homeWins + draws + awayWins;
  const recentMatches = matches.slice(0, 5).map((m, i) =>
    `  ${i + 1}. ${m.homeTeam} ${m.score} ${m.awayTeam} (${new Date(m.date).toLocaleDateString()})`
  ).join('\n');

  return `
═══════════════════════════════════════════════════════════════
HEAD-TO-HEAD HISTORY (Last ${total} meetings)
═══════════════════════════════════════════════════════════════
RECORD:
├─ Home Team Wins: ${homeWins} (${((homeWins/total)*100).toFixed(1)}%)
├─ Draws: ${draws} (${((draws/total)*100).toFixed(1)}%)
└─ Away Team Wins: ${awayWins} (${((awayWins/total)*100).toFixed(1)}%)

RECENT MEETINGS:
${recentMatches}`;
}

/**
 * Build league context section
 */
function buildLeagueContextSection(leagueStats) {
  if (!leagueStats || !leagueStats.stats) {
    return `
═══════════════════════════════════════════════════════════════
LEAGUE CONTEXT
═══════════════════════════════════════════════════════════════
⚠️ League statistics not available`;
  }

  const stats = leagueStats.stats;

  return `
═══════════════════════════════════════════════════════════════
LEAGUE CONTEXT (${leagueStats.league} ${leagueStats.season})
═══════════════════════════════════════════════════════════════
LEAGUE AVERAGES:
├─ Goals per game: ${stats.goalsPerGame}
├─ Home win rate: ${stats.homeWinPercentage}%
├─ Draw rate: ${stats.drawPercentage}%
├─ Away win rate: ${stats.awayWinPercentage}%
├─ BTTS: ${stats.bttsPercentage}%
└─ Over 2.5 goals: ${stats.over25Percentage}%`;
}

/**
 * Build the complete prompt
 * @param {Object} fixture - Match fixture
 * @param {Object} matchData - Match data
 * @param {Object} scorelineAnalysis - Scoreline calculator output
 * @param {Object} leagueStats - League statistics
 * @returns {string} Complete prompt for Claude
 */
function buildAnalystPrompt(fixture, matchData, scorelineAnalysis, leagueStats) {
  const dataSection = buildDataSection(fixture, matchData, scorelineAnalysis, leagueStats);

  return `${ANALYST_SYSTEM_PROMPT}

═══════════════════════════════════════════════════════════════
BEGIN DATA INPUT
═══════════════════════════════════════════════════════════════
${dataSection}
═══════════════════════════════════════════════════════════════
END DATA INPUT
═══════════════════════════════════════════════════════════════

Based on the data provided above, produce your professional analysis following the mandatory output structure.
Remember: Be data-driven, highlight uncertainty, and avoid absolute predictions.`;
}

module.exports = {
  ANALYST_SYSTEM_PROMPT,
  buildAnalystPrompt,
  buildDataSection,
  buildModelSignalsSection,
  buildStandingsSection,
  buildFormSection,
  buildMatchIncentiveSection,
  buildPlayerQualitySection,
  buildInjurySection,
  buildFixtureCongestionSection,
  buildH2HSection,
  buildLeagueContextSection
};
