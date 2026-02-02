/**
 * ═══════════════════════════════════════════════════════════════
 * AI ANALYSIS SERVICE
 * ═══════════════════════════════════════════════════════════════
 * Professional-grade AI-powered match analysis using Claude
 * - Data-driven structured prompts
 * - Integrated scoreline calculations
 * - Quantified metrics and probabilities
 * - Risk-aware confidence framing
 */

const axios = require('axios');
const { API_CONFIG, VALIDATION } = require('../config/constants');
const { buildAnalystPrompt } = require('../config/analyst-prompt-template');
const ScorelineCalculator = require('./scoreline-calculator.service');

class AIAnalysisService {
  constructor() {
    this.analysisCount = 0;
    this.scorelineCalculator = new ScorelineCalculator();
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

      // Step 1: Calculate scoreline analysis (pass league stats for accurate averages)
      console.log(`   📊 Calculating scoreline probabilities...`);
      const scorelineAnalysis = this.scorelineCalculator.generateFullAnalysis(matchData, leagueStats);

      // Step 2: Build structured prompt
      console.log(`   📝 Building professional analyst prompt...`);
      const prompt = buildAnalystPrompt(fixture, matchData, scorelineAnalysis, leagueStats);
      console.log(`   📏 Prompt size: ${prompt.length} characters`);

      // Step 3: Call Claude API
      console.log(`   ⏳ Requesting AI analysis (may take 30-60 seconds)...`);
      const response = await this._callClaudeAPI(prompt);

      // Step 4: Validate response
      if (!this._validatePrediction(response)) {
        console.warn(`   ⚠️  Prediction validation failed, but proceeding...`);
      }

      this.analysisCount++;

      return {
        analysis: response,
        calculatedMetrics: scorelineAnalysis,
        metadata: {
          generatedAt: new Date().toISOString(),
          model: API_CONFIG.anthropic.model,
          dataQuality: this._assessDataQuality(matchData),
          confidence: scorelineAnalysis.confidence
        }
      };
    } catch (error) {
      console.error(`   ❌ AI prediction error: ${error.message}`);
      throw error;
    }
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

    // Check for required sections from new format
    const requiredPatterns = [
      /model signal/i,
      /team.level/i,
      /player.*unit/i,
      /matchup/i,
      /risk/i,
      /confidence/i
    ];

    // At least 3 of the sections should be present
    const matchCount = requiredPatterns.filter(
      pattern => pattern.test(prediction)
    ).length;

    return matchCount >= 3;
  }

  /**
   * Assess quality of match data
   * @private
   */
  _assessDataQuality(matchData) {
    let quality = 0;
    let maxQuality = 10;

    if (matchData.homeStats && matchData.awayStats) quality += 2;
    if (matchData.homeRecentMatches?.matches?.length >= 3) quality++;
    if (matchData.awayRecentMatches?.matches?.length >= 3) quality++;
    if (matchData.h2h && matchData.h2h.total > 0) quality++;
    if (matchData.standings) quality++;
    if (matchData.apiPrediction) quality++;
    if (matchData.homeInjuries !== null && matchData.awayInjuries !== null) quality++;
    if (matchData.homeSquad?.length > 0 && matchData.awaySquad?.length > 0) quality += 2;

    const percentage = (quality / maxQuality * 100).toFixed(0);

    if (percentage >= 90) return 'Excellent';
    if (percentage >= 70) return 'Good';
    if (percentage >= 50) return 'Fair';
    return 'Limited';
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get scoreline calculator instance for external use
   */
  getScorelineCalculator() {
    return this.scorelineCalculator;
  }

  /**
   * Get analysis count
   */
  getAnalysisCount() {
    return this.analysisCount;
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AIAnalysisService;
