import React, { useEffect, useRef, useState } from 'react'

export interface NumberFlashProps {
  /** The numeric value to display */
  value: number
  /** Format callback — defaults to 2dp string */
  format?: (v: number) => string
  /** Extra className forwarded to the span */
  className?: string
  /** If true, text color reflects price direction (buy-green / sell-red) */
  colorize?: boolean
}

/**
 * NumberFlash — renders a number that briefly flashes green or red
 * whenever the value changes direction.
 *
 * Implementation note: we track direction in state (not by reading prevRef during
 * render) to satisfy react-hooks/refs lint rule. The prevRef is only read inside
 * the useEffect (not during render), satisfying the rule correctly.
 */
export const NumberFlash: React.FC<NumberFlashProps> = ({
  value,
  format = v => v.toFixed(2),
  className = '',
  colorize = false,
}) => {
  const prevRef = useRef<number>(value)
  const [flashClass, setFlashClass] = useState<string>('')
  // Track last known direction as state so it's available during render without touching ref
  const [direction, setDirection] = useState<'up' | 'down' | 'flat'>('flat')

  useEffect(() => {
    const prev = prevRef.current
    if (value === prev) return

    const isUp = value > prev
    setDirection(isUp ? 'up' : 'down')
    setFlashClass(isUp ? 'flash-buy-anim' : 'flash-sell-anim')
    prevRef.current = value

    // Remove animation class after it completes so it can re-trigger
    const timer = setTimeout(() => setFlashClass(''), 450)
    return () => clearTimeout(timer)
  }, [value])

  const colorClass = colorize
    ? direction === 'up'
      ? 'text-buy'
      : direction === 'down'
        ? 'text-sell'
        : ''
    : ''

  return (
    <span className={`${flashClass} ${colorClass} ${className}`.trim()}>
      {format(value)}
    </span>
  )
}
