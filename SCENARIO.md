## English Pitch Script + Shot-by-Shot Storyboard (~60s)

Song: https://www.youtube.com/watch?v=oEybvx6Fx8M
Voiceover: 

---

### 🎬 SHOT 1 — Hook (0–8s)

**Visual:** Black screen → rapid montage of crypto candlestick charts flashing, red/green. Zoom into a Twitter/X feed: *"Smart Money accumulated $XYZ at $0.40… now $4.00"*. Text slams on screen:

> **"You're always late."**

**VO (voiceover):**
> *"What if your portfolio knew where Smart Money was moving — before you did? Meet **FOMO Indexes**."*

**On-screen text:** FOMO INDEXES logo animates in (terminal-style typewriter effect).

---

### 🎬 SHOT 2 — Problem (8–20s)

**Visual:** Screen recording of a messy workflow: 6 browser tabs — Nansen dashboards, spreadsheets with wallet addresses, DEX charts. Clock overlay spinning fast. Cut to a trader rubbing eyes at 2 AM.

**VO:**
> *"Traders burn hours every week manually tracking Smart Money flows, cross-checking token correlations, and rebalancing portfolios. And by the time the analysis is done — the whales have already moved."*

**On-screen text (appears word by word):**
- `Manual Smart Money tracking` ❌
- `Correlation spreadsheets` ❌
- `Late rebalances` ❌

---

### 🎬 SHOT 3 — Solution (20–35s)

**Visual:** Clean cut to the **FOMO Indexes dashboard** (your actual Next.js app, live). Camera slowly pans across:
- Index card with top tokens + weights
- Rebalance history timeline
- Smart Money inflow badges lighting up

**VO:**
> *"FOMO Indexes is a weekly-rebalancing index engine, powered by **Nansen Analytics**. It selects top tokens by Smart Money inflow, adjusts weights using a correlation matrix, and flags arbitrage between similar assets — automatically."*

**On-screen text (badges pop over the UI):**
- `✅ Top tokens by Smart Money`
- `✅ Correlation-adjusted weights`
- `✅ Arbitrage signals`

---

### 🎬 SHOT 4 — Platform & Implementation (35–50s)

**Visual:** Split-screen architecture diagram animating in (recreate `IDEA.md` diagram, dark theme):

```
Nansen API → NestJS backend → Analytics Engine → Live Dashboard
              ↓                     ↓
         PostgreSQL          Correlation matrix
```

Then quick cuts:
- `agents/` Python CLI running `token-god-mode` in terminal
- API counter ticking up: `1,247 Nansen API calls`
- Dashboard auto-refreshing (show the 30s poll as a subtle progress ring)

**VO:**
> *"Under the hood: a NestJS backend fed by the Nansen Query API — Smart Money Flow, Token God Mode, Wallet Activity. Signals persist in PostgreSQL, the Next.js dashboard refreshes every thirty seconds, and standalone Python agents handle deep token analysis."*

---

### 🎬 SHOT 5 — Close / CTA (50–60s)

**Visual:** Dashboard fullscreen, indexes glowing green. Slow zoom out. Logo + tagline fade in over it.

**VO:**
> *"Built in one week for the Nansen Meridian Buildathon. Over a thousand real API calls. **FOMO Indexes — stop watching charts. Start following the money.**"*

**On-screen text:**
> **FOMO Indexes**
> *Follow the money.*
> Nansen Meridian Buildathon 2026

---

### Production notes
- **Total runtime:** ~58–60s at normal VO pace (~140–150 words/min).
- **Music:** dark synthwave/terminal ambience, duck under VO.
- **Screen capture:** record the real dashboard at 1440p; blur any real wallet data if needed.
- **Fallback B-roll:** if dashboard isn't demo-ready for a shot, use the architecture diagram animation instead of Shot 3's live UI.

Want me to also write a shorter 30-second cut for Twitter/X?