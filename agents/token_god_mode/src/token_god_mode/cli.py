"""Command-line entry point for Token God Mode."""

from __future__ import annotations

import argparse
import json
import os
import sys

from token_god_mode.client import NansenClient, TGMConfig
from token_god_mode.models import TokenQuery
from token_god_mode.workflow import collect_snapshot


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Collect a Token God Mode intelligence snapshot")
    parser.add_argument("--token-address", default=os.environ.get("TGM_TOKEN_ADDRESS"))
    parser.add_argument("--chain", default=os.environ.get("TGM_CHAIN", "solana"))
    parser.add_argument("--lookback-days", type=int, default=int(os.environ.get("TGM_LOOKBACK_DAYS", "7")))
    parser.add_argument("--per-page", type=int, default=100)
    parser.add_argument("--dry-run", action="store_true", help="print request plan; do not call API")
    parser.add_argument("--json", action="store_true", help="pretty-print JSON")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not args.token_address:
        print("--token-address or TGM_TOKEN_ADDRESS is required", file=sys.stderr)
        return 2
    query = TokenQuery(
        chain=args.chain,
        token_address=args.token_address,
        lookback_days=args.lookback_days,
        per_page=args.per_page,
    )
    try:
        client = NansenClient(TGMConfig.from_env()) if not args.dry_run else None
        snapshot = collect_snapshot(client, query, dry_run=args.dry_run)
    except (ValueError, TypeError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(json.dumps(snapshot.model_dump(), indent=2 if args.json or args.dry_run else None, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
