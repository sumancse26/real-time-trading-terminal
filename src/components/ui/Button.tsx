import React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'buy' | 'sell' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded transition-all focus:outline-none focus:ring-1 select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

  return (
    <button
      className={`btn btn-${variant} btn-${size} ${baseStyles} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <span className="spinner-sm" /> : children}
    </button>
  )
}
