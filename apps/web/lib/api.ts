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
  }>
  connections: Array<{ from: string; to: string; description: string }>
  power: { source: string; voltage: string; current: string; capacity: string; estimated_runtime: string }
  dimensions: { width: string; height: string; depth: string; units: string }
}

export type DesignResponse = { design: DesignResult; cached: boolean }

export async function designIdea(idea: string): Promise<DesignResponse> {
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')
  let response: Response
  try {
    response = await fetch(`${baseUrl}/api/design`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idea }),
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
    const detail = payload && typeof payload === 'object' && 'detail' in payload
      ? String(payload.detail)
      : 'Could not generate a design. Try again.'
    throw new Error(detail)
  }
  if (!payload || typeof payload !== 'object' || !('design' in payload) || !('cached' in payload)) {
    throw new Error('The design service returned an unexpected response. Please try again.')
  }
  return payload as DesignResponse
}
