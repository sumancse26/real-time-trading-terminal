import { create } from 'zustand'

export type ErrorSeverity = 'ERROR' | 'WARN' | 'INFO'

export interface LoggedError {
  id: string
  timestamp: number
  source: string
  severity: ErrorSeverity
  message: string
  details?: unknown
  stack?: string
}

export interface ErrorLogState {
  logs: LoggedError[]
  unreadCount: number
  logError: (source: string, message: string, details?: unknown, severity?: ErrorSeverity, stack?: string) => void
  clearLogs: () => void
  markAllRead: () => void
}

export const useErrorLogStore = create<ErrorLogState>((set) => ({
  logs: [],
  unreadCount: 0,

  logError: (source: string, message: string, details?: unknown, severity: ErrorSeverity = 'ERROR', stack?: string) => {
    const newLog: LoggedError = {
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      source,
      severity,
      message,
      details,
      stack,
    }

    set((state) => ({
      logs: [newLog, ...state.logs].slice(0, 100), // Keep last 100 logs
      unreadCount: state.unreadCount + 1,
    }))
  },

  clearLogs: () => set({ logs: [], unreadCount: 0 }),

  markAllRead: () => set({ unreadCount: 0 }),
}))
