/**
 * ═══════════════════════════════════════════════════════════════
 * FORMATTERS - Date, number, and display formatting utilities
 * ═══════════════════════════════════════════════════════════════
 */

const Formatters = {
  /**
   * Format date for display
   */
  formatDate(dateString, options = {}) {
    const date = new Date(dateString);
    const defaults = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', { ...defaults, ...options });
  },

  /**
   * Format date as relative time
   */
  formatRelativeDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days === 0 && hours < 1) {
      return 'Starting soon';
    } else if (days === 0) {
      return `In ${hours}h`;
    } else if (days === 1) {
      return 'Tomorrow';
    } else {
      return `In ${days} days`;
    }
  },

  /**
   * Format number with specified decimal places
   */
  formatNumber(num, decimals = 2) {
    if (num === null || num === undefined) return 'N/A';
    return parseFloat(num).toFixed(decimals);
  },

  /**
   * Format percentage
   */
  formatPercent(num, decimals = 1) {
    if (num === null || num === undefined) return 'N/A';
    return `${parseFloat(num).toFixed(decimals)}%`;
  },

  /**
   * Format form string (WDLWW -> badges)
   */
  formatForm(formString) {
    if (!formString) return '';
    return formString.split('').map(result => {
      const classes = {
        'W': 'win',
        'D': 'draw',
        'L': 'loss'
      };
      return `<span class="result-badge ${classes[result] || ''}">${result}</span>`;
    }).join('');
  },

  /**
   * Format form as trend badges
   */
  formatFormTrend(formString) {
    if (!formString) return '';
    return formString.split('').map(result =>
      `<span class="form-trend-item ${result}">${result}</span>`
    ).join('');
  },

  /**
   * Get confidence badge class
   */
  getConfidenceBadgeClass(level) {
    const classes = {
      'HIGH': 'badge-high',
      'MODERATE': 'badge-moderate',
      'LOW': 'badge-low'
    };
    return classes[level] || 'badge-neutral';
  },

  /**
   * Get injury impact class
   */
  getInjuryImpactClass(impact) {
    const classes = {
      'none': 'none',
      'minor': 'minor',
      'significant': 'significant',
      'severe': 'severe'
    };
    return classes[impact] || 'none';
  },

  /**
   * Format player rating with color class
   */
  formatRating(rating) {
    const num = parseFloat(rating);
    if (isNaN(num)) return { value: 'N/A', class: 'average' };

    let ratingClass = 'average';
    if (num >= 7.5) ratingClass = 'elite';
    else if (num >= 7.0) ratingClass = 'good';

    return {
      value: num.toFixed(2),
      class: ratingClass
    };
  },

  /**
   * Format scoreline with probability
   */
  formatScoreline(scoreline) {
    return {
      score: scoreline.score,
      probability: this.formatPercent(scoreline.probability * 100, 1)
    };
  },

  /**
   * Truncate text with ellipsis
   */
  truncate(text, maxLength = 20) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  },

  /**
   * Calculate xG delta and format
   */
  formatXGDelta(homeXG, awayXG) {
    const delta = parseFloat(homeXG) - parseFloat(awayXG);
    return {
      value: delta.toFixed(2),
      class: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral',
      arrow: delta > 0 ? '↑' : delta < 0 ? '↓' : '='
    };
  },

  /**
   * Format match record (5W-3D-2L)
   */
  formatRecord(wins, draws, losses) {
    return `${wins}W-${draws}D-${losses}L`;
  },

  /**
   * Calculate points from form
   */
  calculateFormPoints(formString) {
    if (!formString) return 0;
    let points = 0;
    formString.split('').forEach(result => {
      if (result === 'W') points += 3;
      else if (result === 'D') points += 1;
    });
    return points;
  },

  /**
   * Get ordinal suffix (1st, 2nd, 3rd, etc.)
   */
  getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Formatters;
}
window.Formatters = Formatters;
