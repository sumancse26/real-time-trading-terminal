import React, { memo } from 'react'
import { useMarketStore, useTicker, useIsFavorite } from '@/core/store/useMarketStore'
import { NumberFlash } from '@/components/ui/NumberFlash'
import { formatPrice, formatPercent } from '@/utils/formatters'
import { Star } from 'lucide-react'

export interface WatchlistItemProps {
  symbol: string
  isActive: boolean
  onSelect: (symbol: string) => void
}

export const WatchlistItem: React.FC<WatchlistItemProps> = memo(({ symbol, isActive, onSelect }) => {
  const ticker = useTicker(symbol)
  const isFav = useIsFavorite(symbol)
  const toggleFavorite = useMarketStore(state => state.toggleFavorite)

  if (!ticker) return null

  const isPositive = ticker.priceChangePercent24h >= 0

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFavorite(symbol)
  }

  return (
    <div
      className={`watchlist-item ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(symbol)}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onKeyDown={e => e.key === 'Enter' && onSelect(symbol)}
      data-testid={`watchlist-item-${ticker.baseAsset}`}
    >
      <button
        type="button"
        className={`watchlist-fav-btn ${isFav ? 'fav-active' : ''}`}
        onClick={handleFavoriteClick}
        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
        aria-label={`Favorite ${symbol}`}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          marginRight: '6px',
          color: isFav ? 'var(--gold, #fbbf24)' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Star size={11} fill={isFav ? 'currentColor' : 'none'} />
      </button>

      <span className="watchlist-symbol">
        {ticker.baseAsset}
        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/{ticker.quoteAsset}</span>
      </span>

      <span className={`watchlist-price ${isPositive ? 'text-buy' : 'text-sell'}`}>
        <NumberFlash value={ticker.lastPrice} format={v => formatPrice(v)} />
      </span>

      <span className="watchlist-market">PERP</span>

      <span className={`watchlist-change ${isPositive ? 'text-buy' : 'text-sell'}`}>
        {formatPercent(ticker.priceChangePercent24h, { includeSign: true, decimals: 2 })}
      </span>
    </div>
  )
})

WatchlistItem.displayName = 'WatchlistItem'
