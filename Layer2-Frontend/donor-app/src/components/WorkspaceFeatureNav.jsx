import React from 'react'
import '../styles/WorkspaceShell.css'

const WorkspaceFeatureNav = ({ role = 'org', ariaLabel = 'Workspace navigation', items = [] }) => {
  return (
    <section
      className={`workspace-feature-nav workspace-feature-nav--${role}`.trim()}
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`workspace-feature-nav__button ${item.active ? 'is-active' : ''}`.trim()}
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </section>
  )
}

export default WorkspaceFeatureNav
