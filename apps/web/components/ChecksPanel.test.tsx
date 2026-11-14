/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ChecksPanel from './ChecksPanel'

afterEach(cleanup)

describe('ChecksPanel', () => {
  it('shows pass, warning, and unknown results with assumptions', () => {
    render(<ChecksPanel checks={[
      { id: 'power_budget', label: 'Power budget', status: 'pass', result: { total_load_w: 2, supply_limit_w: 5 }, reason: 'Loads are within rating.', assumptions: ['Peak loads are not included.'] },
      { id: 'fit', label: 'Part fit', status: 'warning', result: { parts_that_do_not_fit: ['housing'] }, reason: 'One part is too large.', assumptions: ['Only axis-aligned fit is checked.'] },
      { id: 'basic_strength', label: 'Basic strength', status: 'unknown', result: null, reason: 'Missing material data.', assumptions: ['No material strength is guessed.'] },
    ]} />)
    expect(screen.getByText('Power budget')).toBeTruthy()
    expect(screen.getByText('Pass')).toBeTruthy()
    expect(screen.getByText('Warning')).toBeTruthy()
    expect(screen.getByText('Unknown')).toBeTruthy()
    expect(screen.getByText('No material strength is guessed.')).toBeTruthy()
  })
})
