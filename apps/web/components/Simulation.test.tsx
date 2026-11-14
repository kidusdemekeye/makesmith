/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadMujocoEngine } from '../lib/mujoco-loader'
import { runMuJoCoTest } from '../lib/mujoco'
import Simulation from './Simulation'

vi.mock('../lib/mujoco-loader', () => ({ loadMujocoEngine: vi.fn() }))
vi.mock('../lib/mujoco', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/mujoco')>()), runMuJoCoTest: vi.fn() }))

afterEach(cleanup)
beforeEach(() => { vi.mocked(loadMujocoEngine).mockReset(); vi.mocked(runMuJoCoTest).mockReset() })

const testSpec = { model_xml: '<mujoco model="sensor"><worldbody/></mujoco>', test_name: 'settle test', test_description: 'Test the sensor housing settling.', success_condition: 'settles' as const, duration_seconds: 1, velocity_threshold: 0.1 }

describe('Simulation', () => {
  it('explains when an AI model is unavailable', () => {
    render(<Simulation spec={{ ...testSpec, model_xml: '' }} quality={{ engineeringComplete: false, sourceCount: 0 }} />)
    expect(screen.getByText(/could not create a simulation model/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Run MuJoCo test' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('loads MuJoCo WASM and shows the declared test score, confidence, and reasons', async () => {
    const user = userEvent.setup()
    vi.mocked(loadMujocoEngine).mockResolvedValue({})
    vi.mocked(runMuJoCoTest).mockResolvedValue({ model_name: 'sensor', test_name: 'settle test', success_chance_percent: 100, confidence: 'low', reasons: ['settle test: passed.', 'This is not physical validation.'], simulated_seconds: 1, steps: 500 })
    render(<Simulation spec={testSpec} quality={{ engineeringComplete: false, sourceCount: 0 }} />)
    await user.click(screen.getByRole('button', { name: 'Run MuJoCo test' }))
    expect(await screen.findByText('100%')).toBeTruthy()
    expect(screen.getByText('Confidence: low')).toBeTruthy()
    expect(screen.getByText('This is not physical validation.')).toBeTruthy()
    expect(runMuJoCoTest).toHaveBeenCalledWith(expect.anything(), testSpec, { engineeringComplete: false, sourceCount: 0 })
  })
})
