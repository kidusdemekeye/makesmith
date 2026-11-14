/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { runMuJoCoTest, validateModelXml } from './mujoco'

describe('MuJoCo model checks', () => {
  it('accepts a bounded project-specific MJCF model and rejects external files', () => {
    const valid = '<mujoco model="small device"><option timestep="0.002"/><worldbody><geom name="floor" type="plane" size="1 1 0.1"/><body name="case" pos="0 0 0.2"><freejoint/><geom type="box" size="0.1 0.1 0.05"/></body></worldbody></mujoco>'
    expect(validateModelXml(valid).modelName).toBe('small device')
    expect(() => validateModelXml('<mujoco><include file="https://example.com/model.xml"/></mujoco>')).toThrow('external resources')
  })

  it('runs the declared test in MuJoCo WASM and reports its result with confidence reasons', async () => {
    let deletedModel = false
    let deletedData = false
    let steps = 0
    const engine = {
      MjModel: { from_xml_string: () => ({ delete: () => { deletedModel = true } }) },
      MjData: class { time = 0; qpos = new Float64Array([0, 0, 1]); qvel = new Float64Array([0, 0, 0]); delete() { deletedData = true } },
      mj_step: (_model: unknown, data: { time: number }) => { steps += 1; data.time += 0.01 },
    }
    const result = await runMuJoCoTest(engine, {
      model_xml: '<mujoco model="device"><option timestep="0.01"/><worldbody><body><freejoint/><geom type="box" size="0.1 0.1 0.1"/></body></worldbody></mujoco>',
      test_name: 'settle test', test_description: 'Check that motion settles.', success_condition: 'settles', duration_seconds: 0.1, velocity_threshold: 0.1,
    }, { engineeringComplete: true, sourceCount: 2 }, async () => {})
    expect(steps).toBe(10)
    expect(result.success_chance_percent).toBe(100)
    expect(result.confidence).toBe('medium')
    expect(result.reasons.some((reason) => reason.includes('not physical validation'))).toBe(true)
    expect(deletedModel).toBe(true)
    expect(deletedData).toBe(true)
  })

  it('reports failure when the model state is non-finite', async () => {
    const engine = {
      MjModel: { from_xml_string: () => ({ delete: () => {} }) },
      MjData: class { time = 0; qpos = new Float64Array([Number.NaN]); qvel = new Float64Array([0]); delete() {} },
      mj_step: (_model: unknown, data: { time: number }) => { data.time += 0.1 },
    }
    const result = await runMuJoCoTest(engine, {
      model_xml: '<mujoco model="device"><option timestep="0.01"/><worldbody><body><freejoint/><geom type="box" size="0.1 0.1 0.1"/></body></worldbody></mujoco>',
      test_name: 'numerical stability', test_description: 'Check stable state.', success_condition: 'finite_state', duration_seconds: 0.02, velocity_threshold: 0.1,
    }, { engineeringComplete: false, sourceCount: 0 }, async () => {})
    expect(result.success_chance_percent).toBe(0)
    expect(result.confidence).toBe('low')
  })
})
