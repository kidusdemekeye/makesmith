export async function loadMujocoEngine() {
  // Keep the Emscripten runtime out of Next's Node aware bundle: it branches on
  // `process` and otherwise makes the browser build resolve the Node `module` package.
  const importFromPublic = new Function('url', 'return import(url)') as (url: string) => Promise<{ default: (options: unknown) => Promise<unknown> }>
  const loadMujoco = (await importFromPublic(new URL('/mujoco.js', window.location.href).toString())).default
  return loadMujoco({
    locateFile: (path: string) => path.endsWith('.wasm') ? new URL('/mujoco.wasm', window.location.href).toString() : path,
  })
}
