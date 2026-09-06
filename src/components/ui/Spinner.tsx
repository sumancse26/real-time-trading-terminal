import React from 'react'

export interface SpinnerProps {
  size?: 'sm' | 'md'
  className?: string
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'sm', className = '' }) => {
  return <span className={`spinner-${size} ${className}`} role="status" aria-label="Loading" />
}
