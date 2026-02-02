/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SCORELINE CALCULATOR SERVICE - PROFESSIONAL QUANTITATIVE MODEL
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Full Stack:
 * 1. xG-based Poisson Distribution
 * 2. Dixon-Coles Low-Score Correlation Correction
 * 3. Player On/Off Impact (xG contribution per player)
 * 4. Exponential Form Decay (recent matches weighted higher)
 * 5. Market Calibration (shrinkage toward efficient market odds)
 * 
 * Core Formula:
 * λ_home = LeagueAvgHomeGoals × HomeAttackStrength × AwayDefenseWeakness × HomeAdvantage
 * λ_away = LeagueAvgAwayGoals × AwayAttackStrength × HomeDefenseWeakness
 * 
 * Then adjusted for:
 * - Player availability (on/off xG impact)
 * - Recent form (exponential decay weighting)
 * - Market calibration (blend toward market-implied probabilities)
 */

class ScorelineCalculator {
  constructor() {
    // ═══════════════════════════════════════════════════════════════
    // DEFAULT LEAGUE BASELINE PARAMETERS (Top 5 European Leagues Average)
    // These are overridden by actual league stats when available
    // ═══════════════════════════════════════════════════════════════
    this.DEFAULT_AVG_HOME_GOALS = 1.52;    // Default average home goals per game
    this.DEFAULT_AVG_AWAY_GOALS = 1.18;    // Default average away goals per game
    this.DEFAULT_AVG_TOTAL_GOALS = 2.70;   // Default average total goals per game
    
    // Active league averages (updated per analysis)
    this.LEAGUE_AVG_HOME_GOALS = this.DEFAULT_AVG_HOME_GOALS;
    this.LEAGUE_AVG_AWAY_GOALS = this.DEFAULT_AVG_AWAY_GOALS;
    this.LEAGUE_AVG_TOTAL_GOALS = this.DEFAULT_AVG_TOTAL_GOALS;
    
    // ═══════════════════════════════════════════════════════════════
    // MODEL PARAMETERS
    // ═══════════════════════════════════════════════════════════════
    
    // Home Advantage (industry standard: 1.10-1.15)
    this.HOME_ADVANTAGE = 1.12;
    
    // Form Decay Parameters (exponential half-life ~2.5 games)
    this.SEASON_WEIGHT = 0.55;            // 55% season stats
    this.FORM_WEIGHT = 0.45;              // 45% recent form
    this.FORM_DECAY_RATE = 0.75;          // Each game is 75% as important as previous
    
    // Dixon-Coles Correlation (ρ)
    // Negative = low scores slightly more correlated
    // Industry standard: -0.10 to -0.15
    this.DIXON_COLES_RHO = -0.13;
    
    // Market Calibration Parameters
    this.MARKET_CALIBRATION_WEIGHT = 0.25; // 25% blend toward market odds
    this.OVERROUND_ASSUMPTION = 1.05;      // Assume 5% overround in market odds
    
    // λ Bounds (prevents extreme predictions)
    this.MIN_LAMBDA = 0.50;
    this.MAX_LAMBDA = 3.20;
    
    // ═══════════════════════════════════════════════════════════════
    // PLAYER ON/OFF IMPACT PARAMETERS
    // ═══════════════════════════════════════════════════════════════
    // Based on typical xG contribution by position for key players
    
    this.PLAYER_XG_IMPACT = {
      // Attackers (typically contribute 15-25% of team xG if key)
      starStriker: 0.20,          // Elite striker (Haaland, Kane)
      keyAttacker: 0.14,          // Regular starting striker
      rotationAttacker: 0.08,     // Backup/rotation forward
      
      // Midfielders (typically contribute 8-15% of team xG)
      attackingMid: 0.12,         // CAM, creative midfielder
      boxToBox: 0.07,             // B2B with goal threat
      defensiveMid: 0.03,         // CDM, minimal goal contribution
      
      // Defenders (impact on opponent's xG)
      starDefender: 0.10,         // Elite CB reduces opponent xG
      keyDefender: 0.07,          // Regular CB
      fullback: 0.04,             // FB impact
      
      // Goalkeeper
      goalkeeper: 0.08            // GK on/off impact on xGA
    };
    
    // Player identification thresholds
    this.STAR_PLAYER_GOALS = 10;          // 10+ goals = star attacker
    this.KEY_PLAYER_GOALS = 5;            // 5+ goals = key attacker
    this.STAR_PLAYER_RATING = 7.5;        // Rating threshold for "star"
    this.KEY_PLAYER_RATING = 7.0;         // Rating threshold for "key"
  }

  // ═══════════════════════════════════════════════════════════════
  // LEAGUE STATS CONFIGURATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Update league averages from actual league statistics
   * @param {Object} leagueStats - League statistics object
   */
  _updateLeagueAverages(leagueStats) {
    if (leagueStats && leagueStats.stats) {
      const stats = leagueStats.stats;
      
      // Use actual league averages if available
      if (stats.avgHomeGoals) {
        this.LEAGUE_AVG_HOME_GOALS = parseFloat(stats.avgHomeGoals);
      } else {
        this.LEAGUE_AVG_HOME_GOALS = this.DEFAULT_AVG_HOME_GOALS;
      }
      
      if (stats.avgAwayGoals) {
        this.LEAGUE_AVG_AWAY_GOALS = parseFloat(stats.avgAwayGoals);
      } else {
        this.LEAGUE_AVG_AWAY_GOALS = this.DEFAULT_AVG_AWAY_GOALS;
      }
      
      if (stats.goalsPerGame) {
        this.LEAGUE_AVG_TOTAL_GOALS = parseFloat(stats.goalsPerGame);
      } else {
        this.LEAGUE_AVG_TOTAL_GOALS = this.DEFAULT_AVG_TOTAL_GOALS;
      }
      
      console.log(`   📊 Using ${leagueStats.league} averages: Home=${this.LEAGUE_AVG_HOME_GOALS}, Away=${this.LEAGUE_AVG_AWAY_GOALS}, Total=${this.LEAGUE_AVG_TOTAL_GOALS}`);
    } else {
      // Reset to defaults if no league stats provided
      this.LEAGUE_AVG_HOME_GOALS = this.DEFAULT_AVG_HOME_GOALS;
      this.LEAGUE_AVG_AWAY_GOALS = this.DEFAULT_AVG_AWAY_GOALS;
      this.LEAGUE_AVG_TOTAL_GOALS = this.DEFAULT_AVG_TOTAL_GOALS;
      console.log(`   📊 Using default league averages: Home=${this.LEAGUE_AVG_HOME_GOALS}, Away=${this.LEAGUE_AVG_AWAY_GOALS}, Total=${this.LEAGUE_AVG_TOTAL_GOALS}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CORE MATHEMATICAL FUNCTIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Factorial (for Poisson formula)
   */
  factorial(n) {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  /**
   * Poisson probability: P(X = k) = (λ^k × e^-λ) / k!
   */
  poissonProbability(lambda, k) {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / this.factorial(k);
  }

  /**
   * Dixon-Coles adjustment τ(x, y, λ, μ, ρ)
   * Corrects joint probability for 0-0, 1-0, 0-1, 1-1
   */
  dixonColesAdjustment(homeGoals, awayGoals, homeLambda, awayLambda, rho = this.DIXON_COLES_RHO) {
    if (homeGoals === 0 && awayGoals === 0) {
      return 1 - homeLambda * awayLambda * rho;
    } else if (homeGoals === 0 && awayGoals === 1) {
      return 1 + homeLambda * rho;
    } else if (homeGoals === 1 && awayGoals === 0) {
      return 1 + awayLambda * rho;
    } else if (homeGoals === 1 && awayGoals === 1) {
      return 1 - rho;
    }
    return 1.0;
  }

  /**
   * Exponential form decay weights
   * Returns array of weights for last N games
   */
  getFormDecayWeights(numGames = 5) {
    const weights = [];
    for (let i = 0; i < numGames; i++) {
      weights.push(Math.pow(this.FORM_DECAY_RATE, i));
    }
    // Normalize to sum to 1
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map(w => w / sum);
  }

  // ═══════════════════════════════════════════════════════════════
  // ATTACK/DEFENSE STRENGTH CALCULATIONS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Calculate Attack Strength (dimensionless ratio)
   */
  calculateAttackStrength(teamStats, isHome = false) {
    if (!teamStats) return 1.0;
    
    const goalsScored = parseFloat(teamStats.goalsFor) || 0;
    const gamesPlayed = parseFloat(teamStats.played) || 1;
    const teamAvgGoals = goalsScored / gamesPlayed;
    
    const leagueAvg = isHome ? this.LEAGUE_AVG_HOME_GOALS : this.LEAGUE_AVG_AWAY_GOALS;
    const attackStrength = teamAvgGoals / leagueAvg;
    
    return Math.max(0.50, Math.min(2.00, attackStrength));
  }

  /**
   * Calculate Defense Weakness (dimensionless ratio)
   */
  calculateDefenseWeakness(teamStats, isHome = false) {
    if (!teamStats) return 1.0;
    
    const goalsConceded = parseFloat(teamStats.goalsAgainst) || 0;
    const gamesPlayed = parseFloat(teamStats.played) || 1;
    const teamAvgConceded = goalsConceded / gamesPlayed;
    
    const leagueAvg = isHome ? this.LEAGUE_AVG_AWAY_GOALS : this.LEAGUE_AVG_HOME_GOALS;
    const defenseWeakness = teamAvgConceded / leagueAvg;
    
    return Math.max(0.50, Math.min(2.00, defenseWeakness));
  }

  // ═══════════════════════════════════════════════════════════════
  // FORM DECAY CALCULATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Calculate form-weighted goals using exponential decay
   */
  calculateFormGoals(recentMatches, isAttack = true) {
    if (!recentMatches?.matches || recentMatches.matches.length === 0) return null;
    
    const matches = recentMatches.matches.slice(0, 5);
    const weights = this.getFormDecayWeights(matches.length);
    
    let weightedGoals = 0;
    
    matches.forEach((match, idx) => {
      const scoreParts = match.score?.split('-');
      if (!scoreParts || scoreParts.length !== 2) return;
      
      const [homeGoals, awayGoals] = scoreParts.map(Number);
      const goals = isAttack
        ? (match.venue === 'H' ? homeGoals : awayGoals)
        : (match.venue === 'H' ? awayGoals : homeGoals);
      
      weightedGoals += goals * weights[idx];
    });
    
    return weightedGoals;
  }

  /**
   * Calculate form-based attack/defense adjustments
   */
  calculateFormAdjustment(recentMatches, isHome, leagueAvg) {
    const formGoals = this.calculateFormGoals(recentMatches, true);
    const formConceded = this.calculateFormGoals(recentMatches, false);
    
    if (formGoals === null) return { attackAdj: 1.0, defenseAdj: 1.0 };
    
    // Compare form to expected
    const expectedGoals = isHome ? this.LEAGUE_AVG_HOME_GOALS : this.LEAGUE_AVG_AWAY_GOALS;
    const expectedConceded = isHome ? this.LEAGUE_AVG_AWAY_GOALS : this.LEAGUE_AVG_HOME_GOALS;
    
    const attackAdj = formGoals / expectedGoals;
    const defenseAdj = formConceded / expectedConceded;
    
    return {
      attackAdj: Math.max(0.6, Math.min(1.6, attackAdj)),
      defenseAdj: Math.max(0.6, Math.min(1.6, defenseAdj)),
      formGoals,
      formConceded
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // PLAYER ON/OFF IMPACT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Classify a player's importance based on stats
   */
  classifyPlayer(player) {
    const goals = player.goals || 0;
    const assists = player.assists || 0;
    const rating = player.rating || 6.0;
    const position = player.position || '';
    
    // Determine role based on position and output
    if (position === 'Attacker' || position === 'Forward') {
      if (goals >= this.STAR_PLAYER_GOALS || rating >= this.STAR_PLAYER_RATING) {
        return { role: 'starStriker', isAttacker: true };
      } else if (goals >= this.KEY_PLAYER_GOALS || rating >= this.KEY_PLAYER_RATING) {
        return { role: 'keyAttacker', isAttacker: true };
      }
      return { role: 'rotationAttacker', isAttacker: true };
    }
    
    if (position === 'Midfielder') {
      if (goals >= 5 || assists >= 8 || rating >= this.STAR_PLAYER_RATING) {
        return { role: 'attackingMid', isAttacker: true };
      } else if (goals >= 2 || assists >= 4) {
        return { role: 'boxToBox', isAttacker: true };
      }
      return { role: 'defensiveMid', isAttacker: false };
    }
    
    if (position === 'Defender') {
      if (rating >= this.STAR_PLAYER_RATING) {
        return { role: 'starDefender', isAttacker: false };
      } else if (rating >= this.KEY_PLAYER_RATING) {
        return { role: 'keyDefender', isAttacker: false };
      }
      return { role: 'fullback', isAttacker: false };
    }
    
    if (position === 'Goalkeeper') {
      return { role: 'goalkeeper', isAttacker: false };
    }
    
    return { role: 'unknown', isAttacker: false };
  }

  /**
   * Calculate total xG impact from missing players
   * Returns { attackImpact, defenseImpact } as multipliers
   */
  calculatePlayerOnOffImpact(injuries, squad) {
    if (!injuries || injuries.length === 0) {
      return { 
        attackMultiplier: 1.0, 
        defenseMultiplier: 1.0,
        totalAttackReduction: 0,
        totalDefenseIncrease: 0,
        missingPlayers: []
      };
    }
    
    let totalAttackReduction = 0;  // Reduces own xG
    let totalDefenseIncrease = 0;  // Increases opponent xG
    const missingPlayers = [];
    
    // Create lookup of squad players
    const squadMap = new Map();
    (squad || []).forEach(p => {
      if (p.name) squadMap.set(p.name.toLowerCase(), p);
    });
    
    injuries.forEach(injury => {
      const playerName = (injury.player || '').toLowerCase();
      
      // Find player in squad
      let matchedPlayer = null;
      for (const [name, player] of squadMap) {
        if (playerName.includes(name) || name.includes(playerName)) {
          matchedPlayer = player;
          break;
        }
      }
      
      if (matchedPlayer) {
        const classification = this.classifyPlayer(matchedPlayer);
        const impact = this.PLAYER_XG_IMPACT[classification.role] || 0;
        
        if (classification.isAttacker) {
          totalAttackReduction += impact;
        } else {
          totalDefenseIncrease += impact;
        }
        
        missingPlayers.push({
          name: matchedPlayer.name,
          position: matchedPlayer.position,
          role: classification.role,
          impact: impact,
          isAttacker: classification.isAttacker
        });
      }
    });
    
    // Cap total impact at reasonable levels
    totalAttackReduction = Math.min(0.40, totalAttackReduction);   // Max 40% xG reduction
    totalDefenseIncrease = Math.min(0.30, totalDefenseIncrease);   // Max 30% xGA increase
    
    return {
      attackMultiplier: 1 - totalAttackReduction,
      defenseMultiplier: 1 + totalDefenseIncrease,
      totalAttackReduction,
      totalDefenseIncrease,
      missingPlayers
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPECTED GOALS (λ) CALCULATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Calculate base λ using the core formula
   */
  calculateBaseExpectedGoals(homeStats, awayStats) {
    const homeAttack = this.calculateAttackStrength(homeStats, true);
    const homeDefense = this.calculateDefenseWeakness(homeStats, true);
    const awayAttack = this.calculateAttackStrength(awayStats, false);
    const awayDefense = this.calculateDefenseWeakness(awayStats, false);
    
    // Core formula
    const homeLambda = this.LEAGUE_AVG_HOME_GOALS * homeAttack * awayDefense;
    const awayLambda = this.LEAGUE_AVG_AWAY_GOALS * awayAttack * homeDefense;
    
    return {
      homeLambda,
      awayLambda,
      components: {
        homeAttackStrength: homeAttack.toFixed(3),
        homeDefenseWeakness: homeDefense.toFixed(3),
        awayAttackStrength: awayAttack.toFixed(3),
        awayDefenseWeakness: awayDefense.toFixed(3)
      }
    };
  }

  /**
   * Full λ calculation with all adjustments
   */
  calculateExpectedGoals(matchData) {
    const { homeStats, awayStats, homeRecentMatches, awayRecentMatches,
            homeInjuries, awayInjuries, homeSquad, awaySquad } = matchData;
    
    // Step 1: Base calculation
    const base = this.calculateBaseExpectedGoals(homeStats, awayStats);
    let homeLambda = base.homeLambda;
    let awayLambda = base.awayLambda;
    
    // Step 2: Form decay adjustment
    const homeForm = this.calculateFormAdjustment(homeRecentMatches, true);
    const awayForm = this.calculateFormAdjustment(awayRecentMatches, false);
    
    // Blend season and form (55/45)
    homeLambda = (this.SEASON_WEIGHT * homeLambda) + 
                 (this.FORM_WEIGHT * homeLambda * homeForm.attackAdj);
    awayLambda = (this.SEASON_WEIGHT * awayLambda) + 
                 (this.FORM_WEIGHT * awayLambda * awayForm.attackAdj);
    
    // Step 3: Home advantage
    homeLambda *= this.HOME_ADVANTAGE;
    
    // Step 4: Player on/off impact
    const homePlayerImpact = this.calculatePlayerOnOffImpact(homeInjuries, homeSquad);
    const awayPlayerImpact = this.calculatePlayerOnOffImpact(awayInjuries, awaySquad);
    
    // Home missing attackers reduce home xG
    homeLambda *= homePlayerImpact.attackMultiplier;
    // Away missing attackers reduce away xG
    awayLambda *= awayPlayerImpact.attackMultiplier;
    
    // Home missing defenders increase away xG
    awayLambda *= homePlayerImpact.defenseMultiplier;
    // Away missing defenders increase home xG
    homeLambda *= awayPlayerImpact.defenseMultiplier;
    
    // Step 5: Clamp to bounds
    homeLambda = Math.max(this.MIN_LAMBDA, Math.min(this.MAX_LAMBDA, homeLambda));
    awayLambda = Math.max(this.MIN_LAMBDA, Math.min(this.MAX_LAMBDA, awayLambda));
    
    return {
      homeLambda,
      awayLambda,
      components: {
        ...base.components,
        baseLambdaHome: base.homeLambda.toFixed(2),
        baseLambdaAway: base.awayLambda.toFixed(2),
        homeFormAdj: homeForm.attackAdj.toFixed(3),
        awayFormAdj: awayForm.attackAdj.toFixed(3),
        homeFormGoals: homeForm.formGoals?.toFixed(2) || 'N/A',
        awayFormGoals: awayForm.formGoals?.toFixed(2) || 'N/A'
      },
      playerImpact: {
        home: homePlayerImpact,
        away: awayPlayerImpact
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MARKET CALIBRATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Convert market odds to implied probabilities (removing overround)
   */
  marketOddsToProb(marketOdds) {
    if (!marketOdds) return null;
    
    // Parse market percentages
    const homeOdds = parseFloat(marketOdds.home?.replace('%', '')) || 0;
    const drawOdds = parseFloat(marketOdds.draw?.replace('%', '')) || 0;
    const awayOdds = parseFloat(marketOdds.away?.replace('%', '')) || 0;
    
    const total = homeOdds + drawOdds + awayOdds;
    if (total === 0) return null;
    
    // Remove overround (normalize to 100%)
    return {
      homeWin: homeOdds / total,
      draw: drawOdds / total,
      awayWin: awayOdds / total
    };
  }

  /**
   * Calibrate model probabilities toward market
   * Uses shrinkage: final = (1-w)*model + w*market
   */
  calibrateToMarket(modelProbs, marketOdds) {
    const marketProbs = this.marketOddsToProb(marketOdds);
    
    if (!marketProbs) {
      return modelProbs; // No calibration if no market data
    }
    
    const w = this.MARKET_CALIBRATION_WEIGHT;
    
    return {
      homeWin: ((1 - w) * modelProbs.homeWin + w * marketProbs.homeWin),
      draw: ((1 - w) * modelProbs.draw + w * marketProbs.draw),
      awayWin: ((1 - w) * modelProbs.awayWin + w * marketProbs.awayWin)
    };
  }

  /**
   * Reverse-engineer λ from calibrated outcome probabilities
   * This adjusts our xG to match calibrated 1X2 outcomes
   */
  adjustLambdaForCalibration(homeLambda, awayLambda, calibratedProbs, rawProbs) {
    // Calculate the ratio of calibrated to raw probabilities
    const homeRatio = calibratedProbs.homeWin / rawProbs.homeWin;
    const awayRatio = calibratedProbs.awayWin / rawProbs.awayWin;
    
    // Adjust λ proportionally (simplified approach)
    // If calibrated home win is higher, boost home λ slightly
    const lambdaAdjustment = Math.pow(homeRatio / awayRatio, 0.15);
    
    return {
      homeLambda: homeLambda * Math.sqrt(lambdaAdjustment),
      awayLambda: awayLambda / Math.sqrt(lambdaAdjustment)
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SCORELINE PROBABILITY MATRIX
  // ═══════════════════════════════════════════════════════════════

  /**
   * Generate scoreline matrix with Dixon-Coles correction
   */
  generateScorelineMatrix(homeLambda, awayLambda) {
    const scorelines = [];
    let totalProb = 0;
    
    for (let homeGoals = 0; homeGoals <= 7; homeGoals++) {
      for (let awayGoals = 0; awayGoals <= 7; awayGoals++) {
        const homeProb = this.poissonProbability(homeLambda, homeGoals);
        const awayProb = this.poissonProbability(awayLambda, awayGoals);
        const dcAdj = this.dixonColesAdjustment(homeGoals, awayGoals, homeLambda, awayLambda);
        
        const jointProb = homeProb * awayProb * dcAdj;
        totalProb += jointProb;
        
        scorelines.push({
          score: `${homeGoals}-${awayGoals}`,
          homeGoals,
          awayGoals,
          probability: jointProb,
          dcAdjustment: dcAdj
        });
      }
    }
    
    // Normalize
    scorelines.forEach(s => {
      s.probability = s.probability / totalProb;
      s.percentageStr = (s.probability * 100).toFixed(1) + '%';
    });
    
    return scorelines.sort((a, b) => b.probability - a.probability);
  }

  /**
   * Calculate goal distribution for a single team
   */
  calculateGoalDistribution(lambda) {
    const distribution = [];
    for (let goals = 0; goals <= 6; goals++) {
      distribution.push({
        goals,
        probability: this.poissonProbability(lambda, goals)
      });
    }
    return distribution;
  }

  // ═══════════════════════════════════════════════════════════════
  // OUTCOME PROBABILITIES
  // ═══════════════════════════════════════════════════════════════

  /**
   * Calculate raw outcome probabilities from λ
   */
  calculateOutcomeProbabilities(homeLambda, awayLambda) {
    const matrix = this.generateScorelineMatrix(homeLambda, awayLambda);
    
    let homeWin = 0, draw = 0, awayWin = 0;
    
    matrix.forEach(s => {
      if (s.homeGoals > s.awayGoals) homeWin += s.probability;
      else if (s.homeGoals === s.awayGoals) draw += s.probability;
      else awayWin += s.probability;
    });
    
    return { homeWin, draw, awayWin };
  }

  /**
   * Calculate BTTS probability
   */
  calculateBTTS(homeLambda, awayLambda) {
    const homeScores = 1 - this.poissonProbability(homeLambda, 0);
    const awayScores = 1 - this.poissonProbability(awayLambda, 0);
    
    return {
      probability: (homeScores * awayScores * 100).toFixed(1),
      homeScoresProb: (homeScores * 100).toFixed(1),
      awayScoresProb: (awayScores * 100).toFixed(1)
    };
  }

  /**
   * Calculate Over/Under probabilities
   */
  calculateOverUnder(homeLambda, awayLambda) {
    const matrix = this.generateScorelineMatrix(homeLambda, awayLambda);
    
    let over05 = 0, over15 = 0, over25 = 0, over35 = 0, over45 = 0;
    
    matrix.forEach(s => {
      const total = s.homeGoals + s.awayGoals;
      if (total > 0.5) over05 += s.probability;
      if (total > 1.5) over15 += s.probability;
      if (total > 2.5) over25 += s.probability;
      if (total > 3.5) over35 += s.probability;
      if (total > 4.5) over45 += s.probability;
    });
    
    return {
      over05: (over05 * 100).toFixed(1),
      over15: (over15 * 100).toFixed(1),
      over25: (over25 * 100).toFixed(1),
      over35: (over35 * 100).toFixed(1),
      over45: (over45 * 100).toFixed(1),
      under15: ((1 - over15) * 100).toFixed(1),
      under25: ((1 - over25) * 100).toFixed(1),
      under35: ((1 - over35) * 100).toFixed(1)
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SUPPORTING ANALYSIS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Analyze player quality for context
   */
  analyzePlayerQuality(attackingSquad, defendingSquad) {
    const getTop = (squad, pos, n = 3) => (squad || [])
      .filter(p => p.position === pos)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, n);
    
    const attackers = getTop(attackingSquad, 'Attacker');
    const defenders = getTop(defendingSquad, 'Defender');
    
    const avgAttack = attackers.length > 0
      ? attackers.reduce((s, p) => s + (p.rating || 6.5), 0) / attackers.length : 6.5;
    const avgDefense = defenders.length > 0
      ? defenders.reduce((s, p) => s + (p.rating || 6.5), 0) / defenders.length : 6.5;
    
    return {
      attackRating: avgAttack.toFixed(2),
      defenseRating: avgDefense.toFixed(2),
      delta: (avgAttack - avgDefense).toFixed(2),
      eliteAttackers: attackers.filter(p => (p.rating || 0) >= 7.5).length,
      eliteDefenders: defenders.filter(p => (p.rating || 0) >= 7.5).length
    };
  }

  /**
   * Calculate venue splits from recent matches
   */
  calculateVenueSplits(recentMatches) {
    if (!recentMatches?.matches) return { home: null, away: null };
    
    const calcSplit = (matches, venue) => {
      const filtered = matches.filter(m => m.venue === venue);
      if (filtered.length === 0) return null;
      
      let gf = 0, ga = 0, w = 0, d = 0, l = 0;
      filtered.forEach(m => {
        const parts = m.score?.split('-');
        if (!parts || parts.length !== 2) return;
        const [hg, ag] = parts.map(Number);
        gf += venue === 'H' ? hg : ag;
        ga += venue === 'H' ? ag : hg;
        if (m.result === 'W') w++;
        else if (m.result === 'D') d++;
        else l++;
      });
      
      return {
        played: filtered.length,
        record: `${w}W-${d}D-${l}L`,
        goalsFor: gf,
        goalsAgainst: ga,
        avgGoalsFor: (gf / filtered.length).toFixed(2),
        avgGoalsAgainst: (ga / filtered.length).toFixed(2)
      };
    };
    
    return {
      home: calcSplit(recentMatches.matches, 'H'),
      away: calcSplit(recentMatches.matches, 'A')
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MAIN ANALYSIS ENTRY POINT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Generate full match analysis
   * @param {Object} matchData - Match data
   * @param {Object} leagueStats - League statistics (optional)
   */
  generateFullAnalysis(matchData, leagueStats = null) {
    // Update league averages if league-specific stats are provided
    this._updateLeagueAverages(leagueStats);
    
    // Step 1: Calculate xG with all adjustments
    const xgCalc = this.calculateExpectedGoals(matchData);
    let { homeLambda, awayLambda } = xgCalc;
    
    // Step 2: Calculate raw outcome probabilities
    const rawOutcomes = this.calculateOutcomeProbabilities(homeLambda, awayLambda);
    
    // Step 3: Market calibration (if market odds available)
    const marketOdds = matchData.apiPrediction?.winProbability;
    let calibratedOutcomes = rawOutcomes;
    let wasCalibrated = false;
    
    if (marketOdds) {
      calibratedOutcomes = this.calibrateToMarket(rawOutcomes, marketOdds);
      
      // Adjust λ to match calibrated outcomes
      const adjusted = this.adjustLambdaForCalibration(
        homeLambda, awayLambda, calibratedOutcomes, rawOutcomes
      );
      homeLambda = Math.max(this.MIN_LAMBDA, Math.min(this.MAX_LAMBDA, adjusted.homeLambda));
      awayLambda = Math.max(this.MIN_LAMBDA, Math.min(this.MAX_LAMBDA, adjusted.awayLambda));
      wasCalibrated = true;
    }
    
    // Step 4: Generate all predictions with final λ
    const topScorelines = this.generateScorelineMatrix(homeLambda, awayLambda).slice(0, 12);
    const btts = this.calculateBTTS(homeLambda, awayLambda);
    const overUnder = this.calculateOverUnder(homeLambda, awayLambda);
    
    // Goal distributions
    const homeGoalDist = this.calculateGoalDistribution(homeLambda);
    const awayGoalDist = this.calculateGoalDistribution(awayLambda);
    
    // Supporting data
    const homePlayerQuality = this.analyzePlayerQuality(matchData.homeSquad, matchData.awaySquad);
    const awayPlayerQuality = this.analyzePlayerQuality(matchData.awaySquad, matchData.homeSquad);
    const homeVenueSplits = this.calculateVenueSplits(matchData.homeRecentMatches);
    const awayVenueSplits = this.calculateVenueSplits(matchData.awayRecentMatches);
    
    // Format injury impact for output
    const formatInjuryImpact = (impact) => ({
      multiplier: impact.attackMultiplier,
      keyPlayersOut: impact.missingPlayers.filter(p => p.impact >= 0.10).length,
      totalOut: impact.missingPlayers.length,
      reduction: (impact.totalAttackReduction * 100).toFixed(1),
      defenseImpact: (impact.totalDefenseIncrease * 100).toFixed(1),
      impact: impact.totalAttackReduction >= 0.15 ? 'severe' :
              impact.totalAttackReduction >= 0.08 ? 'moderate' :
              impact.totalAttackReduction > 0 ? 'minor' : 'none',
      missingPlayers: impact.missingPlayers
    });
    
    return {
      xG: {
        home: {
          base: xgCalc.components.baseLambdaHome,
          adjusted: homeLambda.toFixed(2),
          final: homeLambda.toFixed(2),
          formXG: xgCalc.components.homeFormGoals
        },
        away: {
          base: xgCalc.components.baseLambdaAway,
          adjusted: awayLambda.toFixed(2),
          final: awayLambda.toFixed(2),
          formXG: xgCalc.components.awayFormGoals
        },
        delta: (homeLambda - awayLambda).toFixed(2),
        totalExpected: (homeLambda + awayLambda).toFixed(2),
        components: xgCalc.components
      },
      goalDistribution: {
        home: homeGoalDist,
        away: awayGoalDist
      },
      playerQuality: {
        home: homePlayerQuality,
        away: awayPlayerQuality
      },
      injuryImpact: {
        home: formatInjuryImpact(xgCalc.playerImpact.home),
        away: formatInjuryImpact(xgCalc.playerImpact.away)
      },
      venueSplits: {
        home: homeVenueSplits,
        away: awayVenueSplits
      },
      predictions: {
        topScorelines,
        mostLikely: topScorelines[0],
        outcomes: {
          homeWin: (calibratedOutcomes.homeWin * 100).toFixed(1),
          draw: (calibratedOutcomes.draw * 100).toFixed(1),
          awayWin: (calibratedOutcomes.awayWin * 100).toFixed(1)
        },
        rawOutcomes: {
          homeWin: (rawOutcomes.homeWin * 100).toFixed(1),
          draw: (rawOutcomes.draw * 100).toFixed(1),
          awayWin: (rawOutcomes.awayWin * 100).toFixed(1)
        },
        btts,
        overUnder
      },
      marketCalibration: {
        applied: wasCalibrated,
        weight: this.MARKET_CALIBRATION_WEIGHT,
        marketOdds: marketOdds || null
      },
      confidence: this._calculateConfidence(matchData, xgCalc.playerImpact),
      methodology: {
        model: 'xG-Poisson + Dixon-Coles + Player On/Off + Form Decay + Market Calibration',
        version: '2.0',
        leagueAverages: {
          homeGoals: this.LEAGUE_AVG_HOME_GOALS,
          awayGoals: this.LEAGUE_AVG_AWAY_GOALS,
          totalGoals: this.LEAGUE_AVG_TOTAL_GOALS
        },
        homeAdvantage: this.HOME_ADVANTAGE,
        formWeight: `${this.FORM_WEIGHT * 100}%`,
        formDecayRate: this.FORM_DECAY_RATE,
        dixonColesRho: this.DIXON_COLES_RHO,
        marketCalibrationWeight: `${this.MARKET_CALIBRATION_WEIGHT * 100}%`
      }
    };
  }

  /**
   * Calculate confidence score
   */
  _calculateConfidence(matchData, playerImpact) {
    let score = 70;
    
    // Data quality
    if (matchData.homeStats?.played >= 15 && matchData.awayStats?.played >= 15) score += 10;
    else if (matchData.homeStats?.played >= 10 && matchData.awayStats?.played >= 10) score += 5;
    
    if (matchData.h2h?.total >= 5) score += 5;
    if (matchData.standings) score += 3;
    
    // Form data
    if (matchData.homeRecentMatches?.matches?.length >= 5 &&
        matchData.awayRecentMatches?.matches?.length >= 5) score += 5;
    
    // Injury uncertainty
    const homeInjuryImpact = playerImpact.home.totalAttackReduction + playerImpact.home.totalDefenseIncrease;
    const awayInjuryImpact = playerImpact.away.totalAttackReduction + playerImpact.away.totalDefenseIncrease;
    
    if (homeInjuryImpact >= 0.20 || awayInjuryImpact >= 0.20) score -= 15;
    else if (homeInjuryImpact >= 0.10 || awayInjuryImpact >= 0.10) score -= 8;
    
    score = Math.max(25, Math.min(92, score));
    
    let level = 'MODERATE';
    if (score >= 78) level = 'HIGH';
    else if (score < 50) level = 'LOW';
    
    return { score, level, percentage: score + '%' };
  }
}

module.exports = ScorelineCalculator;
