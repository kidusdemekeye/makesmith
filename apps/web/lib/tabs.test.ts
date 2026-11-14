import { describe, expect, it } from 'vitest'
import { RESULT_TABS } from './tabs'

describe('result tabs', () => {
  it('defines the six requested result workspaces in order', () => {
    expect(RESULT_TABS.map((tab) => tab.label)).toEqual([
      'Design', 'Parts', 'Manual', '3D Files', 'Checks', 'Simulation',
    ])
  })
})
