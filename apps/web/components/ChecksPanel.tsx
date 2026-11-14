import type { CheckResult } from '../lib/api'

function formatValue(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ')
  if (value && typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function ChecksPanel({ checks }: { checks: CheckResult[] }) {
  return <section className="checks-panel" aria-label="Engineering checks">
    <div className="view-intro"><div className="eyebrow"><span>CODE-BASED REVIEW</span></div><h3>What the numbers say</h3><p>These quick checks use only numeric values in this design. Unknown means a required rating or measurement was not provided.</p></div>
    <ol className="check-list">{checks.map((check) => <li className={`check-card check-${check.status}`} key={check.id}>
      <div className="check-heading"><h3>{check.label}</h3><span className={`check-status status-${check.status}`}>{check.status === 'pass' ? 'Pass' : check.status === 'warning' ? 'Warning' : 'Unknown'}</span></div>
      <p>{check.reason}</p>
      {check.result && <dl className="check-values">{Object.entries(check.result).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{formatValue(value)}</dd></div>)}</dl>}
      {check.assumptions.length > 0 && <div className="check-assumptions"><strong>Assumptions and limits</strong><ul>{check.assumptions.map((assumption, index) => <li key={`${assumption}-${index}`}>{assumption}</li>)}</ul></div>}
    </li>)}</ol>
  </section>
}
