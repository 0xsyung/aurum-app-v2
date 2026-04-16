import { useState } from 'react'
import { Link } from 'react-router-dom'
import './UserApp.css'

interface Market {
  id: string
  title: string
  description?: string
  outcomes: {
    label: string
    probability: number
  }[]
  volume: string
  expiresAt?: string
  category: string
  isLive?: boolean
  image?: string
}

const SAMPLE_MARKETS: Market[] = [
  {
    id: '1',
    title: 'US x Iran permanent peace deal by June 30, 2026?',
    outcomes: [
      { label: 'Yes', probability: 70 },
      { label: 'No', probability: 30 },
    ],
    volume: '$8M',
    expiresAt: 'June 30, 2026',
    category: 'Geopolitics',
    isLive: true,
  },
  {
    id: '2',
    title: 'Bitcoin above 70K on April 16?',
    outcomes: [
      { label: 'Yes', probability: 100 },
      { label: 'No', probability: 0 },
    ],
    volume: '$4M',
    category: 'Crypto',
    isLive: true,
  },
  {
    id: '3',
    title: '2026 NBA Champion',
    outcomes: [
      { label: 'Oklahoma City Thunder', probability: 44 },
      { label: 'San Antonio Spurs', probability: 15 },
      { label: 'Boston Celtics', probability: 12 },
    ],
    volume: '$273M',
    expiresAt: 'June 16, 2026',
    category: 'Sports',
  },
  {
    id: '4',
    title: '2026 FIFA World Cup Winner',
    outcomes: [
      { label: 'Spain', probability: 17 },
      { label: 'France', probability: 16 },
      { label: 'England', probability: 11 },
    ],
    volume: '$662M',
    expiresAt: 'July 21, 2026',
    category: 'Sports',
  },
  {
    id: '5',
    title: 'Presidential Election Winner 2028',
    outcomes: [
      { label: 'JD Vance', probability: 19 },
      { label: 'Gavin Newsom', probability: 17 },
      { label: 'Marco Rubio', probability: 12 },
    ],
    volume: '$531M',
    expiresAt: 'November 5, 2028',
    category: 'Politics',
  },
  {
    id: '6',
    title: 'What price will Bitcoin hit in April?',
    outcomes: [
      { label: '↑ 80,000', probability: 26 },
      { label: '↓ 65,000', probability: 20 },
      { label: '↓ 60,000', probability: 6 },
    ],
    volume: '$27M',
    expiresAt: 'April 30, 2026',
    category: 'Crypto',
  },
  {
    id: '7',
    title: 'Will the US confirm that aliens exist before 2027?',
    outcomes: [
      { label: 'Yes', probability: 18 },
      { label: 'No', probability: 82 },
    ],
    volume: '$23M',
    expiresAt: 'December 31, 2026',
    category: 'Misc',
  },
  {
    id: '8',
    title: 'Will Israel x Hezbollah ceasefire last until June 30?',
    outcomes: [
      { label: 'Yes', probability: 87 },
      { label: 'No', probability: 13 },
    ],
    volume: '$12M',
    expiresAt: 'June 30, 2026',
    category: 'Geopolitics',
  },
]

const CATEGORIES = ['Trending', 'Politics', 'Sports', 'Crypto', 'Geopolitics', 'Misc']

function MarketCard({ market }: { market: Market }) {
  const topOutcome = market.outcomes[0]
  const topProbability = topOutcome.probability

  return (
    <div className="market-card">
      {market.isLive && <div className="live-badge">LIVE</div>}
      <div className="market-header">
        <h3 className="market-title">{market.title}</h3>
        {market.expiresAt && <span className="market-expiry">{market.expiresAt}</span>}
      </div>

      <div className="market-main">
        <div className="probability-display">
          <div className="probability-number">{topProbability}%</div>
          <div className="probability-label">{topOutcome.label}</div>
        </div>

        <div className="outcomes-preview">
          {market.outcomes.slice(0, 2).map((outcome, idx) => (
            <div key={idx} className="outcome-chip">
              <span className="outcome-label">{outcome.label}</span>
              <span className="outcome-prob">{outcome.probability}%</span>
            </div>
          ))}
          {market.outcomes.length > 2 && (
            <div className="outcome-chip more">+{market.outcomes.length - 2}</div>
          )}
        </div>
      </div>

      <div className="market-footer">
        <span className="market-volume">{market.volume} Vol</span>
        <span className="market-category">{market.category}</span>
      </div>

      <button className="market-trade-btn">Trade</button>
    </div>
  )
}

export default function UserApp() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const filteredMarkets = selectedCategory
    ? SAMPLE_MARKETS.filter((m) => m.category === selectedCategory)
    : SAMPLE_MARKETS

  return (
    <div className="user-app">
      <header className="user-header">
        <div className="user-header-content">
          <div className="logo-section">
            <h1 className="app-logo">Aurum</h1>
            <p className="tagline">Prediction Markets</p>
          </div>
          <div className="header-actions">
            <input type="text" placeholder="Search markets..." className="search-box" />
            <button className="wallet-btn">Connect Wallet</button>
            <Link to="/dev" className="dev-link">Dev Tools</Link>
          </div>
        </div>
      </header>

      <nav className="categories-nav">
        <div className="categories-scroll">
          <button
            className={`category-btn ${selectedCategory === null ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            All Markets
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </nav>

      <main className="markets-container">
        <div className="markets-header">
          <h2>{selectedCategory ? `${selectedCategory} Markets` : 'All Markets'}</h2>
          <div className="sort-options">
            <select className="sort-select">
              <option>Trending</option>
              <option>Volume</option>
              <option>Liquidity</option>
              <option>Newest</option>
            </select>
          </div>
        </div>

        <div className="markets-grid">
          {filteredMarkets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>

        {filteredMarkets.length === 0 && (
          <div className="empty-state">
            <p>No markets found in this category</p>
          </div>
        )}
      </main>

      <footer className="user-footer">
        <div className="footer-content">
          <p>&copy; 2026 Aurum Prediction Markets. All rights reserved.</p>
          <div className="footer-links">
            <a href="#privacy">Privacy</a>
            <a href="#terms">Terms</a>
            <a href="#help">Help</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
