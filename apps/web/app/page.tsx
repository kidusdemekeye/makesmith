'use client'

import { FormEvent, useState } from 'react'
import { designIdea, DesignResponse } from '../lib/api'
import { RESULT_TABS, ResultTabId } from '../lib/tabs'

const PLACEHOLDERS: Record<Exclude<ResultTabId, 'design'>, { eyebrow: string; title: string; description: string }> = {
  parts: { eyebrow: 'NEXT IN THE WORKFLOW', title: 'Parts grounded in real sources', description: 'Exact components, specifications, and search links will be collected here after research is added.' },
  manual: { eyebrow: 'ASSEMBLY GUIDE', title: 'A clear path from box to build', description: 'Assembly steps, tools, and common mistakes will be organized here for your design.' },
  files: { eyebrow: 'CUSTOM GEOMETRY', title: 'Parts you can make', description: 'Custom part files and a full assembly viewer will appear here when CAD generation is connected.' },
  checks: { eyebrow: 'ENGINEERING REVIEW', title: 'Know what needs a second look', description: 'Power, weight, fit, and basic strength checks will be gathered here as the design develops.' },
  simulation: { eyebrow: 'VIRTUAL TESTING', title: 'Try the design before you build', description: 'Project-specific simulation results and their confidence will be shown here when simulation is connected.' },
}

function countLabel(count: number, item: string) {
  return `${count} ${item}${count === 1 ? '' : 's'}`
}

export default function Home() {
  const [idea, setIdea] = useState('')
  const [activeTab, setActiveTab] = useState<ResultTabId>('design')
  const [result, setResult] = useState<DesignResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!idea.trim()) {
      setError('Start with a description of the thing you want to make.')
      return
    }
    setLoading(true)
    setError('')
    setActiveTab('design')
    try {
      setResult(await designIdea(idea.trim()))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not generate a design. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const design = result?.design

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Makesmith home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>makesmith<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-meta"><span className="status-dot" /> DSU IGNITE <span className="meta-divider">/</span> HARDWARE STUDIO</div>
        <a className="topbar-link" href="#workspace">YOUR WORKSPACE <span aria-hidden="true">↗</span></a>
      </header>

      <section className="intro" id="top">
        <div className="intro-copy">
          <div className="eyebrow"><span>01</span> IDEAS INTO HARDWARE</div>
          <h1>Make the thing<br /><em>you imagine.</em></h1>
          <p className="intro-text">Describe what you want to build. Makesmith turns a first thought into a practical plan, one clear step at a time.</p>
        </div>
        <div className="intro-aside" aria-label="A better way to begin">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
          <div className="orbit-core"><span aria-hidden="true">✳</span></div>
          <span className="orbit-tag tag-top">IDEA</span><span className="orbit-tag tag-right">DESIGN</span><span className="orbit-tag tag-bottom">BUILD</span>
          <span className="orbit-caption">A better way to begin</span>
        </div>
      </section>

      <section className="workspace" id="workspace">
        <div className="section-heading">
          <div><div className="eyebrow"><span>01 / INPUT</span></div><h2>What are you making?</h2></div>
          <div className="session-note"><span className="session-icon">⌁</span> ONE IDEA AT A TIME</div>
        </div>
        <form className="idea-form" onSubmit={handleSubmit}>
          <label htmlFor="idea" className="sr-only">Describe your hardware idea</label>
          <textarea id="idea" name="idea" value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="A compact indoor garden that waters itself when the soil gets dry..." maxLength={5000} rows={3} aria-describedby="idea-hint" disabled={loading} />
          <div className="form-footer">
            <span id="idea-hint" className="form-hint">Start broad. You can refine the details as you go.</span>
            <div className="submit-row"><span className="character-count">{idea.length.toLocaleString()} / 5,000</span>
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? <><span className="spinner" /> Working...</> : <>Draft my design <span aria-hidden="true">↗</span></>}
              </button>
            </div>
          </div>
        </form>
        {error && <p className="error-message" role="alert"><span aria-hidden="true">!</span> {error}</p>}

        <div className="result-heading">
          <div><div className="eyebrow"><span>02 / YOUR BUILD PLAN</span></div><h2>Project workspace</h2></div>
          {design && <div className="result-summary"><span className="status-dot" /> DESIGN READY <span className="meta-divider">/</span> {result.cached ? 'FROM CACHE' : 'OPENAI'}</div>}
        </div>
        <div className="workspace-card">
          <div className="tabs" role="tablist" aria-label="Project workspaces">
            {RESULT_TABS.map((tab) => <button className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`} id={`tab-${tab.id}`} key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls="tab-panel" onClick={() => setActiveTab(tab.id)}><span className="tab-number">{tab.number}</span>{tab.label}</button>)}
          </div>
          <section className="tab-panel" id="tab-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
            {activeTab === 'design' ? design ? (
              <div className="design-content">
                <div className="design-title-row"><div><div className="eyebrow"><span>DESIGN OVERVIEW</span></div><h3>{design.summary || design.idea}</h3></div><span className="concept-badge">FIRST PASS</span></div>
                <p className="idea-echo">Based on: “{design.idea}”</p>
                <div className="design-grid">
                  <article className="detail-card">
                    <div className="detail-head"><span className="detail-index">A</span><h4>Core components</h4><span className="detail-count">{countLabel(design.components.length, 'item')}</span></div>
                    {design.components.length ? <ul className="component-list">{design.components.map((component, index) => <li key={`${component.name}-${index}`}><span className="list-bullet">{String(index + 1).padStart(2, '0')}</span><span><strong>{component.name}</strong><small>{component.purpose}</small></span></li>)}</ul> : <p className="empty-detail">No components were returned in this first pass.</p>}
                  </article>
                  <article className="detail-card">
                    <div className="detail-head"><span className="detail-index">B</span><h4>Connections</h4><span className="detail-count">{countLabel(design.connections.length, 'link')}</span></div>
                    {design.connections.length ? <ul className="plain-list">{design.connections.map((connection, index) => <li key={`${connection.from}-${connection.to}-${index}`}><strong>{connection.from}</strong><span className="arrow">→</span><strong>{connection.to}</strong><small>{connection.description}</small></li>)}</ul> : <p className="empty-detail">Connection details will be added as the plan develops.</p>}
                  </article>
                  <article className="detail-card"><div className="detail-head"><span className="detail-index">C</span><h4>Power notes</h4></div><dl className="spec-list">{Object.entries(design.power).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{value || '—'}</dd></div>)}</dl></article>
                  <article className="detail-card"><div className="detail-head"><span className="detail-index">D</span><h4>Envelope</h4></div><dl className="spec-list">{Object.entries(design.dimensions).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value || '—'}</dd></div>)}</dl></article>
                  <article className="detail-card preliminary-parts">
                    <div className="detail-head"><span className="detail-index">E</span><h4>Preliminary part ideas · not yet researched</h4><span className="detail-count">{countLabel(design.parts.length, 'item')}</span></div>
                    {design.parts.length ? <ul className="component-list">{design.parts.map((part, index) => <li key={`${part.name}-${index}`}><span className="list-bullet">{String(index + 1).padStart(2, '0')}</span><span><strong>{part.name || 'Unnamed part'}</strong><small>{[part.manufacturer, part.model].filter(Boolean).join(' · ') || `${countLabel(part.quantity, 'unit')} suggested`}</small>{part.specifications.length > 0 && <small>{part.specifications.join(' · ')}</small>}</span></li>)}</ul> : <p className="empty-detail">No part candidates were returned in this first pass.</p>}
                  </article>
                </div>
                <div className="design-footnote"><span className="sparkle">✳</span> Treat this as a starting point. Research and engineering checks will ground the next iteration.</div>
              </div>
            ) : (
              <div className="empty-workspace"><div className="empty-art" aria-hidden="true"><span className="empty-shape shape-large" /><span className="empty-shape shape-small" /><span className="empty-spark">✳</span></div><div className="eyebrow"><span>READY WHEN YOU ARE</span></div><h3>Your idea starts here.</h3><p>Describe the hardware you have in mind, and your first design will land in this workspace.</p></div>
            ) : (
              <div className="placeholder-workspace"><div className="placeholder-art" aria-hidden="true"><span className="placeholder-ring" /><span className="placeholder-center">{RESULT_TABS.find((tab) => tab.id === activeTab)?.number}</span></div><div className="placeholder-copy"><div className="eyebrow"><span>{PLACEHOLDERS[activeTab].eyebrow}</span></div><h3>{PLACEHOLDERS[activeTab].title}</h3><p>{PLACEHOLDERS[activeTab].description}</p><span className="coming-note"><span className="status-dot" /> WORKSPACE READY TO GROW</span></div></div>
            )}
          </section>
        </div>
      </section>
      <footer className="footer"><span>MAKESMITH <span className="brand-period">✳</span> BUILD WITH INTENTION</span><span>DESIGNED FOR THE CURIOUS</span></footer>
    </main>
  )
}
