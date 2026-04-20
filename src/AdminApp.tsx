import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createPublicClient, http, createWalletClient, custom } from 'viem'
import { sepolia } from 'viem/chains'
import './AdminApp.css'

const rpcUrl =
  import.meta.env.VITE_SEPOLIA_RPC_URL?.trim() ||
  'https://ethereum-sepolia-rpc.publicnode.com'

const MOCK_ORACLE_ADDRESS = import.meta.env.VITE_MOCK_ORACLE_ADDRESS?.trim() || ''
const CONDITIONAL_TOKENS = '0x1d2607F5e52c4bc92891bE5932091b7D74FC719A'

const mockOracleAbi = [
  {
    type: 'function',
    name: 'admin',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'setAdmin',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newAdmin', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'registerQuestion',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'question', type: 'string' },
      { name: 'outcomeSlotCount', type: 'uint256' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'registerQuestionUnique',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'question', type: 'string' },
      { name: 'outcomeSlotCount', type: 'uint256' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'setAnswer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'questionId', type: 'bytes32' },
      { name: 'payouts', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'submitAnswerToConditionalTokens',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'questionId', type: 'bytes32' },
      { name: 'conditionalTokens', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'computeQuestionIdFromString',
    stateMutability: 'pure',
    inputs: [{ name: 'question', type: 'string' }],
    outputs: [{ type: 'bytes32' }],
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
    name: 'getAnswer',
    stateMutability: 'view',
    inputs: [{ name: 'questionId', type: 'bytes32' }],
    outputs: [{ type: 'uint256[]' }],
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
  {
    type: 'function',
    name: 'proposeQuestion',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'question', type: 'string' },
      { name: 'outcomeSlotCount', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approveProposal',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'rejectProposal',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getProposal',
    stateMutability: 'view',
    inputs: [{ name: 'proposalId', type: 'uint256' }],
    outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'proposer', type: 'address' },
      { name: 'question', type: 'string' },
      { name: 'outcomeSlotCount', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'processedAt', type: 'uint256' },
      { name: 'rejectionReason', type: 'string' },
    ],
  },
  {
    type: 'function',
    name: 'getProposalCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getProposalIds',
    stateMutability: 'view',
    inputs: [
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256[]' }],
  },
  {
    type: 'function',
    name: 'getProposalsByStatus',
    stateMutability: 'view',
    inputs: [
      { name: 'status', type: 'uint8' },
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256[]' }],
  },
] as const

const conditionalTokensAbi = [
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
] as const

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl),
})

interface QuestionData {
  id: string
  text: string
  outcomeSlotCount: number
  answered: boolean
  createdAt: number
  answeredAt: number
  answer?: bigint[]
}

interface ProposalData {
  id: number
  proposer: string
  question: string
  outcomeSlotCount: number
  status: number // 0=Pending, 1=Approved, 2=Rejected
  createdAt: number
  processedAt: number
  rejectionReason: string
}

export default function AdminApp() {
  const [adminAddress, setAdminAddress] = useState<string>('')
  const [connectedAccount, setConnectedAccount] = useState<string>('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [questions, setQuestions] = useState<QuestionData[]>([])
  const [proposals, setProposals] = useState<ProposalData[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showTransferAdminModal, setShowTransferAdminModal] = useState(false)
  const [showSetAnswerModal, setShowSetAnswerModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionData | null>(null)
  const [selectedProposal, setSelectedProposal] = useState<ProposalData | null>(null)

  useEffect(() => {
    loadAdminInfo()
    loadQuestions()
    loadProposals()
  }, [])

  useEffect(() => {
    if (adminAddress && connectedAccount) {
      setIsAdmin(adminAddress.toLowerCase() === connectedAccount.toLowerCase())
    }
  }, [adminAddress, connectedAccount])

  const loadAdminInfo = async () => {
    if (!MOCK_ORACLE_ADDRESS) return

    try {
      const admin = await publicClient.readContract({
        address: MOCK_ORACLE_ADDRESS as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'admin',
      })
      setAdminAddress(admin)
    } catch (error) {
      console.error('Failed to load admin:', error)
    }
  }

  const loadQuestions = async () => {
    if (!MOCK_ORACLE_ADDRESS) return

    setLoading(true)
    try {
      const count = await publicClient.readContract({
        address: MOCK_ORACLE_ADDRESS as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'getQuestionCount',
      })

      if (count === 0n) {
        setQuestions([])
        return
      }

      const ids = await publicClient.readContract({
        address: MOCK_ORACLE_ADDRESS as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'getQuestionIds',
        args: [0n, count],
      })

      const questionDetails = await Promise.all(
        [...ids].reverse().map(async (qid) => {
          const details = await publicClient.readContract({
            address: MOCK_ORACLE_ADDRESS as `0x${string}`,
            abi: mockOracleAbi,
            functionName: 'getQuestion',
            args: [qid],
          })

          const answer = await publicClient.readContract({
            address: MOCK_ORACLE_ADDRESS as `0x${string}`,
            abi: mockOracleAbi,
            functionName: 'getAnswer',
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
            answer: answer.length > 0 ? answer : undefined,
          }
        })
      )

      setQuestions(questionDetails)
    } catch (error) {
      console.error('Failed to load questions:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProposals = async () => {
    if (!MOCK_ORACLE_ADDRESS) return

    try {
      // Fetch pending proposals (status 0 = Pending)
      const proposalIds = await publicClient.readContract({
        address: MOCK_ORACLE_ADDRESS as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'getProposalsByStatus',
        args: [0, 0n, 100n],
      })

      if (proposalIds.length === 0) {
        setProposals([])
        return
      }

      // Fetch full details for each proposal
      const proposalDetails = await Promise.all(
        [...proposalIds].reverse().map(async (proposalId) => {
          const details = await publicClient.readContract({
            address: MOCK_ORACLE_ADDRESS as `0x${string}`,
            abi: mockOracleAbi,
            functionName: 'getProposal',
            args: [proposalId],
          })

          const [id, proposer, question, outcomeSlotCount, status, createdAt, processedAt, rejectionReason] = details

          return {
            id: Number(id),
            proposer,
            question,
            outcomeSlotCount: Number(outcomeSlotCount),
            status: Number(status),
            createdAt: Number(createdAt),
            processedAt: Number(processedAt),
            rejectionReason,
          }
        })
      )

      setProposals(proposalDetails)
    } catch (error) {
      console.error('Failed to load proposals:', error)
    }
  }

  const handleApproveProposal = async (proposalId: number) => {
    if (!connectedAccount) {
      setMessage('Please connect wallet first')
      return
    }

    setLoading(true)
    setMessage('Approving proposal...')

    try {
      const provider = window.ethereum
      if (!provider) throw new Error('Wallet not available')

      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(provider),
      })

      const proposal = proposals.find(p => p.id === proposalId)
      if (!proposal) throw new Error('Proposal not found')

      // Step 1: Approve proposal (returns questionId)
      const approveHash = await walletClient.writeContract({
        address: MOCK_ORACLE_ADDRESS as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'approveProposal',
        args: [BigInt(proposalId)],
        account: connectedAccount as `0x${string}`,
        chain: sepolia,
      })

      setMessage('Waiting for approval...')
      const receipt = await publicClient.waitForTransactionReceipt({ hash: approveHash })

      // Get the questionId from the approval
      const questionId = await publicClient.readContract({
        address: MOCK_ORACLE_ADDRESS as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'computeQuestionIdFromString',
        args: [proposal.question],
      })

      // Step 2: Prepare condition on ConditionalTokens
      setMessage('Preparing condition...')
      const prepareHash = await walletClient.writeContract({
        address: CONDITIONAL_TOKENS as `0x${string}`,
        abi: conditionalTokensAbi,
        functionName: 'prepareCondition',
        args: [MOCK_ORACLE_ADDRESS as `0x${string}`, questionId, BigInt(proposal.outcomeSlotCount)],
        account: connectedAccount as `0x${string}`,
        chain: sepolia,
      })

      await publicClient.waitForTransactionReceipt({ hash: prepareHash })

      setMessage('✓ Proposal approved and condition prepared!')

      // Refresh both proposals and questions
      await loadProposals()
      await loadQuestions()

      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage(`✗ ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const openRejectModal = (proposal: ProposalData) => {
    setSelectedProposal(proposal)
    setShowRejectModal(true)
  }

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
      setConnectedAccount(addresses[0])
      setMessage('✓ Wallet connected')
      setTimeout(() => setMessage(''), 2000)
    } catch (error) {
      setMessage(`✗ ${(error as Error).message}`)
    }
  }

  const openSetAnswerModal = (question: QuestionData) => {
    setSelectedQuestion(question)
    setShowSetAnswerModal(true)
  }

  return (
    <div className="admin-app">
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="logo-section">
            <h1 className="app-logo">Aurum Admin</h1>
            <p className="tagline">Oracle Management Console</p>
          </div>
          <div className="header-actions">
            <Link to="/" className="back-link">
              ← User App
            </Link>
            <Link to="/dev" className="dev-link">
              Dev Tools
            </Link>
          </div>
        </div>
      </header>

      <div className="admin-container">
        <section className="admin-status-section">
          <h2>Admin Status</h2>
          <div className="status-grid">
            <div className="status-card">
              <label>Oracle Contract</label>
              <div className="address-value">
                {MOCK_ORACLE_ADDRESS ? (
                  <code>{MOCK_ORACLE_ADDRESS}</code>
                ) : (
                  <span className="error">Not configured</span>
                )}
              </div>
            </div>

            <div className="status-card">
              <label>Current Admin</label>
              <div className="address-value">
                {adminAddress ? (
                  <code>{adminAddress}</code>
                ) : (
                  <span>Loading...</span>
                )}
              </div>
            </div>

            <div className="status-card">
              <label>Your Wallet</label>
              <div className="address-value">
                {connectedAccount ? (
                  <>
                    <code>{connectedAccount}</code>
                    {isAdmin && <span className="admin-badge">✓ ADMIN</span>}
                    {!isAdmin && <span className="not-admin-badge">NOT ADMIN</span>}
                  </>
                ) : (
                  <button onClick={connectWallet} className="connect-wallet-btn">
                    Connect Wallet
                  </button>
                )}
              </div>
            </div>
          </div>

          {message && <div className="status-message">{message}</div>}
        </section>

        {!isAdmin && connectedAccount && (
          <div className="warning-banner">
            ⚠️ You are not the admin. Only the admin can execute these operations.
          </div>
        )}

        <section className="admin-actions-section">
          <h2>Admin Actions</h2>
          <div className="action-buttons">
            <button
              className="action-btn primary"
              onClick={() => setShowRegisterModal(true)}
              disabled={!isAdmin}
            >
              Register Question
            </button>
            <button
              className="action-btn secondary"
              onClick={() => setShowTransferAdminModal(true)}
              disabled={!isAdmin}
            >
              Transfer Admin
            </button>
            <button
              className="action-btn refresh"
              onClick={() => {
                loadQuestions()
                loadProposals()
              }}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh All'}
            </button>
          </div>
        </section>

        <section className="proposals-section">
          <h2>Pending Proposals ({proposals.length})</h2>
          {proposals.length === 0 ? (
            <div className="empty-state">No pending proposals.</div>
          ) : (
            <div className="proposals-list">
              {proposals.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  isAdmin={isAdmin}
                  onApprove={handleApproveProposal}
                  onReject={openRejectModal}
                />
              ))}
            </div>
          )}
        </section>

        <section className="questions-section">
          <h2>Questions ({questions.length})</h2>
          {questions.length === 0 ? (
            <div className="empty-state">No questions registered yet.</div>
          ) : (
            <div className="questions-list">
              {questions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  isAdmin={isAdmin}
                  onSetAnswer={openSetAnswerModal}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {showRegisterModal && (
        <RegisterQuestionModal
          onClose={() => setShowRegisterModal(false)}
          onSuccess={() => {
            loadQuestions()
            setShowRegisterModal(false)
          }}
          connectedAccount={connectedAccount}
        />
      )}

      {showTransferAdminModal && (
        <TransferAdminModal
          onClose={() => setShowTransferAdminModal(false)}
          onSuccess={() => {
            loadAdminInfo()
            setShowTransferAdminModal(false)
          }}
          connectedAccount={connectedAccount}
        />
      )}

      {showSetAnswerModal && selectedQuestion && (
        <SetAnswerModal
          question={selectedQuestion}
          onClose={() => {
            setShowSetAnswerModal(false)
            setSelectedQuestion(null)
          }}
          onSuccess={() => {
            loadQuestions()
            setShowSetAnswerModal(false)
            setSelectedQuestion(null)
          }}
          connectedAccount={connectedAccount}
        />
      )}

      {showRejectModal && selectedProposal && (
        <RejectProposalModal
          proposal={selectedProposal}
          onClose={() => {
            setShowRejectModal(false)
            setSelectedProposal(null)
          }}
          onSuccess={() => {
            loadProposals()
            setShowRejectModal(false)
            setSelectedProposal(null)
          }}
          connectedAccount={connectedAccount}
        />
      )}
    </div>
  )
}

interface ProposalCardProps {
  proposal: ProposalData
  isAdmin: boolean
  onApprove: (proposalId: number) => void
  onReject: (proposal: ProposalData) => void
}

function ProposalCard({ proposal, isAdmin, onApprove, onReject }: ProposalCardProps) {
  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <div className="proposal-card">
      <div className="proposal-header">
        <h3>{proposal.question}</h3>
      </div>

      <div className="proposal-details">
        <div className="detail-row">
          <label>Proposal ID:</label>
          <span>{proposal.id}</span>
        </div>
        <div className="detail-row">
          <label>Proposer:</label>
          <code>{shortenAddress(proposal.proposer)}</code>
        </div>
        <div className="detail-row">
          <label>Outcomes:</label>
          <span>{proposal.outcomeSlotCount}</span>
        </div>
        <div className="detail-row">
          <label>Created:</label>
          <span>{new Date(proposal.createdAt * 1000).toLocaleString()}</span>
        </div>
      </div>

      {isAdmin && (
        <div className="proposal-actions">
          <button
            className="action-btn primary small"
            onClick={() => onApprove(proposal.id)}
          >
            Approve
          </button>
          <button
            className="action-btn danger small"
            onClick={() => onReject(proposal)}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

interface QuestionCardProps {
  question: QuestionData
  isAdmin: boolean
  onSetAnswer: (question: QuestionData) => void
}

function QuestionCard({ question, isAdmin, onSetAnswer }: QuestionCardProps) {
  const [showSubmitModal, setShowSubmitModal] = useState(false)

  return (
    <div className="question-card">
      <div className="question-header">
        <h3>{question.text}</h3>
        <span className={`status-badge ${question.answered ? 'answered' : 'pending'}`}>
          {question.answered ? 'Answered' : 'Pending'}
        </span>
      </div>

      <div className="question-details">
        <div className="detail-row">
          <label>Question ID:</label>
          <code>{question.id}</code>
        </div>
        <div className="detail-row">
          <label>Outcomes:</label>
          <span>{question.outcomeSlotCount}</span>
        </div>
        <div className="detail-row">
          <label>Created:</label>
          <span>{new Date(question.createdAt * 1000).toLocaleString()}</span>
        </div>
        {question.answered && question.answer && (
          <div className="detail-row">
            <label>Answer:</label>
            <span>[{question.answer.map(String).join(', ')}]</span>
          </div>
        )}
      </div>

      <div className="question-actions">
        {!question.answered && (
          <button
            className="action-btn primary small"
            onClick={() => onSetAnswer(question)}
            disabled={!isAdmin}
          >
            Set Answer
          </button>
        )}
        {question.answered && (
          <button
            className="action-btn secondary small"
            onClick={() => setShowSubmitModal(true)}
            disabled={!isAdmin}
          >
            Submit to ConditionalTokens
          </button>
        )}
      </div>

      {showSubmitModal && (
        <SubmitAnswerModal
          question={question}
          onClose={() => setShowSubmitModal(false)}
          connectedAccount={''}
        />
      )}
    </div>
  )
}

interface RegisterQuestionModalProps {
  onClose: () => void
  onSuccess: () => void
  connectedAccount: string
}

function RegisterQuestionModal({
  onClose,
  onSuccess,
  connectedAccount,
}: RegisterQuestionModalProps) {
  const [questionText, setQuestionText] = useState('')
  const [outcomes, setOutcomes] = useState('2')
  const [useUnique, setUseUnique] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleRegister = async () => {
    if (!connectedAccount) {
      setMessage('Please connect wallet first')
      return
    }

    if (!questionText.trim()) {
      setMessage('Please enter a question')
      return
    }

    setLoading(true)
    setMessage('Registering question...')

    try {
      const provider = window.ethereum
      if (!provider) throw new Error('Wallet not available')

      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(provider),
      })

      const outcomeCount = parseInt(outcomes)

      // Step 1: Register question
      const registerHash = await walletClient.writeContract({
        address: MOCK_ORACLE_ADDRESS as `0x${string}`,
        abi: mockOracleAbi,
        functionName: useUnique ? 'registerQuestionUnique' : 'registerQuestion',
        args: [questionText.trim(), BigInt(outcomeCount)],
        account: connectedAccount as `0x${string}`,
        chain: sepolia,
      })

      setMessage('Waiting for registration...')
      await publicClient.waitForTransactionReceipt({ hash: registerHash })

      // Step 2: Get question ID
      const questionId = await publicClient.readContract({
        address: MOCK_ORACLE_ADDRESS as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'computeQuestionIdFromString',
        args: [questionText.trim()],
      })

      // Step 3: Prepare condition
      setMessage('Preparing condition...')
      const prepareHash = await walletClient.writeContract({
        address: CONDITIONAL_TOKENS as `0x${string}`,
        abi: conditionalTokensAbi,
        functionName: 'prepareCondition',
        args: [MOCK_ORACLE_ADDRESS as `0x${string}`, questionId, BigInt(outcomeCount)],
        account: connectedAccount as `0x${string}`,
        chain: sepolia,
      })

      await publicClient.waitForTransactionReceipt({ hash: prepareHash })

      setMessage('✓ Question registered and condition prepared!')
      setTimeout(onSuccess, 1500)
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

        <h2>Register New Question</h2>
        <p className="info-text">
          Note: Users can now propose questions directly. This admin form is for direct registration.
        </p>

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
        </div>

        <div className="modal-section">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={useUnique}
              onChange={(e) => setUseUnique(e.target.checked)}
              disabled={loading}
            />
            <span>Use unique ID (allows duplicate questions)</span>
          </label>
        </div>

        <button
          onClick={handleRegister}
          disabled={loading || !questionText.trim()}
          className="modal-btn primary"
        >
          {loading ? 'Registering...' : 'Register Question'}
        </button>

        {message && <div className="modal-message">{message}</div>}
      </div>
    </div>
  )
}

interface TransferAdminModalProps {
  onClose: () => void
  onSuccess: () => void
  connectedAccount: string
}

function TransferAdminModal({
  onClose,
  onSuccess,
  connectedAccount,
}: TransferAdminModalProps) {
  const [newAdmin, setNewAdmin] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleTransfer = async () => {
    if (!connectedAccount) {
      setMessage('Please connect wallet first')
      return
    }

    if (!newAdmin.trim() || !newAdmin.startsWith('0x')) {
      setMessage('Please enter a valid address')
      return
    }

    setLoading(true)
    setMessage('Transferring admin rights...')

    try {
      const provider = window.ethereum
      if (!provider) throw new Error('Wallet not available')

      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(provider),
      })

      const hash = await walletClient.writeContract({
        address: MOCK_ORACLE_ADDRESS as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'setAdmin',
        args: [newAdmin as `0x${string}`],
        account: connectedAccount as `0x${string}`,
        chain: sepolia,
      })

      await publicClient.waitForTransactionReceipt({ hash })

      setMessage('✓ Admin transferred successfully!')
      setTimeout(onSuccess, 1500)
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

        <h2>Transfer Admin Rights</h2>
        <p className="warning-text">
          ⚠️ Warning: You will lose admin access after this operation!
        </p>

        <div className="modal-section">
          <label>New Admin Address</label>
          <input
            type="text"
            value={newAdmin}
            onChange={(e) => setNewAdmin(e.target.value)}
            placeholder="0x..."
            disabled={loading}
          />
        </div>

        <button
          onClick={handleTransfer}
          disabled={loading || !newAdmin.trim()}
          className="modal-btn danger"
        >
          {loading ? 'Transferring...' : 'Transfer Admin'}
        </button>

        {message && <div className="modal-message">{message}</div>}
      </div>
    </div>
  )
}

interface SetAnswerModalProps {
  question: QuestionData
  onClose: () => void
  onSuccess: () => void
  connectedAccount: string
}

function SetAnswerModal({
  question,
  onClose,
  onSuccess,
  connectedAccount,
}: SetAnswerModalProps) {
  const [payouts, setPayouts] = useState<string[]>(
    Array(question.outcomeSlotCount).fill('')
  )
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSetAnswer = async () => {
    if (!connectedAccount) {
      setMessage('Please connect wallet first')
      return
    }

    if (payouts.some((p) => !p.trim())) {
      setMessage('Please fill all payout values')
      return
    }

    setLoading(true)
    setMessage('Setting answer...')

    try {
      const provider = window.ethereum
      if (!provider) throw new Error('Wallet not available')

      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(provider),
      })

      const payoutValues = payouts.map((p) => BigInt(p))

      const hash = await walletClient.writeContract({
        address: MOCK_ORACLE_ADDRESS as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'setAnswer',
        args: [question.id as `0x${string}`, payoutValues],
        account: connectedAccount as `0x${string}`,
        chain: sepolia,
      })

      await publicClient.waitForTransactionReceipt({ hash })

      setMessage('✓ Answer set successfully!')
      setTimeout(onSuccess, 1500)
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

        <h2>Set Answer</h2>
        <p className="question-text">{question.text}</p>

        <div className="modal-section">
          <label>Payout Numerators (sum determines denominator)</label>
          {payouts.map((payout, idx) => (
            <div key={idx} className="payout-input">
              <label>Outcome {idx}:</label>
              <input
                type="number"
                value={payout}
                onChange={(e) => {
                  const newPayouts = [...payouts]
                  newPayouts[idx] = e.target.value
                  setPayouts(newPayouts)
                }}
                placeholder="e.g., 1 or 0"
                min="0"
                disabled={loading}
              />
            </div>
          ))}
          <small>
            Example: For binary outcome, use [1, 0] for outcome 0 wins, [0, 1] for outcome 1
            wins, [1, 1] for tie
          </small>
        </div>

        <button
          onClick={handleSetAnswer}
          disabled={loading || payouts.some((p) => !p.trim())}
          className="modal-btn primary"
        >
          {loading ? 'Setting Answer...' : 'Set Answer'}
        </button>

        {message && <div className="modal-message">{message}</div>}
      </div>
    </div>
  )
}

interface SubmitAnswerModalProps {
  question: QuestionData
  onClose: () => void
  connectedAccount: string
}

function SubmitAnswerModal({
  question,
  onClose,
  connectedAccount,
}: SubmitAnswerModalProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubmit = async () => {
    if (!connectedAccount) {
      setMessage('Please connect wallet first')
      return
    }

    setLoading(true)
    setMessage('Submitting answer to ConditionalTokens...')

    try {
      const provider = window.ethereum
      if (!provider) throw new Error('Wallet not available')

      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(provider),
      })

      const hash = await walletClient.writeContract({
        address: MOCK_ORACLE_ADDRESS as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'submitAnswerToConditionalTokens',
        args: [question.id as `0x${string}`, CONDITIONAL_TOKENS as `0x${string}`],
        account: connectedAccount as `0x${string}`,
        chain: sepolia,
      })

      await publicClient.waitForTransactionReceipt({ hash })

      setMessage('✓ Answer submitted successfully!')
      setTimeout(onClose, 1500)
    } catch (error) {
      setMessage(`✗ ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content small" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <h2>Submit Answer</h2>
        <p className="question-text">{question.text}</p>

        <div className="modal-section">
          <label>Answer:</label>
          <div className="answer-display">
            {question.answer ? `[${question.answer.map(String).join(', ')}]` : 'N/A'}
          </div>
          <small>
            This will call reportPayouts() on the ConditionalTokens contract, allowing
            users to redeem their positions.
          </small>
        </div>

        <button onClick={handleSubmit} disabled={loading} className="modal-btn primary">
          {loading ? 'Submitting...' : 'Submit to ConditionalTokens'}
        </button>

        {message && <div className="modal-message">{message}</div>}
      </div>
    </div>
  )
}

interface RejectProposalModalProps {
  proposal: ProposalData
  onClose: () => void
  onSuccess: () => void
  connectedAccount: string
}

function RejectProposalModal({
  proposal,
  onClose,
  onSuccess,
  connectedAccount,
}: RejectProposalModalProps) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleReject = async () => {
    if (!connectedAccount) {
      setMessage('Please connect wallet first')
      return
    }

    if (!reason.trim()) {
      setMessage('Please provide a rejection reason')
      return
    }

    setLoading(true)
    setMessage('Rejecting proposal...')

    try {
      const provider = window.ethereum
      if (!provider) throw new Error('Wallet not available')

      const walletClient = createWalletClient({
        chain: sepolia,
        transport: custom(provider),
      })

      const hash = await walletClient.writeContract({
        address: MOCK_ORACLE_ADDRESS as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'rejectProposal',
        args: [BigInt(proposal.id), reason.trim()],
        account: connectedAccount as `0x${string}`,
        chain: sepolia,
      })

      await publicClient.waitForTransactionReceipt({ hash })

      setMessage('✓ Proposal rejected successfully!')
      setTimeout(onSuccess, 1500)
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

        <h2>Reject Proposal</h2>
        <p className="question-text">{proposal.question}</p>

        <div className="modal-section">
          <label>Rejection Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Question is unclear, duplicate, or violates guidelines..."
            rows={4}
            disabled={loading}
          />
        </div>

        <button
          onClick={handleReject}
          disabled={loading || !reason.trim()}
          className="modal-btn danger"
        >
          {loading ? 'Rejecting...' : 'Reject Proposal'}
        </button>

        {message && <div className="modal-message">{message}</div>}
      </div>
    </div>
  )
}
