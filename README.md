# aurum-app-v2

A minimal frontend for interacting with the deployed `ConditionalTokens` contract on Sepolia.

## Target Contract

- Network: Sepolia (`11155111`)
- Contract: `ConditionalTokens`
- Address: `0x1d2607F5e52c4bc92891bE5932091b7D74FC719A`

## Features

- Connect injected wallet (MetaMask/Rabby)
- Derive IDs from contract helpers:
  - `getQuestionIdFromString`
  - `getConditionId`
  - `getPositionId`
- Write actions:
  - `prepareCondition`
  - `splitPosition`
  - `mergePositions`
  - `reportPayouts`
  - `redeemPositions`
- ERC20 support action:
  - `approve` collateral spending to `ConditionalTokens`
  - allowance readback

## Local Development

```bash
npm install
npm run dev
```

Optional RPC override:

```bash
VITE_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<key> npm run dev
```

If not provided, the app falls back to:
- `https://ethereum-sepolia-rpc.publicnode.com`

## Build

```bash
npm run build
npm run preview
```

## Deploy To GitHub Pages

Workflow file:
- `.github/workflows/deploy-pages.yml`

It deploys automatically on push to `main`.

### One-time repo setup

1. In GitHub repo settings, go to **Pages**.
2. Set source to **GitHub Actions**.
3. (Optional) Add repository variable:
   - `VITE_SEPOLIA_RPC_URL` (if you want your own RPC endpoint in production)

After that, each push to `main` publishes the app.

## Notes

- The UI is intentionally operator-focused, not consumer-friendly.
- `reportPayouts` must be sent from the same oracle address used when preparing the condition.
- For split/merge amounts, inputs are in human units (the app converts using token `decimals()`).
