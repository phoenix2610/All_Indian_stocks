import math
import random
import threading
import time

TICK_SECONDS = 0.2
CANDLE_TICKS = 15
NUM_LEVELS = 10
TICK_SIZE = 0.05
BASE_LEVEL_VOLUME = 500.0
MAX_HISTORY_CANDLES = 300
FORECAST_CANDLES = 15


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


class MarketSimulator:
    def __init__(self, start_price=1000.0, seed=None):
        self._rng = random.Random(seed)
        self._lock = threading.Lock()

        self.price = start_price
        self.spread = TICK_SIZE * 4
        self.sentiment = 0.0
        self.fear = 0.0

        self.bids = []
        self.asks = []
        self._init_book()

        self._candle_seq = 0
        self._ticks_since_candle_start = 0
        self.current_candle = self._new_candle(self.price, self._candle_seq)
        self.candles = []
        self.history = []
        self.returns = []

        self.paused = False
        self.speed = 1.0

        self._running = False
        self._thread = None

    def _init_book(self):
        mid = self.price
        for i in range(NUM_LEVELS):
            bid_price = round(mid - self.spread / 2 - i * TICK_SIZE, 2)
            ask_price = round(mid + self.spread / 2 + i * TICK_SIZE, 2)
            decay = math.exp(-i / 4.0)
            self.bids.append({"price": bid_price, "volume": BASE_LEVEL_VOLUME * decay})
            self.asks.append({"price": ask_price, "volume": BASE_LEVEL_VOLUME * decay})

    def _new_candle(self, price, idx):
        return {"idx": idx, "t": idx * CANDLE_TICKS * TICK_SECONDS,
                "o": price, "h": price, "l": price, "c": price, "v": 0.0}

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False

    def set_paused(self, paused):
        self.paused = bool(paused)

    def set_speed(self, factor):
        self.speed = clamp(float(factor), 0.1, 8.0)

    def _run_loop(self):
        while self._running:
            if not self.paused:
                self.tick()
                time.sleep(TICK_SECONDS / self.speed)
            else:
                time.sleep(0.1)

    def tick(self):
        with self._lock:
            self._replenish_liquidity()
            traded_volume = self._maybe_market_order()
            self._update_sentiment()
            self._decay_fear()
            self._recompute_mid_and_spread()
            self._roll_candle(traded_volume)

    def _replenish_liquidity(self):
        for i, lvl in enumerate(self.bids):
            target = BASE_LEVEL_VOLUME * math.exp(-i / 4.0)
            lvl["volume"] = clamp(
                lvl["volume"] + 0.15 * (target - lvl["volume"]) + self._rng.uniform(-25, 25),
                0, target * 3
            )
        for i, lvl in enumerate(self.asks):
            target = BASE_LEVEL_VOLUME * math.exp(-i / 4.0)
            lvl["volume"] = clamp(
                lvl["volume"] + 0.15 * (target - lvl["volume"]) + self._rng.uniform(-25, 25),
                0, target * 3
            )

    def _update_sentiment(self):
        self.sentiment += -0.02 * self.sentiment + self._rng.gauss(0, 0.02)
        if self._rng.random() < 0.01:
            self.sentiment += self._rng.uniform(-0.6, 0.6)
        self.sentiment = clamp(self.sentiment, -1.0, 1.0)

    def _decay_fear(self):
        self.fear *= 0.9

    def _maybe_market_order(self):
        traded_volume = 0.0
        if self._rng.random() > 0.55:
            return traded_volume

        p_buy = 0.5 + 0.35 * self.sentiment
        side = "buy" if self._rng.random() < p_buy else "sell"

        size = self._rng.expovariate(1 / 120.0)
        if self._rng.random() < 0.05:
            size *= self._rng.uniform(4, 9)

        book = self.asks if side == "buy" else self.bids
        remaining = size
        levels_consumed = 0
        for lvl in book:
            if remaining <= 0:
                break
            take = min(lvl["volume"], remaining)
            lvl["volume"] -= take
            remaining -= take
            traded_volume += take
            if lvl["volume"] < 1e-6:
                levels_consumed += 1

        if levels_consumed > 0:
            self.fear = clamp(self.fear + 0.15 * levels_consumed, 0, 1.5)
            shift = levels_consumed * TICK_SIZE
            if side == "buy":
                self.price += shift * self._rng.uniform(0.6, 1.0)
            else:
                self.price -= shift * self._rng.uniform(0.6, 1.0)

        return traded_volume

    def _recompute_mid_and_spread(self):
        base_spread = TICK_SIZE * 4 * (1 + self.fear)
        noise = self._rng.gauss(0, 0.01) * (1 + abs(self.sentiment))
        self.price = round(self.price + noise, 2)
        self.spread = round(base_spread, 2)

        for i, lvl in enumerate(self.bids):
            lvl["price"] = round(self.price - self.spread / 2 - i * TICK_SIZE, 2)
        for i, lvl in enumerate(self.asks):
            lvl["price"] = round(self.price + self.spread / 2 + i * TICK_SIZE, 2)

    def _roll_candle(self, traded_volume):
        c = self.current_candle
        c["h"] = max(c["h"], self.price)
        c["l"] = min(c["l"], self.price)
        c["c"] = self.price
        c["v"] += traded_volume

        self._ticks_since_candle_start += 1
        if self._ticks_since_candle_start >= CANDLE_TICKS:
            if c["o"] > 0:
                self.returns.append(math.log(max(c["c"], 1e-6) / max(c["o"], 1e-6)))
                self.returns = self.returns[-40:]

            self.candles.append(c)
            self.history.append(self._make_keyframe(c))
            self.candles = self.candles[-MAX_HISTORY_CANDLES:]
            self.history = self.history[-MAX_HISTORY_CANDLES:]

            self._candle_seq += 1
            self._ticks_since_candle_start = 0
            self.current_candle = self._new_candle(self.price, self._candle_seq)

    def _make_keyframe(self, candle):
        total_bid = sum(l["volume"] for l in self.bids)
        total_ask = sum(l["volume"] for l in self.asks)
        imbalance = 0.0
        if total_bid + total_ask > 0:
            imbalance = (total_bid - total_ask) / (total_bid + total_ask)
        return {
            "idx": candle["idx"],
            "candle": dict(candle),
            "bids": [{"price": l["price"], "volume": round(l["volume"], 1)} for l in self.bids],
            "asks": [{"price": l["price"], "volume": round(l["volume"], 1)} for l in self.asks],
            "spread": round(self.spread, 2),
            "spread_bps": round((self.spread / self.price) * 10000, 1) if self.price else 0,
            "imbalance": round(imbalance, 4),
            "sentiment": round(self.sentiment, 4),
            "fear": round(self.fear, 4),
            "forecast": self._forecast(from_price=candle["c"], start_idx=candle["idx"]),
        }

    def _forecast(self, from_price=None, start_idx=None):
        if len(self.returns) >= 5:
            mean_r = sum(self.returns) / len(self.returns)
            var_r = sum((r - mean_r) ** 2 for r in self.returns) / len(self.returns)
            vol = math.sqrt(max(var_r, 1e-10))
        else:
            mean_r = 0.0
            vol = 0.005

        drift = clamp(mean_r + 0.002 * self.sentiment, -0.02, 0.02)
        price = from_price if from_price is not None else self.price
        idx = (start_idx if start_idx is not None else self._candle_seq)
        out = []
        for _ in range(FORECAST_CANDLES):
            idx += 1
            o = price
            steps = 4
            path = [o]
            for _ in range(steps):
                shock = self._rng.gauss(0, vol / math.sqrt(steps))
                path.append(path[-1] * math.exp(drift / steps + shock))
            c = path[-1]
            h = max(path)
            l = min(path)
            out.append({"idx": idx, "o": round(o, 2), "h": round(h, 2),
                        "l": round(l, 2), "c": round(c, 2), "v": 0.0})
            price = c
        return out

    def get_state(self):
        with self._lock:
            total_bid = sum(l["volume"] for l in self.bids)
            total_ask = sum(l["volume"] for l in self.asks)
            imbalance = 0.0
            if total_bid + total_ask > 0:
                imbalance = (total_bid - total_ask) / (total_bid + total_ask)

            best_bid = self.bids[0]["price"]
            best_ask = self.asks[0]["price"]

            return {
                "price": round(self.price, 2),
                "best_bid": best_bid,
                "best_ask": best_ask,
                "spread": round(best_ask - best_bid, 2),
                "spread_bps": round(((best_ask - best_bid) / self.price) * 10000, 1) if self.price else 0,
                "imbalance": round(imbalance, 4),
                "sentiment": round(self.sentiment, 4),
                "fear": round(self.fear, 4),
                "bids": [{"price": l["price"], "volume": round(l["volume"], 1)} for l in self.bids],
                "asks": [{"price": l["price"], "volume": round(l["volume"], 1)} for l in self.asks],
                "candles": self.candles[-90:] + [self.current_candle],
                "forecast": self._forecast(),
                "paused": self.paused,
                "speed": self.speed,
                "latest_idx": self.current_candle["idx"],
            }

    def get_history(self, since=None):
        with self._lock:
            if since is None:
                items = self.history[-MAX_HISTORY_CANDLES:]
            else:
                items = [k for k in self.history if k["idx"] > since]
            return {
                "keyframes": items,
                "earliest_idx": self.history[0]["idx"] if self.history else None,
                "latest_idx": self.history[-1]["idx"] if self.history else None,
            }
