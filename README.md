# ⚽ PredictAI - Professional Soccer Match Prediction Engine

A professional-grade soccer match prediction system powered by AI. Fetches comprehensive match data from API-Football and uses Claude AI for deep tactical analysis and predictions.

## 🌟 Features

- **4 Major Leagues**: Premier League, Bundesliga, Serie A, La Liga
- **Comprehensive Data**: Team statistics, H2H history, recent form, API predictions
- **AI-Powered Analysis**: Professional-grade tactical analysis using Claude Sonnet 4
- **Smart Caching**: Reduces API calls and improves performance
- **Modern UI**: Clean, professional interface with real-time updates

## 📋 Prerequisites

- Node.js (v14 or higher)
- API-Football Premium subscription
- Anthropic API key (for Claude)

## 🚀 Quick Start

### 1. Clone/Download the Project

```bash
cd soccer-predictor
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
RAPIDAPI_KEY=your_api_football_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
PORT=3000
NODE_ENV=development
```

**Where to get API keys:**
- **API-Football**: https://api-sports.io/
- **Anthropic**: https://console.anthropic.com/

### 4. Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

### 5. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

## 📁 Project Structure

```
soccer-predictor/
├── server.js              # Express backend server
├── public/
│   └── index.html        # Frontend application
├── package.json          # Dependencies and scripts
├── .env.example          # Environment variables template
├── .env                  # Your actual configuration (create this)
└── README.md            # This file
```

## 🔌 API Endpoints

### GET `/api/fixtures/:league`
Get upcoming fixtures for a league
- **Parameters**: `league` (epl, bundesliga, seriea, laliga)
- **Response**: Array of fixture objects

### GET `/api/match-data/:fixtureId`
Get comprehensive match data for prediction
- **Parameters**: 
  - `fixtureId` (fixture ID)
  - Query params: `homeTeamId`, `awayTeamId`, `leagueId`
- **Response**: Object with team stats, H2H, recent form, predictions

### POST `/api/predict`
Generate AI prediction for a match
- **Body**: `{ fixture, matchData }`
- **Response**: `{ prediction: "..." }`

### GET `/api/health`
Health check endpoint
- **Response**: Server status and available leagues

## 🎯 Data Collected for Each Prediction

The backend fetches **comprehensive data** from multiple API endpoints:

### Core Match Context
- **Home Team Season Statistics**: Full season performance, goals, wins, possession, shots
- **Away Team Season Statistics**: Complete season metrics and trends
- **League Standings**: Current position, points, form, pressure factors
- **API Predictions**: Built-in prediction algorithms from API-Football

### Historical Performance
- **Head-to-Head History**: Last 10 meetings between teams
- **Recent Form**: Last 20 matches for both teams (W/D/L, goals, trends)
- **Home/Away Splits**: Venue-specific performance patterns

### Squad & Player Intelligence
- **Full Squad Information**: All players, positions, squad depth
- **Detailed Player Statistics**: Goals, assists, shots, passes, tackles, duels for every player
- **Player Recent Form**: Performance trends over last 5-10 matches
- **League Top Performers**: Top scorers and assist providers for context

### Critical Tactical Data
- **Injuries & Suspensions**: Missing players and their impact
- **Formation Analysis**: Most used formations and success rates
- **Goals by Time Period**: When teams score/concede (0-15, 16-30, 31-45, etc.)
- **Tactical Patterns**: Possession style, attacking patterns, defensive organization

### Statistical Depth
- **Match Statistics Averages**: Possession, shots, passes, corners, cards
- **Performance Metrics**: Clean sheets, failed to score, biggest wins/losses
- **Penalty Records**: Scored, missed, accuracy

**Total**: 1,000+ individual data points analyzed per match prediction

## 🤖 AI Analysis Includes

The AI generates a **professional-grade report** covering 12 comprehensive sections:

1. **Executive Summary** - Outcome prediction with confidence %, predicted scoreline, key factors
2. **Tactical Analysis** - Formations, strategies, key battles, tactical matchups
3. **Team Form & Momentum** - Recent performance, W/D/L patterns, trends, streaks
4. **League Position & Context** - Standings impact, pressure, motivation, what's at stake
5. **Head-to-Head Insights** - Historical patterns, home advantage, psychological edge
6. **Player Analysis & Key Battles** - Top performers, critical matchups, form analysis
7. **Injury & Suspension Impact** - Missing players, depth analysis, percentage impact
8. **Statistical Probabilities** - Over/Under 2.5, BTTS, clean sheets, corners, cards
9. **Goals by Time Period** - When teams score/concede across match timeline
10. **Attacking vs Defensive Analysis** - Threat levels, efficiency, vulnerability assessment
11. **Risk Assessment** - Confidence level, variables, upset potential, variance factors
12. **Final Verdict** - Recommended prediction, scoreline, betting value, risk rating

Each analysis is **data-driven** with specific percentages, probabilities, and supporting evidence from the collected data.

## 🔧 Configuration Options

### League IDs (in server.js)
```javascript
const LEAGUES = {
  epl: { id: 39, name: 'Premier League', season: 2025 },
  bundesliga: { id: 78, name: 'Bundesliga', season: 2025 },
  seriea: { id: 135, name: 'Serie A', season: 2025 },
  laliga: { id: 140, name: 'La Liga', season: 2025 }
};
```

### Cache Settings
- Fixtures: 1 hour TTL
- Predictions: 30 minutes TTL

## 🚀 Deployment

### Deploy to Production

1. **Set environment to production**:
   ```env
   NODE_ENV=production
   ```

2. **Use a process manager** (PM2):
   ```bash
   npm install -g pm2
   pm2 start server.js --name soccer-predictor
   pm2 save
   pm2 startup
   ```

3. **Set up reverse proxy** (Nginx example):
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Deploy to Cloud Platforms

**Heroku**:
```bash
git init
heroku create your-app-name
git add .
git commit -m "Initial commit"
git push heroku main
heroku config:set RAPIDAPI_KEY=your_key
heroku config:set ANTHROPIC_API_KEY=your_key
```

**AWS/DigitalOcean/Others**:
- Use the same setup process
- Configure environment variables in platform settings
- Ensure Node.js is installed
- Run `npm start` or use PM2

## 📊 SAAS Features to Add

- [ ] User authentication and accounts
- [ ] Subscription tiers (Free/Pro/Enterprise)
- [ ] Historical predictions tracking
- [ ] Prediction accuracy metrics
- [ ] Email notifications for matches
- [ ] API access for developers
- [ ] Multi-match comparison
- [ ] Player injury impact analysis
- [ ] Live odds integration
- [ ] Export reports (PDF/CSV)

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Change PORT in .env file or kill the process
lsof -ti:3000 | xargs kill
```

### API Rate Limits
- API-Football Premium allows higher rate limits
- Cache is implemented to reduce API calls
- Consider upgrading your plan for production use

### CORS Issues
- Backend has CORS enabled for all origins
- For production, configure specific origins in server.js

## 📝 License

MIT License - feel free to use for commercial purposes

## 🤝 Support

For issues or questions:
- Check API-Football documentation: https://api-sports.io/documentation/football/v3
- Check Anthropic documentation: https://docs.anthropic.com/

---

Built with ⚽ for professional soccer analytics
