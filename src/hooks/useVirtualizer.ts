import { useState, useCallback, useRef, useEffect, useMemo } from 'react'

export interface VirtualItem {
  index: number
  start: number
  size: number
}

export interface UseVirtualizerOptions {
  count: number
  itemHeight: number
  overscan?: number
  containerRef: React.RefObject<HTMLElement | null>
}

export interface VirtualizerResult {
  virtualItems: VirtualItem[]
  totalSize: number
  startIndex: number
  endIndex: number
  visibleCount: number
  scrollToIndex: (index: number) => void
  scrollTop: number
  scrollVelocity: number
}

/**
 * High-Performance Row Virtualizer Hook
 * Renders only the visible window of rows in the DOM plus overscan buffers.
 * Scales seamlessly to 100,000+ items with constant O(1) DOM memory footprint.
 */
export function useVirtualizer({
  count,
  itemHeight,
  overscan = 4,
  containerRef,
}: UseVirtualizerOptions): VirtualizerResult {
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(400)
  const [scrollVelocity, setScrollVelocity] = useState(0)

  const lastScrollTimeRef = useRef(0)
  const lastScrollTopRef = useRef(0)
  const velocityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Measure container height with ResizeObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    setContainerHeight(container.clientHeight || 400)

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.height > 0) {
            setContainerHeight(entry.contentRect.height)
          }
        }
      })

      observer.observe(container)
      return () => observer.disconnect()
    }
  }, [containerRef])

  // Scroll event handler with velocity tracking
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const currentScrollTop = container.scrollTop
    const now = Date.now()
    const dt = Math.max(1, now - lastScrollTimeRef.current)
    const dy = Math.abs(currentScrollTop - lastScrollTopRef.current)
    const velocity = Math.round((dy / dt) * 1000) // px/sec

    lastScrollTopRef.current = currentScrollTop
    lastScrollTimeRef.current = now

    setScrollTop(currentScrollTop)
    setScrollVelocity(velocity)

    if (velocityTimeoutRef.current) {
      clearTimeout(velocityTimeoutRef.current)
    }
    velocityTimeoutRef.current = setTimeout(() => {
      setScrollVelocity(0)
    }, 150)
  }, [containerRef])

  // Attach native passive scroll listener for 60fps scrolling
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [containerRef, handleScroll])

  const { startIndex, endIndex, virtualItems } = useMemo(() => {
    if (count <= 0 || itemHeight <= 0) {
      return { startIndex: 0, endIndex: 0, virtualItems: [] }
    }

    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const end = Math.min(count, Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan)

    const items: VirtualItem[] = []
    for (let i = start; i < end; i++) {
      items.push({
        index: i,
        start: i * itemHeight,
        size: itemHeight,
      })
    }

    return {
      startIndex: start,
      endIndex: end,
      virtualItems: items,
    }
  }, [count, itemHeight, overscan, scrollTop, containerHeight])

  const totalSize = count * itemHeight
  const visibleCount = virtualItems.length

  const scrollToIndex = useCallback(
    (index: number) => {
      const container = containerRef.current
      if (!container) return
      const targetScroll = Math.max(0, Math.min(index * itemHeight, totalSize - containerHeight))
      container.scrollTop = targetScroll
    },
    [containerRef, itemHeight, totalSize, containerHeight]
  )

  return {
    virtualItems,
    totalSize,
    startIndex,
    endIndex,
    visibleCount,
    scrollToIndex,
    scrollTop,
    scrollVelocity,
  }
}
