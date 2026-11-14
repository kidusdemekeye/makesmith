'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Answers, getIntake, IntakeResponse, designIdea, DesignResponse } from '../lib/api'
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
  const [intake, setIntake] = useState<IntakeResponse | null>(null)
  const [answers, setAnswers] = useState<Answers>({})
  const [loading, setLoading] = useState(false)
  const [generationStage, setGenerationStage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading) return
    const stages = ['Researching real parts and datasheets', 'Designing the build', 'Preparing the manual and checks']
    let index = 0
    const timer = window.setInterval(() => {
      index = Math.min(index + 1, stages.length - 1)
      setGenerationStage(stages[index])
    }, 1800)
    return () => window.clearInterval(timer)
  }, [loading])

  async function checkIdea(candidate: string) {
    setLoading(true)
    setError('')
    setResult(null)
    setIntake(null)
    try {
      const checked = await getIntake(candidate)
      setIntake(checked)
      setAnswers(Object.fromEntries(checked.questions.map((question) => [question.id, question.default])))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not check your idea. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!idea.trim()) {
      setError('Start with a description of the thing you want to make.')
      return
    }
    setActiveTab('design')
    await checkIdea(idea.trim())
  }

  async function createDesign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const candidate = idea.trim()
    setLoading(true)
    setError('')
    setGenerationStage('Researching real parts and datasheets')
    setActiveTab('design')
    try {
      setResult(await designIdea(candidate, answers))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not generate a design. Try again.')
    } finally {
      setLoading(false)
      setGenerationStage('')
    }
  }

  async function chooseAlternative(alternative: string) {
    setIdea(alternative)
    setActiveTab('design')
    await checkIdea(alternative)
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
          <textarea id="idea" name="idea" value={idea} onChange={(event) => { setIdea(event.target.value); setIntake(null); setResult(null); setError('') }} placeholder="A compact indoor garden that waters itself when the soil gets dry..." maxLength={5000} rows={3} aria-describedby="idea-hint" disabled={loading} />
          <div className="form-footer">
            <span id="idea-hint" className="form-hint">Start broad. You can refine the details as you go.</span>
            <div className="submit-row"><span className="character-count">{idea.length.toLocaleString()} / 5,000</span>
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? <><span className="spinner" /> Checking...</> : <>Check my idea <span aria-hidden="true">↗</span></>}
              </button>
            </div>
          </div>
        </form>
        {error && <p className="error-message" role="alert"><span aria-hidden="true">!</span> {error}</p>}

        {intake && <section className="intake-card" aria-live="polite">
          <div className="eyebrow"><span>IDEA CHECK</span></div>
          <h3>{intake.feasibility === 'impossible' ? 'This needs a change in direction.' : intake.feasibility === 'unsafe' ? 'I can’t help design that device.' : 'A few details'}</h3>
          <p>{intake.explanation}</p>
          {intake.feasibility === 'impossible' && <div className="alternative-list"><strong>Choose a realistic alternative to continue:</strong>{intake.alternatives.map((alternative) => <button className="alternative-button" key={alternative} type="button" disabled={loading} onClick={() => void chooseAlternative(alternative)}>{alternative}<span aria-hidden="true">↗</span></button>)}</div>}
          {intake.feasibility === 'unsafe' && <p className="form-hint">Try describing a benign device or safety-focused project.</p>}
          {(intake.feasibility === 'feasible' || intake.feasibility === 'needs_clarification') && <form className="followup-form" onSubmit={createDesign}>
            <h4>Defaults are ready. Change any answer, or continue as-is.</h4>
            <div className="followup-grid">{intake.questions.map((question) => <label key={question.id} htmlFor={`answer-${question.id}`}>{question.label}<input id={`answer-${question.id}`} value={answers[question.id] ?? question.default} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} disabled={loading} /></label>)}</div>
            <div className="submit-row"><span className="form-hint" aria-live="polite">{loading ? generationStage : 'You can skip all questions by keeping the defaults.'}</span><button className="primary-button" type="submit" disabled={loading}>{loading ? <><span className="spinner" /> Working...</> : <>Use these defaults <span aria-hidden="true">↗</span></>}</button></div>
          </form>}
        </section>}

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
                    <div className="detail-head"><span className="detail-index">E</span><h4>Research and parts</h4><span className="detail-count">{countLabel(design.parts.length, 'part')}</span></div>
                    {design.parts.length > 0 && <ul className="component-list">{design.parts.map((part, index) => <li key={`${part.name}-${index}`}><span className="list-bullet">{String(index + 1).padStart(2, '0')}</span><span><strong>{part.name}</strong><small>{[part.manufacturer, part.model].filter(Boolean).join(' · ')} · Qty {part.quantity}</small>{part.specifications.map((spec) => <small key={spec}>{spec}</small>)}<a href={part.search_url} target="_blank" rel="noreferrer">Search this exact part</a></span></li>)}</ul>}
                    {design.parts.length === 0 && <p className="empty-detail">No parts were returned in the research pass.</p>}
                    {design.research.length > 0 && <><h5>Sources</h5><ul className="component-list">{design.research.map((source, index) => <li key={`${source.url}-${index}`}><span className="list-bullet">{String(index + 1).padStart(2, '0')}</span><span><strong><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></strong><small>{source.snippet}</small></span></li>)}</ul></>}
                  </article>
                </div>
                <div className="design-footnote"><span className="sparkle">✳</span> Treat estimates as a starting point. Confirm fit, ratings, and compatibility before building.</div>
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
