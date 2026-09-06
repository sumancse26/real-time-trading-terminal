export type AccountType = 'SPOT' | 'MARGIN' | 'FUTURES'

export interface AssetBalance {
  asset: string
  free: number
  locked: number
  total: number
  borrowed?: number
  interest?: number
  usdValue?: number
}

export interface AccountSummary {
  accountId: string
  accountType: AccountType
  totalEquity: number
  availableMargin: number
  initialMargin: number
  maintenanceMargin: number
  unrealizedPnl: number
  marginRatio: number
  balances: AssetBalance[]
  canTrade: boolean
  canWithdraw: boolean
  updateTime: number
}
