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

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(rpcUrl),
})

function App() {
  const [account, setAccount] = useState<string>('')
  const [status, setStatus] = useState<string>('')

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

  const networkHint = useMemo(() => `Sepolia RPC: ${rpcUrl}`, [])

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus('No injected wallet found. Install MetaMask or Rabby.')
      return
    }

    const walletClient = createWalletClient({ chain: sepolia, transport: custom(window.ethereum) })
    const addresses = await walletClient.requestAddresses()
    const addr = addresses[0]
    if (!addr) {
      setStatus('No account returned from wallet.')
      return
    }

    setAccount(addr)
    setOracle(addr)
    setPrepareOracle(addr)
    setStatus(`Connected ${addr}`)
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

  async function waitAndSet(hash: `0x${string}`) {
    setStatus(`Tx submitted: ${hash}`)
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    setStatus(`Tx confirmed in block ${receipt.blockNumber}. Hash: ${hash}`)
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
      setStatus('Derived question, condition, and position IDs.')
    } catch (error) {
      setStatus((error as Error).message)
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
      await waitAndSet(hash)
    } catch (error) {
      setStatus((error as Error).message)
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
      setStatus('Allowance refreshed.')
    } catch (error) {
      setStatus((error as Error).message)
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

      await waitAndSet(hash)
      await refreshAllowance()
    } catch (error) {
      setStatus((error as Error).message)
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

      await waitAndSet(hash)
    } catch (error) {
      setStatus((error as Error).message)
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

      await waitAndSet(hash)
    } catch (error) {
      setStatus((error as Error).message)
    }
  }

  async function onReportPayouts() {
    try {
      const { walletClient, addr } = await walletClientOrThrow()
      requireBytes32(reportQuestionId, 'Question ID')

      const payouts = reportPayouts
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => BigInt(v))

      if (payouts.length < 2) throw new Error('Need at least 2 payout entries')

      const hash = await walletClient.writeContract({
        address: CONDITIONAL_TOKENS,
        abi: conditionalTokensAbi,
        functionName: 'reportPayouts',
        args: [reportQuestionId as `0x${string}`, payouts],
        account: addr,
        chain: sepolia,
      })

      await waitAndSet(hash)
    } catch (error) {
      setStatus((error as Error).message)
    }
  }

  async function onRedeem() {
    try {
      const { walletClient, addr } = await walletClientOrThrow()
      requireAddress(redeemCollateral, 'Collateral token')
      requireBytes32(redeemConditionId, 'Condition ID')

      const indexes = redeemIndexes
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v) => BigInt(v))

      if (indexes.length === 0) throw new Error('Provide at least one outcome index')

      const hash = await walletClient.writeContract({
        address: CONDITIONAL_TOKENS,
        abi: conditionalTokensAbi,
        functionName: 'redeemPositions',
        args: [redeemCollateral as `0x${string}`, redeemConditionId as `0x${string}`, indexes],
        account: addr,
        chain: sepolia,
      })

      await waitAndSet(hash)
    } catch (error) {
      setStatus((error as Error).message)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Aurum App v2</h1>
          <p>ConditionalTokens operator console (Sepolia)</p>
        </div>
        <button onClick={connectWallet}>{account ? 'Connected' : 'Connect Wallet'}</button>
      </header>

      <section className="status">
        <div><strong>Contract:</strong> {CONDITIONAL_TOKENS}</div>
        <div><strong>Account:</strong> {account || 'Not connected'}</div>
        <div><strong>Network:</strong> Sepolia</div>
        <div><strong>RPC:</strong> {networkHint}</div>
        <div><strong>Status:</strong> {status || 'Ready'}</div>
      </section>

      <section className="card">
        <h2>1) Derive IDs</h2>
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
        <h2>2) Prepare Condition</h2>
        <div className="grid">
          <label>Oracle<input value={prepareOracle} onChange={(e) => setPrepareOracle(e.target.value)} placeholder="0x..." /></label>
          <label>Question ID<input value={prepareQuestionId} onChange={(e) => setPrepareQuestionId(e.target.value)} placeholder="0x...32 bytes" /></label>
          <label>Outcome count<input value={prepareOutcomes} onChange={(e) => setPrepareOutcomes(e.target.value)} /></label>
        </div>
        <button onClick={onPrepareCondition}>Prepare</button>
      </section>

      <section className="card">
        <h2>3) Approve Collateral (ERC20)</h2>
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
        <h2>4) Split Position</h2>
        <div className="grid">
          <label>Collateral token<input value={splitCollateral} onChange={(e) => setSplitCollateral(e.target.value)} placeholder="0x..." /></label>
          <label>Condition ID<input value={splitConditionId} onChange={(e) => setSplitConditionId(e.target.value)} placeholder="0x...32 bytes" /></label>
          <label>Amount (human units)<input value={splitAmount} onChange={(e) => setSplitAmount(e.target.value)} /></label>
        </div>
        <button onClick={onSplit}>Split</button>
      </section>

      <section className="card">
        <h2>5) Merge Positions</h2>
        <div className="grid">
          <label>Collateral token<input value={mergeCollateral} onChange={(e) => setMergeCollateral(e.target.value)} placeholder="0x..." /></label>
          <label>Condition ID<input value={mergeConditionId} onChange={(e) => setMergeConditionId(e.target.value)} placeholder="0x...32 bytes" /></label>
          <label>Amount (human units)<input value={mergeAmount} onChange={(e) => setMergeAmount(e.target.value)} /></label>
        </div>
        <button onClick={onMerge}>Merge</button>
      </section>

      <section className="card">
        <h2>6) Report Payouts (oracle account only)</h2>
        <div className="grid">
          <label>Question ID<input value={reportQuestionId} onChange={(e) => setReportQuestionId(e.target.value)} placeholder="0x...32 bytes" /></label>
          <label>Payout vector (comma-separated)<input value={reportPayouts} onChange={(e) => setReportPayouts(e.target.value)} placeholder="1,0" /></label>
        </div>
        <button onClick={onReportPayouts}>Report</button>
      </section>

      <section className="card">
        <h2>7) Redeem Positions</h2>
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
