# All Indian Stocks

NIFTY-50 historical price data, a series of seasonality/strategy analysis reports built on it, and a from-scratch market microstructure simulator.

## Contents

### `nifty-50_data/`
Daily OHLCV data (2007–2021) for all NIFTY-50 constituents, plus `stock_metadata.csv` (sector classifications) and `IndianFinancialNews.csv` (50,000 headlines, Feb 2003–May 2020, for sentiment cross-referencing).

### Analysis reports
- **`ADANIPORTS_april_seasonality.md`** — April stands out as Adani Ports' calmest month (smallest drawdowns) with the strongest average returns and highest hit-rate of positive months.
- **`ALL_STOCKS_april_seasonality.md`** — the same pattern holds market-wide: April is the calmest month for 60% of NIFTY-50 constituents, not explained by news sentiment.
- **`SEASONAL_TIMING_BACKTEST.md`** — backtests timing a lump-sum contribution to each stock's historically calmest month vs. a flat monthly SIP. Small edge (median +0.42pp annualised), with a look-ahead-bias caveat spelled out.
- **`TECHNICAL_STRATEGY_TEST.md`** — tests Golden/Death Cross, MACD, and RSI against buy-and-hold on Adani Ports. Buy-and-hold wins; the moving-average crossover does meaningfully reduce drawdown without improving return.
- **`ML_PREDICTION_TEST.md`** — walk-forward test of Decision Tree / Random Forest / Gradient Boosting against a naive zero-return guess. None beat the naive baseline out of sample — an honest negative result, not a failed experiment.

Charts referenced by the reports are in `seasonality_charts/`.

### `market-sim/`
A self-contained order-book market simulator — a Flask backend running the book/price/volume mechanics, and a React frontend to watch it live.

- **Mechanics**: a 10-level bid/ask book with mean-reverting liquidity; random market orders walk the book and produce real price impact and spread widening ("fear") when they consume liquidity; a slow mean-reverting sentiment process biases order flow direction.
- **Forecast overlay**: every tick, a short stochastic projection is computed from the current drift/volatility estimate and drawn as a dashed overlay past a "NOW" divider.
- **Replay**: a scrubber lets you drag back to any past candle and see the forecast archived at that moment overlaid against the real candles that actually followed it — the direct test of whether the forecast had any value.
- **Controls**: pause/resume, and a 0.25x–4x speed control (the simulation runs on a virtual tick clock, not wall-clock time, so both apply cleanly).

Run locally:
```bash
cd market-sim/backend
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
./venv/bin/python app.py        # http://127.0.0.1:5000

cd market-sim/frontend
npm install
npm run dev                     # http://127.0.0.1:5173
```
