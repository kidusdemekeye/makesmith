import { afterEach, describe, expect, it, vi } from 'vitest'
import { designIdea } from './api'

afterEach(() => vi.unstubAllGlobals())

describe('designIdea', () => {
  it('posts an idea and returns the normalized design response', async () => {
    const response = { design: { idea: 'Headphones', summary: 'A listening device' }, cached: false }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response })
    vi.stubGlobal('fetch', fetchMock)

    await expect(designIdea('Headphones')).resolves.toEqual(response)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/api/design', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idea: 'Headphones' }),
    })
  })

  it('uses a safe server message when the API rejects a design', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'OpenAI is not configured.' }),
    }))
    await expect(designIdea('Headphones')).rejects.toThrow('OpenAI is not configured.')
  })

  it('extracts a readable FastAPI validation message from 422 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: [{ msg: 'String should have at least 1 character', type: 'string_too_short' }] }),
    }))
    await expect(designIdea('')).rejects.toThrow('String should have at least 1 character')
  })

  it('reports a helpful error for an unreadable response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => { throw new Error('bad json') } }))
    await expect(designIdea('Headphones')).rejects.toThrow('Could not generate a design. Try again.')
  })
})
