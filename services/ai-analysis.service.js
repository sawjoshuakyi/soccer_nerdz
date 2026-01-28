/**
 * ═══════════════════════════════════════════════════════════════
 * AI ANALYSIS SERVICE
 * ═══════════════════════════════════════════════════════════════
 * Professional-grade AI-powered match analysis using GPT-4.1
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

    return `You are a UEFA-licensed professional football analyst. Analyze this match comprehensively and provide detailed insights.

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
${this._buildSquadAnalysisSection(matchData)}
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

**2. TACTICAL ANALYSIS & PLAYER RATINGS** ⚠️ USE SQUAD DATA
- Expected formations from predicted lineups
- Tactical battles (e.g., "3-man midfield dominance")
- Style matchup analysis
- KEY: Analyze HIGH-RATED PLAYERS (7.5+) across ALL positions:
  * Identify elite goalkeepers (affects scoring chances)
  * Highlight top-rated defenders (affects clean sheet probability)
  * Note high-performing midfielders (dictates tempo)
  * Recognize dangerous attackers (goal threats)
- Use player ratings to predict:
  * Clean sheet likelihood (GK + defenders ratings)
  * Goal-scoring probability (attacker + midfielder ratings)
  * Tactical vulnerabilities (weak positions, low ratings)

**3. KEY PLAYERS & INJURIES** ⚠️ CRITICAL
⚠️⚠️⚠️ TRANSFER WINDOW WARNING ⚠️⚠️⚠️

The "Season Top Scorers" section ONLY shows players in the CURRENT squad.
Players who have transferred OUT are already excluded.

Use THIS priority order:
1. SQUAD ANALYSIS → Current squad with ratings (all positions)
2. TOP SCORERS → Current squad's goal scorers only
3. INJURIES → Who is confirmed OUT

HOME TEAM:
- Available: Use Squad Analysis section (current players only)
- Injuries/Out: EVERY player from injuries section + impact

AWAY TEAM:
- Available: Use Squad Analysis section (current players only)
- Injuries/Out: EVERY player from injuries section + impact

Example CORRECT approach:
"Bournemouth's attack features Evanilson (8.2 rating, 12 goals) and Cook"

Example WRONG approach:
"Bournemouth will rely on Semenyo" ← API data now shows current squad only

🎯 HIGHLIGHT ATTACKERS: When discussing goal threats, emphasize top-rated attackers
Example: "⚡ Arsenal's attacking threat comes from Victor Gyokeres (8.5 rating, 15 goals)"

**4. RECENT FORM**
- Last 5 results with scores
- Goals scored/conceded patterns
- Winning/losing streaks
- Home vs Away form split

**5. LEAGUE POSITION & STAKES**
- Exact positions from standings
- Points gap
- What they're fighting for (be specific)
- Pressure analysis

**6. HEAD-TO-HEAD HISTORY**
- Recent meetings with scores
- Home advantage stats
- Historical patterns

**7. STATISTICAL DEEP DIVE**
- Over/Under 2.5 goals probability
- BTTS (Both Teams To Score) probability
- Clean sheet likelihood
- xG (expected goals) estimation

**8. ATTACK VS DEFENSE MATCHUP & PLAYER IMPACT**
- Home attack (${matchData.homeStats?.avgGoalsFor || 'N/A'} avg) vs Away defense (${matchData.awayStats?.avgGoalsAgainst || 'N/A'} avg)
- Away attack (${matchData.awayStats?.avgGoalsFor || 'N/A'} avg) vs Home defense (${matchData.homeStats?.avgGoalsAgainst || 'N/A'} avg)
- Expected goals for each team
- CRITICAL: Factor in individual player quality:
  * High-rated attackers (7.5+) increase scoring probability
  * Elite defenders (7.5+) reduce opponent's chances
  * Goalkeeper rating directly affects clean sheet probability
  * Example: "Home team has 3 defenders rated 7.5+, limiting away team's attack"

**9. RISK FACTORS**
- What could change outcome
- Variance factors
- Lineup uncertainties

**10. FINAL VERDICT**
Predicted Score: [X-X]
Confidence: [0-100]%

Justification (3 bullets):
• Statistical: [Actual stats from data]
• Tactical & Player Quality: [Formation/style + key player ratings]
• Contextual: [League position, injuries, motivation]

Key Player Impacts:
• [Name high-rated players (7.5+) who will influence the match]
• [Note defensive/GK quality affecting scoreline]

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
LEAGUE STANDINGS
═══════════════════════════════════════════════════════════════
⚠️ Standings data not available`;
    }

    const { home, away } = matchData.standings;
    
    return `═══════════════════════════════════════════════════════════════
LEAGUE STANDINGS
═══════════════════════════════════════════════════════════════
HOME TEAM:
- Position: ${home?.position || 'N/A'}
- Points: ${home?.points || 'N/A'}
- Goal Difference: ${home?.goalsDiff || 'N/A'}
- Form (last 5): ${home?.form || 'N/A'}

AWAY TEAM:
- Position: ${away?.position || 'N/A'}
- Points: ${away?.points || 'N/A'}
- Goal Difference: ${away?.goalsDiff || 'N/A'}
- Form (last 5): ${away?.form || 'N/A'}

Position Gap: ${Math.abs((home?.position || 0) - (away?.position || 0))} places`;
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
    // Use current season squad data only - this ensures transferred players don't show
    const getCurrentSquadNames = (squad) =>
      squad?.map(p => p.name).filter(Boolean) || [];
    
    const formatPlayers = (players, stat = 'goals', currentSquadNames = []) => {
      if (!players || players.length === 0) return '  No data available';
      // Only show players who are in the CURRENT squad for this team
      return players
        .filter(p => currentSquadNames.includes(p.player?.name))
        .slice(0, 3)
        .map(p => {
          const stats = p.statistics?.[0];
          const value = stat === 'goals' ? stats?.goals?.total : stats?.goals?.assists;
          return `  • ${p.player?.name || 'Unknown'} (${value || 0} ${stat})`;
        }).join('\n') || '  No active scorers in current squad';
    };
    
    const homeSquadNames = getCurrentSquadNames(matchData.homeSquad);
    const awaySquadNames = getCurrentSquadNames(matchData.awaySquad);
    
    return `
═══════════════════════════════════════════════════════════════
SEASON TOP SCORERS (CURRENT SQUAD ONLY)
═══════════════════════════════════════════════════════════════
⚠️ Only showing players currently in the squad (transfers excluded)

HOME TEAM - Top Scorers:
${formatPlayers(matchData.topScorers?.home || [], 'goals', homeSquadNames)}

AWAY TEAM - Top Scorers:
${formatPlayers(matchData.topScorers?.away || [], 'goals', awaySquadNames)}
`;
  }

  _buildSquadAnalysisSection(matchData) {
    const formatSquad = (squad, teamName) => {
      if (!squad || squad.length === 0) return '  No squad data available';
      
      // Group by position - using CURRENT squad data only
      const goalkeepers = squad.filter(p => p.position === 'Goalkeeper').sort((a, b) => (b.rating || 0) - (a.rating || 0));
      const defenders = squad.filter(p => p.position === 'Defender').sort((a, b) => (b.rating || 0) - (a.rating || 0));
      const midfielders = squad.filter(p => p.position === 'Midfielder').sort((a, b) => (b.rating || 0) - (a.rating || 0));
      const attackers = squad.filter(p => p.position === 'Attacker').sort((a, b) => (b.rating || 0) - (a.rating || 0));
      
      const formatPlayer = (p) => {
        // Defensive: ensure rating is a number or can be converted to one
        let rating = 'N/A';
        if (typeof p.rating === 'number' && !isNaN(p.rating)) {
          rating = p.rating.toFixed(2);
        } else if (typeof p.rating === 'string' && !isNaN(parseFloat(p.rating))) {
          rating = parseFloat(p.rating).toFixed(2);
        }
        const apps = p.appearances || 0;
        const goals = p.goals || 0;
        const assists = p.assists || 0;
        const minutes = p.minutes || 0;
        const hasStats = p.hasStats !== false && (apps > 0 || p.rating);
        
        let summary = `${p.name} (Rating: ${rating}, Apps: ${apps})`;
        
        if (p.position === 'Goalkeeper' && p.saves) {
          summary += ` - ${p.saves} saves, ${p.cleanSheets || 0} clean sheets`;
        } else if (goals > 0 || assists > 0) {
          summary += ` - ${goals}G, ${assists}A`;
        }
        
        if (p.tackles > 0 || p.interceptions > 0) {
          summary += ` [${p.tackles}T, ${p.interceptions}I]`;
        }
        
        // Note for recent transfers
        if (!hasStats) {
          summary += ` [RECENT TRANSFER - No stats yet]`;
        }
        
        return summary;
      };
      
      let output = '';
      
      if (goalkeepers.length > 0) {
        output += '\n\n  GOALKEEPERS (Top rated):\n';
        goalkeepers.slice(0, 2).forEach(p => {
          output += `    • ${formatPlayer(p)}\n`;
        });
      }
      
      if (defenders.length > 0) {
        output += '\n  DEFENDERS (Top 3 by rating):\n';
        defenders.slice(0, 3).forEach(p => {
          output += `    • ${formatPlayer(p)}\n`;
        });
      }
      
      if (midfielders.length > 0) {
        output += '\n  MIDFIELDERS (Top 3 by rating):\n';
        midfielders.slice(0, 3).forEach(p => {
          output += `    • ${formatPlayer(p)}\n`;
        });
      }
      
      if (attackers.length > 0) {
        output += '\n  🎯 ATTACKERS (Top 5 by rating) - KEY GOAL THREATS:\n';
        attackers.slice(0, 5).forEach(p => {
          output += `    ⚡ ${formatPlayer(p)}\n`;
        });
      }
      
      return output;
    };
    
    return `
═══════════════════════════════════════════════════════════════
SQUAD ANALYSIS - PLAYER RATINGS & PERFORMANCE (CURRENT SQUAD)
═══════════════════════════════════════════════════════════════
⚠️ Only showing current squad members (no transferred players)

HOME TEAM SQUAD:
${formatSquad(matchData.homeSquad, 'Home')}

AWAY TEAM SQUAD:
${formatSquad(matchData.awaySquad, 'Away')}
`;
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
  // CLAUDE API INTEGRATION (Anthropic)
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