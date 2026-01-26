// Formation Diagram Renderer - Livescore Style
// Vertical pitch with both teams

window.renderFormationDiagram = function(data) {
  const { 
    homeTeam, 
    awayTeam, 
    homeFormation, 
    awayFormation,
    homeLineup,
    awayLineup,
    injuries 
  } = data;

  const html = `
    <div class="formation-container-livescore">
      <div class="formation-header-livescore">
        <div class="team-section">
          <span class="team-name-livescore">${homeTeam}</span>
          <span class="formation-badge">${homeFormation}</span>
        </div>
        <div class="vs-text">VS</div>
        <div class="team-section">
          <span class="team-name-livescore">${awayTeam}</span>
          <span class="formation-badge">${awayFormation}</span>
        </div>
      </div>

      <div class="pitch-livescore">
        <!-- Away team (top) -->
        <div class="team-lineup away-team">
          <div class="lineup-rows" id="away-lineup"></div>
        </div>

        <!-- Center line indicator -->
        <div class="center-line-indicator">
          <span>${awayTeam}</span>
          <div class="center-circle"></div>
          <span>${homeTeam}</span>
        </div>

        <!-- Home team (bottom) -->
        <div class="team-lineup home-team">
          <div class="lineup-rows" id="home-lineup"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('formation-display').innerHTML = html;
  
  // Render lineups
  renderLivescoreLineup('home-lineup', homeFormation, homeLineup, injuries, true);
  renderLivescoreLineup('away-lineup', awayFormation, awayLineup, injuries, false);
};

function renderLivescoreLineup(containerId, formation, lineup, injuries, isHome) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const [def, mid, att] = formation.split('-').map(Number);
  if (!def || !mid || !att) return;
  
  let html = '';
  
  if (isHome) {
    // Home team: GK -> DEF -> MID -> ATT (bottom to top)
    html += createLivescoreRow([lineup.goalkeeper || {name: 'GK'}], isHome, injuries, 'GK');
    html += createLivescoreRow(lineup.defenders || Array(def).fill({name: 'DEF'}), isHome, injuries, 'DEF');
    html += createLivescoreRow(lineup.midfielders || Array(mid).fill({name: 'MID'}), isHome, injuries, 'MID');
    html += createLivescoreRow(lineup.attackers || Array(att).fill({name: 'ATT'}), isHome, injuries, 'ATT');
  } else {
    // Away team: ATT -> MID -> DEF -> GK (top to bottom)
    html += createLivescoreRow(lineup.attackers || Array(att).fill({name: 'ATT'}), isHome, injuries, 'ATT');
    html += createLivescoreRow(lineup.midfielders || Array(mid).fill({name: 'MID'}), isHome, injuries, 'MID');
    html += createLivescoreRow(lineup.defenders || Array(def).fill({name: 'DEF'}), isHome, injuries, 'DEF');
    html += createLivescoreRow([lineup.goalkeeper || {name: 'GK'}], isHome, injuries, 'GK');
  }
  
  container.innerHTML = html;
}

function createLivescoreRow(players, isHome, injuries, position) {
  const playerColor = isHome ? '#00ff88' : '#00d4ff';
  
  return `
    <div class="player-row-livescore">
      ${players.map((player, index) => {
        const isInjured = injuries.includes(player.name);
        const shirtNumber = player.number || (position === 'GK' ? 1 : index + 2);
        
        return `
          <div class="player-livescore ${isInjured ? 'injured-livescore' : ''}">
            <div class="player-dot" style="background-color: ${playerColor}; border-color: ${playerColor};">
              <span class="shirt-number">${shirtNumber}</span>
            </div>
            <div class="player-info">
              <div class="player-name-livescore">${player.name}</div>
              ${isInjured ? '<div class="injury-badge">⚠️ Injured</div>' : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}