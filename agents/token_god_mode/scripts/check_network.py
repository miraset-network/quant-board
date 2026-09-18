"""Smoke-test one authenticated Token God Mode network request."""

from __future__ import annotations

import argparse
import os
import sys
import requests

from token_god_mode.client import NansenClient, TGMConfig
from token_god_mode.models import TokenQuery


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Check connectivity and authentication with the Nansen TGM API"
    )
    parser.add_argument("--token-address", default=os.environ.get("TGM_TOKEN_ADDRESS"))
    parser.add_argument("--chain", default=os.environ.get("TGM_CHAIN", "solana"))
    parser.add_argument("--lookback-days", type=int, default=1)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not args.token_address:
        print("ERROR: --token-address or TGM_TOKEN_ADDRESS is required", file=sys.stderr)
        return 2

    try:
        config = TGMConfig.from_env()
        query = TokenQuery(
            chain=args.chain,
            token_address=args.token_address,
            lookback_days=args.lookback_days,
            per_page=1,
        )
        client = NansenClient(config)
        payload = client.post("holders", query.request_body())
    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else "unknown"
        print(f"FAIL: API returned HTTP {status}: {exc}", file=sys.stderr)
        return 1
    except requests.RequestException as exc:
        print(f"FAIL: network request failed: {exc}", file=sys.stderr)
        return 1
    except (TypeError, ValueError) as exc:
        print(f"FAIL: configuration or response error: {exc}", file=sys.stderr)
        return 1

    rows = payload.get("data", [])
    count = len(rows) if isinstance(rows, list) else "unknown"
    print(f"OK: connected to {config.base_url}")
    print(f"Token: {args.token_address} | chain: {args.chain}")
    print(f"Holders response rows: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
