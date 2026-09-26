"""The token investigation workflow."""

from __future__ import annotations

import logging
from typing import Any

from token_god_mode.client import ENDPOINTS, LABEL_TYPES, NansenClient
from token_god_mode.models import TokenQuery, TokenSnapshot

logger = logging.getLogger(__name__)


def collect_snapshot(
    client: NansenClient | None,
    query: TokenQuery,
    *,
    dry_run: bool = False,
    best_effort: bool = True,
) -> TokenSnapshot:
    """Collect every TGM dataset for a token, preserving partial failures."""
    snapshot = TokenSnapshot(query=query)
    for dataset in ENDPOINTS:
        body = query.request_body(label_type=LABEL_TYPES.get(dataset))
        if dataset == "market_data":
            body["timeframe"] = "1d"
        if dry_run:
            snapshot.data[dataset] = {"endpoint": ENDPOINTS[dataset], "body": body}
            continue
        try:
            if client is None:
                raise ValueError("client is required when dry_run is false")
            snapshot.data[dataset] = client.post(dataset, body)
        except Exception as exc:
            logger.warning("Dataset %s failed: %s", dataset, exc)
            snapshot.errors[dataset] = str(exc)
            if not best_effort:
                raise
    return snapshot
