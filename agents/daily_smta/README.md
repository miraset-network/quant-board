# Daily SMTA (Smart Money Token Analysis)

Daily analysis of Smart Money token flows using Nansen API.

## Setup

```bash
# Install dependencies
pip install -e ".[dev]"

# Or with uv (recommended)
uv pip install -e ".[dev]"
```

## Configuration

Copy `.env.example` to `.env` and add your Nansen API key:

```bash
cp .env.example .env
# Edit .env with your NANSEN_API_KEY
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NANSEN_API_KEY` | Yes | - | Your Nansen API key |
| `SMTA_TOKEN_ADDRESS` | No | Auto | Override token address (skip Smart Money selection) |
| `SMTA_LOOKBACK_DAYS` | No | `7` | Days of historical data to fetch |
| `SMTA_CHAIN` | No | `ethereum` | Blockchain to analyze |

## Usage

```bash
# Run analysis (auto-selects top Smart Money buy)
python -m daily_smta

# Run with specific token
SMTA_TOKEN_ADDRESS=0x95669a6589a81a6704bab1020722d0c405841885 python -m daily_smta

# Run with custom lookback
SMTA_LOOKBACK_DAYS=30 python -m daily_smta
```

## Cron Setup

```bash
# Daily at 6 AM UTC
0 6 * * * /path/to/venv/bin/python -m daily_smta >> /var/log/daily_smta.log 2>&1
```

## Output

```
=== Daily SMTA Summary ===
Token: GIVE (0x95669a6589a81a6704bab1020722d0c405841885)
7d Net Inflow: $1,234,567 | Traders: 42
Movers: 8 buyers, 2 sellers (top 10 by volume)
Holder Concentration: Top holder owns 15.3% of supply
Price Change (7d): +12.45%
OHLCV Candles: 7
```

## Testing

```bash
pytest -v
```

## Project Structure

```
daily_smta/
├── src/daily_smta/
│   ├── __init__.py
│   └── __main__.py      # Main entry point
├── tests/
│   └── test_daily_smta.py
├── pyproject.toml
└── .env.example
```