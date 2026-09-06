import React from 'react'

export interface CardProps {
  children: React.ReactNode
  title?: React.ReactNode
  headerAction?: React.ReactNode
  className?: string
}

export const Card: React.FC<CardProps> = ({ children, title, headerAction, className = '' }) => {
  return (
    <div className={`terminal-panel ${className}`}>
      {title && (
        <div className="panel-header">
          <div className="panel-title">{title}</div>
          {headerAction && <div className="panel-actions">{headerAction}</div>}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </div>
  )
}
