import { describe, expect, it, vi } from 'vitest'
import { applyAssemblyTransform } from './model-transform'

describe('assembly transforms', () => {
  it('applies millimeter translation and degree rotation to a viewer mesh', () => {
    const mesh = { position: { set: vi.fn() }, rotation: { set: vi.fn() } }
    applyAssemblyTransform(mesh, { position_mm: [10, -5, 2], rotation_deg: [0, 90, 180] })
    expect(mesh.position.set).toHaveBeenCalledWith(10, -5, 2)
    expect(mesh.rotation.set).toHaveBeenCalledWith(0, Math.PI / 2, Math.PI)
  })
})
