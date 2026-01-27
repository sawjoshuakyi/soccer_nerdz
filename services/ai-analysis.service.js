/**
 * ═══════════════════════════════════════════════════════════════
 * AI ANALYSIS SERVICE
 * ═══════════════════════════════════════════════════════════════
 * Professional-grade AI-powered match analysis using Claude
 * - Structured prompts for consistent output
 * - Comprehensive data integration
 * - Validation and error handling
 */

const axios = require('axios');
const { API_CONFIG, ANALYSIS_CONFIG, VALIDATION } = require('../config/constants');

class AIAnalysisService {
  constructor() {
    this.analysisCount = 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN PREDICTION GENERATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Generate comprehensive AI prediction for a match
   * @param {Object} fixture - Fixture object
   * @param {Object} matchData - Comprehensive match data
   * @param {Object} leagueStats - League-wide statistics
   * @returns {Promise<Object>} Prediction analysis
   */
  async generatePrediction(fixture, matchData, leagueStats = null) {
    try {
      console.log(`   🤖 Generating AI prediction...`);
      console.log(`   📝 Building comprehensive prompt...`);
      
      const prompt = this._buildPredictionPrompt(fixture, matchData, leagueStats);
      
      console.log(`   📊 Prompt size: ${prompt.length} characters`);
      console.log(`   ⏳ Requesting AI analysis (may take 30-60 seconds)...`);
      
      const response = await this._callClaudeAPI(prompt);
      
      // Validate response
      if (!this._validatePrediction(response)) {
        throw new Error('AI prediction validation failed');
      }

      this.analysisCount++;
      
      return {
        analysis: response,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: API_CONFIG.anthropic.model,
          dataQuality: this._assessDataQuality(matchData)
        }
      };

    } catch (error) {
      console.error(`   ❌ AI prediction error: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PROMPT BUILDER
  // ═══════════════════════════════════════════════════════════════

  /**
   * Build comprehensive prediction prompt
   * @private
   */
  _buildPredictionPrompt(fixture, matchData, leagueStats) {
    const homeTeam = fixture.teams.home.name;
    const awayTeam = fixture.teams.away.name;
    const league = fixture.league.name;
    const matchDate = new Date(fixture.fixture.date).toLocaleString();
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    return `You are an expert football analyst providing professional match predictions. 

⚠️ IMPORTANT CONTEXT ⚠️
Today's Date: ${currentDate}
Current Season: 2025-2026
Your knowledge cutoff may be outdated. Use ONLY the data provided below. Do not rely on historical assumptions about team positions or form.

Analyze this match comprehensively and provide detailed insights.

═══════════════════════════════════════════════════════════════
MATCH INFORMATION
═══════════════════════════════════════════════════════════════
Competition: ${league}
Match: ${homeTeam} vs ${awayTeam}
Date: ${matchDate}
Venue: ${fixture.fixture.venue?.name || 'TBD'}

${this._buildStandingsSection(matchData)}
${this._buildFormSection(matchData)}
${this._buildH2HSection(matchData)}
${this._buildStatisticsSection(matchData)}
${this._buildInjuriesSection(matchData)}
${this._buildPredictedLineupsSection(matchData)}
${this._buildTopPlayersSection(matchData)}
${this._buildLeagueStatsSection(leagueStats)}

═══════════════════════════════════════════════════════════════
ANALYSIS INSTRUCTIONS
═══════════════════════════════════════════════════════════════

Your analysis MUST be:
✅ Data-driven - Base every claim on the statistics provided
✅ Specific - Use exact numbers, percentages, and facts
✅ Contextual - Consider league position, injuries, and stakes
✅ Varied - Don't default to generic 2-1 predictions
✅ Accurate - Cross-reference all injury data before claiming "no injuries"

CRITICAL RULES:
1. CHECK INJURIES SECTION - If injuries are listed, you MUST analyze them
2. USE ACTUAL STANDINGS - Don't guess positions
3. VARY SCORELINES - Use statistics to justify specific scorelines
4. BE SPECIFIC - "Team X averages 2.3 goals/game" not "scores a lot"
5. CONSIDER CONTEXT - Relegation battles, European races, etc.

REQUIRED SECTIONS:

**1. EXECUTIVE SUMMARY**
- Predicted scoreline (justified by data, not generic)
- Confidence level (0-100%)
- 2-3 sentence summary of why

**2. TACTICAL ANALYSIS**
- Expected formations from predicted lineups
- Tactical battles (e.g., "3-man midfield dominance")
- Style matchup analysis
- Key tactical advantages

**3. PLAYER PERFORMANCE ANALYSIS & SCORING PREDICTIONS** ⚠️ CRITICAL
⚠️⚠️⚠️ TRANSFER WINDOW WARNING ⚠️⚠️⚠️

DO NOT use the "Season Top Scorers" section to determine who is available!
That data may include players who have TRANSFERRED to other clubs!

Use THIS priority order ONLY:
1. RECENT FORM → "Players Recently Used (Last 3 Games)" list
2. INJURIES → Who is confirmed OUT
3. Season stats for CONTEXT ONLY (if player is in recent lineups)

For each team, analyze:

HOME TEAM KEY PLAYERS:
For players in "Players Recently Used" list, provide:
- Name & Position
- Recent form analysis (if they appear multiple times in last 3 games)
- Scoring/Assist likelihood (High/Medium/Low) based on:
  * Season stats (if available in Top Scorers section AND player is in recent lineup)
  * Recent appearances (regularity in last 3 games)
  * Team's attacking output
- Example: "Haaland (ST) - High scoring likelihood. Appeared in all 3 recent games. Team averages 2.5 goals/game"

Injuries/Suspensions:
- EVERY player from injuries section + their impact on team strength

AWAY TEAM KEY PLAYERS:
(Same analysis structure as home team)

⚠️ SCORING PREDICTION GUIDELINES:
- HIGH likelihood: Player appears in all/most recent games + team has high goal average + attacking position
- MEDIUM likelihood: Player appears occasionally OR defensive-minded team OR midfield position
- LOW likelihood: Recently substituted/benched OR team struggles to score OR defensive position

Example CORRECT approach:
"Salah (RW) - High scoring likelihood. Featured in all 3 recent matches. Liverpool averages 2.3 goals/game"

Example WRONG approach:
"Semenyo (10 goals)" ← Player may have transferred! Don't mention unless in recent lineup

If you're uncertain about specific players, use team statistics:
"Their attacking options average 1.5 goals/game" instead of naming individuals.

**4. RECENT FORM**
- Last 5 results with scores
- Goals scored/conceded patterns
- Winning/losing streaks
- Home vs Away form split

**5. LEAGUE POSITION & STAKES**
⚠️ USE ONLY THE STANDINGS DATA PROVIDED ABOVE ⚠️
- Exact positions from standings table (do NOT guess or use outdated knowledge)
- Points gap to leaders/relegation (use actual numbers from data)
- What they're fighting for based on CURRENT position (title race, top 4, mid-table, relegation)
- Pressure analysis based on actual league context

**6. HEAD-TO-HEAD HISTORY**
- Recent meetings with scores
- Home advantage stats
- Historical patterns

**7. STATISTICAL DEEP DIVE**
- Over/Under 2.5 goals probability
- BTTS (Both Teams To Score) probability
- Clean sheet likelihood
- xG (expected goals) estimation

**8. MOST LIKELY GOAL SCORERS** 🎯 NEW SECTION
Based on player analysis from section 3, predict who is most likely to score:

HOME TEAM - Top 3 Most Likely Scorers:
1. [Player Name] ([Position]) - [HIGH/MEDIUM/LOW] likelihood
   - Rationale: [Goals/90, recent form, appearances]
2. [Player Name] ([Position]) - [HIGH/MEDIUM/LOW] likelihood
   - Rationale: [Stats and reasoning]
3. [Player Name] ([Position]) - [HIGH/MEDIUM/LOW] likelihood
   - Rationale: [Stats and reasoning]

AWAY TEAM - Top 3 Most Likely Scorers:
1. [Player Name] ([Position]) - [HIGH/MEDIUM/LOW] likelihood
   - Rationale: [Goals/90, recent form, appearances]
2. [Player Name] ([Position]) - [HIGH/MEDIUM/LOW] likelihood
   - Rationale: [Stats and reasoning]
3. [Player Name] ([Position]) - [HIGH/MEDIUM/LOW] likelihood
   - Rationale: [Stats and reasoning]

Anytime Goalscorer Bets:
- Best Value: [Player with good odds vs likelihood]
- Dark Horse: [Unexpected scorer with reasoning]

⚠️ ONLY include players from "Players Recently Used" list!

**9. ATTACK VS DEFENSE MATCHUP**
- Home attack (${matchData.homeStats?.avgGoalsFor || 'N/A'} avg) vs Away defense (${matchData.awayStats?.avgGoalsAgainst || 'N/A'} avg)
- Away attack (${matchData.awayStats?.avgGoalsFor || 'N/A'} avg) vs Home defense (${matchData.homeStats?.avgGoalsAgainst || 'N/A'} avg)
- Expected goals for each team

**10. RISK FACTORS**
- What could change outcome
- Variance factors
- Lineup uncertainties

**11. FINAL VERDICT**
Predicted Score: [X-X]
Confidence: [0-100]%

Justification (3 bullets):
• Statistical: [Actual stats from data]
• Tactical: [Formation/style matchup]
• Contextual: [League position, injuries, motivation]

Alternative Outcomes:
- Most likely: [Score with probability]
- Dark horse: [Upset scenario with probability]

Betting Recommendations:
- Value bet: [Based on analysis]
- Avoid: [Risky bets]

SCORELINE GUIDANCE:
- Relegation teams (bottom 3): Expect defensive 0-0, 1-0, 1-1
- Mismatched (10+ position gap): Wider margins 3-0, 4-1
- Attacking teams (>2.5 avg goals): Higher scoring 3-2, 4-2
- Defensive teams (<1.5 avg goals): Low scoring 1-0, 0-0
- Evenly matched: Competitive 2-1, 1-1, 2-2

Base your scoreline on ACTUAL data, not stereotypes.`;
  }

  // ═══════════════════════════════════════════════════════════════
  // PROMPT SECTION BUILDERS
  // ═══════════════════════════════════════════════════════════════

  _buildStandingsSection(matchData) {
    if (!matchData.standings) {
      return `═══════════════════════════════════════════════════════════════
CURRENT LEAGUE STANDINGS (2025-2026 Season)
═══════════════════════════════════════════════════════════════
⚠️ Standings data not available`;
    }

    const { home, away } = matchData.standings;
    const higherTeam = (home?.position || 999) < (away?.position || 999) ? home : away;
    const lowerTeam = higherTeam === home ? away : home;
    const positionGap = Math.abs((home?.position || 0) - (away?.position || 0));
    
    return `═══════════════════════════════════════════════════════════════
CURRENT LEAGUE STANDINGS (2025-2026 Season)
═══════════════════════════════════════════════════════════════
⚠️ USE THESE POSITIONS - DO NOT USE OUTDATED KNOWLEDGE ⚠️

HOME TEAM (${matchData.standings.home?.team || 'Unknown'}):
- Position: ${home?.position || 'N/A'} / 20
- Points: ${home?.points || 'N/A'}
- Goal Difference: ${home?.goalsDiff || 'N/A'}
- Form (last 5): ${home?.form || 'N/A'}

AWAY TEAM (${matchData.standings.away?.team || 'Unknown'}):
- Position: ${away?.position || 'N/A'} / 20
- Points: ${away?.points || 'N/A'}
- Goal Difference: ${away?.goalsDiff || 'N/A'}
- Form (last 5): ${away?.form || 'N/A'}

Position Gap: ${positionGap} places
${higherTeam?.team || 'Higher team'} is in ${higherTeam?.position || 'N/A'} place
${lowerTeam?.team || 'Lower team'} is in ${lowerTeam?.position || 'N/A'} place

⚠️ For Stakes Analysis: Use ONLY these current positions. If a team is in position 1-4, they're in title/Champions League race. Position 5-7 is Europa League race. Position 18-20 is relegation battle.`;
  }

  _buildFormSection(matchData) {
    const formatMatches = (matchesData) => {
      if (!matchesData || !matchesData.matches || matchesData.matches.length === 0) {
        return '  No recent data';
      }
      return matchesData.matches.map((m, i) => 
        `  ${i + 1}. ${m.result} ${m.venue} vs ${m.opponent} (${m.score})${m.lineup ? ` - Formation: ${m.lineup.formation}` : ''}`
      ).join('\n');
    };

    const formatRecentPlayers = (matchesData) => {
      if (!matchesData || !matchesData.recentlyPlayedPlayers || matchesData.recentlyPlayedPlayers.length === 0) {
        return '  No lineup data available';
      }
      return '  ' + matchesData.recentlyPlayedPlayers.join(', ');
    };

    return `
═══════════════════════════════════════════════════════════════
RECENT FORM (Last 5 Matches)
═══════════════════════════════════════════════════════════════
HOME TEAM:
${formatMatches(matchData.homeRecentMatches)}

Overall Form: ${matchData.homeStats?.form || 'N/A'}
Goals Scored (avg): ${matchData.homeStats?.avgGoalsFor || 'N/A'}
Goals Conceded (avg): ${matchData.homeStats?.avgGoalsAgainst || 'N/A'}

Players Recently Used (Last 3 Games):
${formatRecentPlayers(matchData.homeRecentMatches)}
⚠️ These are the CURRENT active players - use these over season stats!

AWAY TEAM:
${formatMatches(matchData.awayRecentMatches)}

Overall Form: ${matchData.awayStats?.form || 'N/A'}
Goals Scored (avg): ${matchData.awayStats?.avgGoalsFor || 'N/A'}
Goals Conceded (avg): ${matchData.awayStats?.avgGoalsAgainst || 'N/A'}

Players Recently Used (Last 3 Games):
${formatRecentPlayers(matchData.awayRecentMatches)}
⚠️ These are the CURRENT active players - use these over season stats!`;
  }

  _buildH2HSection(matchData) {
    if (!matchData.h2h || matchData.h2h.total === 0) {
      return `
═══════════════════════════════════════════════════════════════
HEAD-TO-HEAD HISTORY
═══════════════════════════════════════════════════════════════
⚠️ No recent head-to-head data available`;
    }

    const { homeWins, draws, awayWins, matches } = matchData.h2h;
    const recentMatches = matches.slice(0, 5).map((m, i) => 
      `  ${i + 1}. ${m.homeTeam} ${m.score} ${m.awayTeam} (${new Date(m.date).toLocaleDateString()})`
    ).join('\n');

    return `
═══════════════════════════════════════════════════════════════
HEAD-TO-HEAD HISTORY
═══════════════════════════════════════════════════════════════
Total Meetings: ${homeWins + draws + awayWins}
Home Wins: ${homeWins}
Draws: ${draws}
Away Wins: ${awayWins}

Recent Meetings:
${recentMatches}`;
  }

  _buildStatisticsSection(matchData) {
    return `
═══════════════════════════════════════════════════════════════
SEASON STATISTICS
═══════════════════════════════════════════════════════════════
HOME TEAM:
- Matches Played: ${matchData.homeStats?.played || 0}
- Record: ${matchData.homeStats?.wins || 0}W-${matchData.homeStats?.draws || 0}D-${matchData.homeStats?.losses || 0}L
- Goals Scored: ${matchData.homeStats?.goalsFor || 0} (${matchData.homeStats?.avgGoalsFor || 'N/A'} per game)
- Goals Conceded: ${matchData.homeStats?.goalsAgainst || 0} (${matchData.homeStats?.avgGoalsAgainst || 'N/A'} per game)
- Clean Sheets: ${matchData.homeStats?.cleanSheets || 0}
- Failed to Score: ${matchData.homeStats?.failedToScore || 0}

AWAY TEAM:
- Matches Played: ${matchData.awayStats?.played || 0}
- Record: ${matchData.awayStats?.wins || 0}W-${matchData.awayStats?.draws || 0}D-${matchData.awayStats?.losses || 0}L
- Goals Scored: ${matchData.awayStats?.goalsFor || 0} (${matchData.awayStats?.avgGoalsFor || 'N/A'} per game)
- Goals Conceded: ${matchData.awayStats?.goalsAgainst || 0} (${matchData.awayStats?.avgGoalsAgainst || 'N/A'} per game)
- Clean Sheets: ${matchData.awayStats?.cleanSheets || 0}
- Failed to Score: ${matchData.awayStats?.failedToScore || 0}`;
  }

  _buildInjuriesSection(matchData) {
    const formatInjuries = (injuries) => {
      if (!injuries || injuries.length === 0) return '  ✅ No current injuries';
      return injuries.map(inj => 
        `  ⚠️ ${inj.player} (${inj.position}) - ${inj.reason}${inj.expectedReturn ? ` | Return: ${new Date(inj.expectedReturn).toLocaleDateString()}` : ''}`
      ).join('\n');
    };

    return `
═══════════════════════════════════════════════════════════════
INJURIES & SUSPENSIONS
═══════════════════════════════════════════════════════════════
HOME TEAM:
${formatInjuries(matchData.homeInjuries)}

AWAY TEAM:
${formatInjuries(matchData.awayInjuries)}`;
  }

  _buildPredictedLineupsSection(matchData) {
    if (!matchData.apiPrediction) {
      return `
═══════════════════════════════════════════════════════════════
PREDICTED LINEUPS
═══════════════════════════════════════════════════════════════
⚠️ Lineup predictions not available`;
    }

    const { predictedLineups, winProbability } = matchData.apiPrediction;

    return `
═══════════════════════════════════════════════════════════════
PREDICTED LINEUPS & WIN PROBABILITY
═══════════════════════════════════════════════════════════════
HOME FORMATION: ${predictedLineups?.home || 'N/A'}
AWAY FORMATION: ${predictedLineups?.away || 'N/A'}

Win Probability (from API):
- Home Win: ${winProbability?.home || 'N/A'}%
- Draw: ${winProbability?.draw || 'N/A'}%
- Away Win: ${winProbability?.away || 'N/A'}%`;
  }

  _buildTopPlayersSection(matchData) {
    const formatPlayers = (players, stat = 'goals') => {
      if (!players || players.length === 0) return '  No data available';
      return players.slice(0, 5).map(p => {
        const stats = p.statistics?.[0];
        const goals = stats?.goals?.total || 0;
        const assists = stats?.goals?.assists || 0;
        const appearances = stats?.games?.appearences || 0;
        const minutes = stats?.games?.minutes || 0;
        const rating = stats?.games?.rating || 'N/A';
        const position = stats?.games?.position || 'Unknown';
        
        // Calculate goals per 90 minutes
        const goalsPer90 = minutes > 0 ? ((goals / minutes) * 90).toFixed(2) : '0.00';
        
        if (stat === 'goals') {
          return `  • ${p.player?.name || 'Unknown'} (${position}) - ${goals} goals, ${assists} assists in ${appearances} apps | ${goalsPer90} goals/90min | Rating: ${rating}`;
        } else {
          return `  • ${p.player?.name || 'Unknown'} (${position}) - ${assists} assists, ${goals} goals in ${appearances} apps | Rating: ${rating}`;
        }
      }).join('\n');
    };

    return `
═══════════════════════════════════════════════════════════════
SEASON PLAYER STATISTICS (⚠️ WARNING - MAY INCLUDE TRANSFERRED PLAYERS)
═══════════════════════════════════════════════════════════════
⚠️⚠️⚠️ CRITICAL WARNING - READ CAREFULLY ⚠️⚠️⚠️

This section shows SEASON STATISTICS ONLY - it aggregates ALL matches from
August to now, including players who may have TRANSFERRED TO OTHER CLUBS!

USAGE RULES:
1. Check if player appears in "Players Recently Used (Last 3 Games)" 
2. If YES → You can reference their season stats for context
3. If NO → DO NOT mention them (they may have transferred)
4. If UNCERTAIN → Use generic team statistics instead

HOME TEAM - Top Scorers (USE ONLY IF IN RECENT LINEUP):
${formatPlayers(matchData.topScorers?.home || [], 'goals')}

HOME TEAM - Top Assisters (USE ONLY IF IN RECENT LINEUP):
${formatPlayers(matchData.topScorers?.home || [], 'assists')}

AWAY TEAM - Top Scorers (USE ONLY IF IN RECENT LINEUP):
${formatPlayers(matchData.topScorers?.away || [], 'goals')}

AWAY TEAM - Top Assisters (USE ONLY IF IN RECENT LINEUP):
${formatPlayers(matchData.topScorers?.away || [], 'assists')}

⚠️⚠️⚠️ PLAYER ANALYSIS PROCESS ⚠️⚠️⚠️

Step 1: Check "Players Recently Used" list
Step 2: For players in that list, check if they appear in stats above
Step 3: If YES, analyze their:
   - Goals/90 minutes (higher = more likely to score)
   - Appearances (consistency indicator)
   - Rating (form indicator)
   - Position (attackers more likely to score)
Step 4: Provide scoring likelihood: HIGH (>0.50 goals/90), MEDIUM (0.20-0.50), LOW (<0.20)

Example Analysis:
"Kane (ST) - HIGH scoring likelihood. 0.85 goals/90min, featured in all 3 recent games, 7.8 rating"
"Saka (RW) - MEDIUM scoring likelihood. 0.35 goals/90min, 5 assists, appeared twice in last 3 games"

⚠️⚠️⚠️ DO NOT MENTION THESE PLAYERS AS "AVAILABLE" ⚠️⚠️⚠️

Only mention specific players if you can verify they appeared in the 
"Players Recently Used" list OR are mentioned in injuries/suspensions.

If you want to reference attacking threat, use the team's overall 
statistics (goals/game average) rather than naming specific players
who may no longer be at the club.`;
  }

  _buildLeagueStatsSection(leagueStats) {
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
LEAGUE CONTEXT
═══════════════════════════════════════════════════════════════
League: ${leagueStats.league}
Season: ${leagueStats.season}

Average Statistics:
- Goals per game: ${stats.goalsPerGame}
- Home win rate: ${stats.homeWinPercentage}%
- Draw rate: ${stats.drawPercentage}%
- Away win rate: ${stats.awayWinPercentage}%
- BTTS: ${stats.bttsPercentage}%
- Over 2.5 goals: ${stats.over25Percentage}%`;
  }

  // ═══════════════════════════════════════════════════════════════
  // CLAUDE API INTEGRATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Call Claude API with retry logic
   * @private
   */
  async _callClaudeAPI(prompt, retryCount = 0) {
    const maxRetries = 3;
    const timeout = API_CONFIG.anthropic.timeout;
    
    try {
      console.log(`   🤖 Calling Claude API (attempt ${retryCount + 1}/${maxRetries + 1})...`);
      
      const response = await axios.post(
        API_CONFIG.anthropic.baseUrl,
        {
          model: API_CONFIG.anthropic.model,
          max_tokens: API_CONFIG.anthropic.maxTokens,
          messages: [{ role: 'user', content: prompt }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_CONFIG.anthropic.key,
            'anthropic-version': API_CONFIG.anthropic.version
          },
          timeout: timeout
        }
      );

      const text = response.data.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');

      console.log(`   ✅ Received response (${text.length} characters)`);
      return text;

    } catch (error) {
      const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
      const isRateLimit = error.response?.status === 429;
      const isServerError = error.response?.status >= 500;
      
      // Retry on timeout, rate limit, or server errors
      if (retryCount < maxRetries && (isTimeout || isRateLimit || isServerError)) {
        const delay = 10000 * Math.pow(2, retryCount); // 10s, 20s, 40s
        
        if (isTimeout) {
          console.log(`   ⏱️  Timeout (${timeout/1000}s). Retrying in ${delay/1000}s... (${retryCount + 1}/${maxRetries})`);
        } else if (isRateLimit) {
          console.log(`   ⚠️  Rate limit. Retrying in ${delay/1000}s... (${retryCount + 1}/${maxRetries})`);
        } else if (isServerError) {
          console.log(`   ⚠️  Server error ${error.response.status}. Retrying in ${delay/1000}s... (${retryCount + 1}/${maxRetries})`);
        }
        
        await this._delay(delay);
        return this._callClaudeAPI(prompt, retryCount + 1);
      }

      // Format error message
      let errorMsg = 'Claude API error: ';
      if (isTimeout) {
        errorMsg += `timeout of ${timeout/1000}s exceeded`;
      } else if (error.response) {
        errorMsg += `${error.response.status} - ${error.response.data?.error?.message || error.message}`;
      } else {
        errorMsg += error.message;
      }
      
      throw new Error(errorMsg);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // VALIDATION & QUALITY ASSESSMENT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Validate AI prediction response
   * @private
   */
  _validatePrediction(prediction) {
    if (!prediction || prediction.length < VALIDATION.prediction.minLength) {
      return false;
    }

    // Check for required sections
    const hasRequiredSections = VALIDATION.prediction.requiredSections.every(
      section => prediction.toUpperCase().includes(section)
    );

    return hasRequiredSections;
  }

  /**
   * Assess quality of match data
   * @private
   */
  _assessDataQuality(matchData) {
    let quality = 0;
    let maxQuality = 8;

    if (matchData.homeStats && matchData.awayStats) quality++;
    if (matchData.homeRecentMatches?.length > 0) quality++;
    if (matchData.awayRecentMatches?.length > 0) quality++;
    if (matchData.h2h && matchData.h2h.total > 0) quality++;
    if (matchData.standings) quality++;
    if (matchData.apiPrediction) quality++;
    if (matchData.homeInjuries !== null && matchData.awayInjuries !== null) quality++;
    if (matchData.topScorers) quality++;

    const percentage = (quality / maxQuality * 100).toFixed(0);
    
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 70) return 'Good';
    if (percentage >= 50) return 'Fair';
    return 'Limited';
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AIAnalysisService;