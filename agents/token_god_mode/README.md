# Token God Mode

On-chain intelligence agent for a single token. It turns the investigation flow

`token → who is buying → smart money → funds → whales → exchanges → fresh wallets → DEX activity → netflow`

into one normalized snapshot backed by Nansen Token God Mode endpoints.

## Setup

```bash
uv pip install -e ".[dev]" # or: pip install -e ".[dev]"
cp .env.example .env
# Set NANSEN_API_KEY and TGM_TOKEN_ADDRESS in .env
```

## Usage

```bash
# SOL token on Solana; prints a JSON snapshot
TGM_TOKEN_ADDRESS=<mint> token-god-mode

# Inspect the exact request plan without making network calls
token-god-mode --token-address <mint> --chain solana --dry-run

# Make one authenticated network request (holders, per_page=1)
python scripts/check_network.py --token-address <mint> --chain solana
# Or, after installation:
token-god-mode-network-check --token-address <mint> --chain solana

# Pretty-print a saved snapshot
token-god-mode --token-address <mint> --json
```

The API key is read only from `NANSEN_API_KEY`. Never commit `.env` or API responses
that contain wallet-level data.

`check_network.py` intentionally makes only one request to `POST /tgm/holders` and
returns exit code `0` only when the request succeeds. It does not print the API key.

## Collected datasets

The snapshot has stable keys for: `holders`, `smart_money_holders`, `whales`,
`exchange_holdings`, `dex_trades`, `transfers`, `buy_sell_activity`, `token_flows`,
`pnl_leaderboard`, `market_data`, `risk_reward`, and `smart_money_activity`.

Endpoint paths live in `src/token_god_mode/client.py` in one map because Nansen
availability and naming can vary by plan/API version. Confirm the paths and the
`label_type` values against your Nansen account before production use. A failed
optional dataset is returned under `errors` rather than hiding the rest of the
snapshot.

## Testing

```bash
pytest -v
ruff check .
```
