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
  custom_parts: Array<{ name: string; purpose: string; cadquery_code: string; dimensions: string }>
  manual: Array<{ number: number; title: string; parts: string[]; tools: string[]; action: string; reason: string; mistakes: string[] }>
  assumptions: string[]
}

export type DesignResponse = { design: DesignResult; cached: boolean }
export type Answers = Partial<Record<'budget' | 'size' | 'purpose' | 'skill_level', string>>
export type IntakeQuestion = { id: keyof Answers; label: string; default: string; options: string[]; skip_allowed: boolean }
export type IntakeResponse = { feasibility: 'feasible' | 'needs_clarification' | 'impossible' | 'unsafe'; explanation: string; alternatives: string[]; questions: IntakeQuestion[] }
export type CadModel = { name: string; purpose: string; dimensions: string; stl_base64: string }
export type CadResponse = { models: CadModel[]; assembly: string[] }

function apiBaseUrl() {
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')
  return baseUrl
}

async function request<T>(path: string, body: unknown, fallback: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
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
  const payload = await request<unknown>('/api/design', { idea, answers }, 'Could not generate a design. Try again.')
  if (!payload || typeof payload !== 'object' || !('design' in payload) || !('cached' in payload)) {
    throw new Error('The design service returned an unexpected response. Please try again.')
  }
  return payload as DesignResponse
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

