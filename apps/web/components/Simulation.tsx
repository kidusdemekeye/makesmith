'use client'

import { useState } from 'react'
import type { SimulationSpec } from '../lib/mujoco'
import { runMuJoCoTest } from '../lib/mujoco'
import { loadMujocoEngine } from '../lib/mujoco-loader'

type Quality = { engineeringComplete: boolean; sourceCount: number }
type SimulationResult = { model_name: string; test_name: string; success_chance_percent: number; confidence: string; reasons: string[]; simulated_seconds: number; steps: number }

export default function Simulation({ spec, quality }: { spec: SimulationSpec; quality: Quality }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [error, setError] = useState('')
  const available = Boolean(spec.model_xml.trim() && spec.test_name.trim())

  async function runTest() {
    if (!available) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const engine = await loadMujocoEngine()
      setResult(await runMuJoCoTest(engine, spec, quality))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'MuJoCo could not run this model in the browser.')
    } finally {
      setLoading(false)
    }
  }

  return <section className="simulation-panel" aria-label="MuJoCo simulation">
    <div className="view-intro"><div className="eyebrow"><span>BROWSER WASM SIMULATION</span></div><h3>Run a focused physics test</h3>
      {available ? <><p><strong>{spec.test_name}</strong> · {spec.test_description}</p><p>The test steps this design’s MJCF model in MuJoCo WebAssembly for {spec.duration_seconds} seconds. A passing score means only that the stated model test passed.</p></> : <p>The AI could not create a simulation model from the available design details. Add measurable geometry or moving parts in the design request and generate it again.</p>}
    </div>
    <button className="primary-button" type="button" onClick={() => void runTest()} disabled={!available || loading}>{loading ? <><span className="spinner" /> Running MuJoCo…</> : <>Run MuJoCo test <span aria-hidden="true">↗</span></>}</button>
    {error && <p className="error-message" role="alert">{error}</p>}
    {result && <div className="simulation-result" aria-live="polite">
      <div className="simulation-score"><span>Chance of passing this test</span><strong>{result.success_chance_percent}%</strong><small>Confidence: {result.confidence}</small></div>
      <dl className="simulation-stats"><div><dt>Model</dt><dd>{result.model_name}</dd></div><div><dt>Simulated</dt><dd>{result.simulated_seconds.toFixed(2)} s</dd></div><div><dt>Steps</dt><dd>{result.steps}</dd></div></dl>
      <h4>Why</h4><ul>{result.reasons.map((reason, index) => <li key={`${reason}-${index}`}>{reason}</li>)}</ul>
    </div>}
    <p className="simulation-caution">A simplified digital model cannot account for every material, manufacturing tolerance, interaction, or real-world use condition.</p>
  </section>
}
