import React from 'react'

export default function OrderBook({ bids, asks }) {
  const maxVol = Math.max(...bids.map((b) => b.volume), ...asks.map((a) => a.volume), 1)
  const asksDesc = [...asks].reverse()

  return (
    <div>
      {asksDesc.map((lvl, i) => (
        <div className="book-row ask" key={`a${i}`}>
          <div className="book-bar" style={{ width: `${(lvl.volume / maxVol) * 100}%` }} />
          <div className="book-price" style={{ color: 'var(--red)' }}>{lvl.price.toFixed(2)}</div>
          <div className="book-vol">{lvl.volume.toFixed(0)}</div>
        </div>
      ))}
      <div className="spread-divider">spread</div>
      {bids.map((lvl, i) => (
        <div className="book-row bid" key={`b${i}`}>
          <div className="book-bar" style={{ width: `${(lvl.volume / maxVol) * 100}%` }} />
          <div className="book-price" style={{ color: 'var(--green)' }}>{lvl.price.toFixed(2)}</div>
          <div className="book-vol">{lvl.volume.toFixed(0)}</div>
        </div>
      ))}
    </div>
  )
}
