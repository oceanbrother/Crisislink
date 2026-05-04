import React from 'react'
import '../styles/WorkspaceShell.css'

const WorkspaceSummaryCard = ({ role = 'org', title, subtitle = '', action = null, context = null, children = null, className = '' }) => {
  return (
    <section className={`workspace-summary-card workspace-summary-card--${role} ${className}`.trim()}>
      <div className="workspace-summary-card__header">
        <div className="workspace-summary-card__heading">
          <h1 className="workspace-summary-card__title">{title}</h1>
          {subtitle ? <p className="workspace-summary-card__subtitle">{subtitle}</p> : null}
        </div>
        {action ? <div className="workspace-summary-card__action">{action}</div> : null}
      </div>

      {context ? <div className="workspace-summary-card__context">{context}</div> : null}
      {children ? <div className="workspace-summary-card__body">{children}</div> : null}
    </section>
  )
}

export default WorkspaceSummaryCard
