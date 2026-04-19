# aurum-app-v2

A React + Vite dApp for interacting with the deployed `ConditionalTokens` contract on Sepolia.

## What Has Been Implemented

This app is an operator console for the current `aurum-contracts-v2` state.

Implemented contract interactions:
- MockOracle flows:
  - register question
  - set/override answer vector
  - submit answer to `ConditionalTokens`
  - inspect one question (`getQuestion`, `getAnswer`)
  - list recent questions (`getQuestionCount`, `getQuestionIds`)
- Read helpers:
  - `getQuestionIdFromString`
  - `getConditionId`
  - `getPositionId`
- Write actions:
  - `prepareCondition`
  - `splitPosition`
  - `mergePositions`
  - `reportPayouts`
  - `redeemPositions`
- ERC20 helper flow:
  - `approve(spender, amount)`
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
- `src/App.tsx`: all interaction logic and UI sections
- `src/App.css`: operator-console styling
- `src/index.css`: base typography/layout reset
- `vite.config.ts`: Vite config (`base: './'`)
- `.github/workflows/deploy-pages.yml`: Pages build/deploy workflow

Runtime stack:
- React 19 + TypeScript
- `viem` for chain reads/writes and wallet client
- Sepolia chain target only

## Interaction Design

The UI is structured in the same order users typically operate contracts:
1. Derive IDs (question/condition/position)
2. Prepare condition
3. Split (automatically approves collateral before splitting)
4. Merge
5. Report payouts
6. Redeem

This reduces operator error by matching contract dependency order.

**Note on Split Operation:** When splitting positions, the app automatically handles the ERC20 approval in a two-step process:
1. First transaction: Approve ConditionalTokens contract to spend collateral tokens
2. Second transaction: Execute the splitPosition call

Users will see two MetaMask prompts for each split operation.

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

Why:
- Target users are dev/operators validating contract behavior
- Prioritize clarity and transaction traceability over marketing UX

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
