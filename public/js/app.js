/**
 * ═══════════════════════════════════════════════════════════════
 * PREDICTAI - Main Application
 * ═══════════════════════════════════════════════════════════════
 * Professional soccer match prediction dashboard
 */

const App = {
  // Application state
  state: {
    currentLeague: 'epl',
    fixtures: [],
    selectedFixture: null,
    prediction: null,
    loading: false
  },

  // League configurations
  leagues: {
    epl: { name: 'Premier League', emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    bundesliga: { name: 'Bundesliga', emoji: '🇩🇪' },
    seriea: { name: 'Serie A', emoji: '🇮🇹' },
    laliga: { name: 'La Liga', emoji: '🇪🇸' },
    ligue1: { name: 'Ligue 1', emoji: '🇫🇷' },
    ucl: { name: 'Champions League', emoji: '⭐' },
    europa: { name: 'Europa League', emoji: '🏆' }
  },

  /**
   * Initialize the application
   */
  async init() {
    console.log('🚀 PredictAI initializing...');

    // Set up event listeners
    this.setupEventListeners();

    // Load initial data
    await this.loadFixtures();

    console.log('✅ PredictAI ready');
  },

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // League selector
    const leagueSelect = document.getElementById('league-select');
    if (leagueSelect) {
      leagueSelect.addEventListener('change', (e) => {
        this.state.currentLeague = e.target.value;
        this.loadFixtures();
      });
    }

    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }
  },

  /**
   * Load fixtures for current league
   */
  async loadFixtures() {
    this.setLoading(true);

    try {
      const fixtures = await API.getFixtures(this.state.currentLeague);
      this.state.fixtures = fixtures;
      this.renderFixturesList();

      // Auto-select first fixture if available
      if (fixtures.length > 0) {
        this.selectFixture(fixtures[0]);
      } else {
        this.renderEmptyState();
      }
    } catch (error) {
      console.error('Failed to load fixtures:', error);
      this.renderError('Failed to load fixtures. Please try again.');
    } finally {
      this.setLoading(false);
    }
  },

  /**
   * Select a fixture and load its prediction
   */
  async selectFixture(fixture) {
    this.state.selectedFixture = fixture;
    this.highlightSelectedFixture(fixture.fixture.id);
    this.setLoading(true);

    try {
      // Try to get prediction
      const result = await API.getPrediction(fixture);

      if (result.prediction) {
        this.state.prediction = result.prediction;
        this.renderPrediction(result.prediction);
      } else {
        this.renderNoPrediction();
      }
    } catch (error) {
      if (error.message.includes('404')) {
        this.renderNoPrediction();
      } else {
        this.renderError('Failed to load prediction');
      }
    } finally {
      this.setLoading(false);
    }
  },

  /**
   * Render fixtures list in sidebar
   */
  renderFixturesList() {
    const container = document.getElementById('fixtures-list');
    if (!container) return;

    if (this.state.fixtures.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📅</div>
          <div class="empty-state-title">No Upcoming Matches</div>
          <div class="empty-state-description">Check back later for upcoming fixtures</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.state.fixtures.map(f => {
      const match = f;
      const fixtureDate = new Date(match.fixture.date);
      const homeTeam = match.teams.home;
      const awayTeam = match.teams.away;

      return `
        <div class="match-card" data-fixture-id="${match.fixture.id}" onclick="App.selectFixture(${JSON.stringify(match).replace(/"/g, '&quot;')})">
          <div class="match-card-header">
            <span class="match-card-league">${this.leagues[this.state.currentLeague]?.emoji || '⚽'}</span>
            <span class="match-card-date">${Formatters.formatRelativeDate(match.fixture.date)}</span>
          </div>
          <div class="match-card-teams">
            <div class="match-card-team">
              <img src="${homeTeam.logo}" alt="${homeTeam.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚽</text></svg>'">
              <span class="match-card-team-name">${Formatters.truncate(homeTeam.name, 15)}</span>
            </div>
            <span class="match-card-vs">VS</span>
            <div class="match-card-team">
              <img src="${awayTeam.logo}" alt="${awayTeam.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚽</text></svg>'">
              <span class="match-card-team-name">${Formatters.truncate(awayTeam.name, 15)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * Highlight selected fixture
   */
  highlightSelectedFixture(fixtureId) {
    document.querySelectorAll('.match-card').forEach(card => {
      card.classList.remove('active');
      if (card.dataset.fixtureId == fixtureId) {
        card.classList.add('active');
      }
    });
  },

  /**
   * Render prediction dashboard
   */
  renderPrediction(prediction) {
    const container = document.getElementById('prediction-content');
    if (!container) return;

    const fixture = this.state.selectedFixture;
    const metrics = prediction.calculatedMetrics || {};
    const metadata = prediction.metadata || {};

    // Build the dashboard HTML
    container.innerHTML = `
      <!-- Match Header -->
      <div class="card full-width mb-6">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <img src="${fixture.teams.home.logo}" alt="" style="width: 64px; height: 64px; object-fit: contain;">
              <div>
                <h2 style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold);">
                  ${fixture.teams.home.name} vs ${fixture.teams.away.name}
                </h2>
                <p style="color: var(--color-text-muted);">
                  ${Formatters.formatDate(fixture.fixture.date)} • ${fixture.fixture.venue?.name || 'TBD'}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <img src="${fixture.teams.away.logo}" alt="" style="width: 64px; height: 64px; object-fit: contain;">
            </div>
          </div>
        </div>
      </div>

      <!-- KPI Row -->
      <div class="kpi-row mb-6">
        ${this.renderKPICards(metrics)}
      </div>

      <!-- Charts Row -->
      <div class="dashboard-grid">
        <!-- Outcome Probabilities -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Outcome Probabilities</span>
          </div>
          <div class="card-body">
            <div id="probability-bars"></div>
          </div>
        </div>

        <!-- xG Comparison -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Expected Goals (xG)</span>
          </div>
          <div class="card-body">
            <div id="xg-comparison"></div>
          </div>
        </div>

        <!-- Most Likely Scorelines -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Most Likely Scorelines</span>
          </div>
          <div class="card-body">
            <div id="scoreline-grid"></div>
          </div>
        </div>

        <!-- Scoreline Chart -->
        <div class="card two-thirds">
          <div class="card-header">
            <span class="card-title">Scoreline Probability Distribution</span>
          </div>
          <div class="card-body">
            <canvas id="scoreline-chart" height="200"></canvas>
          </div>
        </div>

        <!-- Confidence -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Model Confidence</span>
          </div>
          <div class="card-body" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div class="confidence-meter">
              <span class="confidence-value">${metadata.confidence?.percentage || 'N/A'}</span>
              <span class="confidence-label ${(metadata.confidence?.level || 'moderate').toLowerCase()}">${metadata.confidence?.level || 'MODERATE'}</span>
            </div>
            <p style="margin-top: var(--spacing-4); font-size: var(--font-size-sm); color: var(--color-text-muted); text-align: center;">
              Data Quality: ${metadata.dataQuality || 'N/A'}
            </p>
          </div>
        </div>

        <!-- AI Analysis -->
        <div class="card full-width">
          <div class="card-header">
            <span class="card-title">Professional Analysis</span>
            <span class="badge badge-info">AI Generated</span>
          </div>
          <div class="card-body">
            <div class="analysis-content" style="white-space: pre-wrap; font-size: var(--font-size-sm); line-height: 1.7; color: var(--color-text-secondary);">
              ${this.formatAnalysis(prediction.prediction || prediction.analysis)}
            </div>
          </div>
        </div>
      </div>
    `;

    // Render visualizations
    if (metrics.predictions) {
      Visualization.renderProbabilityBars('probability-bars', metrics.predictions.outcomes);
      Visualization.renderScorelineGrid('scoreline-grid', metrics.predictions.topScorelines);
      Visualization.createScorelineProbabilityChart('scoreline-chart', metrics.predictions.topScorelines);
    }

    if (metrics.xG) {
      Visualization.renderXGComparison('xg-comparison',
        metrics.xG.home.final,
        metrics.xG.away.final,
        fixture.teams.home.name,
        fixture.teams.away.name
      );
    }
  },

  /**
   * Render KPI cards
   */
  renderKPICards(metrics) {
    const predictions = metrics.predictions || {};
    const xG = metrics.xG || {};

    return `
      <div class="kpi-card">
        <div class="kpi-card-label">Most Likely Score</div>
        <div class="kpi-card-value">${predictions.mostLikely?.score || 'N/A'}</div>
        <div class="kpi-card-change">${predictions.mostLikely?.percentageStr || ''} probability</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-label">Home Win %</div>
        <div class="kpi-card-value positive">${predictions.outcomes?.homeWin || 'N/A'}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-label">Draw %</div>
        <div class="kpi-card-value neutral">${predictions.outcomes?.draw || 'N/A'}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-label">Away Win %</div>
        <div class="kpi-card-value negative">${predictions.outcomes?.awayWin || 'N/A'}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-label">Over 2.5 Goals</div>
        <div class="kpi-card-value">${predictions.overUnder?.over25 || 'N/A'}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-label">BTTS</div>
        <div class="kpi-card-value">${predictions.btts?.probability || 'N/A'}%</div>
      </div>
    `;
  },

  /**
   * Format AI analysis text
   */
  formatAnalysis(text) {
    if (!text) return 'Analysis not available';

    // Convert markdown-style headers to styled spans
    return text
      .replace(/^##\s+(.+)$/gm, '<h3 style="color: var(--color-primary); margin-top: var(--spacing-4); margin-bottom: var(--spacing-2);">$1</h3>')
      .replace(/^###\s+(.+)$/gm, '<h4 style="color: var(--color-text-primary); margin-top: var(--spacing-3);">$1</h4>')
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color: var(--color-text-primary);">$1</strong>')
      .replace(/^\d+\.\s+(.+)$/gm, '<div style="margin-left: var(--spacing-4);">• $1</div>')
      .replace(/^-\s+(.+)$/gm, '<div style="margin-left: var(--spacing-4);">• $1</div>');
  },

  /**
   * Render no prediction available state
   */
  renderNoPrediction() {
    const container = document.getElementById('prediction-content');
    if (!container) return;

    const fixture = this.state.selectedFixture;

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⏳</div>
        <div class="empty-state-title">Prediction Not Available</div>
        <div class="empty-state-description">
          The prediction for ${fixture?.teams?.home?.name || 'this match'} vs ${fixture?.teams?.away?.name || ''} is being generated.
          Check back soon!
        </div>
      </div>
    `;
  },

  /**
   * Render empty state
   */
  renderEmptyState() {
    const container = document.getElementById('prediction-content');
    if (!container) return;

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-title">Select a Match</div>
        <div class="empty-state-description">
          Choose a match from the list to view predictions and analysis
        </div>
      </div>
    `;
  },

  /**
   * Render error state
   */
  renderError(message) {
    const container = document.getElementById('prediction-content');
    if (!container) return;

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Something went wrong</div>
        <div class="empty-state-description">${message}</div>
        <button class="btn btn-primary mt-4" onclick="App.loadFixtures()">Try Again</button>
      </div>
    `;
  },

  /**
   * Set loading state
   */
  setLoading(loading) {
    this.state.loading = loading;
    const loader = document.getElementById('loading-indicator');
    if (loader) {
      loader.style.display = loading ? 'flex' : 'none';
    }
  },

  /**
   * Toggle theme
   */
  toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Load saved theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Initialize app
  App.init();
});

// Export
window.App = App;
