# aurum-app-v2

A React + Vite dApp for interacting with the deployed `ConditionalTokens` contract on Sepolia.

## What Has Been Implemented

This app is an operator console for the current `aurum-contracts-v2` state.

Implemented contract interactions:
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

## Target Contract

- Network: Sepolia (`11155111`)
- Contract: `ConditionalTokens`
- Address: `0x1d2607F5e52c4bc92891bE5932091b7D74FC719A`

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
3. Approve collateral
4. Split
5. Merge
6. Report payouts
7. Redeem

This reduces operator error by matching contract dependency order.

## Design Decisions and Rationale

### 1) Keep scope to current deployed contract only
Decision:
- Build only features supported by live `ConditionalTokens`

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
- Deploy from `main` via Actions (`deploy-pages.yml`)

Why:
- Simple hosting with no server runtime
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

Production (GitHub Pages):
- Optional repo variable: `VITE_SEPOLIA_RPC_URL`
- Fallback if unset: `https://ethereum-sepolia-rpc.publicnode.com`

## Build and Deploy

Build locally:
```bash
npm run build
npm run preview
```

GitHub Pages workflow:
- File: `.github/workflows/deploy-pages.yml`
- Trigger: push to `main`

One-time repo setup:
1. GitHub Settings → Pages
2. Source: **GitHub Actions**
3. (Optional) Add repo variable `VITE_SEPOLIA_RPC_URL`

## Known Limitations

- No market registry or market list UI
- No oracle workflow UX (proposal/dispute/finalize)
- No AMM/liquidity/trading UI
- No event indexer/history panel
- No token balance dashboard yet

These are expected for this phase and align with current on-chain scope.

## Next Suggested Enhancements

- Add reusable preset storage for common condition inputs
- Add read panels for `payoutDenominator`, `payoutNumerators`, and position balances
- Add a guided wizard mode for first-time operators
- Add network switch helper (auto-prompt to Sepolia)
