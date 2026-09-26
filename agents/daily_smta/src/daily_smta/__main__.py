"""Daily Smart Money Token Analysis - Nansen API client."""

from __future__ import annotations

import logging
import os
import sys
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import requests
from dotenv import load_dotenv
from pydantic import BaseModel, Field

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

BASE_URL = "https://api.nansen.ai/api/v1"
DEFAULT_CHAIN = "ethereum"
DEFAULT_TIMEFRAME = "1d"
DEFAULT_LOOKBACK_DAYS = 7
DEFAULT_PAGE_SIZE = 10
HOLDERS_PAGE_SIZE = 100
REQUEST_TIMEOUT = 30


class NansenConfig(BaseModel):
    api_key: str = Field(..., description="Nansen API key")
    base_url: str = BASE_URL
    chain: str = DEFAULT_CHAIN
    timeout: int = REQUEST_TIMEOUT

    @classmethod
    def from_env(cls) -> NansenConfig:
        api_key = os.environ.get("NANSEN_API_KEY")
        if not api_key:
            raise ValueError("NANSEN_API_KEY environment variable not set")
        return cls(api_key=api_key)


class TimeWindow(BaseModel):
    from_time: str
    to_time: str

    @classmethod
    def last_n_days(cls, days: int = DEFAULT_LOOKBACK_DAYS) -> TimeWindow:
        to_time = datetime.now(UTC)
        from_time = to_time - timedelta(days=days)
        return cls(
            from_time=from_time.isoformat(),
            to_time=to_time.isoformat(),
        )


class TokenNetflow(BaseModel):
    token_address: str
    token_symbol: str | None = None
    net_flow_7d_usd: float
    trader_count: int = 0


class NetflowResponse(BaseModel):
    data: list[TokenNetflow] = Field(default_factory=list)


class MoverParams(BaseModel):
    chain: str
    token_address: str
    date: TimeWindow
    pagination: dict[str, int] = Field(
        default_factory=lambda: {"page": 1, "per_page": DEFAULT_PAGE_SIZE}
    )
    order_by: list[dict[str, str]] = Field(
        default_factory=lambda: [{"field": "trade_volume_usd", "direction": "DESC"}]
    )


class HoldersParams(BaseModel):
    chain: str
    token_address: str
    aggregate_by_entity: bool = False
    label_type: str = "all_holders"
    pagination: dict[str, int] = Field(
        default_factory=lambda: {"page": 1, "per_page": HOLDERS_PAGE_SIZE}
    )
    premium_labels: bool = False
    order_by: list[dict[str, str]] = Field(
        default_factory=lambda: [{"field": "token_amount", "direction": "DESC"}]
    )


class OHLCVParams(BaseModel):
    chain: str
    token_address: str
    timeframe: str = DEFAULT_TIMEFRAME
    date: TimeWindow | None = None


class NansenClient:
    def __init__(self, config: NansenConfig):
        self.config = config
        self.session = requests.Session()
        self.session.headers.update(
            {"apikey": config.api_key, "Content-Type": "application/json"}
        )

    def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.config.base_url}{path}"
        logger.debug("POST %s", url)
        response = self.session.post(url, json=body, timeout=self.config.timeout)
        response.raise_for_status()
        return response.json()  # type: ignore[no-any-return]

    def get_smart_money_netflow(
        self,
        chain: str | None = None,
        include_native: bool = False,
        include_stablecoins: bool = False,
        page: int = 1,
        per_page: int = DEFAULT_PAGE_SIZE,
    ) -> NetflowResponse:
        body = {
            "chains": [chain or self.config.chain],
            "filters": {
                "include_native_tokens": include_native,
                "include_stablecoins": include_stablecoins,
            },
            "order_by": [{"field": "net_flow_7d_usd", "direction": "DESC"}],
            "pagination": {"page": page, "per_page": per_page},
        }
        data = self._post("/smart-money/netflow", body)
        return NetflowResponse.model_validate(data)

    def get_token_movers(self, params: MoverParams) -> dict[str, Any]:
        return self._post("/tgm/who-bought-sold", params.model_dump())

    def get_token_holders(self, params: HoldersParams) -> dict[str, Any]:
        return self._post("/tgm/holders", params.model_dump())

    def get_token_ohlcv(self, params: OHLCVParams) -> dict[str, Any]:
        body = params.model_dump(exclude_none=True)
        return self._post("/tgm/token-ohlcv", body)


@dataclass
class AnalysisResult:
    top_token: TokenNetflow
    movers: dict[str, Any]
    holders: dict[str, Any]
    ohlcv: dict[str, Any]


def run_analysis(
    client: NansenClient,
    window: TimeWindow,
    token_address: str | None = None,
) -> AnalysisResult:
    logger.info("Fetching Smart Money netflow...")
    netflow = client.get_smart_money_netflow()
    rows = netflow.data

    if not rows:
        raise RuntimeError("No Smart Money netflow rows returned")

    top_token = token_address or max(rows, key=lambda r: r.net_flow_7d_usd).token_address
    top_row = next((r for r in rows if r.token_address == top_token), rows[0])

    logger.info(
        "Top token: %s (%s) - %.0f USD net inflow, %d traders",
        top_row.token_symbol or top_row.token_address,
        top_row.token_address,
        top_row.net_flow_7d_usd,
        top_row.trader_count,
    )

    logger.info("Fetching token movers...")
    movers = client.get_token_movers(
        MoverParams(
            chain=client.config.chain,
            token_address=top_token,
            date=window,
        )
    )

    logger.info("Fetching token holders...")
    holders = client.get_token_holders(
        HoldersParams(
            chain=client.config.chain,
            token_address=top_token,
        )
    )

    logger.info("Fetching OHLCV...")
    ohlcv = client.get_token_ohlcv(
        OHLCVParams(
            chain=client.config.chain,
            token_address=top_token,
            date=window,
        )
    )

    return AnalysisResult(
        top_token=top_row,
        movers=movers,
        holders=holders,
        ohlcv=ohlcv,
    )


def format_summary(result: AnalysisResult) -> str:
    top = result.top_token
    movers_data = result.movers.get("data", [])
    holders_data = result.holders.get("data", [])
    ohlcv_data = result.ohlcv.get("data", [])

    buyers = len([m for m in movers_data if m.get("side") == "buy"])
    sellers = len([m for m in movers_data if m.get("side") == "sell"])

    top_holder_pct = 0.0
    if holders_data:
        total = sum(h.get("token_amount", 0) for h in holders_data)
        if total > 0:
            top_holder_pct = (holders_data[0].get("token_amount", 0) / total) * 100

    price_change = 0.0
    if len(ohlcv_data) >= 2:
        first_close = ohlcv_data[0].get("close", 0)
        last_close = ohlcv_data[-1].get("close", 0)
        if first_close:
            price_change = ((last_close - first_close) / first_close) * 100

    return (
        f"\n=== Daily SMTA Summary ===\n"
        f"Token: {top.token_symbol or top.token_address} ({top.token_address})\n"
        f"7d Net Inflow: ${top.net_flow_7d_usd:,.0f} | Traders: {top.trader_count}\n"
        f"Movers: {buyers} buyers, {sellers} sellers (top {len(movers_data)} by volume)\n"
        f"Holder Concentration: Top holder owns {top_holder_pct:.1f}% of supply\n"
        f"Price Change (7d): {price_change:+.2f}%\n"
        f"OHLCV Candles: {len(ohlcv_data)}"
    )


def main() -> int:
    try:
        config = NansenConfig.from_env()
    except ValueError as e:
        logger.error("%s", e)
        return 1

    token_address = os.environ.get("SMTA_TOKEN_ADDRESS")
    lookback_days = int(os.environ.get("SMTA_LOOKBACK_DAYS", str(DEFAULT_LOOKBACK_DAYS)))

    client = NansenClient(config)
    window = TimeWindow.last_n_days(lookback_days)

    try:
        result = run_analysis(client, window, token_address)
        print(format_summary(result))
        logger.debug("Full movers: %s", result.movers)
        logger.debug("Full holders: %s", result.holders)
        logger.debug("Full ohlcv: %s", result.ohlcv)
        return 0
    except requests.HTTPError as e:
        logger.error("API error: %s", e.response.text if e.response else e)
        return 1
    except Exception as e:
        logger.exception("Analysis failed: %s", e)
        return 1


if __name__ == "__main__":
    sys.exit(main())
