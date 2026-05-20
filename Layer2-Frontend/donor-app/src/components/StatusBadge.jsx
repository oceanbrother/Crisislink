import React from 'react'
import '../styles/StatusBadge.css'

const DEFAULT_LABELS = {
  available: 'Available',
  claimed:   'Claimed',
  collected: 'Collected',
  expired:   'Expired',
  posted:    'Posted',
}

const ICONS = {
  available: 'check_circle',
  claimed:   'schedule',
  collected: 'task_alt',
  expired:   'event_busy',
  posted:    'campaign',
}

// Renders a coloured badge showing the current listing status
const StatusBadge = ({
  status = 'available',
  label,
  className = '',
  variant = 'default',
  showIcon = true,
}) => {
  const safeStatus = ICONS[status] ? status : 'available'
  const text = label || DEFAULT_LABELS[safeStatus]

  return (
    <span
      className={`status-badge status-badge--${safeStatus} status-badge--${variant} ${className}`.trim()}
      role="status"
    >
      {showIcon ? (
        <span className="status-badge__icon material-symbols-outlined" aria-hidden="true">
          {ICONS[safeStatus]}
        </span>
      ) : null}
      <span className="status-badge__label">{text}</span>
    </span>
  )
}

export default StatusBadge
