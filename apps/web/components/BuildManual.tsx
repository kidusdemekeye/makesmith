import type { DesignResult } from '../lib/api'

export default function BuildManual({ steps }: { steps: DesignResult['manual'] }) {
  const orderedSteps = [...steps].sort((left, right) => left.number - right.number)
  return <section className="manual-document print-document" aria-label="Build manual">
    <div className="manual-toolbar"><div className="eyebrow"><span>ASSEMBLY GUIDE</span></div><button className="secondary-button" type="button" onClick={() => window.print()}>Print or save as PDF</button></div>
    <header className="view-intro"><h3>Build it one clear step at a time.</h3><p>Read the full step before starting. Check each component rating and fit against the final device as you go.</p></header>
    {orderedSteps.length ? <ol className="manual-steps">{orderedSteps.map((step) => <li className="manual-step" key={`${step.number}-${step.title}`}>
      <div className="manual-step-heading"><span className="step-number">{String(step.number).padStart(2, '0')}</span><h3>{step.number}. {step.title}</h3></div>
      <div className="manual-step-grid">
        <section><h4>Parts and tools</h4><p><strong>Parts:</strong> {step.parts.length ? step.parts.join(', ') : 'None listed'}</p><p><strong>Tools:</strong> {step.tools.length ? step.tools.join(', ') : 'None listed'}</p></section>
        <section><h4>What to do</h4><p>{step.action}</p></section>
        <section><h4>Why it matters</h4><p>{step.reason}</p></section>
        <section><h4>Common mistakes</h4>{step.mistakes.length ? <ul>{step.mistakes.map((mistake, index) => <li key={`${mistake}-${index}`}>{mistake}</li>)}</ul> : <p>No common mistakes were listed.</p>}</section>
      </div>
    </li>)}</ol> : <div className="view-empty"><h3>No assembly steps were returned</h3><p>The design did not contain a manual. Review the parts and connection plan before building.</p></div>}
    <p className="manual-caution">This is a planning guide, not a substitute for component datasheets, professional review, or safe tool practices.</p>
  </section>
}
