import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPublicClient, http, createWalletClient, custom } from 'viem'
import { sepolia } from 'viem/chains'
import './UserApp.css'

const rpcUrl =
  import.meta.env.VITE_SEPOLIA_RPC_URL?.trim() ||
  'https://ethereum-sepolia-rpc.publicnode.com'

const MOCK_ORACLE_ADDRESS = import.meta.env.VITE_MOCK_ORACLE_ADDRESS?.trim() || ''
const CONDITIONAL_TOKENS = '0x1d2607F5e52c4bc92891bE5932091b7D74FC719A'
const COLLATERAL_TOKEN_ADDRESS = import.meta.env.VITE_COLLATERAL_TOKEN_ADDRESS?.trim() || ''

const mockOracleAbi = [
  {
    type: 'function',
    name: 'getQuestion',
    stateMutability: 'view',
    inputs: [{ name: 'questionId', type: 'bytes32' }],
    outputs: [
      { name: 'exists', type: 'bool' },
      { name: 'outcomeSlotCount', type: 'uint256' },
      { name: 'question', type: 'string' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'answered', type: 'bool' },
      { name: 'answeredAt', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'getQuestionCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getQuestionIds',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [{ type: 'bytes32[]' }],
  },
] as const

const conditionalTokensAbi = [
  {
    type: 'function',
    name: 'getQuestionIdFromString',
    stateMutability: 'pure',
    inputs: [{ name: 'question', type: 'string' }],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'getConditionId',
    stateMutability: 'pure',
    inputs: [
      { name: 'oracle', type: 'address' },
      { name: 'questionId', type: 'bytes32' },
      { name: 'outcomeSlotCount', type: 'uint256' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'getPositionId',
    stateMutability: 'pure',
    inputs: [
      { name: 'collateralToken', type: 'address' },
      { name: 'conditionId', type: 'bytes32' },
      { name: 'outcomeIndex', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'prepareCondition',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'oracle', type: 'address' },
      { name: 'questionId', type: 'bytes32' },
      { name: 'outcomeSlotCount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'splitPosition',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'collateralToken', type: 'address' },
      { name: 'conditionId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

interface OracleQuestion {
  id: `0x${string}`
  text: string
  outcomeSlotCount: number
  answered: boolean
  createdAt: number
  answeredAt: number
}

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl),
})

function MarketCard({
  market,
  onTrade,
}: {
  market: OracleQuestion
  onTrade: (market: OracleQuestion) => void
}) {
  return (
    <div className="market-card">
      {!market.answered && <div className="live-badge">LIVE</div>}
      <div className="market-header">
        <h3 className="market-title">{market.text}</h3>
      </div>

      <div className="market-main">
        <div className="probability-display">
          <div className="probability-number">{market.outcomeSlotCount}</div>
          <div className="probability-label">Outcomes</div>
        </div>

        <div className="outcomes-preview">
          <div className="outcome-chip">
            <span className="outcome-label">Status</span>
            <span className="outcome-prob">{market.answered ? 'Resolved' : 'Active'}</span>
          </div>
          <div className="outcome-chip">
            <span className="outcome-label">Created</span>
            <span className="outcome-prob">{new Date(market.createdAt * 1000).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="market-footer">
        <span className="market-category">Sepolia Testnet</span>
      </div>

      <button className="market-trade-btn" onClick={() => onTrade(market)}>
        Trade
      </button>
    </div>
  )
}

interface TradeModalProps {
  market: OracleQuestion | null
  onClose: () => void
}

function TradeModal({ market, onClose }: TradeModalProps) {
  const [account, setAccount] = useState('')
  const [amount, setAmount] = useState('1')
  const [selectedOutcome, setSelectedOutcome] = useState(0)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  if (!market) return null

  const connectWallet = async () => {
    const provider = window.ethereum
    if (!provider) {
      setMessage('MetaMask or Rabby wallet required')
      return
    }

    try {
      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(provider),
      })
      const addresses = await walletClient.requestAddresses()
      setAccount(addresses[0])
      setMessage('Wallet connected!')
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const handleTrade = async () => {
    if (!account) {
      setMessage('Please connect wallet first')
      return
    }

    if (!MOCK_ORACLE_ADDRESS || !COLLATERAL_TOKEN_ADDRESS) {
      setMessage('Missing configuration: VITE_MOCK_ORACLE_ADDRESS or VITE_COLLATERAL_TOKEN_ADDRESS')
      return
    }

    setLoading(true)
    setMessage('Preparing trade...')

    try {
      const provider = window.ethereum
      if (!provider) {
        throw new Error('Wallet not available')
      }

      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(provider),
      })

      const accountAddr = account as `0x${string}`

      // Step 1: Get Question ID from ConditionalTokens
      const questionId = await publicClient.readContract({
        address: CONDITIONAL_TOKENS,
        abi: conditionalTokensAbi,
        functionName: 'getQuestionIdFromString',
        args: [market.text],
      })

      setMessage('Derived question ID')

      // Step 2: Get Condition ID
      const conditionId = await publicClient.readContract({
        address: CONDITIONAL_TOKENS,
        abi: conditionalTokensAbi,
        functionName: 'getConditionId',
        args: [MOCK_ORACLE_ADDRESS as `0x${string}`, questionId, BigInt(market.outcomeSlotCount)],
      })

      setMessage('Derived condition ID')

      // Step 3: Prepare condition if needed
      try {
        await publicClient.readContract({
          address: CONDITIONAL_TOKENS,
          abi: conditionalTokensAbi,
          functionName: 'getPositionId',
          args: [COLLATERAL_TOKEN_ADDRESS as `0x${string}`, conditionId, BigInt(selectedOutcome)],
        })
        setMessage('Condition exists, ready to split')
      } catch {
        setMessage('Preparing condition...')
        // Prepare condition
        const hash = await walletClient.writeContract({
          address: CONDITIONAL_TOKENS,
          abi: conditionalTokensAbi,
          functionName: 'prepareCondition',
          args: [
            MOCK_ORACLE_ADDRESS as `0x${string}`,
            questionId,
            BigInt(market.outcomeSlotCount),
          ],
          account: accountAddr,
          chain: sepolia,
        })
        setMessage(`Condition prepared: ${hash.slice(0, 10)}...`)
      }

      // Step 4: Split position
      setMessage('Executing split position transaction...')
      const splitHash = await walletClient.writeContract({
        address: CONDITIONAL_TOKENS,
        abi: conditionalTokensAbi,
        functionName: 'splitPosition',
        args: [
          COLLATERAL_TOKEN_ADDRESS as `0x${string}`,
          conditionId,
          BigInt(Math.floor(parseFloat(amount) * 1e18)),
        ],
        account: accountAddr,
        chain: sepolia,
      })

      setMessage(`Trade submitted! Tx: ${splitHash.slice(0, 10)}...`)
    } catch (error) {
      setMessage(`Error: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <h2>Trade Market</h2>
        <p className="market-description">{market.text}</p>

        <div className="modal-section">
          <label>Outcome</label>
          <select value={selectedOutcome} onChange={(e) => setSelectedOutcome(Number(e.target.value))}>
            {Array.from({ length: market.outcomeSlotCount }).map((_, i) => (
              <option key={i} value={i}>
                Outcome {i}
              </option>
            ))}
          </select>
        </div>

        <div className="modal-section">
          <label>Amount (tokens)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="0.1" step="0.1" />
        </div>

        <div className="modal-section">
          <label>Wallet: {account || 'Not connected'}</label>
          {!account ? (
            <button onClick={connectWallet} className="modal-btn primary">
              Connect Wallet
            </button>
          ) : (
            <button onClick={handleTrade} disabled={loading} className="modal-btn primary">
              {loading ? 'Processing...' : 'Execute Trade'}
            </button>
          )}
        </div>

        {message && <div className={`modal-message ${message.includes('Error') ? 'error' : 'info'}`}>{message}</div>}
      </div>
    </div>
  )
}

export default function UserApp() {
  const [markets, setMarkets] = useState<OracleQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedMarket, setSelectedMarket] = useState<OracleQuestion | null>(null)

  useEffect(() => {
    loadMarkets()
  }, [])

  const loadMarkets = async () => {
    if (!MOCK_ORACLE_ADDRESS) {
      setError('VITE_MOCK_ORACLE_ADDRESS not configured')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      // Get total question count
      const total = await publicClient.readContract({
        address: MOCK_ORACLE_ADDRESS as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'getQuestionCount',
      })

      if (total === 0n) {
        setMarkets([])
        setLoading(false)
        return
      }

      // Fetch latest 20 questions
      const pageSize = 20n
      const offset = total > pageSize ? total - pageSize : 0n

      const ids = await publicClient.readContract({
        address: MOCK_ORACLE_ADDRESS as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'getQuestionIds',
        args: [offset, pageSize],
      })

      // Fetch details for each question
      const questionDetails = await Promise.all(
        [...ids].reverse().map(async (qid) => {
          const details = await publicClient.readContract({
            address: MOCK_ORACLE_ADDRESS as `0x${string}`,
            abi: mockOracleAbi,
            functionName: 'getQuestion',
            args: [qid],
          })

          const [, outcomeCount, text, createdAt, answered, answeredAt] = details

          return {
            id: qid,
            text,
            outcomeSlotCount: Number(outcomeCount),
            answered,
            createdAt: Number(createdAt),
            answeredAt: Number(answeredAt),
          }
        })
      )

      setMarkets(questionDetails)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="user-app">
      <header className="user-header">
        <div className="user-header-content">
          <div className="logo-section">
            <h1 className="app-logo">Aurum</h1>
            <p className="tagline">Prediction Markets</p>
          </div>
          <div className="header-actions">
            <button className="refresh-btn" onClick={loadMarkets} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </button>
            <Link to="/dev" className="dev-link">
              Dev Tools
            </Link>
          </div>
        </div>
      </header>

      <nav className="categories-nav">
        <div className="categories-scroll">
          <button className="category-btn active">All Markets</button>
        </div>
      </nav>

      <main className="markets-container">
        <div className="markets-header">
          <h2>{loading ? 'Loading Markets...' : `Markets (${markets.length})`}</h2>
          <div className="market-info">
            <p className="network-info">Network: Sepolia Testnet</p>
            {MOCK_ORACLE_ADDRESS && <p className="oracle-info">Oracle: {MOCK_ORACLE_ADDRESS.slice(0, 10)}...</p>}
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading && <div className="loading-state">Loading markets from MockOracle...</div>}

        {!loading && markets.length === 0 && (
          <div className="empty-state">
            <p>No markets found. Create your first question in the Dev Tools!</p>
            <Link to="/dev" className="dev-link">
              Go to Dev Tools
            </Link>
          </div>
        )}

        <div className="markets-grid">
          {markets.map((market) => (
            <MarketCard key={market.id} market={market} onTrade={setSelectedMarket} />
          ))}
        </div>
      </main>

      <footer className="user-footer">
        <div className="footer-content">
          <p>&copy; 2026 Aurum Prediction Markets. Real blockchain interactions on Sepolia testnet.</p>
          <div className="footer-links">
            <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer">
              Sepolia Explorer
            </a>
            <Link to="/dev">Developer Docs</Link>
          </div>
        </div>
      </footer>

      <TradeModal market={selectedMarket} onClose={() => setSelectedMarket(null)} />
    </div>
  )
}
