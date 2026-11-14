import type { Vector3 } from './api'

export type ModelTransform = { position_mm: Vector3; rotation_deg: Vector3 }

export function applyAssemblyTransform(mesh: { position: { set: (x: number, y: number, z: number) => unknown }; rotation: { set: (x: number, y: number, z: number) => unknown } }, transform: ModelTransform) {
  mesh.position.set(transform.position_mm[0], transform.position_mm[1], transform.position_mm[2])
  mesh.rotation.set(transform.rotation_deg[0] * Math.PI / 180, transform.rotation_deg[1] * Math.PI / 180, transform.rotation_deg[2] * Math.PI / 180)
}
