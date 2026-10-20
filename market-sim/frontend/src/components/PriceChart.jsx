import React from 'react'

const WIDTH = 900
const HEIGHT = 340
const VOL_HEIGHT = 70
const PAD = 24
const LOOKBACK = 60

export default function PriceChart({ candles, forecast, anchorIdx }) {
  if (anchorIdx == null) return null

  const byIdx = new Map(candles.map((c) => [c.idx, c]))
  const forecastByIdx = new Map(forecast.map((c) => [c.idx, c]))

  const windowStart = anchorIdx - LOOKBACK
  const windowEnd = anchorIdx + Math.max(forecast.length, 1)
  const n = windowEnd - windowStart + 1

  const slots = []
  for (let idx = windowStart; idx <= windowEnd; idx++) {
    slots.push({ idx, real: byIdx.get(idx), forecast: forecastByIdx.get(idx) })
  }

  const present = slots.filter((s) => s.real || s.forecast)
  if (present.length === 0) return null

  const highs = present.flatMap((s) => [s.real?.h, s.forecast?.h].filter((v) => v != null))
  const lows = present.flatMap((s) => [s.real?.l, s.forecast?.l].filter((v) => v != null))
  const maxP = Math.max(...highs)
  const minP = Math.min(...lows)
  const range = Math.max(maxP - minP, 0.01)
  const maxV = Math.max(...present.map((s) => s.real?.v || 0), 1)

  const slot = (WIDTH - PAD * 2) / n
  const bodyW = Math.max(2, slot * 0.6)

  const yFor = (price) => PAD + (HEIGHT - PAD * 2) * (1 - (price - minP) / range)
  const yForVol = (v) => VOL_HEIGHT * (v / maxV)
  const xFor = (idx) => PAD + (idx - windowStart) * slot + slot / 2

  const nowX = xFor(anchorIdx) + slot / 2

  return (
    <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT + VOL_HEIGHT + 20}`} preserveAspectRatio="xMidYMid meet">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = PAD + (HEIGHT - PAD * 2) * f
        const price = maxP - range * f
        return (
          <g key={f}>
            <line x1={PAD} x2={WIDTH - PAD} y1={y} y2={y} stroke="#1f2733" strokeWidth="1" />
            <text x={WIDTH - PAD + 4} y={y + 3} fontSize="9" fill="#7b8494">
              {price.toFixed(2)}
            </text>
          </g>
        )
      })}

      <line x1={nowX} x2={nowX} y1={PAD} y2={HEIGHT - PAD} stroke="#5b8cff" strokeWidth="1" strokeDasharray="3,3" />
      <text x={nowX + 4} y={PAD + 10} fontSize="9" fill="#5b8cff">
        {'NOW'}
      </text>

      {slots.map(({ idx, real, forecast: f }) => {
        const x = xFor(idx)
        return (
          <g key={idx}>
            {real && (
              <g>
                <line
                  x1={x} x2={x}
                  y1={yFor(real.h)} y2={yFor(real.l)}
                  stroke={real.c >= real.o ? '#26a69a' : '#ef5350'} strokeWidth="1"
                />
                <rect
                  x={x - bodyW / 2}
                  y={yFor(Math.max(real.o, real.c))}
                  width={bodyW}
                  height={Math.max(1, yFor(Math.min(real.o, real.c)) - yFor(Math.max(real.o, real.c)))}
                  fill={real.c >= real.o ? '#26a69a' : '#ef5350'}
                />
                <rect
                  x={x - bodyW / 2}
                  y={HEIGHT + 20 + (VOL_HEIGHT - yForVol(real.v))}
                  width={bodyW}
                  height={yForVol(real.v)}
                  fill={real.c >= real.o ? '#26a69a' : '#ef5350'}
                  opacity="0.6"
                />
              </g>
            )}
            {f && (
              <g opacity="0.85">
                <line
                  x1={x} x2={x}
                  y1={yFor(f.h)} y2={yFor(f.l)}
                  stroke="#9aa5b1" strokeWidth="1.5" strokeDasharray="2,2"
                />
                <rect
                  x={x - bodyW / 2}
                  y={yFor(Math.max(f.o, f.c))}
                  width={bodyW}
                  height={Math.max(1, yFor(Math.min(f.o, f.c)) - yFor(Math.max(f.o, f.c)))}
                  fill="none"
                  stroke="#9aa5b1"
                  strokeWidth="1.5"
                  strokeDasharray="2,2"
                />
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}
