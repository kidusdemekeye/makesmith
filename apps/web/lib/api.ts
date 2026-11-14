import type { SimulationSpec } from './mujoco'

export type Vector3 = [number, number, number]

export type DesignResult = {
  idea: string
  summary: string
  components: Array<{ name: string; purpose: string }>
  parts: Array<{
    name: string
    manufacturer: string
    model: string
    specifications: string[]
    quantity: number
    links: string[]
    search_url: string
    source_urls: string[]
  }>
  connections: Array<{ from: string; to: string; description: string }>
  power: { source: string; voltage: string; current: string; capacity: string; estimated_runtime: string }
  dimensions: { width: string; height: string; depth: string; units: string }
  research: Array<{ title: string; url: string; snippet: string }>
  custom_parts: Array<{ name: string; purpose: string; cadquery_code: string; dimensions: string; position_mm: Vector3; rotation_deg: Vector3 }>
  manual: Array<{ number: number; title: string; parts: string[]; tools: string[]; action: string; reason: string; mistakes: string[] }>
  assumptions: string[]
  engineering: {
    battery_capacity_mah: number | null
    supply_power_w: number | null
    consumers: Array<{ name: string; voltage_v: number | null; current_a: number | null; power_w: number | null }>
    parts: Array<{ name: string; quantity: number; mass_g: number | null; dimensions_mm: Array<number | null> | null }>
    enclosure_mm: Array<number | null> | null
    strength: Array<{ name: string; load_n: number | null; cross_section_mm2: number | null; allowable_stress_mpa: number | null }>
  }
  simulation: SimulationSpec
}

export type DesignResponse = { design: DesignResult; cached: boolean }
export type Answers = Partial<Record<'budget' | 'size' | 'purpose' | 'skill_level', string>>
export type IntakeQuestion = { id: keyof Answers; label: string; default: string; options: string[]; skip_allowed: boolean }
export type IntakeResponse = { feasibility: 'feasible' | 'needs_clarification' | 'impossible' | 'unsafe'; explanation: string; alternatives: string[]; questions: IntakeQuestion[] }
export type CadModel = { name: string; purpose: string; dimensions: string; stl_base64: string; position_mm: Vector3; rotation_deg: Vector3 }
export type CadResponse = { models: CadModel[]; assembly: Array<{ name: string; position_mm: Vector3; rotation_deg: Vector3 }> }
export type CheckResult = { id: string; label: string; status: 'pass' | 'warning' | 'unknown'; result: Record<string, unknown> | null; reason: string; assumptions: string[] }
export type ChecksResponse = { checks: CheckResult[] }

function apiBaseUrl() {
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')
  return baseUrl
}

async function request<T>(path: string, body: unknown, fallback: string, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      ...(method === 'POST' ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
    })
  } catch {
    throw new Error('Could not reach Makesmith. Check that the API is running and try again.')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload ? payload.detail : null
    let message = fallback
    if (typeof detail === 'string') {
      message = detail
    } else if (Array.isArray(detail) && detail.length > 0 && typeof detail[0] === 'object' && detail[0] !== null && 'msg' in detail[0] && typeof detail[0].msg === 'string') {
      message = detail[0].msg
    }
    throw new Error(message)
  }
  return payload as T
}

export async function designIdea(idea: string, answers: Answers = {}): Promise<DesignResponse> {
  const started = await request<unknown>('/api/design/jobs', { idea, answers }, 'Could not generate a design. Try again.')
  if (!started || typeof started !== 'object' || !('job_id' in started) || typeof started.job_id !== 'string') {
    throw new Error('The design service returned an unexpected response. Please try again.')
  }
  const deadline = Date.now() + 300_000
  while (Date.now() < deadline) {
    const status = await request<unknown>(`/api/design/jobs/${encodeURIComponent(started.job_id)}`, undefined, 'Could not check design progress.', 'GET')
    if (status && typeof status === 'object' && 'status' in status) {
      if (status.status === 'complete' && 'design' in status && 'cached' in status) {
        return { design: status.design, cached: status.cached } as DesignResponse
      }
      if (status.status === 'error') {
        throw new Error('detail' in status && typeof status.detail === 'string' ? status.detail : 'Could not generate a design. Try again.')
      }
      if (status.status !== 'pending') throw new Error('The design service returned an unexpected response. Please try again.')
    } else {
      throw new Error('The design service returned an unexpected response. Please try again.')
    }
    await new Promise((resolve) => globalThis.setTimeout(resolve, 1000))
  }
  throw new Error('Design generation is still running. Keep this page open and try again shortly.')
}

export async function getIntake(idea: string): Promise<IntakeResponse> {
  const payload = await request<unknown>('/api/intake', { idea }, 'Could not check your idea. Try again.')
  if (!payload || typeof payload !== 'object' || !('feasibility' in payload) || !('questions' in payload) || !Array.isArray(payload.questions)) {
    throw new Error('The intake service returned an unexpected response. Please try again.')
  }
  return payload as IntakeResponse
}


export async function compileCad(design: DesignResult): Promise<CadResponse> {
  const payload = await request<unknown>('/api/cad', { design }, 'Could not compile custom parts. Try again.')
  if (!payload || typeof payload !== 'object' || !('models' in payload) || !Array.isArray(payload.models) || !('assembly' in payload) || !Array.isArray(payload.assembly)) {
    throw new Error('The CAD service returned an unexpected response. Please try again.')
  }
  return payload as CadResponse
}


export async function runChecks(design: DesignResult): Promise<ChecksResponse> {
  const payload = await request<unknown>('/api/checks', { design }, 'Could not calculate engineering checks. Try again.')
  if (!payload || typeof payload !== 'object' || !('checks' in payload) || !Array.isArray(payload.checks)) {
    throw new Error('The checks service returned an unexpected response. Please try again.')
  }
  return payload as ChecksResponse
}

