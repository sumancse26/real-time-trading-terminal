import React from 'react'

export interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * CSS-only tooltip — no JS portals, no external deps.
 * Shows on hover via the `.tooltip-wrapper:hover .tooltip-box` rule in index.css.
 */
export const Tooltip: React.FC<TooltipProps> = ({ content, children, className = '' }) => {
  return (
    <span className={`tooltip-wrapper ${className}`}>
      {children}
      <span className="tooltip-box" role="tooltip">
        {content}
      </span>
    </span>
  )
}
