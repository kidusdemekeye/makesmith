'use client'

import { useEffect, useRef, useState } from 'react'
import type { CadModel } from '../lib/api'
import { applyAssemblyTransform } from '../lib/model-transform'

type Mode = 'assembly' | 'part'

export default function ModelViewer({ models }: { models: CadModel[] }) {
  const host = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<Mode>('assembly')
  const [selected, setSelected] = useState(0)
  const [renderError, setRenderError] = useState('')
  const visibleModels = mode === 'assembly' ? models : models.slice(selected, selected + 1)

  useEffect(() => {
    const container = host.current
    if (!container || visibleModels.length === 0) return
    if (typeof window === 'undefined' || !('WebGLRenderingContext' in window)) {
      setRenderError('This browser does not support the WebGL 3D preview.')
      return
    }

    let renderer: import('three').WebGLRenderer | undefined
    let controls: import('three/addons/controls/OrbitControls.js').OrbitControls | undefined
    let frame = 0
    try {
      let cancelled = false
      void Promise.all([import('three'), import('three/addons/loaders/STLLoader.js'), import('three/addons/controls/OrbitControls.js')]).then(async ([THREE, { STLLoader }, { OrbitControls }]) => {
        if (cancelled || !container) return
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.setSize(container.clientWidth || 640, container.clientHeight || 420)
        renderer.setClearColor('#f3f0e9', 1)
        container.replaceChildren(renderer.domElement)

        const scene = new THREE.Scene()
        scene.background = new THREE.Color('#f3f0e9')
        const camera = new THREE.PerspectiveCamera(42, (container.clientWidth || 640) / (container.clientHeight || 420), 0.1, 5000)
        camera.position.set(3, 3, 4)
        scene.add(new THREE.HemisphereLight('#ffffff', '#81745e', 2.2))
        const keyLight = new THREE.DirectionalLight('#ffffff', 2.4)
        keyLight.position.set(4, 6, 8)
        scene.add(keyLight)
        const group = new THREE.Group()
        const loader = new STLLoader()
        for (let index = 0; index < visibleModels.length; index += 1) {
          const binary = window.atob(visibleModels[index].stl_base64)
          const bytes = new Uint8Array(binary.length)
          for (let offset = 0; offset < binary.length; offset += 1) bytes[offset] = binary.charCodeAt(offset)
          const geometry = loader.parse(bytes.buffer)
          geometry.computeVertexNormals()
          const material = new THREE.MeshStandardMaterial({ color: ['#b36a42', '#627e73', '#65788b', '#c59c54'][index % 4], metalness: 0.12, roughness: 0.62 })
          const mesh = new THREE.Mesh(geometry, material)
          if (mode === 'assembly') applyAssemblyTransform(mesh, visibleModels[index])
          group.add(mesh)
        }
        scene.add(group)
        group.updateMatrixWorld(true)
        const bounds = new THREE.Box3().setFromObject(group)
        const center = bounds.getCenter(new THREE.Vector3())
        const size = bounds.getSize(new THREE.Vector3())
        group.position.sub(center)
        camera.position.set(size.x * 1.8 + 2, size.y * 1.8 + 2, size.z * 2.2 + 2)
        camera.lookAt(0, 0, 0)
        controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        const render = () => {
          controls?.update()
          renderer?.render(scene, camera)
          frame = window.requestAnimationFrame(render)
        }
        render()
        setRenderError('')
      }).catch(() => setRenderError('The STL preview could not be opened. Download the file to inspect it in a CAD tool.'))
      return () => {
        cancelled = true
        window.cancelAnimationFrame(frame)
        controls?.dispose()
        renderer?.dispose()
        if (container) container.replaceChildren()
      }
    } catch {
      setRenderError('The 3D preview could not start in this browser.')
    }
    return () => {
      window.cancelAnimationFrame(frame)
      controls?.dispose()
      renderer?.dispose()
    }
  }, [visibleModels])

  if (!models.length) return <div className="viewer-empty"><span className="viewer-icon" aria-hidden="true">◇</span><h3>No custom STL files yet</h3><p>When the design includes printable custom geometry, compiled parts will appear here.</p></div>

  return <div className="model-viewer">
    <div className="viewer-toolbar" aria-label="3D view controls">
      <div className="viewer-modes" role="group" aria-label="Choose model view">
        <button type="button" aria-pressed={mode === 'assembly'} onClick={() => setMode('assembly')}>Full assembly</button>
        <button type="button" aria-pressed={mode === 'part'} onClick={() => setMode('part')}>Individual part</button>
      </div>
      {mode === 'part' && <label className="sr-only" htmlFor="model-part">Choose a custom part</label>}
      {mode === 'part' && <select id="model-part" value={selected} onChange={(event) => setSelected(Number(event.target.value))}>{models.map((model, index) => <option key={`${model.name}-${index}`} value={index}>{model.name}</option>)}</select>}
    </div>
    <div className="viewer-layout">
      <div ref={host} className="viewer-canvas" aria-label={mode === 'assembly' ? 'Full assembly 3D preview' : `${visibleModels[0]?.name} 3D preview`} role="img" />
      <aside className="viewer-parts"><h3>{mode === 'assembly' ? 'Assembly parts' : visibleModels[0]?.name}</h3><ul>{visibleModels.map((model, index) => <li key={`${model.name}-${index}`}><strong>{model.name}</strong><small>{model.dimensions || model.purpose}</small><a download={`${model.name.replace(/[^a-z0-9_-]/gi, '-')}.stl`} href={`data:model/stl;base64,${model.stl_base64}`}>Download STL</a></li>)}</ul></aside>
    </div>
    {renderError && <p className="viewer-error" role="status">{renderError}</p>}
    <p className="viewer-note">Assembly placement is a visual preview. Confirm clearances and fit before fabrication.</p>
  </div>
}
