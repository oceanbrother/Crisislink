import React from 'react'
import '../styles/WorkspaceShell.css'

const WorkspaceContextCard = ({ label, value, supportingText = '', icon = 'info', className = '' }) => {
  return (
    <div className={`workspace-context-card ${className}`.trim()}>
      <div className="workspace-context-card__badge">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="workspace-context-card__copy">
        <span className="workspace-context-card__label">{label}</span>
        <span className="workspace-context-card__value">{value}</span>
        {supportingText ? <span className="workspace-context-card__supporting">{supportingText}</span> : null}
      </div>
    </div>
  )
}

export default WorkspaceContextCard
