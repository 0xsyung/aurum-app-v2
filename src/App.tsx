import { useMemo, useState } from 'react'
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  isAddress,
  parseUnits,
} from 'viem'
import { sepolia } from 'viem/chains'
import './App.css'

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
    }
  }
}

const CONDITIONAL_TOKENS = '0x1d2607F5e52c4bc92891bE5932091b7D74FC719A'

const rpcUrl =
  import.meta.env.VITE_SEPOLIA_RPC_URL?.trim() ||
  'https://ethereum-sepolia-rpc.publicnode.com'

const COLLATERAL_TOKEN_ADDRESS =
  import.meta.env.VITE_COLLATERAL_TOKEN_ADDRESS?.trim() || ''

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
  {
    type: 'function',
    name: 'mergePositions',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'collateralToken', type: 'address' },
      { name: 'conditionId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'reportPayouts',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'questionId', type: 'bytes32' },
      { name: 'payouts', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'redeemPositions',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'collateralToken', type: 'address' },
      { name: 'conditionId', type: 'bytes32' },
      { name: 'outcomeIndexes', type: 'uint256[]' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const

const mockOracleAbi = [
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
    name: 'computeQuestionIdFromString',
    stateMutability: 'pure',
    inputs: [{ name: 'question', type: 'string' }],
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
    outputs: [{ name: 'payouts', type: 'uint256[]' }],
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

const erc20Abi = [
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

type OracleQuestion = {
  id: `0x${string}`
  text: string
  outcomeSlotCount: string
  answered: boolean
  createdAt: string
  answeredAt: string
  payouts: string
}

type ActivityLogEntry = {
  id: string
  timestamp: string
  action: string
  status: 'pending' | 'success' | 'error'
  message: string
  hash?: string
}

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl),
})

const TIMELINE_STEPS = [
  { number: 1, label: 'Configure\nMock Oracle' },
  { number: 2, label: 'Register\nQuestion' },
  { number: 3, label: 'Derive\nIDs' },
  { number: 4, label: 'Prepare\nCondition' },
  { number: 5, label: 'Approve\nCollateral' },
  { number: 6, label: 'Split\nPosition' },
  { number: 7, label: 'Set & Submit\nAnswer' },
  { number: 8, label: 'Report\nPayouts' },
  { number: 9, label: 'Redeem\nPositions' },
]

function Timeline() {
  return (
    <aside className="timeline">
      <div className="timeline-steps">
        {TIMELINE_STEPS.map((step) => (
          <div key={step.number} className="timeline-step">
            <div className="timeline-step-dot">{step.number}</div>
            <div className="timeline-step-label">{step.label}</div>
          </div>
        ))}
      </div>
    </aside>
  )
}

function App() {
  const [account, setAccount] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])

  const [questionText, setQuestionText] = useState('Will ETH be above 5000 by 2026-12-31?')
  const [oracle, setOracle] = useState('')
  const [outcomeCount, setOutcomeCount] = useState('2')
  const [collateral, setCollateral] = useState(COLLATERAL_TOKEN_ADDRESS)
  const [outcomeIndex, setOutcomeIndex] = useState('0')

  const [derivedQuestionId, setDerivedQuestionId] = useState('')
  const [derivedConditionId, setDerivedConditionId] = useState('')
  const [derivedPositionId, setDerivedPositionId] = useState('')

  const [prepareQuestionId, setPrepareQuestionId] = useState('')
  const [prepareOracle, setPrepareOracle] = useState('')
  const [prepareOutcomes, setPrepareOutcomes] = useState('2')

  const [approveCollateral, setApproveCollateral] = useState(COLLATERAL_TOKEN_ADDRESS)
  const [approveAmount, setApproveAmount] = useState('100')
  const [currentAllowance, setCurrentAllowance] = useState('')

  const [splitCollateral, setSplitCollateral] = useState(COLLATERAL_TOKEN_ADDRESS)
  const [splitConditionId, setSplitConditionId] = useState('')
  const [splitAmount, setSplitAmount] = useState('10')
  const [splitPositionIds, setSplitPositionIds] = useState<string[]>([])

  const [mergeCollateral, setMergeCollateral] = useState(COLLATERAL_TOKEN_ADDRESS)
  const [mergeConditionId, setMergeConditionId] = useState('')
  const [mergeAmount, setMergeAmount] = useState('10')

  const [reportQuestionId, setReportQuestionId] = useState('')
  const [reportPayouts, setReportPayouts] = useState('1,0')

  const [redeemCollateral, setRedeemCollateral] = useState(COLLATERAL_TOKEN_ADDRESS)
  const [redeemConditionId, setRedeemConditionId] = useState('')
  const [redeemIndexes, setRedeemIndexes] = useState('0')

  const [balanceCheckConditionId, setBalanceCheckConditionId] = useState('')
  const [balanceCheckOutcomeIndexes, setBalanceCheckOutcomeIndexes] = useState('0,1')
  const [outcomeTokenBalances, setOutcomeTokenBalances] = useState<{ index: number; balance: string }[]>([])

  const [mockOracleAddress, setMockOracleAddress] = useState(
    import.meta.env.VITE_MOCK_ORACLE_ADDRESS?.trim() || ''
  )
  const [oracleQuestionText, setOracleQuestionText] = useState('Will ETH be above 5000 by 2026-12-31?')
  const [oracleOutcomeCount, setOracleOutcomeCount] = useState('2')
  const [oracleSetQuestionId, setOracleSetQuestionId] = useState('')
  const [oracleSetPayouts, setOracleSetPayouts] = useState('1,0')
  const [oracleCheckQuestionId, setOracleCheckQuestionId] = useState('')
  const [oracleQuestionDetails, setOracleQuestionDetails] = useState<OracleQuestion | null>(null)
  const [oracleQuestionList, setOracleQuestionList] = useState<OracleQuestion[]>([])

  const networkHint = useMemo(() => `Sepolia RPC: ${rpcUrl}`, [])

  async function connectWallet() {
    if (!window.ethereum) {
      logActivity('Connect Wallet', 'error', 'No injected wallet found. Install MetaMask or Rabby.')
      return
    }

    const walletClient = createWalletClient({ chain: sepolia, transport: custom(window.ethereum) })
    const addresses = await walletClient.requestAddresses()
    const addr = addresses[0]
    if (!addr) {
      logActivity('Connect Wallet', 'error', 'No account returned from wallet.')
      return
    }

    setAccount(addr)
    setOracle(addr)
    setPrepareOracle(addr)
    logActivity('Connect Wallet', 'success', `Connected ${addr}`)
  }

  async function walletClientOrThrow() {
    if (!window.ethereum) throw new Error('Wallet not found')
    const walletClient = createWalletClient({ chain: sepolia, transport: custom(window.ethereum) })
    const addresses = await walletClient.requestAddresses()
    const addr = addresses[0]
    if (!addr) throw new Error('No wallet account selected')
    if (account !== addr) setAccount(addr)
    return { walletClient, addr }
  }

  function requireAddress(value: string, label: string) {
    if (!isAddress(value)) throw new Error(`${label} is not a valid address`)
  }

  function requireBytes32(value: string, label: string) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
      throw new Error(`${label} must be 32-byte hex (0x + 64 chars)`)
    }
  }

  function logActivity(action: string, status: 'pending' | 'success' | 'error', message: string, hash?: string) {
    const timestamp = new Date().toLocaleTimeString()
    const entry: ActivityLogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp,
      action,
      status,
      message,
      hash,
    }
    setActivityLog((prev) => [entry, ...prev].slice(0, 50))
    setStatus(`[${status.toUpperCase()}] ${message}`)
  }

  function getLastActivityForAction(actionName: string): ActivityLogEntry | undefined {
    return activityLog.find((entry) => entry.action === actionName)
  }

  function renderActionResult(actionName: string) {
    const entry = getLastActivityForAction(actionName)
    if (!entry) return null

    return (
      <div className={`action-result ${entry.status}`}>
        <div className="action-result-header">
          <span className="action-result-time">{entry.timestamp}</span>
          <span className={`action-result-status ${entry.status}`}>{entry.status}</span>
        </div>
        <div className="action-result-message">{entry.message}</div>
        {entry.hash && (
          <div className="action-result-hash">
            <a href={`https://sepolia.etherscan.io/tx/${entry.hash}`} target="_blank" rel="noopener noreferrer">
              Tx: {entry.hash.slice(0, 12)}...{entry.hash.slice(-8)}
            </a>
          </div>
        )}
      </div>
    )
  }

  function parseCsvBigInts(value: string, label: string) {
    const parsed = value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => BigInt(v))

    if (parsed.length === 0) throw new Error(`${label} is empty`)
    return parsed
  }

  async function waitAndSet(hash: `0x${string}`, action: string) {
    logActivity(action, 'pending', `Submitted. Hash: ${hash}`, hash)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    logActivity(action, 'success', `Confirmed in block ${receipt.blockNumber}`, hash)
  }

  async function deriveIds() {
    try {
      requireAddress(oracle, 'Oracle')
      requireAddress(collateral, 'Collateral token')

      const slots = BigInt(outcomeCount)
      const outIdx = BigInt(outcomeIndex)

      const qid = await publicClient.readContract({
        address: CONDITIONAL_TOKENS,
        abi: conditionalTokensAbi,
        functionName: 'getQuestionIdFromString',
        args: [questionText],
      })

      const cid = await publicClient.readContract({
        address: CONDITIONAL_TOKENS,
        abi: conditionalTokensAbi,
        functionName: 'getConditionId',
        args: [oracle as `0x${string}`, qid, slots],
      })

      const pid = await publicClient.readContract({
        address: CONDITIONAL_TOKENS,
        abi: conditionalTokensAbi,
        functionName: 'getPositionId',
        args: [collateral as `0x${string}`, cid, outIdx],
      })

      setDerivedQuestionId(qid)
      setDerivedConditionId(cid)
      setDerivedPositionId(pid.toString())
      
      // Sync derived IDs to all corresponding fields
      setPrepareQuestionId(qid)
      setOracleSetQuestionId(qid)
      setReportQuestionId(qid)
      setOracleCheckQuestionId(qid)
      setSplitConditionId(cid)
      setMergeConditionId(cid)
      setRedeemConditionId(cid)
      setBalanceCheckConditionId(cid)
      
      logActivity('Derive IDs', 'success', 'Question, condition, and position IDs derived')
    } catch (error) {
      logActivity('Derive IDs', 'error', (error as Error).message)
    }
  }

  async function getTokenDecimals(token: `0x${string}`) {
    const decimals = await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'decimals',
    })
    return Number(decimals)
  }

  async function onPrepareCondition() {
    try {
      const { walletClient, addr } = await walletClientOrThrow()
      requireAddress(prepareOracle, 'Oracle')
      requireBytes32(prepareQuestionId, 'Question ID')

      const hash = await walletClient.writeContract({
        address: CONDITIONAL_TOKENS,
        abi: conditionalTokensAbi,
        functionName: 'prepareCondition',
        args: [prepareOracle as `0x${string}`, prepareQuestionId as `0x${string}`, BigInt(prepareOutcomes)],
        account: addr,
        chain: sepolia,
      })
      await waitAndSet(hash, 'Prepare Condition')
    } catch (error) {
      logActivity('Prepare Condition', 'error', (error as Error).message)
    }
  }

  async function refreshAllowance() {
    try {
      if (!account) throw new Error('Connect wallet first')
      requireAddress(approveCollateral, 'Collateral token')

      const token = approveCollateral as `0x${string}`
      const [decimals, allowance] = await Promise.all([
        getTokenDecimals(token),
        publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account as `0x${string}`, CONDITIONAL_TOKENS],
        }),
      ])

      setCurrentAllowance(`${allowance.toString()} (${formatUnits(allowance, decimals)})`)
      logActivity('Refresh Allowance', 'success', `Allowance: ${formatUnits(allowance, decimals)}`)
    } catch (error) {
      logActivity('Refresh Allowance', 'error', (error as Error).message)
    }
  }

  async function onApprove() {
    try {
      const { walletClient, addr } = await walletClientOrThrow()
      requireAddress(approveCollateral, 'Collateral token')
      const token = approveCollateral as `0x${string}`
      const decimals = await getTokenDecimals(token)
      const raw = parseUnits(approveAmount, decimals)

      const hash = await walletClient.writeContract({
        address: token,
        abi: erc20Abi,
        functionName: 'approve',
        args: [CONDITIONAL_TOKENS, raw],
        account: addr,
        chain: sepolia,
      })

      await waitAndSet(hash, 'Approve Collateral')
      await refreshAllowance()
    } catch (error) {
      logActivity('Approve Collateral', 'error', (error as Error).message)
    }
  }

  async function onSplit() {
    try {
      const { walletClient, addr } = await walletClientOrThrow()
      requireAddress(splitCollateral, 'Collateral token')
      requireBytes32(splitConditionId, 'Condition ID')

      const token = splitCollateral as `0x${string}`
      const decimals = await getTokenDecimals(token)
      const amount = parseUnits(splitAmount, decimals)

      const hash = await walletClient.writeContract({
        address: CONDITIONAL_TOKENS,
        abi: conditionalTokensAbi,
        functionName: 'splitPosition',
        args: [token, splitConditionId as `0x${string}`, amount],
        account: addr,
        chain: sepolia,
      })

      await waitAndSet(hash, 'Split Position')

      // Calculate position IDs for each outcome
      const outcomeCount = BigInt(prepareOutcomes)
      const positionIds: string[] = []

      for (let i = 0; i < Number(outcomeCount); i++) {
        const positionId = await publicClient.readContract({
          address: CONDITIONAL_TOKENS,
          abi: conditionalTokensAbi,
          functionName: 'getPositionId',
          args: [token, splitConditionId as `0x${string}`, BigInt(i)],
        })
        positionIds.push(positionId.toString())
      }

      setSplitPositionIds(positionIds)
    } catch (error) {
      logActivity('Split Position', 'error', (error as Error).message)
    }
  }

  async function onMerge() {
    try {
      const { walletClient, addr } = await walletClientOrThrow()
      requireAddress(mergeCollateral, 'Collateral token')
      requireBytes32(mergeConditionId, 'Condition ID')

      const token = mergeCollateral as `0x${string}`
      const decimals = await getTokenDecimals(token)
      const amount = parseUnits(mergeAmount, decimals)

      const hash = await walletClient.writeContract({
        address: CONDITIONAL_TOKENS,
        abi: conditionalTokensAbi,
        functionName: 'mergePositions',
        args: [token, mergeConditionId as `0x${string}`, amount],
        account: addr,
        chain: sepolia,
      })

      await waitAndSet(hash, 'Merge Positions')
    } catch (error) {
      logActivity('Merge Positions', 'error', (error as Error).message)
    }
  }

  async function onReportPayouts() {
    try {
      const { walletClient, addr } = await walletClientOrThrow()
      requireBytes32(reportQuestionId, 'Question ID')

      const payouts = parseCsvBigInts(reportPayouts, 'Payout vector')
      if (payouts.length < 2) throw new Error('Need at least 2 payout entries')

      const hash = await walletClient.writeContract({
        address: CONDITIONAL_TOKENS,
        abi: conditionalTokensAbi,
        functionName: 'reportPayouts',
        args: [reportQuestionId as `0x${string}`, payouts],
        account: addr,
        chain: sepolia,
      })

      await waitAndSet(hash, 'Report Payouts')
    } catch (error) {
      logActivity('Report Payouts', 'error', (error as Error).message)
    }
  }

  async function onRedeem() {
    try {
      const { walletClient, addr } = await walletClientOrThrow()
      requireAddress(redeemCollateral, 'Collateral token')
      requireBytes32(redeemConditionId, 'Condition ID')

      const indexes = parseCsvBigInts(redeemIndexes, 'Outcome indexes')

      const hash = await walletClient.writeContract({
        address: CONDITIONAL_TOKENS,
        abi: conditionalTokensAbi,
        functionName: 'redeemPositions',
        args: [redeemCollateral as `0x${string}`, redeemConditionId as `0x${string}`, indexes],
        account: addr,
        chain: sepolia,
      })

      await waitAndSet(hash, 'Redeem Positions')
    } catch (error) {
      logActivity('Redeem Positions', 'error', (error as Error).message)
    }
  }

  async function onRegisterOracleQuestion() {
    try {
      const { walletClient, addr } = await walletClientOrThrow()
      requireAddress(mockOracleAddress, 'MockOracle address')

      const hash = await walletClient.writeContract({
        address: mockOracleAddress as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'registerQuestion',
        args: [oracleQuestionText, BigInt(oracleOutcomeCount)],
        account: addr,
        chain: sepolia,
      })

      const predictedQid = await publicClient.readContract({
        address: mockOracleAddress as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'computeQuestionIdFromString',
        args: [oracleQuestionText],
      })

      setOracleSetQuestionId(predictedQid)
      setOracleCheckQuestionId(predictedQid)
      setPrepareQuestionId(predictedQid)

      await waitAndSet(hash, 'Register Oracle Question')
      await loadOracleQuestions()

      // Auto-derive IDs after question is registered
      setOutcomeCount(oracleOutcomeCount)
      setTimeout(() => deriveIds(), 500)
    } catch (error) {
      logActivity('Register Oracle Question', 'error', (error as Error).message)
    }
  }

  async function onSetOracleAnswer() {
    try {
      const { walletClient, addr } = await walletClientOrThrow()
      requireAddress(mockOracleAddress, 'MockOracle address')
      requireBytes32(oracleSetQuestionId, 'Oracle Question ID')

      const payouts = parseCsvBigInts(oracleSetPayouts, 'Oracle payout vector')

      const hash = await walletClient.writeContract({
        address: mockOracleAddress as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'setAnswer',
        args: [oracleSetQuestionId as `0x${string}`, payouts],
        account: addr,
        chain: sepolia,
      })

      await waitAndSet(hash, 'Set Oracle Answer')
      await checkOracleQuestion(oracleSetQuestionId)
      await loadOracleQuestions()
    } catch (error) {
      logActivity('Set Oracle Answer', 'error', (error as Error).message)
    }
  }

  async function onSubmitOracleAnswerToConditionalTokens() {
    try {
      const { walletClient, addr } = await walletClientOrThrow()
      requireAddress(mockOracleAddress, 'MockOracle address')
      requireBytes32(oracleSetQuestionId, 'Oracle Question ID')

      // First, verify the question exists on the oracle and has been answered
      const details = await publicClient.readContract({
        address: mockOracleAddress as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'getQuestion',
        args: [oracleSetQuestionId as `0x${string}`],
      })

      const [exists, , , , answered] = details

      if (!exists) {
        throw new Error(`Question ${oracleSetQuestionId.slice(0, 10)}... does not exist on oracle`)
      }

      if (!answered) {
        throw new Error('Question has not been answered yet. Set the answer first using "Step 7a: Set Answer (Oracle)"')
      }

      logActivity('Submit Oracle Answer to ConditionalTokens', 'pending', `Submitting answer from oracle to ConditionalTokens...`)

      const hash = await walletClient.writeContract({
        address: mockOracleAddress as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'submitAnswerToConditionalTokens',
        args: [oracleSetQuestionId as `0x${string}`, CONDITIONAL_TOKENS],
        account: addr,
        chain: sepolia,
      })

      await waitAndSet(hash, 'Submit Oracle Answer to ConditionalTokens')
    } catch (error) {
      logActivity('Submit Oracle Answer to ConditionalTokens', 'error', (error as Error).message)
    }
  }

  async function checkOracleQuestion(questionId: string) {
    requireAddress(mockOracleAddress, 'MockOracle address')
    requireBytes32(questionId, 'Question ID')

    const details = await publicClient.readContract({
      address: mockOracleAddress as `0x${string}`,
      abi: mockOracleAbi,
      functionName: 'getQuestion',
      args: [questionId as `0x${string}`],
    })

    const answer = await publicClient.readContract({
      address: mockOracleAddress as `0x${string}`,
      abi: mockOracleAbi,
      functionName: 'getAnswer',
      args: [questionId as `0x${string}`],
    })

    const [, slots, text, createdAt, answered, answeredAt] = details

    setOracleQuestionDetails({
      id: questionId as `0x${string}`,
      text,
      outcomeSlotCount: slots.toString(),
      answered,
      createdAt: createdAt.toString(),
      answeredAt: answeredAt.toString(),
      payouts: answer.length ? answer.map((v) => v.toString()).join(',') : '-',
    })

    logActivity('Check Oracle Question', 'success', `Question loaded: ${text}`)
  }

  async function onCheckOracleQuestion() {
    try {
      await checkOracleQuestion(oracleCheckQuestionId)
    } catch (error) {
      logActivity('Check Oracle Question', 'error', (error as Error).message)
    }
  }

  async function loadOracleQuestions() {
    try {
      requireAddress(mockOracleAddress, 'MockOracle address')
      const total = await publicClient.readContract({
        address: mockOracleAddress as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'getQuestionCount',
      })

      const pageSize = 20n
      const offset = total > pageSize ? total - pageSize : 0n
      const ids = await publicClient.readContract({
        address: mockOracleAddress as `0x${string}`,
        abi: mockOracleAbi,
        functionName: 'getQuestionIds',
        args: [offset, pageSize],
      })

      const rows: OracleQuestion[] = await Promise.all(
        [...ids].reverse().map(async (qid) => {
          const details = await publicClient.readContract({
            address: mockOracleAddress as `0x${string}`,
            abi: mockOracleAbi,
            functionName: 'getQuestion',
            args: [qid],
          })

          const answer = await publicClient.readContract({
            address: mockOracleAddress as `0x${string}`,
            abi: mockOracleAbi,
            functionName: 'getAnswer',
            args: [qid],
          })

          const [, slots, text, createdAt, answered, answeredAt] = details

          return {
            id: qid,
            text,
            outcomeSlotCount: slots.toString(),
            answered,
            createdAt: createdAt.toString(),
            answeredAt: answeredAt.toString(),
            payouts: answer.length ? answer.map((v) => v.toString()).join(',') : '-',
          } satisfies OracleQuestion
        })
      )

      setOracleQuestionList(rows)
      logActivity('Load Oracle Questions', 'success', `Loaded ${rows.length} questions`)
    } catch (error) {
      logActivity('Load Oracle Questions', 'error', (error as Error).message)
    }
  }

  async function checkOutcomeTokenBalances() {
    try {
      if (!account) throw new Error('Connect wallet first')
      requireBytes32(balanceCheckConditionId, 'Condition ID')

      const outcomeIndexes = parseCsvBigInts(balanceCheckOutcomeIndexes, 'Outcome indexes')
      const collateralToken = collateral as `0x${string}`

      const balances = await Promise.all(
        outcomeIndexes.map(async (outcomeIndex) => {
          const positionId = await publicClient.readContract({
            address: CONDITIONAL_TOKENS,
            abi: conditionalTokensAbi,
            functionName: 'getPositionId',
            args: [collateralToken, balanceCheckConditionId as `0x${string}`, outcomeIndex],
          })

          const balance = await publicClient.readContract({
            address: CONDITIONAL_TOKENS,
            abi: conditionalTokensAbi,
            functionName: 'balanceOf',
            args: [account as `0x${string}`, BigInt(positionId.toString())],
          })

          return {
            index: Number(outcomeIndex),
            balance: balance.toString(),
          }
        })
      )

      setOutcomeTokenBalances(balances)
      logActivity('Check Outcome Token Balances', 'success', `Retrieved balances for ${balances.length} outcomes`)
    } catch (error) {
      logActivity('Check Outcome Token Balances', 'error', (error as Error).message)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Aurum App v2</h1>
          <p>ConditionalTokens + MockOracle operator console (Sepolia)</p>
        </div>
        <button onClick={connectWallet}>{account ? 'Connected' : 'Connect Wallet'}</button>
      </header>

      <div className="timeline-wrapper">
        <Timeline />

        <div className="main-content">
        <section className="activity-log">
          <h3>Activity Log</h3>
          {activityLog.length === 0 ? (
            <div className="log-entry log-empty">No activity yet</div>
          ) : (
            <div className="log-list">
              {activityLog.map((entry) => (
                <div key={entry.id} className={`log-entry log-${entry.status}`}>
                  <div className="log-header">
                    <span className="log-time">{entry.timestamp}</span>
                    <span className="log-action">{entry.action}</span>
                    <span className={`log-status log-status-${entry.status}`}>{entry.status.toUpperCase()}</span>
                  </div>
                  <div className="log-message">{entry.message}</div>
                  {entry.hash && (
                    <div className="log-hash">
                      <a href={`https://sepolia.etherscan.io/tx/${entry.hash}`} target="_blank" rel="noopener noreferrer">
                        {entry.hash.slice(0, 10)}...{entry.hash.slice(-8)}
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      <section className="status">
        <div><strong>ConditionalTokens:</strong> {CONDITIONAL_TOKENS}</div>
        <div><strong>MockOracle:</strong> {mockOracleAddress || '(set in UI or VITE_MOCK_ORACLE_ADDRESS)'}</div>
        <div><strong>Account:</strong> {account || 'Not connected'}</div>
        <div><strong>Network:</strong> Sepolia</div>
        <div><strong>RPC:</strong> {networkHint}</div>
        <div><strong>Status:</strong> {status || 'Ready'}</div>
      </section>

      <section className="card" data-step="1">
        <h2>1) Configure Mock Oracle</h2>
        <div className="description">
          <p>Set up the MockOracle contract address to use for creating and managing test questions. This is the first step in the workflow.</p>
          <p><strong>Next step:</strong> Register a question (step 2)</p>
        </div>
        <div className="grid">
          <label>MockOracle address<input value={mockOracleAddress} onChange={(e) => setMockOracleAddress(e.target.value)} placeholder="0x..." /></label>
        </div>
        <div className="actions">
          <button onClick={loadOracleQuestions}>Load Questions</button>
        </div>
      </section>

      <section className="card" data-step="2">
        <h2>2) Mock Oracle: Register Question</h2>
        <div className="description">
          <p>Create a new question in the MockOracle. This generates a unique question ID that will be used throughout the workflow.</p>
          <p><strong>Prerequisites:</strong> MockOracle configured (step 1)</p>
          <p><strong>Next step:</strong> Derive IDs (step 3)</p>
        </div>
        <div className="grid">
          <label>Question text<input value={oracleQuestionText} onChange={(e) => { setOracleQuestionText(e.target.value); setQuestionText(e.target.value); }} /></label>
          <label>Outcome count<input value={oracleOutcomeCount} onChange={(e) => setOracleOutcomeCount(e.target.value)} /></label>
        </div>
        <button onClick={onRegisterOracleQuestion}>Register Question</button>
        {renderActionResult('Register Oracle Question')}
      </section>

      <section className="card" data-step="3">
        <h2>3) Derive IDs</h2>
        <div className="description">
          <p>Calculate the Condition ID and Position ID from the ConditionalTokens contract using your question, oracle, collateral, and outcome parameters. These IDs are required for all subsequent operations.</p>
          <p><strong>Prerequisites:</strong> Question registered (step 2)</p>
          <p><strong>Next step:</strong> Prepare condition (step 4)</p>
        </div>
        <div className="grid">
          <label>Question text<input value={questionText} onChange={(e) => { setQuestionText(e.target.value); setOracleQuestionText(e.target.value); }} /></label>
          <label>Oracle address<input value={oracle} onChange={(e) => setOracle(e.target.value)} placeholder="0x..." /></label>
          <label>Outcome count<input value={outcomeCount} onChange={(e) => setOutcomeCount(e.target.value)} /></label>
          <label>Collateral token<input value={collateral} onChange={(e) => setCollateral(e.target.value)} placeholder="0x..." /></label>
          <label>Outcome index<input value={outcomeIndex} onChange={(e) => setOutcomeIndex(e.target.value)} /></label>
        </div>
        <button onClick={deriveIds}>Derive</button>
        {renderActionResult('Derive IDs')}
        <div className="outputs">
          <div><strong>Question ID:</strong> {derivedQuestionId || '-'}</div>
          <div><strong>Condition ID:</strong> {derivedConditionId || '-'}</div>
          <div><strong>Position ID:</strong> {derivedPositionId || '-'}</div>
        </div>
      </section>

      <section className="card" data-step="4">
        <h2>4) Prepare Condition</h2>
        <div className="description">
          <p>Initialize a condition in the ConditionalTokens contract. This creates the condition state and makes it ready for splitting positions.</p>
          <p><strong>Prerequisites:</strong> IDs derived (step 3)</p>
          <p><strong>Next step:</strong> Approve collateral (step 5)</p>
        </div>
        <div className="grid">
          <label>Oracle<input value={prepareOracle} onChange={(e) => setPrepareOracle(e.target.value)} placeholder="0x..." /></label>
          <label>Question ID<input value={prepareQuestionId} onChange={(e) => setPrepareQuestionId(e.target.value)} placeholder="0x...32 bytes" /></label>
          <label>Outcome count<input value={prepareOutcomes} onChange={(e) => setPrepareOutcomes(e.target.value)} /></label>
        </div>
        <button onClick={onPrepareCondition}>Prepare</button>
        {renderActionResult('Prepare Condition')}
      </section>

      <section className="card" data-step="5">
        <h2>5) Approve Collateral (ERC20)</h2>
        <div className="description">
          <p>Grant the ConditionalTokens contract permission to spend your collateral tokens. This is required before splitting or merging positions.</p>
          <p><strong>Prerequisites:</strong> Condition prepared (step 4), You hold ERC20 tokens</p>
          <p><strong>Next step:</strong> Split positions (step 6)</p>
        </div>
        <div className="grid">
          <label>Collateral token<input value={approveCollateral} onChange={(e) => setApproveCollateral(e.target.value)} placeholder="0x..." /></label>
          <label>Amount (human units)<input value={approveAmount} onChange={(e) => setApproveAmount(e.target.value)} /></label>
        </div>
        <div className="actions">
          <button onClick={onApprove}>Approve</button>
          <button onClick={refreshAllowance}>Refresh Allowance</button>
        </div>
        <div><strong>Allowance:</strong> {currentAllowance || '-'}</div>
        {renderActionResult('Approve Collateral') || renderActionResult('Refresh Allowance')}
      </section>

      <section className="card" data-step="6">
        <h2>6) Split Position</h2>
        <div className="description">
          <p>Deposit collateral into the ConditionalTokens contract and receive outcome tokens for each possible outcome. This creates positions in the event.</p>
          <p><strong>Prerequisites:</strong> Collateral approved (step 5), Condition prepared (step 4)</p>
          <p><strong>Next step:</strong> Set and submit answer (step 7)</p>
        </div>
        <div className="grid">
          <label>Collateral token<input value={splitCollateral} onChange={(e) => setSplitCollateral(e.target.value)} placeholder="0x..." /></label>
          <label>Condition ID<input value={splitConditionId} onChange={(e) => setSplitConditionId(e.target.value)} placeholder="0x...32 bytes" /></label>
          <label>Amount (human units)<input value={splitAmount} onChange={(e) => setSplitAmount(e.target.value)} /></label>
        </div>
        <button onClick={onSplit}>Split</button>
        {renderActionResult('Split Position')}
        {splitPositionIds.length > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#15803d', marginBottom: '0.5rem' }}>
              Outcome Token Position IDs:
            </div>
            <div className="outputs">
              {splitPositionIds.map((id, index) => (
                <div key={index} style={{ fontSize: '0.8rem', color: '#166534', wordBreak: 'break-all' }}>
                  <strong>Outcome {index}:</strong> {id}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>6b) Check Outcome Token Balances</h2>
        <div className="description optional">
          <p>Check your balance of outcome tokens after splitting. This shows how many outcome tokens you hold for each outcome index.</p>
          <p><strong>Prerequisites:</strong> Positions split (step 6), Connected to wallet</p>
          <p><strong>Use case:</strong> Verify token holdings and track positions</p>
        </div>
        <div className="grid">
          <label>Condition ID<input value={balanceCheckConditionId} onChange={(e) => setBalanceCheckConditionId(e.target.value)} placeholder="0x...32 bytes" /></label>
          <label>Outcome indexes (comma-separated)<input value={balanceCheckOutcomeIndexes} onChange={(e) => setBalanceCheckOutcomeIndexes(e.target.value)} placeholder="0,1" /></label>
        </div>
        <button onClick={checkOutcomeTokenBalances}>Check Balances</button>
        {renderActionResult('Check Outcome Token Balances')}
        {outcomeTokenBalances.length > 0 && (
          <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f0f4ff', border: '1px solid #86c0ff', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1546b3', marginBottom: '0.5rem' }}>
              Outcome Token Balances:
            </div>
            <div className="outputs">
              {outcomeTokenBalances.map((balance, index) => (
                <div key={index} style={{ fontSize: '0.8rem', color: '#1f3b8c' }}>
                  <strong>Outcome {balance.index}:</strong> {balance.balance}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card" data-step="7">
        <h2>7) Set & Submit Answer (Oracle → ConditionalTokens)</h2>
        <div className="description">
          <p>Two-step process: First, set the answer/outcome on the MockOracle contract. Then, submit that answer to ConditionalTokens to resolve the condition and report payouts.</p>
          <p><strong>Step 7a:</strong> Set answer on oracle (below)</p>
          <p><strong>Step 7b:</strong> Submit answer to ConditionalTokens (completes resolution)</p>
          <p><strong>Prerequisites:</strong> Question registered (step 2), Positions split (step 6)</p>
          <p><strong>Next step:</strong> Redeem positions (step 9)</p>
        </div>
        <div className="grid">
          <label>Question ID<input value={oracleSetQuestionId} onChange={(e) => setOracleSetQuestionId(e.target.value)} placeholder="0x...32 bytes" /></label>
          <label>Payout vector (comma-separated)<input value={oracleSetPayouts} onChange={(e) => setOracleSetPayouts(e.target.value)} placeholder="1,0" /></label>
        </div>
        <div className="actions">
          <button onClick={onSetOracleAnswer}>Step 7a: Set Answer (Oracle)</button>
          <button onClick={onSubmitOracleAnswerToConditionalTokens}>Step 7b: Submit to ConditionalTokens</button>
        </div>
        <div className="outputs" style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#334155' }}>
          {renderActionResult('Set Oracle Answer')}
          {renderActionResult('Submit Oracle Answer to ConditionalTokens')}
        </div>
      </section>

      <section className="card" data-step="8">
        <h2>8) Redeem Positions</h2>
        <div className="description">
          <p>Claim your winnings based on the resolution. Use this to redeem your outcome tokens back into collateral. You can only redeem the winning outcome tokens.</p>
          <p><strong>Prerequisites:</strong> Condition resolved and reported (step 7)</p>
          <p><strong>This is the final step</strong> in the workflow.</p>
        </div>
        <div className="grid">
          <label>Collateral token<input value={redeemCollateral} onChange={(e) => setRedeemCollateral(e.target.value)} placeholder="0x..." /></label>
          <label>Condition ID<input value={redeemConditionId} onChange={(e) => setRedeemConditionId(e.target.value)} placeholder="0x...32 bytes" /></label>
          <label>Outcome indexes (comma-separated)<input value={redeemIndexes} onChange={(e) => setRedeemIndexes(e.target.value)} placeholder="0,1" /></label>
        </div>
        <button onClick={onRedeem}>Redeem</button>
        {renderActionResult('Redeem Positions')}
      </section>

      <section className="card">
        <h2>Alternative: Direct Report Payouts (without oracle)</h2>
        <div className="description optional">
          <p>Report the final outcome/payout vector directly to the ConditionalTokens contract. Use this if you're not using the MockOracle or want to report payouts manually.</p>
          <p><strong>Prerequisites:</strong> Condition prepared (step 4), Event has resolved</p>
        </div>
        <div className="grid">
          <label>Question ID<input value={reportQuestionId} onChange={(e) => setReportQuestionId(e.target.value)} placeholder="0x...32 bytes" /></label>
          <label>Payout vector (comma-separated)<input value={reportPayouts} onChange={(e) => setReportPayouts(e.target.value)} placeholder="1,0" /></label>
        </div>
        <button onClick={onReportPayouts}>Report</button>
        {renderActionResult('Report Payouts')}
      </section>

      <hr />

      <section className="card">
        <h2>Optional: Mock Oracle: Check Question</h2>
        <div className="description optional">
          <p>View the details of a registered question, including its answer, outcome count, and payout vector. Use this to verify question state.</p>
          <p><strong>Prerequisites:</strong> Question registered (step 2)</p>
          <p><strong>Use case:</strong> Verification and debugging</p>
        </div>
        <div className="grid">
          <label>Question ID<input value={oracleCheckQuestionId} onChange={(e) => setOracleCheckQuestionId(e.target.value)} placeholder="0x...32 bytes" /></label>
        </div>
        <div className="actions">
          <button onClick={onCheckOracleQuestion}>Check Question</button>
        </div>
        {renderActionResult('Check Oracle Question')}
        {oracleQuestionDetails ? (
          <div className="outputs">
            <div><strong>ID:</strong> {oracleQuestionDetails.id}</div>
            <div><strong>Question:</strong> {oracleQuestionDetails.text}</div>
            <div><strong>Outcome count:</strong> {oracleQuestionDetails.outcomeSlotCount}</div>
            <div><strong>Answered:</strong> {oracleQuestionDetails.answered ? 'Yes' : 'No'}</div>
            <div><strong>Payouts:</strong> {oracleQuestionDetails.payouts}</div>
            <div><strong>Created at:</strong> {oracleQuestionDetails.createdAt}</div>
            <div><strong>Answered at:</strong> {oracleQuestionDetails.answeredAt}</div>
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2>Optional: Mock Oracle: Recent Questions</h2>
        <div className="description optional">
          <p>View a list of recently created questions in the MockOracle. Useful for tracking all questions and their status.</p>
          <p><strong>Use case:</strong> Discovery and monitoring</p>
        </div>
        <div className="actions">
          <button onClick={loadOracleQuestions}>Refresh Questions</button>
        </div>
        {renderActionResult('Load Oracle Questions')}
        <div className="list">
          {oracleQuestionList.length === 0 ? (
            <div>No questions loaded.</div>
          ) : (
            oracleQuestionList.map((row) => (
              <div key={row.id} className="list-item">
                <div><strong>ID:</strong> {row.id}</div>
                <div><strong>Question:</strong> {row.text}</div>
                <div><strong>Outcomes:</strong> {row.outcomeSlotCount}</div>
                <div><strong>Answered:</strong> {row.answered ? 'Yes' : 'No'}</div>
                <div><strong>Payouts:</strong> {row.payouts}</div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="card">
        <h2>Optional: Merge Positions</h2>
        <div className="description optional">
          <p>Combine all outcome tokens back into collateral (when outcome is unknown or not yet resolved). This is the opposite of split and releases your collateral.</p>
          <p><strong>Prerequisites:</strong> Positions split (step 6), You hold outcome token sets</p>
          <p><strong>Use case:</strong> Exit positions before condition resolution</p>
        </div>
        <div className="grid">
          <label>Collateral token<input value={mergeCollateral} onChange={(e) => setMergeCollateral(e.target.value)} placeholder="0x..." /></label>
          <label>Condition ID<input value={mergeConditionId} onChange={(e) => setMergeConditionId(e.target.value)} placeholder="0x...32 bytes" /></label>
          <label>Amount (human units)<input value={mergeAmount} onChange={(e) => setMergeAmount(e.target.value)} /></label>
        </div>
        <button onClick={onMerge}>Merge</button>
        {renderActionResult('Merge Positions')}
      </section>
        </div>
      </div>
    </main>
  )
}

export default App
