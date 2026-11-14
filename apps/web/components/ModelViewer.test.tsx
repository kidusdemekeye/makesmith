/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ModelViewer from './ModelViewer'

afterEach(cleanup)

describe('ModelViewer', () => {
  it('explains when a design has no custom STL files', () => {
    render(<ModelViewer models={[]} />)
    expect(screen.getByRole('heading', { name: 'No custom STL files yet' })).toBeTruthy()
  })

  it('lists part downloads and a full assembly view for compiled models', () => {
    render(<ModelViewer models={[{ name: 'Mount', purpose: 'Hold the board', dimensions: '20 x 10 mm', stl_base64: 'U1RM', position_mm: [0, 0, 0], rotation_deg: [0, 0, 0] }]} />)
    expect(screen.getByRole('button', { name: 'Full assembly' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Individual part' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Download STL' }).getAttribute('download')).toBe('Mount.stl')
    expect(screen.getByRole('img', { name: 'Full assembly 3D preview' })).toBeTruthy()
  })
})
