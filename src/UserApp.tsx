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
    name: 'registerQuestion',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'questionText', type: 'string' },
      { name: 'outcomeSlotCount', type: 'uint256' },
      { name: 'timeout', type: 'uint32' },
    ],
    outputs: [{ name: 'questionId', type: 'bytes32' }],
  },
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
  const isResolved = market.answered
  
  return (
    <div className="market-card">
      {!isResolved && <div className="live-badge">LIVE</div>}
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
            <span className="outcome-prob">{isResolved ? 'Resolved' : 'Active'}</span>
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

      <button 
        className="market-trade-btn" 
        onClick={() => onTrade(market)}
        disabled={isResolved}
      >
        {isResolved ? 'Market Resolved' : 'Trade'}
      </button>
    </div>
  )
}

interface CreateQuestionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function CreateQuestionModal({ isOpen, onClose, onSuccess }: CreateQuestionModalProps) {
  const [questionText, setQuestionText] = useState('')
  const [outcomes, setOutcomes] = useState('2')
  const [timeoutSeconds, setTimeoutSeconds] = useState('86400')
  const [account, setAccount] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  if (!isOpen) return null

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
      setMessage('✓ Wallet connected')
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const handleCreateQuestion = async () => {
    if (!account) {
      setMessage('Please connect wallet first')
      return
    }

    if (!MOCK_ORACLE_ADDRESS) {
      setMessage('Oracle address not configured')
      return
    }

    if (!questionText.trim()) {
      setMessage('Please enter a question')
      return
    }

    setLoading(true)
    setMessage('Creating question...')

    try {
      const provider = window.ethereum
      if (!provider) throw new Error('Wallet not available')

      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(provider),
      })

      const accountAddr = account as `0x${string}`
      const outcomeCount = parseInt(outcomes)
      const timeoutSecs = parseInt(timeoutSeconds)

      if (outcomeCount < 2 || outcomeCount > 256) {
        throw new Error('Outcomes must be between 2 and 256')
      }

      if (timeoutSecs < 60) {
        throw new Error('Timeout must be at least 60 seconds')
      }

      setMessage(`Sending transaction... Question: "${questionText.slice(0, 50)}...", Outcomes: ${outcomeCount}, Timeout: ${timeoutSecs}s`)

      const hash = await walletClient.writeContract({
        address: MOCK_ORACLE_ADDRESS as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'registerQuestion',
        args: [questionText.trim(), BigInt(outcomeCount), timeoutSecs],
        account: accountAddr,
        chain: sepolia,
      })

      setMessage(`✓ Question created! Tx: ${hash.slice(0, 10)}...`)
      
      globalThis.setTimeout(() => {
        setQuestionText('')
        setOutcomes('2')
        setTimeoutSeconds('86400')
        setMessage('')
        onSuccess()
        onClose()
      }, 2000)
    } catch (error) {
      setMessage(`✗ ${(error as Error).message}`)
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

        <h2>Create New Question</h2>
        <p className="modal-hint">Ask a new prediction market question on Sepolia testnet</p>

        <div className="modal-section">
          <label>Question</label>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="e.g., Will Bitcoin reach $100k by end of 2026?"
            rows={3}
            disabled={loading}
          />
        </div>

        <div className="modal-section">
          <label>Number of Outcomes</label>
          <input
            type="number"
            value={outcomes}
            onChange={(e) => setOutcomes(e.target.value)}
            min="2"
            max="256"
            disabled={loading}
          />
          <small>Binary (Yes/No) = 2, Multiple choice = 3-256</small>
        </div>

        <div className="modal-section">
          <label>Timeout (seconds)</label>
          <input
            type="number"
            value={timeoutSeconds}
            onChange={(e) => setTimeoutSeconds(e.target.value)}
            min="60"
            placeholder="86400"
            disabled={loading}
          />
          <small>How long before oracle can be asked (default: 24 hours = 86400)</small>
        </div>

        <div className="modal-section">
          {!account ? (
            <>
              <button onClick={connectWallet} className="modal-btn primary">
                Connect Wallet
              </button>
              <p className="modal-hint">You need to connect to create a question</p>
            </>
          ) : (
            <>
              <button onClick={handleCreateQuestion} disabled={loading || !questionText.trim()} className="modal-btn primary">
                {loading ? 'Creating...' : 'Create Question'}
              </button>
              <p className="modal-hint">Connected: {account.slice(0, 6)}...{account.slice(-4)}</p>
            </>
          )}
        </div>

        {message && <div className={`modal-message ${message.includes('✗') ? 'error' : message.includes('✓') ? 'success' : 'info'}`}>{message}</div>}
      </div>
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
      setMessage('✓ Wallet connected')
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const handleBuyShares = async () => {
    if (!account) {
      setMessage('Please connect wallet first')
      return
    }

    if (!MOCK_ORACLE_ADDRESS || !COLLATERAL_TOKEN_ADDRESS) {
      setMessage('Missing configuration: VITE_MOCK_ORACLE_ADDRESS or VITE_COLLATERAL_TOKEN_ADDRESS')
      return
    }

    setLoading(true)
    setMessage('Processing order...')

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

      setMessage('Computing condition ID...')

      // Step 2: Get Condition ID
      const conditionId = await publicClient.readContract({
        address: CONDITIONAL_TOKENS,
        abi: conditionalTokensAbi,
        functionName: 'getConditionId',
        args: [MOCK_ORACLE_ADDRESS as `0x${string}`, questionId, BigInt(market.outcomeSlotCount)],
      })

      // Step 3: Execute split position for this outcome
      setMessage('Executing transaction...')
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

      setMessage(`✓ Order placed! Tx: ${splitHash.slice(0, 10)}...`)
      globalThis.setTimeout(() => {
        onClose()
      }, 2000)
    } catch (error) {
      setMessage(`✗ ${(error as Error).message}`)
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

        <h2>Place Order</h2>
        <p className="market-description">{market.text}</p>

        <div className="modal-section">
          <label>Select Outcome</label>
          <div className="outcome-buttons">
            {Array.from({ length: market.outcomeSlotCount }).map((_, i) => (
              <button
                key={i}
                className={`outcome-btn ${selectedOutcome === i ? 'selected' : ''}`}
                onClick={() => setSelectedOutcome(i)}
              >
                Outcome {i}
              </button>
            ))}
          </div>
        </div>

        <div className="modal-section">
          <label>Amount to Invest (tokens)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0.1"
            step="0.1"
            placeholder="1.0"
            disabled={!account || loading}
          />
        </div>

        <div className="modal-section">
          {!account ? (
            <>
              <button onClick={connectWallet} className="modal-btn primary">
                Connect Wallet
              </button>
              <p className="modal-hint">Connect MetaMask or Rabby to trade</p>
            </>
          ) : (
            <>
              <button onClick={handleBuyShares} disabled={loading || !amount} className="modal-btn primary">
                {loading ? 'Processing...' : 'Buy Shares'}
              </button>
              <p className="modal-hint">Buy {market.outcomeSlotCount > 2 ? 'shares for' : ''} Outcome {selectedOutcome}</p>
            </>
          )}
        </div>

        {message && <div className={`modal-message ${message.includes('✗') ? 'error' : message.includes('✓') ? 'success' : 'info'}`}>{message}</div>}
      </div>
    </div>
  )
}

export default function UserApp() {
  const [markets, setMarkets] = useState<OracleQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedMarket, setSelectedMarket] = useState<OracleQuestion | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

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
            <button className="create-btn" onClick={() => setShowCreateModal(true)}>
              + New Question
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
            <p>No markets found. Create your first question!</p>
            <button onClick={() => setShowCreateModal(true)} className="empty-state-btn">
              Create Question
            </button>
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
      <CreateQuestionModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onSuccess={loadMarkets} />
    </div>
  )
}
