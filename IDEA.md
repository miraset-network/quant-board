# ⚠️ ARCHIVED — IDEA.md

> This document is the **original product idea / pitch** written before the hackathon build. The MVP that was actually built differs in stack (NestJS, not Express), response shapes, and endpoints. Use it to understand the origin of the project, not the current API contract.
>
> For the authoritative current state, see [`AGENTS.md`](./AGENTS.md), the actual controllers in `apps/api/src/`, and the dashboard in `apps/web/components/Dashboard.tsx`.

---

# FOMO Indexes — Ребаланс портфеля на основі Nansen Analytics

## 🎯 Проблема

Трейджери та інвестори витрачають години на:
- Ручний аналіз Smart Money потоків
- Відстеження кореляцій між токенами
- Своєчасний ребаланс портфеля
- Пошук статичних арбітражних можливостей

## 💡 Рішення

**FOMO Indexes** — бекенд-сервіс для розумного ребалансу портфеля, який:
1. **Щотижня ребалансується** на основі Nansen Query API
2. **Відбирає топ-токени** за метриками Smart Money
3. **Коригує ваги** на основі кореляційного аналізу
4. **Шукає арбітраж** між схожими токенами
5. **Надає REST API + WebSocket** сигнали для інтеграції

## 🔧 Інтеграція з Nansen API

### Використані ендпоінти:

```typescript
// 1. Smart Money Flow
GET /api/query/smart-money-flow
- Top 20 Smart Money Net Inflow Tokens
- Top 10 Accumulating Wallets of L2s

// 2. Token God Mode
GET /api/token-god-mode
- Whale concentration
- Smart Money freshness
- CEX exposure

// 3. Wallet Activity
GET /api/wallet-activity
- Real-time correlation score
- PnL history
- Win-rate tracking
```

### Архітектура:

```
┌─────────────────────────────────────────────────────────┐
│              Token God Index Engine                     │
├─────────────────────────────────────────────────────────┤
│  Nansen API → Data Layer → Analytics → Rebalance API   │
│     ↓              ↓            ↓           ↓           │
│  Smart Money   Normalized   Correlation  REST + WS     │
│  Flow Data     Metrics      Matrix       Signals       │
└─────────────────────────────────────────────────────────┘
                          ↓
            ┌─────────────────────────────┐
            │   PostgreSQL (signal history)│
            └─────────────────────────────┘
```

##  Функціонал

### 1. Smart Money Mirror Index
- Користувач обирає 5-20 Smart Money гаманців
- Індекс автоматично реплікує їх нетто-рухи
- Ваги розраховуються через Nansen API (on-chain analytics)

### 2. Static Arbitrage Detector
- Аналіз кореляції між токенами (30/60/90 днів)
- Виявлення статичних арбітражних можливостей
- Авто-ребаланс при відхиленні > 5%

### 3. Correlation-Based Weighting
- Dynamic weights від 0% до 70% на основі:
  - Smart Money concentration
  - CEX exposure score
  - Whale activity freshness

### 4. REST API для інтеграції
- Готові сигнали для підключення до будь-якого UI
- WebSocket для real-time сповіщень
- Симуляція портфеля перед ребалансом

## 🛠 Технічна реалізація

### Стек (MVP):
- **Backend**: Node.js + TypeScript + Express
- **Data**: Nansen Query API
- **Analytics**: Власна correlation логіка
- **API**: REST (3 endpoints для MVP)
- **Storage**: Memory/JSON (MVP), PostgreSQL (потім)

### Ключові компоненти:

```typescript
// 1. Data Fetcher
class NansenDataFetcher {
  async getSmartMoneyFlow(): Promise<TokenFlow[]>
  async getCorrelationMatrix(tokens: string[]): Promise<Matrix>
  async getWhaleConcentration(token: string): Promise<number>
}

// 2. Rebalance Engine
class RebalanceEngine {
  calculateWeights(metrics: Metrics): Weight[]
  detectArbitrage(correlation: Matrix): Arbitrage[]
  generateSignals(newWeights: Weight[]): RebalanceSignal[]
}

// 3. REST API
GET  /api/index/current        // Поточні ваги індексу
GET  /api/index/rebalance      // Сигнали на ребаланс
GET  /api/arbitrage/opportunities  // Арбітражні можливості
POST /api/index/simulate       // Симуляція портфеля
WS   /ws/signals               // Live сигнали
```

## 🏆 Унікальність

| Конкуренти | FOMO Indexes |
|------------|-------------------|
| Статичні індекси (Index Coop) | **Динамічний ребаланс** |
| Ручний аналіз | **Авто-ребаланс по Nansen** |
| Загальні метрики | **Smart Money-specific** |
| Без кореляцій | **Correlation-weighted** |

## 📈 Бізнес-модель

- **Management Fee**: 1% річних від AUM
- **Performance Fee**: 10% від прибутку
- **API Cost**: ~$500/міс (Nansen Enterprise)
- **Break-even**: $50K AUM

## 🎯 KPI для хакатону (MVP)

- [ ] 1,000+ Nansen API calls
- [ ] Working demo з live data
- [ ] 3 REST API ендпоінти (minimum)
- [ ] Recording demo < 10 min
- [ ] Submit на хакатон

## 🚀 Roadmap (1 Week Sprint)

### Days 1-2 (Sep 22-23) — Core API
- [ ] Nansen API integration (1 endpoint)
- [ ] Basic data fetcher
- [ ] GET /api/index/current

### Days 3-4 (Sep 24-25) — Analytics
- [ ] Correlation matrix calculation
- [ ] Weight calculation engine
- [ ] GET /api/index/rebalance

### Day 5 (Sep 26) — Arbitrage
- [ ] Static arbitrage detection
- [ ] GET /api/arbitrage/opportunities

### Day 6 (Sep 27) — Polish
- [ ] README.md
- [ ] Demo recording
- [ ] 1,000 API calls milestone

### Day 7 (Sep 28) — Submit
- [ ] X post with demo
- [ ] Submit form

## 📊 Приклад API відповідей

### GET /api/index/current

```json
{
  "indexName": "Top 20 Smart Money Inflow",
  "lastUpdate": "2026-09-22T14:30:00Z",
  "tokens": [
    {
      "symbol": "ETH",
      "weight": 15.2,
      "smartMoneyScore": 92,
      "correlation": 0.85,
      "whaleConcentration": 0.34
    },
    {
      "symbol": "ARB",
      "weight": 8.7,
      "smartMoneyScore": 87,
      "correlation": 0.72,
      "whaleConcentration": 0.28
    }
  ],
  "totalValue": "$2.4M",
  "weeklyChange": "+12.3%"
}
```

### GET /api/index/rebalance

```json
{
  "signalDate": "2026-09-22T14:30:00Z",
  "currentPortfolio": [...],
  "targetPortfolio": [...],
  "actions": [
    { "action": "BUY", "token": "ARB", "change": "+5.2%" },
    { "action": "SELL", "token": "OP", "change": "-3.1%" }
  ],
  "confidence": 0.87
}
```

### GET /api/arbitrage/opportunities

```json
{
  "opportunities": [
    {
      "pair": "ETH/ARB",
      "correlation": 0.92,
      "divergence": 0.08,
      "signal": "LONG_ARB_SHORT_ETH",
      "expectedReturn": "2.3%"
    }
  ]
}
```

##  Prize Allocation

- **$10,000 USDC** (1st Place) → Development fund
- **API Credits** → Continue analytics
- **Exposure** → Nansen community

---

**Team**: Solo Builder  
**Timeline**: Sep 14-27, 2026  
**Status**: In Progress  
**API Key**: Configured ✅
