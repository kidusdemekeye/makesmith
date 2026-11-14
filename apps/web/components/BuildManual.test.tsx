/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BuildManual from './BuildManual'

afterEach(cleanup)

describe('BuildManual', () => {
  it('shows explanatory ordered steps with parts, tools, and common mistakes', () => {
    const { container } = render(<BuildManual steps={[
      { number: 2, title: 'Fit the lid', parts: ['Printed lid'], tools: ['Small screwdriver'], action: 'Seat the lid evenly.', reason: 'An even fit protects the sensor.', mistakes: ['Do not force the corners.'] },
      { number: 1, title: 'Mount the sensor', parts: ['Moisture sensor'], tools: ['Screwdriver'], action: 'Secure the sensor above the soil.', reason: 'This keeps the electronics dry.', mistakes: ['Avoid burying the circuit board.'] },
    ]} />)
    const headings = [...container.querySelectorAll('.manual-step-heading h3')]
    expect(headings.map((heading) => heading.textContent)).toEqual(['1. Mount the sensor', '2. Fit the lid'])
    expect(screen.getAllByText('Why it matters')).toHaveLength(2)
    expect(screen.getByText('Avoid burying the circuit board.')).toBeTruthy()
  })

  it('offers print-to-PDF without calling print until selected', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<BuildManual steps={[]} />)
    expect(print).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Print or save as PDF' }))
    expect(print).toHaveBeenCalledOnce()
  })
})
