# Умови участі в Nansen Meridian Buildathon

## 📅 Дати проведення

- **Старт**: 14 вересня 2026
- **Фініш**: 27 вересня 2026
- **Тривалість**: 2 тижні (активний збірка MVP з 22 по 28 вересня)

## 🎁 Призовий фонд

### 1-ше місце
- **$10,000 USDC**

### 2-ге місце
- AirPods Max
- Ledger Hardware Wallet
- Keychron Q Pro Keyboard

### 3-тє місце
- Sony WH-1000XM5
- Ledger Hardware Wallet

### Почесні згадки
- 100,000 Nansen API Credits (кожному)

## 📋 Вимоги до участі

### Обов'язкові кроки:

1. **Створити API ключ**
   - URL: https://app.nansen.ai/api
   - Безкоштовно для старту
   - Зберегти ключ у безпечному місці

2. **Зробити 1,000+ API calls**
   - Будь-які ендпоінти
   - Довести використання Nansen API у проекті
   - Фіксувати логи для підтвердження

3. **Опублікувати демо на X (Twitter)**
   - Тег: [@nansen_ai](https://twitter.com/nansen_ai)
   - Відео-демонстрація роботи проекту
   - Посилання на GitHub репозиторій

4. **Подати заявку**
   - URL: https://nsn.ai/meridian-submit
   - Email
   - Посилання на X пост
   - Посилання на GitHub repo

### Технічні вимоги:

- ✅ Використовувати Nansen API (будь-які ендпоінти)
- ✅ Working demo (live data loads)
- ✅ End-to-end функціонал
- ✅ Recording демо (без narration)
- ✅ Clean README
- ✅ Можливість запустити за < 10 хвилин

## 🏆 Критерії оцінювання

### 1. Data Integration (25%)
**Nansen data drives the logic — not just appears on screen**

| Рівень | Бали | Опис |
|--------|------|------|
| Поверхневий | 0-10% | API використовується тільки для відображення |
| Базовий | 11-20% | Дані впливають на логіку частково |
| Глибокий | 21-25% | Nansen data — ядро бізнес-логіки |

**Для FOMO Indexes:**
- Smart Money flow → ваги токенів ✅
- Correlation score → ребаланс тригери ✅
- Whale concentration → risk adjustment ✅

### 2. Creativity & Originality (25%)
**A use case nobody thought to build**

| Рівень | Бали | Опис |
|--------|------|------|
| Standard | 0-10% | Черговий dashboard |
| Interesting | 11-20% | Новий кут зору |
| Unique | 21-25% | Use case якого ще не бачили |

**Для FOMO Indexes:**
- ✅ Динамічний індекс на Smart Money
- ✅ Correlation-based weighting
- ✅ Static arbitrage detection

### 3. Functionality & Workability (25%)
**Live data loads. End to end. No crashes.**

| Вимога | Статус |
|--------|--------|
| Live data з Nansen API | ✅ (залежить від `NANSEN_API_KEY`) |
| End-to-end workflow | ✅ |
| No crashes during recording | ⬜ (потрібне тестування запису) |
| Stable API integration | ✅ |

### 4. Documentation & Submission (25%)
**Another builder can run it in under 10 minutes**

| Вимога | Статус |
|--------|--------|
| Clean README.md | ✅ |
| Followable recording | ⬜ (потрібне запис) |
| No narration needed | ✅ (UI self-explanatory, terminal-style) |
| Quick setup (< 10 min) | ✅ (див. `README.md`) |

## 📝 Чек-лист підготовки

### Тиждень 1 (Sep 14-20)

- [x] Створити Nansen API key
- [x] Інтегрувати API ендпоінти
- [x] Зробити 1,000+ API calls (у процесі)
- [x] Data pipeline working
- [x] Correlation engine ready

### Тиждень 2 (Sep 21-27)

- [ ] Smart contract deployed (testnet) — за межами MVP
- [x] Rebalance automation working
- [x] Dashboard UI complete
- [ ] Demo recording ready
- [x] README.md written
- [ ] X post published
- [ ] Submission form filled

## ⚠️ Важливі зауваження

### Що НЕ прийнятне:
- ❌ Dashboards без бізнес-логіки
- ❌ Проекти що падають під час демо
- ❌ Documentation яка незрозуміла
- ❌ Використання Nansen API тільки для display

### Що заохочується:
- ✅ Simple tool that runs > impressive one that doesn't
- ✅ Creativity beats complexity
- ✅ Real working demo > mockup
- ✅ Clear documentation > verbose

## 🔗 Корисні посилання

- **Документація API**: https://docs.nansen.ai/api/overview
- **Форма подачі**: https://nsn.ai/meridian-submit
- **Сторінка хакатону**: https://nansen.ai/campaigns/meridian-buildathon
- **Twitter**: https://twitter.com/nansen_ai

## 📞 Контакти для підтримки

- Email: support@nansen.ai
- Telegram: https://t.me/nansen_digest
- Discord: Nansen Community

## 🎯 Стратегія перемоги

1. **Focus on Data Integration (25%)**
   - Глибока інтеграція Nansen даних у бізнес-логіку
   - Не просто display — а decision making

2. **Maximize Originality (25%)**
   - Унікальний use case (FOMO Indexes)
   - Те, чого ще не робили

3. **Ensure Functionality (25%)**
   - Стабільна робота під час recording
   - Live data, no crashes

4. **Perfect Documentation (25%)**
   - README зрозумілий за 5 хвилин
   - Recording без narration
   - Setup < 10 хвилин

---

**Статус підготовки**: Ready — потрібен лише запис demo  
**API Key**: Отримано ✅  
**API Calls**: ✅ (рахунок у `NansenService` + `api_call_log`; milestone done)  
**Demo**: Not ready ⬜  
**Submission**: Not submitted ⬜
