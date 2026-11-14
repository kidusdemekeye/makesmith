export type SimulationSpec = {
  model_xml: string
  test_name: string
  test_description: string
  success_condition: 'finite_state' | 'settles'
  duration_seconds: number
  velocity_threshold: number
}

const ALLOWED_TAGS = new Set([
  'mujoco', 'compiler', 'option', 'size', 'visual', 'statistic', 'map', 'quality', 'global', 'headlight', 'rgba', 'haze',
  'worldbody', 'body', 'joint', 'freejoint', 'geom', 'site', 'camera', 'light', 'default', 'actuator', 'motor', 'position',
  'velocity', 'general', 'sensor', 'accelerometer', 'velocimeter', 'gyro', 'force', 'torque', 'framepos', 'framequat',
  'subtreecom', 'tendon', 'spatial', 'wrap', 'equality', 'connect', 'weld', 'distance', 'contact', 'pair', 'exclude', 'keyframe', 'key',
])

export function validateModelXml(xml: string): { modelName: string; timestep: number } {
  if (typeof xml !== 'string' || xml.length < 1 || xml.length > 20000) throw new Error('Simulation model must contain 1–20,000 characters.')
  if (typeof DOMParser === 'undefined') throw new Error('The XML model can only be validated in a browser.')
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (document.querySelector('parsererror')) throw new Error('The MuJoCo model XML is malformed.')
  const root = document.documentElement
  if (root.tagName !== 'mujoco') throw new Error('MuJoCo model must have a <mujoco> root element.')
  const tags = [...document.getElementsByTagName('*')]
  if (tags.some((element) => !ALLOWED_TAGS.has(element.tagName))) throw new Error('MuJoCo model contains unsupported tags or external resources.')
  if (tags.some((element) => [...element.attributes].some((attribute) => ['file', 'meshdir', 'texturedir', 'contentdir', 'plugin'].includes(attribute.name)))) {
    throw new Error('MuJoCo model cannot load external resources or plugins.')
  }
  if (tags.filter((element) => element.tagName === 'body').length > 24 || tags.filter((element) => element.tagName === 'geom').length > 64 || tags.filter((element) => ['joint', 'freejoint'].includes(element.tagName)).length > 32) {
    throw new Error('MuJoCo model is larger than the browser simulation limits.')
  }
  const timestepValue = document.querySelector('option')?.getAttribute('timestep')
  const timestep = timestepValue ? Number(timestepValue) : 0.002
  if (!Number.isFinite(timestep) || timestep < 0.0001 || timestep > 0.01) throw new Error('MuJoCo timestep must be between 0.0001 and 0.01 seconds.')
  return { modelName: root.getAttribute('model') || 'Hardware model', timestep }
}

export async function runMuJoCoTest(
  engine: any,
  simulation: SimulationSpec,
  quality: { engineeringComplete: boolean; sourceCount: number },
  yieldControl: () => Promise<void> = () => new Promise((resolve) => requestAnimationFrame(() => resolve())),
) {
  const parsed = validateModelXml(simulation.model_xml)
  if (!Number.isFinite(simulation.duration_seconds) || simulation.duration_seconds <= 0 || simulation.duration_seconds > 5) throw new Error('Simulation duration must be between 0 and 5 seconds.')
  if (!Number.isFinite(simulation.velocity_threshold) || simulation.velocity_threshold <= 0 || simulation.velocity_threshold > 100) throw new Error('Simulation velocity threshold is outside the supported range.')
  const maxSteps = Math.ceil(simulation.duration_seconds / parsed.timestep)
  if (maxSteps > 10000) throw new Error('This model would require too many browser simulation steps.')

  let model: any
  let data: any
  try {
    model = engine.MjModel.from_xml_string(simulation.model_xml)
    data = new engine.MjData(model)
    let steps = 0
    while (Number(data.time) + parsed.timestep * 1e-8 < simulation.duration_seconds && steps < maxSteps + 1) {
      const batchEnd = Math.min(steps + 200, maxSteps + 1)
      while (steps < batchEnd && Number(data.time) + parsed.timestep * 1e-8 < simulation.duration_seconds) {
        engine.mj_step(model, data)
        steps += 1
      }
      if (Number(data.time) + parsed.timestep * 1e-8 < simulation.duration_seconds) await yieldControl()
    }
    const positions = Array.from(data.qpos ?? [], Number)
    const velocities = Array.from(data.qvel ?? [], Number)
    const finite = Number(data.time) + parsed.timestep * 1e-8 >= simulation.duration_seconds && [...positions, ...velocities].every(Number.isFinite)
    const settled = finite && velocities.every((velocity) => Math.abs(velocity) <= simulation.velocity_threshold)
    const passed = simulation.success_condition === 'settles' ? settled : finite
    const confidence = quality.engineeringComplete && quality.sourceCount > 0 ? 'medium' : 'low'
    const reasons = [
      `${simulation.test_name}: ${passed ? 'passed' : 'failed'} after ${Number(data.time).toFixed(2)} seconds (${steps} steps).`,
      finite ? 'The simulated state stayed finite through the requested test duration.' : 'The test ended early or produced a non-finite model state.',
      simulation.success_condition === 'settles' ? (settled ? 'Final joint/body speeds stayed below the configured threshold.' : 'Final speeds exceeded the settling threshold.') : 'The test checks only numerical stability for the stated duration.',
      'This is not physical validation; real-world loads, manufacturing variation, and unmodeled components can change behavior.',
    ]
    return { model_name: parsed.modelName, test_name: simulation.test_name, success_chance_percent: passed ? 100 : 0, confidence, reasons, simulated_seconds: Number(data.time), steps }
  } finally {
    data?.delete?.()
    model?.delete?.()
  }
}
