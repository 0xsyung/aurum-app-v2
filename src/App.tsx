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

function App() {
  const [account, setAccount] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([])

  const [questionText, setQuestionText] = useState('Will ETH be above 5000 by 2026-12-31?')
  const [oracle, setOracle] = useState('')
  const [outcomeCount, setOutcomeCount] = useState('2')
  const [collateral, setCollateral] = useState('')
  const [outcomeIndex, setOutcomeIndex] = useState('0')

  const [derivedQuestionId, setDerivedQuestionId] = useState('')
  const [derivedConditionId, setDerivedConditionId] = useState('')
  const [derivedPositionId, setDerivedPositionId] = useState('')

  const [prepareQuestionId, setPrepareQuestionId] = useState('')
  const [prepareOracle, setPrepareOracle] = useState('')
  const [prepareOutcomes, setPrepareOutcomes] = useState('2')

  const [approveCollateral, setApproveCollateral] = useState('')
  const [approveAmount, setApproveAmount] = useState('100')
  const [currentAllowance, setCurrentAllowance] = useState('')

  const [splitCollateral, setSplitCollateral] = useState('')
  const [splitConditionId, setSplitConditionId] = useState('')
  const [splitAmount, setSplitAmount] = useState('10')

  const [mergeCollateral, setMergeCollateral] = useState('')
  const [mergeConditionId, setMergeConditionId] = useState('')
  const [mergeAmount, setMergeAmount] = useState('10')

  const [reportQuestionId, setReportQuestionId] = useState('')
  const [reportPayouts, setReportPayouts] = useState('1,0')

  const [redeemCollateral, setRedeemCollateral] = useState('')
  const [redeemConditionId, setRedeemConditionId] = useState('')
  const [redeemIndexes, setRedeemIndexes] = useState('0')

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

      await waitAndSet(hash, 'Register Oracle Question')
      await loadOracleQuestions()
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Aurum App v2</h1>
          <p>ConditionalTokens + MockOracle operator console (Sepolia)</p>
        </div>
        <button onClick={connectWallet}>{account ? 'Connected' : 'Connect Wallet'}</button>
      </header>

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

      <section className="card">
        <h2>1) Configure Mock Oracle</h2>
        <div className="grid">
          <label>MockOracle address<input value={mockOracleAddress} onChange={(e) => setMockOracleAddress(e.target.value)} placeholder="0x..." /></label>
        </div>
        <div className="actions">
          <button onClick={loadOracleQuestions}>Load Questions</button>
        </div>
      </section>

      <section className="card">
        <h2>2) Mock Oracle: Register Question</h2>
        <div className="grid">
          <label>Question text<input value={oracleQuestionText} onChange={(e) => setOracleQuestionText(e.target.value)} /></label>
          <label>Outcome count<input value={oracleOutcomeCount} onChange={(e) => setOracleOutcomeCount(e.target.value)} /></label>
        </div>
        <button onClick={onRegisterOracleQuestion}>Register Question</button>
      </section>

      <section className="card">
        <h2>3) Mock Oracle: Set and Submit Answer</h2>
        <div className="grid">
          <label>Question ID<input value={oracleSetQuestionId} onChange={(e) => setOracleSetQuestionId(e.target.value)} placeholder="0x...32 bytes" /></label>
          <label>Payout vector (comma-separated)<input value={oracleSetPayouts} onChange={(e) => setOracleSetPayouts(e.target.value)} placeholder="1,0" /></label>
        </div>
        <div className="actions">
          <button onClick={onSetOracleAnswer}>Set Answer</button>
          <button onClick={onSubmitOracleAnswerToConditionalTokens}>Submit To ConditionalTokens</button>
        </div>
      </section>

      <section className="card">
        <h2>4) Mock Oracle: Check Question</h2>
        <div className="grid">
          <label>Question ID<input value={oracleCheckQuestionId} onChange={(e) => setOracleCheckQuestionId(e.target.value)} placeholder="0x...32 bytes" /></label>
        </div>
        <div className="actions">
          <button onClick={onCheckOracleQuestion}>Check Question</button>
        </div>
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
        <h2>5) Mock Oracle: Recent Questions</h2>
        <div className="actions">
          <button onClick={loadOracleQuestions}>Refresh Questions</button>
        </div>
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
        <h2>6) Derive IDs</h2>
        <div className="grid">
          <label>Question text<input value={questionText} onChange={(e) => setQuestionText(e.target.value)} /></label>
          <label>Oracle address<input value={oracle} onChange={(e) => setOracle(e.target.value)} placeholder="0x..." /></label>
          <label>Outcome count<input value={outcomeCount} onChange={(e) => setOutcomeCount(e.target.value)} /></label>
          <label>Collateral token<input value={collateral} onChange={(e) => setCollateral(e.target.value)} placeholder="0x..." /></label>
          <label>Outcome index<input value={outcomeIndex} onChange={(e) => setOutcomeIndex(e.target.value)} /></label>
        </div>
        <button onClick={deriveIds}>Derive</button>
        <div className="outputs">
          <div><strong>Question ID:</strong> {derivedQuestionId || '-'}</div>
          <div><strong>Condition ID:</strong> {derivedConditionId || '-'}</div>
          <div><strong>Position ID:</strong> {derivedPositionId || '-'}</div>
        </div>
      </section>

      <section className="card">
        <h2>7) Prepare Condition</h2>
        <div className="grid">
          <label>Oracle<input value={prepareOracle} onChange={(e) => setPrepareOracle(e.target.value)} placeholder="0x..." /></label>
          <label>Question ID<input value={prepareQuestionId} onChange={(e) => setPrepareQuestionId(e.target.value)} placeholder="0x...32 bytes" /></label>
          <label>Outcome count<input value={prepareOutcomes} onChange={(e) => setPrepareOutcomes(e.target.value)} /></label>
        </div>
        <button onClick={onPrepareCondition}>Prepare</button>
      </section>

      <section className="card">
        <h2>8) Approve Collateral (ERC20)</h2>
        <div className="grid">
          <label>Collateral token<input value={approveCollateral} onChange={(e) => setApproveCollateral(e.target.value)} placeholder="0x..." /></label>
          <label>Amount (human units)<input value={approveAmount} onChange={(e) => setApproveAmount(e.target.value)} /></label>
        </div>
        <div className="actions">
          <button onClick={onApprove}>Approve</button>
          <button onClick={refreshAllowance}>Refresh Allowance</button>
        </div>
        <div><strong>Allowance:</strong> {currentAllowance || '-'}</div>
      </section>

      <section className="card">
        <h2>9) Split Position</h2>
        <div className="grid">
          <label>Collateral token<input value={splitCollateral} onChange={(e) => setSplitCollateral(e.target.value)} placeholder="0x..." /></label>
          <label>Condition ID<input value={splitConditionId} onChange={(e) => setSplitConditionId(e.target.value)} placeholder="0x...32 bytes" /></label>
          <label>Amount (human units)<input value={splitAmount} onChange={(e) => setSplitAmount(e.target.value)} /></label>
        </div>
        <button onClick={onSplit}>Split</button>
      </section>

      <section className="card">
        <h2>10) Merge Positions</h2>
        <div className="grid">
          <label>Collateral token<input value={mergeCollateral} onChange={(e) => setMergeCollateral(e.target.value)} placeholder="0x..." /></label>
          <label>Condition ID<input value={mergeConditionId} onChange={(e) => setMergeConditionId(e.target.value)} placeholder="0x...32 bytes" /></label>
          <label>Amount (human units)<input value={mergeAmount} onChange={(e) => setMergeAmount(e.target.value)} /></label>
        </div>
        <button onClick={onMerge}>Merge</button>
      </section>

      <section className="card">
        <h2>11) Direct Report Payouts (without oracle helper)</h2>
        <div className="grid">
          <label>Question ID<input value={reportQuestionId} onChange={(e) => setReportQuestionId(e.target.value)} placeholder="0x...32 bytes" /></label>
          <label>Payout vector (comma-separated)<input value={reportPayouts} onChange={(e) => setReportPayouts(e.target.value)} placeholder="1,0" /></label>
        </div>
        <button onClick={onReportPayouts}>Report</button>
      </section>

      <section className="card">
        <h2>12) Redeem Positions</h2>
        <div className="grid">
          <label>Collateral token<input value={redeemCollateral} onChange={(e) => setRedeemCollateral(e.target.value)} placeholder="0x..." /></label>
          <label>Condition ID<input value={redeemConditionId} onChange={(e) => setRedeemConditionId(e.target.value)} placeholder="0x...32 bytes" /></label>
          <label>Outcome indexes (comma-separated)<input value={redeemIndexes} onChange={(e) => setRedeemIndexes(e.target.value)} placeholder="0" /></label>
        </div>
        <button onClick={onRedeem}>Redeem</button>
      </section>
    </main>
  )
}

export default App
