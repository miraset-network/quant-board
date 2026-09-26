"""Tests for daily_smta."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from daily_smta import (
    AnalysisResult,
    HoldersParams,
    MoverParams,
    NansenClient,
    NansenConfig,
    NetflowResponse,
    OHLCVParams,
    TimeWindow,
    TokenNetflow,
    format_summary,
    run_analysis,
)


@pytest.fixture
def config() -> NansenConfig:
    return NansenConfig(api_key="test-key")


@pytest.fixture
def client(config: NansenConfig) -> NansenClient:
    return NansenClient(config)


@pytest.fixture
def window() -> TimeWindow:
    return TimeWindow.last_n_days(7)


@pytest.fixture
def sample_netflow() -> NetflowResponse:
    return NetflowResponse(
        data=[
            TokenNetflow(
                token_address="0xabc",
                token_symbol="TOKEN1",
                net_flow_7d_usd=1_000_000,
                trader_count=50,
            ),
            TokenNetflow(
                token_address="0xdef",
                token_symbol="TOKEN2",
                net_flow_7d_usd=500_000,
                trader_count=30,
            ),
        ]
    )


@pytest.fixture
def sample_movers() -> dict:
    return {
        "data": [
            {"wallet": "0x111", "side": "buy", "trade_volume_usd": 100_000},
            {"wallet": "0x222", "side": "sell", "trade_volume_usd": 80_000},
            {"wallet": "0x333", "side": "buy", "trade_volume_usd": 60_000},
        ]
    }


@pytest.fixture
def sample_holders() -> dict:
    return {
        "data": [
            {"address": "0xaaa", "token_amount": 1_000_000, "percentage": 50},
            {"address": "0xbbb", "token_amount": 500_000, "percentage": 25},
            {"address": "0xccc", "token_amount": 500_000, "percentage": 25},
        ]
    }


@pytest.fixture
def sample_ohlcv() -> dict:
    base = datetime.now(timezone.utc) - timedelta(days=7)
    return {
        "data": [
            {"timestamp": (base + timedelta(days=i)).isoformat(), "close": 1.0 + i * 0.1}
            for i in range(7)
        ]
    }


class TestTimeWindow:
    def test_last_n_days(self) -> None:
        window = TimeWindow.last_n_days(7)
        assert window.from_time is not None
        assert window.to_time is not None
        from_dt = datetime.fromisoformat(window.from_time.replace("Z", "+00:00"))
        to_dt = datetime.fromisoformat(window.to_time.replace("Z", "+00:00"))
        assert (to_dt - from_dt).days == 7


class TestNansenClient:
    @patch("daily_smta.__main__.requests.Session.post")
    def test_get_smart_money_netflow(
        self, mock_post: MagicMock, client: NansenClient, sample_netflow: NetflowResponse
    ) -> None:
        mock_response = MagicMock()
        mock_response.json.return_value = sample_netflow.model_dump()
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        result = client.get_smart_money_netflow()

        assert isinstance(result, NetflowResponse)
        assert len(result.data) == 2
        assert result.data[0].token_symbol == "TOKEN1"
        mock_post.assert_called_once()

    @patch("daily_smta.__main__.requests.Session.post")
    def test_get_token_movers(
        self, mock_post: MagicMock, client: NansenClient, sample_movers: dict
    ) -> None:
        mock_response = MagicMock()
        mock_response.json.return_value = sample_movers
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        params = MoverParams(
            chain="ethereum", token_address="0xabc", date=TimeWindow.last_n_days(7)
        )
        result = client.get_token_movers(params)

        assert result == sample_movers
        mock_post.assert_called_once()

    @patch("daily_smta.__main__.requests.Session.post")
    def test_get_token_holders(
        self, mock_post: MagicMock, client: NansenClient, sample_holders: dict
    ) -> None:
        mock_response = MagicMock()
        mock_response.json.return_value = sample_holders
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        params = HoldersParams(chain="ethereum", token_address="0xabc")
        result = client.get_token_holders(params)

        assert result == sample_holders

    @patch("daily_smta.__main__.requests.Session.post")
    def test_get_token_ohlcv(
        self, mock_post: MagicMock, client: NansenClient, sample_ohlcv: dict
    ) -> None:
        mock_response = MagicMock()
        mock_response.json.return_value = sample_ohlcv
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        params = OHLCVParams(
            chain="ethereum", token_address="0xabc", date=TimeWindow.last_n_days(7)
        )
        result = client.get_token_ohlcv(params)

        assert result == sample_ohlcv


class TestRunAnalysis:
    @patch.object(NansenClient, "get_smart_money_netflow")
    @patch.object(NansenClient, "get_token_movers")
    @patch.object(NansenClient, "get_token_holders")
    @patch.object(NansenClient, "get_token_ohlcv")
    def test_run_analysis_auto_select(
        self,
        mock_ohlcv: MagicMock,
        mock_holders: MagicMock,
        mock_movers: MagicMock,
        mock_netflow: MagicMock,
        client: NansenClient,
        window: TimeWindow,
        sample_netflow: NetflowResponse,
        sample_movers: dict,
        sample_holders: dict,
        sample_ohlcv: dict,
    ) -> None:
        mock_netflow.return_value = sample_netflow
        mock_movers.return_value = sample_movers
        mock_holders.return_value = sample_holders
        mock_ohlcv.return_value = sample_ohlcv

        result = run_analysis(client, window)

        assert isinstance(result, AnalysisResult)
        assert result.top_token.token_address == "0xabc"
        mock_netflow.assert_called_once()
        mock_movers.assert_called_once()
        mock_holders.assert_called_once()
        mock_ohlcv.assert_called_once()

    @patch.object(NansenClient, "get_smart_money_netflow")
    @patch.object(NansenClient, "get_token_movers")
    @patch.object(NansenClient, "get_token_holders")
    @patch.object(NansenClient, "get_token_ohlcv")
    def test_run_analysis_manual_token(
        self,
        mock_ohlcv: MagicMock,
        mock_holders: MagicMock,
        mock_movers: MagicMock,
        mock_netflow: MagicMock,
        client: NansenClient,
        window: TimeWindow,
        sample_netflow: NetflowResponse,
        sample_movers: dict,
        sample_holders: dict,
        sample_ohlcv: dict,
    ) -> None:
        mock_netflow.return_value = sample_netflow
        mock_movers.return_value = sample_movers
        mock_holders.return_value = sample_holders
        mock_ohlcv.return_value = sample_ohlcv

        result = run_analysis(client, window, token_address="0xdef")

        assert result.top_token.token_address == "0xdef"


class TestFormatSummary:
    def test_format_summary(
        self,
        sample_movers: dict,
        sample_holders: dict,
        sample_ohlcv: dict,
    ) -> None:
        top_token = TokenNetflow(
            token_address="0xabc", token_symbol="TEST", net_flow_7d_usd=1_000_000, trader_count=50
        )
        result = AnalysisResult(
            top_token=top_token,
            movers=sample_movers,
            holders=sample_holders,
            ohlcv=sample_ohlcv,
        )

        summary = format_summary(result)

        assert "TEST" in summary
        assert "1,000,000" in summary
        assert "2 buyers" in summary
        assert "1 sellers" in summary
        assert "50.0%" in summary
        assert "Price Change" in summary


class TestNansenConfig:
    def test_from_env_missing_key(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("NANSEN_API_KEY", raising=False)
        with pytest.raises(ValueError, match="NANSEN_API_KEY"):
            NansenConfig.from_env()

    def test_from_env_present(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("NANSEN_API_KEY", "test-123")
        config = NansenConfig.from_env()
        assert config.api_key == "test-123"