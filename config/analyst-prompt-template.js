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

6. Contextual Flags (If Provided)
   - Injuries, suspensions, rest, venue
   - Fixture congestion and fatigue indicators
   - Rotation risk assessment (upcoming important matches)
   - Schedule density impact on team selection
   - Directional impact ONLY unless quantified

7. Confidence Framing (Non-Predictive)
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
  buildPlayerQualitySection,
  buildInjurySection,
  buildFixtureCongestionSection,
  buildH2HSection,
  buildLeagueContextSection
};
