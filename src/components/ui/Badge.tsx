import React from 'react'

export interface BadgeProps {
  children: React.ReactNode
  variant?: 'buy' | 'sell' | 'cyan' | 'neutral' | 'warning'
  size?: 'sm' | 'md'
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
}) => {
  return <span className={`badge badge-${variant} badge-${size} ${className}`}>{children}</span>
}
