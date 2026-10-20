import React, { useEffect, useRef, useState } from 'react'
import PriceChart from './components/PriceChart.jsx'
import OrderBook from './components/OrderBook.jsx'

const POLL_MS = 400
const SPEEDS = [0.25, 0.5, 1, 2, 4]

export default function App() {
  const [liveState, setLiveState] = useState(null)
  const [keyframes, setKeyframes] = useState([])
  const [scrubIdx, setScrubIdx] = useState(null)
  const [connected, setConnected] = useState(false)
  const prevPrice = useRef(null)
  const lastIdxRef = useRef(-1)

  useEffect(() => {
    let cancelled = false

    async function pollState() {
      try {
        const res = await fetch('/api/state')
        const data = await res.json()
        if (cancelled) return
        setLiveState((old) => {
          prevPrice.current = old ? old.price : null
          return data
        })
        setConnected(true)
      } catch {
        if (!cancelled) setConnected(false)
      }
    }

    async function pollHistory() {
      try {
        const since = lastIdxRef.current
        const url = since >= 0 ? `/api/history?since=${since}` : '/api/history'
        const res = await fetch(url)
        const data = await res.json()
        if (cancelled || !data.keyframes.length) return
        setKeyframes((prev) => {
          const merged = [...prev, ...data.keyframes].slice(-400)
          lastIdxRef.current = merged[merged.length - 1].idx
          return merged
        })
      } catch {
      }
    }

    function pollAll() {
      pollState()
      pollHistory()
    }

    pollAll()
    const id = setInterval(pollAll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  async function togglePause() {
    if (!liveState) return
    await fetch(liveState.paused ? '/api/resume' : '/api/pause', { method: 'POST' })
  }

  async function setSpeed(factor) {
    await fetch('/api/speed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factor }),
    })
  }

  async function doReset() {
    await fetch('/api/reset', { method: 'POST' })
    setKeyframes([])
    lastIdxRef.current = -1
    setScrubIdx(null)
  }

  if (!liveState) {
    return (
      <div className="app">
        <div className="title">
          <span><span className="dot" style={{ background: '#7b8494' }} />MARKET SIMULATOR</span>
        </div>
        <div className="panel">Connecting to backend at :5000 ...</div>
      </div>
    )
  }

  const isLive = scrubIdx === null
  const activeKeyframe = isLive ? null : keyframes.find((k) => k.idx === scrubIdx)

  const bids = isLive ? liveState.bids : activeKeyframe?.bids ?? liveState.bids
  const asks = isLive ? liveState.asks : activeKeyframe?.asks ?? liveState.asks
  const spread = isLive ? liveState.spread : activeKeyframe?.spread ?? liveState.spread
  const spreadBps = isLive ? liveState.spread_bps : activeKeyframe?.spread_bps ?? liveState.spread_bps
  const imbalance = isLive ? liveState.imbalance : activeKeyframe?.imbalance ?? liveState.imbalance
  const sentiment = isLive ? liveState.sentiment : activeKeyframe?.sentiment ?? liveState.sentiment
  const fear = isLive ? liveState.fear : activeKeyframe?.fear ?? liveState.fear
  const displayPrice = isLive ? liveState.price : activeKeyframe?.candle.c ?? liveState.price

  const chartCandles = isLive ? liveState.candles : keyframes.map((k) => k.candle)
  const chartForecast = isLive ? liveState.forecast : activeKeyframe?.forecast ?? []
  const anchorIdx = isLive ? liveState.latest_idx : scrubIdx

  const delta = prevPrice.current != null && isLive ? liveState.price - prevPrice.current : 0
  const deltaClass = delta > 0 ? 'up' : delta < 0 ? 'down' : ''
  const imbalancePct = ((imbalance + 1) / 2) * 100

  const maxIdx = keyframes.length ? keyframes[keyframes.length - 1].idx : 0
  const minIdx = keyframes.length ? keyframes[0].idx : 0

  return (
    <div className="app">
      <div className="title">
        <span><span className="dot" /> MARKET SIMULATOR — order book · imbalance-driven price · forward projection</span>
        <span style={{ color: connected ? 'var(--green)' : 'var(--red)' }}>
          {connected ? 'LIVE' : 'DISCONNECTED'}
        </span>
      </div>

      <div className="controlbar">
        <button className="ctl-btn" onClick={togglePause}>
          {liveState.paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <div className="speed-group">
          <span className="label" style={{ marginRight: 6 }}>Speed</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={`ctl-btn small ${Math.abs(liveState.speed - s) < 0.01 ? 'active' : ''}`}
              onClick={() => setSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>
        <button className="ctl-btn" onClick={doReset}>⟲ Reset</button>

        <div className="scrub-group">
          <span className="label">
            {isLive ? 'LIVE (drag to replay)' : `REPLAY — candle #${scrubIdx} of ${maxIdx}`}
          </span>
          <input
            type="range"
            className="scrubber"
            min={minIdx}
            max={maxIdx}
            value={scrubIdx ?? maxIdx}
            disabled={keyframes.length < 2}
            onChange={(e) => setScrubIdx(Number(e.target.value))}
          />
          {!isLive && (
            <button className="ctl-btn small" onClick={() => setScrubIdx(null)}>⏭ Go Live</button>
          )}
        </div>
      </div>

      <div className="statsbar">
        <div className="stat">
          <span className="label">Price</span>
          <span className={`value ${deltaClass}`}>{displayPrice.toFixed(2)}</span>
        </div>
        <div className="stat">
          <span className="label">Spread</span>
          <span className="value">{spread.toFixed(2)} <small style={{ color: 'var(--text-dim)' }}>({spreadBps} bps)</small></span>
        </div>
        <div className="stat" style={{ minWidth: 140 }}>
          <span className="label">Book Imbalance (bid vs ask)</span>
          <div className="imbalance-bar">
            <div className="fill" style={{ width: `${imbalancePct}%` }} />
          </div>
        </div>
        <div className="stat">
          <span className="label">Sentiment</span>
          <span className={`value ${sentiment > 0 ? 'up' : sentiment < 0 ? 'down' : ''}`}>
            {sentiment.toFixed(2)}
          </span>
        </div>
        <div className="stat">
          <span className="label">Fear (spread stress)</span>
          <span className="value">{fear.toFixed(2)}</span>
        </div>
      </div>

      <div className="main-grid">
        <div className="panel">
          <h3>
            <span>Price · Volume</span>
            <span className="legend">
              <span><span className="swatch" style={{ background: 'var(--green)' }} />up</span>
              <span><span className="swatch" style={{ background: 'var(--red)' }} />down</span>
              <span><span className="swatch" style={{ background: 'var(--forecast)', opacity: 0.5 }} />projected</span>
            </span>
          </h3>
          <PriceChart candles={chartCandles} forecast={chartForecast} anchorIdx={anchorIdx} />
          <p className="footer-note">
            {isLive
              ? 'Candles right of the dashed line are a live stochastic projection, re-simulated every tick from the current drift & volatility estimate. Drag the scrubber above to freeze on a past candle and see the forecast that was made there overlaid against the real candles that actually followed — that overlay is the real test of whether it\'s any good.'
              : 'Dashed gray outlines are the forecast archived at this candle; solid colored candles to the right of it are what actually happened afterwards. Compare them directly to judge forecast usefulness.'}
          </p>
        </div>

        <div className="panel">
          <h3><span>Order Book</span></h3>
          <OrderBook bids={bids} asks={asks} />
        </div>
      </div>
    </div>
  )
}
