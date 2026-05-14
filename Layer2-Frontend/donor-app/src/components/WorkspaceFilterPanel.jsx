import React from 'react'
import '../styles/WorkspaceShell.css'

const WorkspaceFilterPanel = ({ role = 'org', className = '', children }) => {
  return (
    // Shared shell keeps donor/org filter layout identical while allowing theme variants.
    <section className={`workspace-filter-panel workspace-filter-panel--${role} ${className}`.trim()}>
      <div className="workspace-filter-panel__inner">{children}</div>
    </section>
  )
}

export default WorkspaceFilterPanel
