/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BETTING ODDS API SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Fetches real-time betting odds from multiple bookmakers using The Odds API
 * Free tier: 500 requests/month
 * 
 * Supported bookmakers: FanDuel, DraftKings, Bet365, and more
 */

const https = require('https');

class OddsApiService {
  constructor() {
    // The Odds API configuration
    this.apiKey = process.env.ODDS_API_KEY || '';
    this.baseUrl = 'api.the-odds-api.com';
    
    // Sport keys for different leagues
    this.sportKeys = {
      epl: 'soccer_epl',
      laliga: 'soccer_spain_la_liga',
      bundesliga: 'soccer_germany_bundesliga',
      seriea: 'soccer_italy_serie_a',
      ligue1: 'soccer_france_ligue_one',
      ucl: 'soccer_uefa_champs_league'
    };
    
    // Bookmaker keys we want to display
    this.targetBookmakers = ['fanduel', 'draftkings', 'betmgm', 'bet365'];
    
    // Cache for odds (5 minute TTL)
    this.oddsCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Convert decimal odds to American odds
   */
  decimalToAmerican(decimal) {
    if (decimal >= 2.0) {
      return '+' + Math.round((decimal - 1) * 100);
    } else {
      return Math.round(-100 / (decimal - 1));
    }
  }

  /**
   * Convert decimal odds to implied probability
   */
  decimalToProbability(decimal) {
    return ((1 / decimal) * 100).toFixed(1);
  }

  /**
   * Fetch odds from The Odds API
   */
  async fetchOdds(league = 'epl') {
    const sportKey = this.sportKeys[league] || this.sportKeys.epl;
    const cacheKey = `odds_${sportKey}`;
    
    // Check cache first
    const cached = this.oddsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    // If no API key, return mock data for demo
    if (!this.apiKey) {
      console.log('[OddsAPI] No API key configured, using mock data');
      return this.getMockOdds();
    }

    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        path: `/v4/sports/${sportKey}/odds/?apiKey=${this.apiKey}&regions=us,uk&markets=h2h&oddsFormat=decimal&bookmakers=${this.targetBookmakers.join(',')}`,
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const odds = JSON.parse(data);
            
            // Cache the result
            this.oddsCache.set(cacheKey, {
              timestamp: Date.now(),
              data: odds
            });
            
            resolve(odds);
          } catch (e) {
            console.error('[OddsAPI] Parse error:', e.message);
            resolve(this.getMockOdds());
          }
        });
      });

      req.on('error', (e) => {
        console.error('[OddsAPI] Request error:', e.message);
        resolve(this.getMockOdds());
      });

      req.setTimeout(10000, () => {
        req.destroy();
        resolve(this.getMockOdds());
      });

      req.end();
    });
  }

  /**
   * Get odds for a specific fixture by team names
   */
  async getFixtureOdds(homeTeam, awayTeam, league = 'epl') {
    const allOdds = await this.fetchOdds(league);
    
    if (!Array.isArray(allOdds)) {
      return this.formatOddsForDisplay(null, homeTeam, awayTeam);
    }

    // Find the matching fixture
    const fixture = allOdds.find(event => {
      const homeMatch = this.teamNameMatch(event.home_team, homeTeam);
      const awayMatch = this.teamNameMatch(event.away_team, awayTeam);
      return homeMatch && awayMatch;
    });

    return this.formatOddsForDisplay(fixture, homeTeam, awayTeam);
  }

  /**
   * Fuzzy match team names (handles variations like "Man Utd" vs "Manchester United")
   */
  teamNameMatch(apiName, ourName) {
    if (!apiName || !ourName) return false;
    
    const normalize = (name) => name.toLowerCase()
      .replace(/fc|afc|cf/gi, '')
      .replace(/manchester/gi, 'man')
      .replace(/united/gi, 'utd')
      .replace(/city/gi, 'city')
      .replace(/hotspur/gi, '')
      .replace(/forest/gi, 'forest')
      .replace(/nottingham/gi, 'nott')
      .replace(/\s+/g, ' ')
      .trim();
    
    const api = normalize(apiName);
    const our = normalize(ourName);
    
    return api.includes(our) || our.includes(api) || 
           api.split(' ').some(w => our.includes(w) && w.length > 3);
  }

  /**
   * Format odds data for display in the UI
   */
  formatOddsForDisplay(fixture, homeTeam, awayTeam) {
    const bookmakers = {};
    
    if (fixture && fixture.bookmakers) {
      fixture.bookmakers.forEach(bm => {
        const market = bm.markets.find(m => m.key === 'h2h');
        if (market) {
          const homeOdds = market.outcomes.find(o => this.teamNameMatch(o.name, homeTeam));
          const drawOdds = market.outcomes.find(o => o.name === 'Draw');
          const awayOdds = market.outcomes.find(o => this.teamNameMatch(o.name, awayTeam));
          
          if (homeOdds && drawOdds && awayOdds) {
            bookmakers[bm.key] = {
              name: this.formatBookmakerName(bm.key),
              home: {
                decimal: homeOdds.price,
                american: this.decimalToAmerican(homeOdds.price),
                probability: this.decimalToProbability(homeOdds.price)
              },
              draw: {
                decimal: drawOdds.price,
                american: this.decimalToAmerican(drawOdds.price),
                probability: this.decimalToProbability(drawOdds.price)
              },
              away: {
                decimal: awayOdds.price,
                american: this.decimalToAmerican(awayOdds.price),
                probability: this.decimalToProbability(awayOdds.price)
              },
              lastUpdate: bm.last_update
            };
          }
        }
      });
    }

    // If no real data, use mock data
    if (Object.keys(bookmakers).length === 0) {
      return this.getMockOddsForFixture(homeTeam, awayTeam);
    }

    return {
      homeTeam,
      awayTeam,
      bookmakers,
      lastUpdate: fixture?.commence_time || new Date().toISOString()
    };
  }

  /**
   * Format bookmaker key to display name
   */
  formatBookmakerName(key) {
    const names = {
      'fanduel': 'FanDuel',
      'draftkings': 'DraftKings',
      'betmgm': 'BetMGM',
      'bet365': 'Bet365',
      'pointsbetus': 'PointsBet',
      'williamhill_us': 'Caesars',
      'bovada': 'Bovada',
      'betonlineag': 'BetOnline'
    };
    return names[key] || key;
  }

  /**
   * Get mock odds for demo/development
   */
  getMockOdds() {
    return [];
  }

  /**
   * Get mock odds for a specific fixture (for demo when API unavailable)
   */
  getMockOddsForFixture(homeTeam, awayTeam) {
    // Generate realistic-looking mock odds based on team names
    // This is just for demo purposes
    const baseHomeOdds = 2.10 + (Math.random() * 0.5 - 0.25);
    const baseDrawOdds = 3.20 + (Math.random() * 0.4 - 0.2);
    const baseAwayOdds = 3.50 + (Math.random() * 0.6 - 0.3);

    const generateBookmakerOdds = (base, variance) => {
      const decimal = base + (Math.random() * variance - variance/2);
      return {
        decimal: decimal.toFixed(2),
        american: this.decimalToAmerican(decimal),
        probability: this.decimalToProbability(decimal)
      };
    };

    return {
      homeTeam,
      awayTeam,
      bookmakers: {
        fanduel: {
          name: 'FanDuel',
          home: generateBookmakerOdds(baseHomeOdds, 0.1),
          draw: generateBookmakerOdds(baseDrawOdds, 0.15),
          away: generateBookmakerOdds(baseAwayOdds, 0.15),
          lastUpdate: new Date().toISOString()
        },
        draftkings: {
          name: 'DraftKings',
          home: generateBookmakerOdds(baseHomeOdds, 0.1),
          draw: generateBookmakerOdds(baseDrawOdds, 0.15),
          away: generateBookmakerOdds(baseAwayOdds, 0.15),
          lastUpdate: new Date().toISOString()
        },
        bet365: {
          name: 'Bet365',
          home: generateBookmakerOdds(baseHomeOdds, 0.08),
          draw: generateBookmakerOdds(baseDrawOdds, 0.12),
          away: generateBookmakerOdds(baseAwayOdds, 0.12),
          lastUpdate: new Date().toISOString()
        }
      },
      isMockData: true,
      lastUpdate: new Date().toISOString()
    };
  }
}

module.exports = new OddsApiService();
