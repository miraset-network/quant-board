from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from token_god_mode.client import ENDPOINTS, NansenClient, TGMConfig
from token_god_mode.models import TimeWindow, TokenQuery
from token_god_mode.workflow import collect_snapshot


def test_time_window_rejects_invalid_lookback() -> None:
    with pytest.raises(ValueError, match="positive"):
        TimeWindow.last_n_days(0)


def test_dry_run_contains_all_datasets() -> None:
    query = TokenQuery(token_address="So111", chain="solana")
    snapshot = collect_snapshot(MagicMock(), query, dry_run=True)

    assert set(snapshot.data) == set(ENDPOINTS)
    assert snapshot.complete
    assert snapshot.data["smart_money_holders"]["body"]["label_type"] == "smart_money"
    assert snapshot.data["market_data"]["body"]["timeframe"] == "1d"


def test_collect_snapshot_keeps_partial_failures() -> None:
    client = MagicMock(spec=NansenClient)

    def post(dataset: str, body: dict[str, object]) -> dict[str, object]:
        if dataset == "holders":
            return {"data": []}
        raise RuntimeError("offline")

    client.post.side_effect = post
    query = TokenQuery(token_address="So111")

    snapshot = collect_snapshot(client, query)

    assert snapshot.data["holders"] == {"data": []}
    assert "dex_trades" in snapshot.errors
    assert not snapshot.complete


def test_client_posts_to_dataset_endpoint() -> None:
    session = MagicMock()
    response = MagicMock()
    response.json.return_value = {"data": []}
    session.post.return_value = response
    client = NansenClient(TGMConfig(api_key="test"), session=session)

    result = client.post("holders", {"token_address": "So111"})

    assert result == {"data": []}
    session.post.assert_called_once()
    response.raise_for_status.assert_called_once()
