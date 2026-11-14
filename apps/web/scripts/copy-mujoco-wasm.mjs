import { copyFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const source = resolve('node_modules/@mujoco/mujoco/mujoco.wasm')
const scriptSource = resolve('node_modules/@mujoco/mujoco/mujoco.js')
const target = resolve('public/mujoco.wasm')
const scriptTarget = resolve('public/mujoco.js')
statSync(source)
statSync(scriptSource)
mkdirSync(dirname(target), { recursive: true })
copyFileSync(source, target)
copyFileSync(scriptSource, scriptTarget)
console.log('Prepared official MuJoCo JavaScript and WASM assets for the browser.')
