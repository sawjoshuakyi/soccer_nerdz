/**
 * ═══════════════════════════════════════════════════════════════
 * VISUALIZATION - Chart.js chart factories
 * ═══════════════════════════════════════════════════════════════
 */

const Visualization = {
  // Chart instances storage
  charts: {},

  // Default Chart.js configuration
  defaults: {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8',
          font: { family: 'Inter, sans-serif' }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#64748b' },
        grid: { color: 'rgba(148, 163, 184, 0.1)' }
      },
      y: {
        ticks: { color: '#64748b' },
        grid: { color: 'rgba(148, 163, 184, 0.1)' }
      }
    }
  },

  /**
   * Destroy existing chart before creating new one
   */
  destroyChart(chartId) {
    if (this.charts[chartId]) {
      this.charts[chartId].destroy();
      delete this.charts[chartId];
    }
  },

  /**
   * Create scoreline probability bar chart
   */
  createScorelineProbabilityChart(canvasId, scorelines) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    const top8 = scorelines.slice(0, 8);
    const labels = top8.map(s => s.score);
    const data = top8.map(s => (s.probability * 100).toFixed(1));

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Probability %',
          data,
          backgroundColor: labels.map((_, i) => i === 0 ? '#10b981' : '#334155'),
          borderColor: labels.map((_, i) => i === 0 ? '#10b981' : '#475569'),
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        ...this.defaults,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.x}% probability`
            }
          }
        },
        scales: {
          x: {
            ...this.defaults.scales.x,
            max: Math.ceil(Math.max(...data) * 1.2),
            title: { display: true, text: 'Probability %', color: '#64748b' }
          },
          y: {
            ...this.defaults.scales.y
          }
        }
      }
    });

    return this.charts[canvasId];
  },

  /**
   * Create outcome probability doughnut chart
   */
  createOutcomeProbabilityChart(canvasId, outcomes) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    this.charts[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Home Win', 'Draw', 'Away Win'],
        datasets: [{
          data: [
            parseFloat(outcomes.homeWin),
            parseFloat(outcomes.draw),
            parseFloat(outcomes.awayWin)
          ],
          backgroundColor: ['#10b981', '#f59e0b', '#3b82f6'],
          borderColor: '#1e293b',
          borderWidth: 2
        }]
      },
      options: {
        ...this.defaults,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#94a3b8',
              padding: 16,
              font: { size: 12 }
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.parsed}%`
            }
          }
        }
      }
    });

    return this.charts[canvasId];
  },

  /**
   * Create team comparison radar chart
   */
  createComparisonRadarChart(canvasId, homeData, awayData, labels) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    this.charts[canvasId] = new Chart(ctx, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            label: 'Home',
            data: homeData,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.2)',
            borderWidth: 2,
            pointBackgroundColor: '#10b981',
            pointRadius: 4
          },
          {
            label: 'Away',
            data: awayData,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderWidth: 2,
            pointBackgroundColor: '#3b82f6',
            pointRadius: 4
          }
        ]
      },
      options: {
        ...this.defaults,
        scales: {
          r: {
            angleLines: { color: 'rgba(148, 163, 184, 0.2)' },
            grid: { color: 'rgba(148, 163, 184, 0.2)' },
            pointLabels: { color: '#94a3b8', font: { size: 11 } },
            ticks: { display: false }
          }
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', padding: 16 }
          }
        }
      }
    });

    return this.charts[canvasId];
  },

  /**
   * Create form trend line chart
   */
  createFormTrendChart(canvasId, homeForm, awayForm) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    const convertFormToPoints = (form) => {
      if (!form) return [];
      return form.split('').map(r => {
        if (r === 'W') return 3;
        if (r === 'D') return 1;
        return 0;
      });
    };

    const homePoints = convertFormToPoints(homeForm);
    const awayPoints = convertFormToPoints(awayForm);
    const labels = homePoints.map((_, i) => `Match ${i + 1}`);

    this.charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Home Team',
            data: homePoints,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 4
          },
          {
            label: 'Away Team',
            data: awayPoints,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 4
          }
        ]
      },
      options: {
        ...this.defaults,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8' }
          }
        },
        scales: {
          y: {
            ...this.defaults.scales.y,
            min: 0,
            max: 3,
            ticks: {
              stepSize: 1,
              callback: (val) => ['L', 'D', '', 'W'][val] || ''
            }
          }
        }
      }
    });

    return this.charts[canvasId];
  },

  /**
   * Create goals distribution chart
   */
  createGoalsDistributionChart(canvasId, homeXG, awayXG) {
    this.destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    // Poisson distribution calculation
    const poisson = (lambda, k) => {
      let factorial = 1;
      for (let i = 2; i <= k; i++) factorial *= i;
      return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial;
    };

    const homeProbs = [0, 1, 2, 3, 4, 5].map(k => (poisson(homeXG, k) * 100).toFixed(1));
    const awayProbs = [0, 1, 2, 3, 4, 5].map(k => (poisson(awayXG, k) * 100).toFixed(1));

    this.charts[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['0', '1', '2', '3', '4', '5'],
        datasets: [
          {
            label: 'Home',
            data: homeProbs,
            backgroundColor: '#10b981',
            borderRadius: 4
          },
          {
            label: 'Away',
            data: awayProbs,
            backgroundColor: '#3b82f6',
            borderRadius: 4
          }
        ]
      },
      options: {
        ...this.defaults,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8' }
          },
          title: {
            display: true,
            text: 'Goal Probability Distribution',
            color: '#f1f5f9'
          }
        },
        scales: {
          x: {
            ...this.defaults.scales.x,
            title: { display: true, text: 'Goals', color: '#64748b' }
          },
          y: {
            ...this.defaults.scales.y,
            title: { display: true, text: 'Probability %', color: '#64748b' }
          }
        }
      }
    });

    return this.charts[canvasId];
  },

  /**
   * Render probability bars (HTML, not Chart.js)
   */
  renderProbabilityBars(containerId, outcomes) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="probability-bars">
        <div class="probability-bar-row">
          <span class="probability-bar-label">Home Win</span>
          <div class="probability-bar-track">
            <div class="probability-bar-fill home" style="width: ${outcomes.homeWin}%"></div>
          </div>
          <span class="probability-bar-value">${outcomes.homeWin}%</span>
        </div>
        <div class="probability-bar-row">
          <span class="probability-bar-label">Draw</span>
          <div class="probability-bar-track">
            <div class="probability-bar-fill draw" style="width: ${outcomes.draw}%"></div>
          </div>
          <span class="probability-bar-value">${outcomes.draw}%</span>
        </div>
        <div class="probability-bar-row">
          <span class="probability-bar-label">Away Win</span>
          <div class="probability-bar-track">
            <div class="probability-bar-fill away" style="width: ${outcomes.awayWin}%"></div>
          </div>
          <span class="probability-bar-value">${outcomes.awayWin}%</span>
        </div>
      </div>
    `;
  },

  /**
   * Render xG comparison widget
   */
  renderXGComparison(containerId, homeXG, awayXG, homeTeam, awayTeam) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const delta = (parseFloat(homeXG) - parseFloat(awayXG)).toFixed(2);
    const deltaClass = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';

    container.innerHTML = `
      <div class="xg-comparison">
        <div class="xg-team">
          <span class="xg-team-label">${homeTeam || 'Home'}</span>
          <span class="xg-team-value home">${homeXG}</span>
        </div>
        <div class="xg-vs">
          <span class="xg-vs-label">xG Delta</span>
          <span class="xg-delta ${deltaClass}">${delta > 0 ? '+' : ''}${delta}</span>
        </div>
        <div class="xg-team">
          <span class="xg-team-label">${awayTeam || 'Away'}</span>
          <span class="xg-team-value away">${awayXG}</span>
        </div>
      </div>
    `;
  },

  /**
   * Render scoreline grid
   */
  renderScorelineGrid(containerId, scorelines) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const top8 = scorelines.slice(0, 8);
    container.innerHTML = `
      <div class="scoreline-grid">
        ${top8.map(s => `
          <div class="scoreline-item">
            <span class="scoreline-score">${s.score}</span>
            <span class="scoreline-prob">${(s.probability * 100).toFixed(1)}%</span>
          </div>
        `).join('')}
      </div>
    `;
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Visualization;
}
window.Visualization = Visualization;
