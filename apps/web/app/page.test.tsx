/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from './page'
import { designIdea, DesignResponse } from '../lib/api'

vi.mock('../lib/api', () => ({ designIdea: vi.fn() }))

const sample: DesignResponse = {
  design: {
    idea: 'A compact indoor garden',
    summary: 'A self-watering indoor garden',
    components: [{ name: 'Moisture sensor', purpose: 'Detects dry soil' }],
    parts: [{ name: 'Moisture probe', manufacturer: 'Fieldworks', model: 'FP-1', specifications: ['Capacitive'], quantity: 1, links: [] }],
    connections: [],
    power: { source: '', voltage: '', current: '', capacity: '', estimated_runtime: '' },
    dimensions: { width: '', height: '', depth: '', units: '' },
  },
  cached: false,
}

afterEach(cleanup)
beforeEach(() => vi.mocked(designIdea).mockReset())

describe('Makesmith workspace', () => {
  it('shows the idea box and six requested result tabs', () => {
    render(<Home />)
    expect(screen.getByRole('textbox', { name: 'Describe your hardware idea' })).toBeTruthy()
    expect(screen.getAllByRole('tab')).toHaveLength(6)
    expect(screen.getByRole('heading', { name: 'Your idea starts here.' })).toBeTruthy()
  })

  it('switches tabs and shows that workspace content', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.click(screen.getByRole('tab', { name: /Parts/ }))
    expect(screen.getByRole('heading', { name: 'Parts grounded in real sources' })).toBeTruthy()
  })

  it('requires an idea and shows an accessible error', async () => {
    const user = userEvent.setup()
    render(<Home />)
    await user.click(screen.getByRole('button', { name: /Draft my design/ }))
    expect(screen.getByRole('alert').textContent).toContain('Start with a description')
    expect(designIdea).not.toHaveBeenCalled()
  })

  it('submits an idea and renders the returned design', async () => {
    const user = userEvent.setup()
    vi.mocked(designIdea).mockResolvedValue(sample)
    render(<Home />)
    await user.type(screen.getByRole('textbox', { name: 'Describe your hardware idea' }), 'A compact indoor garden')
    await user.click(screen.getByRole('button', { name: /Draft my design/ }))
    expect(await screen.findByRole('heading', { name: 'A self-watering indoor garden' })).toBeTruthy()
    expect(screen.getByText('Moisture sensor')).toBeTruthy()
    expect(screen.getByText('Preliminary part ideas · not yet researched')).toBeTruthy()
    expect(screen.getByText('Moisture probe')).toBeTruthy()
    expect(designIdea).toHaveBeenCalledWith('A compact indoor garden')
  })
})
