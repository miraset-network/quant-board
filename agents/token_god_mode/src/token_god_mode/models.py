"""Typed request and response models for Token God Mode."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from pydantic import BaseModel, Field


class TimeWindow(BaseModel):
    from_time: str
    to_time: str

    @classmethod
    def last_n_days(cls, days: int) -> "TimeWindow":
        if days < 1:
            raise ValueError("lookback days must be positive")
        end = datetime.now(UTC)
        return cls(from_time=(end - timedelta(days=days)).isoformat(), to_time=end.isoformat())


class TokenQuery(BaseModel):
    chain: str = "solana"
    token_address: str
    lookback_days: int = 7
    page: int = 1
    per_page: int = 100

    @property
    def window(self) -> TimeWindow:
        return TimeWindow.last_n_days(self.lookback_days)

    def request_body(self, *, label_type: str | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {
            "chain": self.chain,
            "token_address": self.token_address,
            "date": self.window.model_dump(),
            "pagination": {"page": self.page, "per_page": self.per_page},
        }
        if label_type:
            body["label_type"] = label_type
        return body


class TokenSnapshot(BaseModel):
    query: TokenQuery
    data: dict[str, Any] = Field(default_factory=dict)
    errors: dict[str, str] = Field(default_factory=dict)

    @property
    def complete(self) -> bool:
        return not self.errors
