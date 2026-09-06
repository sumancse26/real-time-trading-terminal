import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from '../App'

describe('Trading Terminal App', () => {
  it('renders the complete trading terminal layout', () => {
    render(<App />)

    expect(screen.getByTestId('app-container')).toBeInTheDocument()
    expect(screen.getByTestId('terminal-header')).toBeInTheDocument()
    expect(screen.getByTestId('telemetry-bar')).toBeInTheDocument()
    expect(screen.getByTestId('order-entry-form')).toBeInTheDocument()
    expect(screen.getByTestId('positions-view')).toBeInTheDocument()
    expect(screen.getByText('NEXUS')).toBeInTheDocument()
  })

  it('renders the watchlist panel as part of the 4-column layout', () => {
    render(<App />)

    expect(screen.getByTestId('watchlist-panel')).toBeInTheDocument()
    // BTC/USDT is active by default in the watchlist
    expect(screen.getByTestId('watchlist-item-BTC')).toBeInTheDocument()
  })
})
