/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from './page'
import { getIntake, designIdea, DesignResponse, IntakeResponse } from '../lib/api'

vi.mock('../lib/api', () => ({ getIntake: vi.fn(), designIdea: vi.fn() }))

const sample: DesignResponse = {
  design: {
    idea: 'A compact indoor garden',
    summary: 'A self-watering indoor garden',
    components: [{ name: 'Moisture sensor', purpose: 'Detects dry soil' }],
    parts: [{ name: 'Moisture probe', manufacturer: 'Fieldworks', model: 'FP-1', specifications: ['Capacitive'], quantity: 1, links: [], search_url: 'https://www.google.com/search?q=Moisture%20probe', source_urls: [] }],
    connections: [],
    power: { source: '', voltage: '', current: '', capacity: '', estimated_runtime: '' },
    dimensions: { width: '', height: '', depth: '', units: '' },
    research: [], custom_parts: [], manual: [], assumptions: [],
  },
  cached: false,
}

afterEach(cleanup)
const intake: IntakeResponse = {
  feasibility: 'feasible', explanation: 'A workable concept.', alternatives: [], questions: [
    { id: 'budget', label: 'Budget', default: 'Under $50', options: ['Under $50'], skip_allowed: true },
    { id: 'size', label: 'Size', default: 'Desk-sized', options: ['Desk-sized'], skip_allowed: true },
    { id: 'purpose', label: 'Purpose', default: 'Reliable', options: ['Reliable'], skip_allowed: true },
    { id: 'skill_level', label: 'Skill level', default: 'Beginner', options: ['Beginner'], skip_allowed: true },
  ],
}
beforeEach(() => {
  vi.mocked(getIntake).mockReset().mockResolvedValue(intake)
  vi.mocked(designIdea).mockReset()
})

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
    await user.click(screen.getByRole('button', { name: /Check my idea/ }))
    expect(screen.getByRole('alert').textContent).toContain('Start with a description')
    expect(designIdea).not.toHaveBeenCalled()
  })

  it('submits an idea and renders the returned design', async () => {
    const user = userEvent.setup()
    vi.mocked(designIdea).mockResolvedValue(sample)
    render(<Home />)
    await user.type(screen.getByRole('textbox', { name: 'Describe your hardware idea' }), 'A compact indoor garden')
    await user.click(screen.getByRole('button', { name: /Check my idea/ }))
    expect(await screen.findByRole('heading', { name: 'A few details' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Use these defaults/ }))
    expect(await screen.findByRole('heading', { name: 'A self-watering indoor garden' })).toBeTruthy()
    expect(screen.getByText('Moisture sensor')).toBeTruthy()
    expect(screen.getByText('Moisture probe')).toBeTruthy()
    expect(getIntake).toHaveBeenCalledWith('A compact indoor garden')
    expect(designIdea).toHaveBeenCalledWith('A compact indoor garden', { budget: 'Under $50', size: 'Desk-sized', purpose: 'Reliable', skill_level: 'Beginner' })
  })

  it('lets a person choose a realistic alternative for an impossible idea', async () => {
    const user = userEvent.setup()
    vi.mocked(getIntake).mockResolvedValueOnce({ ...intake, feasibility: 'impossible', explanation: 'Water cannot remain liquid there.', alternatives: ['Build a solar pool heater', 'Make a pool-shaped light sculpture'] })
    render(<Home />)
    await user.type(screen.getByRole('textbox', { name: 'Describe your hardware idea' }), 'A pool on the Sun')
    await user.click(screen.getByRole('button', { name: /Check my idea/ }))
    expect(await screen.findByText('Water cannot remain liquid there.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Build a solar pool heater' }))
    expect(screen.getByRole('textbox', { name: 'Describe your hardware idea' })).toHaveProperty('value', 'Build a solar pool heater')
  })

  it('keeps the idea visible after an intake service error', async () => {
    const user = userEvent.setup()
    vi.mocked(getIntake).mockRejectedValue(new Error('OpenAI is unavailable.'))
    render(<Home />)
    const ideaBox = screen.getByRole('textbox', { name: 'Describe your hardware idea' })
    await user.type(ideaBox, 'A wearable monitor')
    await user.click(screen.getByRole('button', { name: /Check my idea/ }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('OpenAI is unavailable.'))
    expect(ideaBox).toHaveProperty('value', 'A wearable monitor')
  })
})
