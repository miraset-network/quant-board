"""Small Nansen client focused on the Token God Mode surface."""

from __future__ import annotations

import os
from typing import Any

import requests
from dotenv import load_dotenv
from pydantic import BaseModel, Field

load_dotenv()

# Keep integration knowledge in one place. Verify paths against the API version enabled
# for the account; TGM endpoints are plan/version dependent.
ENDPOINTS: dict[str, str] = {
    "holders": "/tgm/holders",
    "smart_money_holders": "/tgm/holders",
    "whales": "/tgm/holders",
    "exchange_holdings": "/tgm/holders",
    "dex_trades": "/tgm/dex-trades",
    "transfers": "/tgm/transfers",
    "buy_sell_activity": "/tgm/who-bought-sold",
    "token_flows": "/tgm/token-flows",
    "pnl_leaderboard": "/tgm/pnl-leaderboard",
    "market_data": "/tgm/token-ohlcv",
    "risk_reward": "/tgm/risk-reward",
    "smart_money_activity": "/tgm/smart-money-activity",
}

LABEL_TYPES = {
    "smart_money_holders": "smart_money",
    "whales": "whales",
    "exchange_holdings": "exchanges",
}


class TGMConfig(BaseModel):
    api_key: str = Field(..., min_length=1)
    base_url: str = "https://api.nansen.ai/api/v1"
    timeout: int = 30

    @classmethod
    def from_env(cls) -> "TGMConfig":
        api_key = os.environ.get("NANSEN_API_KEY")
        if not api_key:
            raise ValueError("NANSEN_API_KEY environment variable not set")
        return cls(
            api_key=api_key,
            base_url=os.environ.get("TGM_BASE_URL", cls.model_fields["base_url"].default),
            timeout=int(os.environ.get("TGM_TIMEOUT", "30")),
        )


class NansenClient:
    def __init__(self, config: TGMConfig, session: requests.Session | None = None) -> None:
        self.config = config
        self.session = session or requests.Session()
        self.session.headers.update({"apikey": config.api_key, "Content-Type": "application/json"})

    def post(self, dataset: str, body: dict[str, Any]) -> dict[str, Any]:
        try:
            path = ENDPOINTS[dataset]
        except KeyError as exc:
            raise ValueError(f"Unknown Token God Mode dataset: {dataset}") from exc
        response = self.session.post(
            f"{self.config.base_url}{path}", json=body, timeout=self.config.timeout
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise TypeError(f"Expected object response for {dataset}")
        return payload
