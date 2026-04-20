# aurum-app-v2

A React + Vite dApp for interacting with the deployed `ConditionalTokens` contract on Sepolia.

## What Has Been Implemented

This app is an operator console for the current `aurum-contracts-v2` state.

Implemented contract interactions:
- MockOracle flows:
  - **propose question** (permissionless - anyone can propose)
  - **approve/reject proposals** (admin-only)
  - register question (admin-only, automatically calls `prepareCondition` on ConditionalTokens)
  - set/override answer vector
  - submit answer to `ConditionalTokens`
  - inspect one question (`getQuestion`, `getAnswer`)
  - list questions and proposals (`getQuestionCount`, `getQuestionIds`, `getProposalCount`, `getProposalIds`, `getProposalsByStatus`)
- Read helpers:
  - `getQuestionIdFromString`
  - `getConditionId`
  - `getPositionId`
- Write actions:
  - `prepareCondition` (called automatically during question creation)
  - `splitPosition` (automatically approves collateral before splitting)
  - `mergePositions`
  - `reportPayouts`
  - `redeemPositions`
- ERC20 helper flow:
  - `approve(spender, amount)` (called automatically during split operations)
  - `allowance(owner, spender)` readback
  - `decimals()` read for unit conversion

Wallet/network behavior:
- Connects to injected wallet (MetaMask/Rabby)
- Sends write transactions through wallet signer
- Waits for tx receipts and surfaces confirmation status

Deployment behavior:
- GitHub Pages CI/CD via GitHub Actions
- Static asset-safe Vite config (`base: './'`)
- Publishes built files to `gh-pages` branch

## Target Contracts

- Network: Sepolia (`11155111`)
- `ConditionalTokens`: `0x1d2607F5e52c4bc92891bE5932091b7D74FC719A`
- `MockOracle`: `0x9c7b5AcCb8B1B3AA342908075eE3479036F7aD15`

## Architecture

Core files:
- `src/UserApp.tsx`: User-facing prediction market interface
- `src/AdminApp.tsx`: Admin dashboard for oracle management
- `src/DevApp.tsx`: Developer tools and contract debugging
- `src/AppRoot.tsx`: React Router configuration
- `src/UserApp.css`, `src/AdminApp.css`: Component styling
- `src/index.css`: Base typography/layout reset
- `vite.config.ts`: Vite config (`base: './'`)
- `.github/workflows/deploy-pages.yml`: Pages build/deploy workflow

Runtime stack:
- React 19 + TypeScript
- `viem` for chain reads/writes and wallet client
- Sepolia chain target only

## Application Routes

- **`/`** - User App: Browse and interact with prediction markets
- **`/admin`** - Admin Dashboard: Manage oracle operations (admin-only functions)
- **`/dev`** - Dev Tools: Contract debugging and advanced operations

## Interaction Design

The application has two distinct interfaces:

### User App (`/`)
Public-facing interface for market participants with two tabs:

**Active Markets Tab:**
1. **Browse Markets**: View all approved/registered prediction markets
2. **Split Position**: Automatically approves collateral and splits position (2 transactions)
3. **Merge Position**: Combines outcome tokens back into collateral (1 transaction)
4. **Redeem Position**: Winners redeem positions for collateral (1 transaction)

**Proposed Markets Tab:**
1. **Propose Question**: Anyone can submit market proposals (1 transaction, permissionless)
2. **View Proposals**: See all proposals with status badges:
   - 🟡 **Pending**: Awaiting admin review
   - 🟢 **Approved**: Approved and now in Active Markets
   - 🔴 **Rejected**: Rejected with reason displayed
3. **Proposer Info**: Shows who proposed each question and when

### Admin Dashboard (`/admin`)
**Admin-only interface** for oracle management. All functions require the connected wallet to be the oracle admin:

**Proposal Management (New!):**
1. **Review Pending Proposals**: See all user-submitted proposals
2. **Approve Proposal**: Accept a proposal and make it an active market
   - Transaction 1: Approve proposal on MockOracle (auto-registers question)
   - Transaction 2: Prepare condition on ConditionalTokens
   - Approved markets immediately appear in Active Markets tab
3. **Reject Proposal**: Decline a proposal with reason
   - Transaction 1: Reject proposal with explanation
   - Rejection reason shown to users in Proposed Markets tab

**Question Management:**
1. **Register Question** (Direct): Creates new prediction market without proposal
   - Transaction 1: Register question with MockOracle
   - Transaction 2: Prepare condition on ConditionalTokens
   - Supports both standard and unique question IDs
   - Note: Most questions now come through the proposal system

2. **Set Answer**: Resolve a question by setting payout numerators
   - Admin specifies payout values for each outcome
   - Example: `[1, 0]` means outcome 0 wins, `[1, 1]` means tie

3. **Submit Answer to ConditionalTokens**: Finalize resolution
   - Calls `reportPayouts()` on ConditionalTokens
   - Enables users to redeem their winning positions

**Admin Operations:**
1. **Transfer Admin**: Change oracle admin to a new address
   - ⚠️ Warning: Current admin loses access after transfer

### Admin Access Control

The MockOracle contract uses an `onlyAdmin` modifier for these functions:
- `registerQuestion()` / `registerQuestionUnique()` - Direct question registration
- `approveProposal()` - Approve user proposals
- `rejectProposal()` - Reject user proposals
- `setAnswer()` - Set resolution outcomes
- `submitAnswerToConditionalTokens()` - Finalize resolution
- `setAdmin()` - Transfer admin rights

**Permissionless functions** (anyone can call):
- `proposeQuestion()` - Submit market proposals

The admin dashboard displays the current admin address and shows whether your connected wallet is the admin. Non-admin users can view questions and proposals but cannot execute admin operations.

## Proposal Workflow

Aurum implements a **community-driven, admin-curated** market creation system:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER PROPOSES                                            │
│    Anyone → proposeQuestion() → Stored on-chain             │
│    Status: Pending 🟡                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. ADMIN REVIEWS                                            │
│    Admin views in /admin → Pending Proposals section        │
│    Reviews question quality, clarity, duplication           │
└─────────────────────────────────────────────────────────────┘
                            ↓
           ┌────────────────┴────────────────┐
           ↓                                  ↓
┌──────────────────────┐         ┌──────────────────────────┐
│ 3a. APPROVE          │         │ 3b. REJECT               │
│ approveProposal()    │         │ rejectProposal(reason)   │
│ + prepareCondition() │         │ Status: Rejected 🔴       │
│ Status: Approved 🟢   │         │ Reason shown to users    │
│ Becomes Active Market│         └──────────────────────────┘
└──────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. MARKET ACTIVE                                            │
│    Users can split/merge/trade positions                    │
│    Eventually resolved by admin                             │
└─────────────────────────────────────────────────────────────┘
```

**Benefits of this approach:**
- ✅ **Permissionless**: Anyone can propose markets
- ✅ **Quality control**: Admin curates to prevent spam/duplicates
- ✅ **Transparency**: All proposals and decisions on-chain
- ✅ **Community-driven**: Users drive what markets exist
- ✅ **No backend**: Fully on-chain, no database needed

**Inspired by**: Polymarket's proposal system and UMA's optimistic oracle architecture

## Design Decisions and Rationale

### 1) Keep scope to current deployed contract only
Decision:
- Build features supported by live `ConditionalTokens` plus simple `MockOracle`

Why:
- Avoid dead UI controls for modules not yet built (oracle/factory/AMM)
- Keep the app reliable against current backend reality

### 2) Use `viem` directly instead of wagmi abstraction
Decision:
- Implement reads/writes via `createPublicClient` + `createWalletClient`

Why:
- Smaller integration surface
- Explicit control over transaction flow and errors
- Good fit for a contract-operator tool

### 3) Human-unit token inputs with on-chain precision conversion
Decision:
- Read token `decimals()` and convert via `parseUnits`

Why:
- Prevent common mistakes from raw integer entry
- Make split/merge/approve amounts easier to reason about

Tradeoff:
- Requires token to expose standard `decimals()`

### 4) Minimal inline ABI instead of generated artifacts
Decision:
- Define only required ABI fragments in `App.tsx`

Why:
- Faster bootstrap and lower coupling to artifact pipeline
- Keeps frontend independent from build-system assumptions

Tradeoff:
- ABI updates must be manually synced if contract interface changes

### 5) Explicit input guards in frontend
Decision:
- Validate addresses and bytes32 fields before submit

Why:
- Fail fast with clear messages before wallet popup/tx submission
- Reduce avoidable reverted transactions

### 6) Operator-first UX over retail polish
Decision:
- Single-page panel layout with direct controls/status
- Automate multi-step contract operations (prepareCondition, approve)

Why:
- Target users are dev/operators validating contract behavior
- Prioritize clarity and transaction traceability over marketing UX
- Reduce operator error by handling contract dependencies automatically

### 7) On-chain proposal system with admin curation
Decision:
- Allow permissionless question proposals via `proposeQuestion()`
- Require admin approval before questions become active markets
- Store all proposals and decisions on-chain

Why:
- **Community-driven**: Users can suggest markets they want
- **Quality control**: Admin prevents spam, duplicates, and unclear questions
- **Fully decentralized**: No backend database or off-chain coordination
- **Transparent**: All proposals and rejection reasons publicly visible
- **Scalable**: Admin reviews only new proposals, not every market creation

Inspired by:
- Polymarket's curated market creation process
- UMA Protocol's optimistic oracle with dispute mechanisms

Tradeoff:
- Not fully permissionless (admin can be bottleneck)
- Future enhancement: Could add economic bonds or DAO governance for approval

### 7) GitHub Pages-native deployment path
Decision:
- Deploy from `main` via Actions (`deploy-pages.yml`) to `gh-pages` branch

Why:
- Simple hosting with no server runtime
- Avoids Pages API permission requirements that can fail in restricted repos
- Fits static Vite output and low-ops workflow

## Environment and RPC

Local dev:
```bash
npm install
npm run dev
```

Optional RPC override:
```bash
VITE_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<key> npm run dev
```

Optional mock oracle address:
```bash
VITE_MOCK_ORACLE_ADDRESS=0x9c7b5AcCb8B1B3AA342908075eE3479036F7aD15 npm run dev
```

Optional collateral token address:
```bash
VITE_COLLATERAL_TOKEN_ADDRESS=0x... npm run dev
```

Production (GitHub Pages):
- Optional repo variable: `VITE_SEPOLIA_RPC_URL`
- Optional repo variable: `VITE_MOCK_ORACLE_ADDRESS`
- Optional repo variable: `VITE_COLLATERAL_TOKEN_ADDRESS`
- Fallback if unset: `https://ethereum-sepolia-rpc.publicnode.com` (RPC), empty string (addresses)

## Build and Deploy

Build locally:
```bash
npm run build
npm run preview
```

GitHub Pages workflow:
- File: `.github/workflows/deploy-pages.yml`
- Trigger: push to `main`
- Output branch: `gh-pages`

One-time repo setup:
1. GitHub Settings → Pages
2. Source: **Deploy from a branch**
3. Branch: `gh-pages` and folder: `/ (root)`
4. (Optional) Add repo variables:
   - `VITE_SEPOLIA_RPC_URL`: Custom Sepolia RPC endpoint
   - `VITE_MOCK_ORACLE_ADDRESS`: Mock oracle contract address
   - `VITE_COLLATERAL_TOKEN_ADDRESS`: Default collateral token address (auto-fills UI fields)

## Known Limitations

- No market registry or market list UI
- No production oracle workflow UX (proposal/dispute/finalize)
- No AMM/liquidity/trading UI
- No event indexer/history panel
- No token balance dashboard yet

These are expected for this phase and align with current on-chain scope.

## Next Suggested Enhancements

- Add reusable preset storage for common condition inputs
- Add read panels for `payoutDenominator`, `payoutNumerators`, and position balances
- Add a guided wizard mode for first-time operators
- Add network switch helper (auto-prompt to Sepolia)
