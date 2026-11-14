import type { DesignResult } from '../lib/api'

export default function PartsList({ parts, research }: Pick<DesignResult, 'parts' | 'research'>) {
  if (!parts.length) return <div className="view-empty"><h3>No researched parts yet</h3><p>Run the research step to collect exact component names and sources.</p></div>
  const sourceByUrl = new Map(research.map((source) => [source.url, source]))
  const partSourceUrls = new Set(parts.flatMap((part) => part.source_urls))
  const unassignedSources = research.filter((source) => !partSourceUrls.has(source.url))
  return <section className="parts-list" aria-label="Parts list">
    <div className="view-intro"><div className="eyebrow"><span>SOURCED COMPONENTS</span></div><h3>Parts for this build</h3><p>Part names and specifications come from the researched design. Check the linked datasheet before ordering.</p></div>
    <ol>{parts.map((part, index) => <li key={`${part.name}-${part.model}-${index}`}>
      <span className="part-number">{String(index + 1).padStart(2, '0')}</span>
      <div className="part-description"><h3>{part.name || 'Unnamed component'}</h3><p>{[part.manufacturer, part.model].filter(Boolean).join(' · ')}</p>
        {part.specifications.length > 0 && <ul className="part-specs">{part.specifications.map((specification) => <li key={specification}>{specification}</li>)}</ul>}
        <p className="part-quantity">Quantity: {part.quantity}</p>
        <div className="part-links"><a href={part.search_url} target="_blank" rel="noreferrer">Search exact part <span aria-hidden="true">↗</span></a>
          {part.source_urls.map((url) => sourceByUrl.get(url)).filter((source): source is NonNullable<typeof source> => Boolean(source)).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} <span aria-hidden="true">↗</span></a>)}
        </div>
      </div>
    </li>)}</ol>
    {unassignedSources.length > 0 && <aside className="research-sources"><h4>Research references</h4><ul>{unassignedSources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><p>{source.snippet}</p></li>)}</ul></aside>}
  </section>
}
