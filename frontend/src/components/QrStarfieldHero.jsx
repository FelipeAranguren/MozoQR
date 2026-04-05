// src/components/QrStarfieldHero.jsx
import React, { useMemo, useRef, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const COL_STAR_A = new THREE.Color('#4CC9F0')
const COL_STAR_B = new THREE.Color('#F72585')
const COL_WHITE = new THREE.Color('#ffffff')

/** Matriz QR simplificada 20×21 (módulos “negros” = 1): finder patterns + datos en cuadrícula. */
const QR_MATRIX = [
  [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,0,1,0,1,0,0,1,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1],
  [1,0,1,1,1,0,1,0,0,0,1,1,0,0,1,0,1,1,1,0,1],
  [1,0,1,1,1,0,1,0,1,1,0,0,1,0,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,1,0,0,1,1,0,0,0,1,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1,1],
  [0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0],
  [1,0,1,1,0,0,1,0,0,0,1,0,0,0,1,1,0,1,0,1,0],
  [0,1,0,0,1,0,0,0,1,0,0,1,0,0,0,1,1,0,0,1,1],
  [1,0,1,0,1,1,1,0,0,1,1,0,1,0,1,0,0,1,1,0,1],
  [0,0,0,1,0,0,0,0,1,0,0,0,1,0,0,1,0,1,0,0,0],
  [1,1,1,0,1,0,1,0,0,1,0,1,0,0,1,1,1,0,1,1,1],
  [0,0,0,0,0,0,0,0,1,1,1,0,1,0,0,0,0,0,0,0,0],
  [1,1,1,1,1,1,1,0,0,0,1,0,0,0,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,1,0,0,1,1,0,1,0,0,0,0,0,1],
  [1,0,1,1,1,0,1,0,0,1,1,0,0,0,1,0,1,1,1,0,1],
  [1,0,1,1,1,0,1,0,1,0,1,1,0,0,1,0,1,1,1,0,1],
  [1,0,0,0,0,0,1,0,0,0,0,1,1,0,1,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,0,1,1,1,0,1,0,1,1,1,1,1,1,1],
]

const QR_ROWS = QR_MATRIX.length
const QR_COLS = QR_MATRIX[0].length

/** Escala del patrón QR en unidades de mundo (más grande = QR inicial más “zoom in”). */
const QR_WORLD_SCALE = 1.58
/** Zoom out de cámara durante la transición (z menor = más cerca = QR más grande al inicio). */
const CAMERA_Z_START = 6.65
const CAMERA_Z_END = 10.45
/** Distancia radial máxima al completar (t≈1); calibrado con escala + zoom de cámara para borde a borde. */
const QR_EXPLODE_RADIAL_MAX = 6.15

function detRand(i, salt = 0) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** Blanco puro ↔ cian suave (misma línea visual que el hero actual). */
function neonQrDotColor(pid) {
  const cyan = { r: 0.38, g: 0.88, b: 1 }
  const white = { r: 1, g: 1, b: 1 }
  const u = detRand(pid, 7)
  const v = detRand(pid, 8)
  const t = 0.2 + u * 0.78
  return {
    r: THREE.MathUtils.clamp(cyan.r + (white.r - cyan.r) * t + (v - 0.5) * 0.06, 0, 1),
    g: THREE.MathUtils.clamp(cyan.g + (white.g - cyan.g) * t + (v - 0.5) * 0.04, 0, 1),
    b: THREE.MathUtils.clamp(cyan.b + (white.b - cyan.b) * t, 0, 1),
  }
}

/**
 * Puntos iniciales en forma de QR cuadrado: grilla de módulos + subpuntos por celda.
 */
function buildProceduralQrPoints() {
  const pitch = 2.06 / QR_COLS
  const sub = 3
  const raw = []
  let pid = 0
  for (let r = 0; r < QR_ROWS; r++) {
    for (let c = 0; c < QR_COLS; c++) {
      if (QR_MATRIX[r][c] !== 1) continue
      const cx = (c - (QR_COLS - 1) / 2) * pitch
      const cy = -((r - (QR_ROWS - 1) / 2) * pitch)
      for (let si = 0; si < sub; si++) {
        for (let sj = 0; sj < sub; sj++) {
          const ox = ((si + 0.5) / sub - 0.5) * pitch * 0.9
          const oy = ((sj + 0.5) / sub - 0.5) * pitch * 0.9
          const col = neonQrDotColor(pid)
          raw.push({
            nx: (cx + ox) * QR_WORLD_SCALE,
            ny: (cy + oy) * QR_WORLD_SCALE,
            r: col.r,
            g: col.g,
            b: col.b,
          })
          pid += 1
        }
      }
    }
  }
  const maxParticles = 3400
  if (raw.length <= maxParticles) return raw
  const k = Math.ceil(raw.length / maxParticles)
  return raw.filter((_, idx) => idx % k === 0)
}

function buildBuffers(list) {
  const n = list.length
  const basePos = new Float32Array(n * 3)
  const radial = new Float32Array(n * 3)
  const distNorm = new Float32Array(n)
  const startCol = new Float32Array(n * 3)
  const endCol = new Float32Array(n * 3)

  let maxD = 0
  const dists = list.map((p) => Math.hypot(p.nx, p.ny))
  maxD = Math.max(...dists, 1e-4)

  for (let i = 0; i < n; i++) {
    const p = list[i]
    const D = Math.hypot(p.nx, p.ny) || 0.001
    const ux = p.nx / D
    const uy = p.ny / D
    const rz = (detRand(i, 1) - 0.5) * 1.1
    let vx = ux
    let vy = uy
    let vz = rz
    const len = Math.hypot(vx, vy, vz) || 1
    vx /= len
    vy /= len
    vz /= len

    basePos[i * 3] = p.nx
    basePos[i * 3 + 1] = p.ny
    basePos[i * 3 + 2] = (detRand(i, 2) - 0.5) * 0.06

    radial[i * 3] = vx
    radial[i * 3 + 1] = vy
    radial[i * 3 + 2] = vz

    distNorm[i] = D / maxD

    startCol[i * 3] = p.r
    startCol[i * 3 + 1] = p.g
    startCol[i * 3 + 2] = p.b

    const pick = detRand(i, 3)
    const target = pick < 0.55 ? COL_WHITE.clone() : pick < 0.82 ? COL_STAR_A.clone() : COL_STAR_B.clone()
    if (pick > 0.92) target.lerp(COL_WHITE, 0.7)
    endCol[i * 3] = target.r
    endCol[i * 3 + 1] = target.g
    endCol[i * 3 + 2] = target.b
  }

  return { n, basePos, radial, distNorm, startCol, endCol }
}

function ZoomCamera({ progress }) {
  const { camera } = useThree()
  useFrame(() => {
    const t = progress.get()
    const travel = THREE.MathUtils.smoothstep(t, 0, 0.98)
    camera.position.z = THREE.MathUtils.lerp(CAMERA_Z_START, CAMERA_Z_END, travel)
  })
  return null
}

function AmbientStars({ progress, count = 900 }) {
  const ref = useRef()
  const { base, radial, distN, colA, colB } = useMemo(() => {
    const base = new Float32Array(count * 3)
    const radial = new Float32Array(count * 3)
    const distN = new Float32Array(count)
    const colA = new Float32Array(count * 3)
    const colB = new Float32Array(count * 3)
    let maxD = 0
    const tmp = []
    for (let i = 0; i < count; i++) {
      const th = detRand(i, 10) * Math.PI * 2
      const ph = (detRand(i, 11) - 0.5) * Math.PI * 0.85
      const rad = 1.8 + detRand(i, 12) * 5.5
      const x = rad * Math.cos(ph) * Math.cos(th)
      const y = rad * Math.cos(ph) * Math.sin(th)
      const z = rad * Math.sin(ph) * 0.7 - 2
      base[i * 3] = x * 0.15
      base[i * 3 + 1] = y * 0.15
      base[i * 3 + 2] = z * 0.15
      const D = Math.hypot(x, y, z) || 1
      tmp.push(D)
      maxD = Math.max(maxD, D)
    }
    for (let i = 0; i < count; i++) {
      const x = base[i * 3] / 0.15
      const y = base[i * 3 + 1] / 0.15
      const z = base[i * 3 + 2] / 0.15
      const D = Math.hypot(x, y, z) || 1
      radial[i * 3] = x / D
      radial[i * 3 + 1] = y / D
      radial[i * 3 + 2] = z / D
      distN[i] = tmp[i] / maxD
      const c0 = detRand(i, 13) < 0.6 ? COL_STAR_A : COL_STAR_B
      colA[i * 3] = c0.r
      colA[i * 3 + 1] = c0.g
      colA[i * 3 + 2] = c0.b
      colB[i * 3] = 1
      colB[i * 3 + 1] = 1
      colB[i * 3 + 2] = 1
    }
    return { base, radial, distN, colA, colB }
  }, [count])

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [count])

  useFrame(() => {
    const t = progress.get()
    const travel = THREE.MathUtils.smoothstep(t, 0, 0.98)
    const burst = travel * 5.2
    const pos = geom.attributes.position.array
    const col = geom.attributes.color.array
    const fade = THREE.MathUtils.smoothstep(t, 0.06, 0.32) * (1 - THREE.MathUtils.smoothstep(t, 0.96, 1) * 0.22)
    for (let i = 0; i < count; i++) {
      const dn = distN[i]
      const bx = base[i * 3]
      const by = base[i * 3 + 1]
      const bz = base[i * 3 + 2]
      const k = burst * (0.35 + dn * 0.65)
      pos[i * 3] = bx + radial[i * 3] * k
      pos[i * 3 + 1] = by + radial[i * 3 + 1] * k
      pos[i * 3 + 2] = bz + radial[i * 3 + 2] * k * (0.9 + 0.35 * travel)
      const cm = THREE.MathUtils.smoothstep(t, 0.1, 0.72)
      col[i * 3] = THREE.MathUtils.lerp(colA[i * 3], colB[i * 3], cm) * fade
      col[i * 3 + 1] = THREE.MathUtils.lerp(colA[i * 3 + 1], colB[i * 3 + 1], cm) * fade
      col[i * 3 + 2] = THREE.MathUtils.lerp(colA[i * 3 + 2], colB[i * 3 + 2], cm) * fade
    }
    geom.attributes.position.needsUpdate = true
    geom.attributes.color.needsUpdate = true
    if (ref.current) ref.current.material.opacity = Math.min(1, fade * 1.15)
  })

  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial
        size={0.045}
        vertexColors
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  )
}

function QrParticleField({ progress, buffers }) {
  const ref = useRef()
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(buffers.n * 3)
    const col = new Float32Array(buffers.n * 3)
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [buffers])

  useFrame(() => {
    const t = progress.get()
    const pos = geom.attributes.position.array
    const col = geom.attributes.color.array
    const { n, basePos, radial, distNorm, startCol, endCol } = buffers
    // Recorrido 0→1: el QR sigue abriéndose todo el scroll (no frena a mitad)
    const travel = THREE.MathUtils.smoothstep(t, 0, 0.98)
    const radialCap = QR_EXPLODE_RADIAL_MAX * travel
    const colorMix = THREE.MathUtils.smoothstep(t, 0.05, 0.78)
    const twinkle = THREE.MathUtils.smoothstep(t, 0.08, 0.82)
    const shrink = 1 - THREE.MathUtils.smoothstep(t, 0.62, 0.98) * 0.16

    for (let i = 0; i < n; i++) {
      const dn = distNorm[i]
      const mag = radialCap * (0.2 + dn * 0.8)
      pos[i * 3] = basePos[i * 3] + radial[i * 3] * mag
      pos[i * 3 + 1] = basePos[i * 3 + 1] + radial[i * 3 + 1] * mag
      pos[i * 3 + 2] = basePos[i * 3 + 2] + radial[i * 3 + 2] * mag * (0.88 + 0.42 * travel)

      col[i * 3] = THREE.MathUtils.lerp(startCol[i * 3], endCol[i * 3], colorMix) * shrink
      col[i * 3 + 1] = THREE.MathUtils.lerp(startCol[i * 3 + 1], endCol[i * 3 + 1], colorMix) * shrink
      col[i * 3 + 2] = THREE.MathUtils.lerp(startCol[i * 3 + 2], endCol[i * 3 + 2], colorMix) * shrink
    }
    geom.attributes.position.needsUpdate = true
    geom.attributes.color.needsUpdate = true
    if (ref.current) {
      const zoomFactor = 1.05 + 0.12 * THREE.MathUtils.smoothstep(t, 0.2, 0.95)
      ref.current.material.size = 0.03 * zoomFactor * (0.88 + 0.48 * twinkle + 0.12 * THREE.MathUtils.smoothstep(t, 0.35, 0.98))
    }
  })

  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial
        size={0.032}
        vertexColors
        transparent
        opacity={1}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  )
}

function Scene({ progress, buffers }) {
  return (
    <>
      <ZoomCamera progress={progress} />
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.08} />
      {buffers && <QrParticleField progress={progress} buffers={buffers} />}
      <AmbientStars progress={progress} />
    </>
  )
}

function CanvasFallback() {
  return (
    <div style={{
      position: 'absolute', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: 13,
    }}>
      Cargando escena…
    </div>
  )
}

/**
 * Hero 100vh: QR procedural (grilla real + finders) → explosión radial scroll → campo estelar.
 * @param {Object} props
 * @param {MotionValue<number>} props.progress — 0 inicio QR, 1 fin vuelo
 */
export default function QrStarfieldHero({ progress }) {
  const [buffers, setBuffers] = useState(null)

  useEffect(() => {
    const list = buildProceduralQrPoints()
    setBuffers(buildBuffers(list))
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#000',
        pointerEvents: 'none',
      }}
    >
      <Suspense fallback={<CanvasFallback />}>
        <Canvas
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          dpr={[1, Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio : 1)]}
          camera={{ position: [0, 0, CAMERA_Z_START], fov: 42, near: 0.05, far: 80 }}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <Scene progress={progress} buffers={buffers} />
        </Canvas>
      </Suspense>
    </div>
  )
}

