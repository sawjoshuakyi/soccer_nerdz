/**
 * ═══════════════════════════════════════════════════════════════
 * API CLIENT - Fetch wrapper with error handling
 * ═══════════════════════════════════════════════════════════════
 */

const API = {
  baseUrl: window.location.origin,

  /**
   * Make API request with error handling
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error.message);
      throw error;
    }
  },

  /**
   * Get fixtures for a league
   */
  async getFixtures(league) {
    return this.request(`/api/fixtures/${league}`);
  },

  /**
   * Get prediction for a fixture
   */
  async getPrediction(fixture) {
    return this.request('/api/predict', {
      method: 'POST',
      body: JSON.stringify({ fixture })
    });
  },

  /**
   * Get prediction by fixture ID
   */
  async getPredictionById(fixtureId) {
    return this.request(`/api/predictions/${fixtureId}`);
  },

  /**
   * Check if prediction exists
   */
  async checkPredictionStatus(fixtureId) {
    return this.request(`/api/predictions/status/${fixtureId}`);
  },

  /**
   * Get match data
   */
  async getMatchData(fixtureId) {
    return this.request(`/api/match-data/${fixtureId}`);
  },

  /**
   * Get league statistics
   */
  async getLeagueStats(league) {
    return this.request(`/api/league-stats/${league}`);
  },

  /**
   * Get system health
   */
  async getHealth() {
    return this.request('/api/health');
  },

  /**
   * Trigger prediction generation (admin)
   */
  async generatePredictions() {
    return this.request('/admin/generate-predictions', { method: 'POST' });
  },

  /**
   * Get generation status
   */
  async getGenerationStatus() {
    return this.request('/admin/generation-status');
  }
};

// Export for module systems, attach to window for browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}
window.API = API;
