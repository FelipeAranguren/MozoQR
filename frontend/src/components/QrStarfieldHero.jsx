import React, { useMemo, useRef, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
const QR_IMAGE = '/hero-qr.png'
const STARS_BG = '/hero-stars-bg.png'

const COL_STAR_A = new THREE.Color('#4CC9F0')
const COL_STAR_B = new THREE.Color('#F72585')
const COL_WHITE = new THREE.Color('#ffffff')

function detRand(i, salt = 0) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** Muestrea píxeles oscuros del QR → posiciones y colores iniciales. */
function sampleQrFromImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const cw = 168
      const ch = Math.max(8, Math.round((img.height / img.width) * cw))
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('canvas'))
        return
      }
      ctx.drawImage(img, 0, 0, cw, ch)
      const { data } = ctx.getImageData(0, 0, cw, ch)
      const step = 2
      const lumThreshold = 0.62
      const raw = []
      for (let y = 0; y < ch; y += step) {
        for (let x = 0; x < cw; x += step) {
          const yi = Math.min(ch - 1, Math.floor(y))
          const xi = Math.min(cw - 1, Math.floor(x))
          const j = (yi * cw + xi) * 4
          const r = data[j] / 255
          const g = data[j + 1] / 255
          const b = data[j + 2] / 255
          const lum = 0.299 * r + 0.587 * g + 0.114 * b
          if (lum < lumThreshold) {
            const nx = (xi / cw - 0.5) * 2.35
            const ny = -(yi / ch - 0.5) * 2.35
            raw.push({ nx, ny, r, g, b })
          }
        }
      }
      const maxParticles = 3200
      let list = raw
      if (raw.length > maxParticles) {
        const k = Math.ceil(raw.length / maxParticles)
        list = raw.filter((_, idx) => idx % k === 0)
      }
      resolve(list)
    }
    img.onerror = () => reject(new Error('img'))
    img.src = src
  })
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
    const u = Math.max(0, (t - 0.18) / 0.82)
    const burst = u * u * 9
    const pos = geom.attributes.position.array
    const col = geom.attributes.color.array
    const fade = THREE.MathUtils.smoothstep(t, 0.12, 0.45) * (1 - THREE.MathUtils.smoothstep(t, 0.88, 1))
    for (let i = 0; i < count; i++) {
      const dn = distN[i]
      const bx = base[i * 3]
      const by = base[i * 3 + 1]
      const bz = base[i * 3 + 2]
      const k = burst * (0.4 + dn * 1.4)
      pos[i * 3] = bx + radial[i * 3] * k
      pos[i * 3 + 1] = by + radial[i * 3 + 1] * k
      pos[i * 3 + 2] = bz + radial[i * 3 + 2] * k * 1.4
      const cm = THREE.MathUtils.smoothstep(t, 0.1, 0.55)
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
    const spread = 2.8 + t * 7.2
    const burst = t * t * (1 + t * 0.35)
    const pos = geom.attributes.position.array
    const col = geom.attributes.color.array
    const { n, basePos, radial, distNorm, startCol, endCol } = buffers
    const colorMix = THREE.MathUtils.smoothstep(t, 0.08, 0.72)
    const shrink = 1 - THREE.MathUtils.smoothstep(t, 0.35, 0.95) * 0.55

    for (let i = 0; i < n; i++) {
      const dn = distNorm[i]
      const mag = burst * spread * (0.35 + dn * 1.15)
      pos[i * 3] = basePos[i * 3] + radial[i * 3] * mag
      pos[i * 3 + 1] = basePos[i * 3 + 1] + radial[i * 3 + 1] * mag
      pos[i * 3 + 2] = basePos[i * 3 + 2] + radial[i * 3 + 2] * mag * 1.65

      col[i * 3] = THREE.MathUtils.lerp(startCol[i * 3], endCol[i * 3], colorMix) * shrink
      col[i * 3 + 1] = THREE.MathUtils.lerp(startCol[i * 3 + 1], endCol[i * 3 + 1], colorMix) * shrink
      col[i * 3 + 2] = THREE.MathUtils.lerp(startCol[i * 3 + 2], endCol[i * 3 + 2], colorMix) * shrink
    }
    geom.attributes.position.needsUpdate = true
    geom.attributes.color.needsUpdate = true
    if (ref.current) {
      const s = 0.85 + t * 0.45
      ref.current.material.size = 0.028 * s
    }
  })

  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial
        size={0.028}
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

function StarfieldBackdrop({ progress }) {
  const { viewport } = useThree()
  const [map, setMap] = useState(null)
  useEffect(() => {
    const loader = new THREE.TextureLoader()
    loader.load(STARS_BG, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      setMap(tex)
    })
  }, [])
  const meshRef = useRef()
  useFrame(() => {
    const t = progress.get()
    if (!meshRef.current) return
    meshRef.current.material.opacity = THREE.MathUtils.smoothstep(t, 0.35, 0.92) * 0.42
  })
  if (!map) return null
  const w = viewport.width * 2.2
  const h = viewport.height * 2.2
  return (
    <mesh ref={meshRef} position={[0, 0, -14]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={map} transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function Scene({ progress, buffers }) {
  return (
    <>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.08} />
      <StarfieldBackdrop progress={progress} />
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
 * Hero 100vh: QR 3D desde imagen → explosión radial scroll → campo estelar.
 * @param {Object} props
 * @param {MotionValue<number>} props.progress — 0 inicio QR, 1 fin vuelo
 */
export default function QrStarfieldHero({ progress }) {
  const [buffers, setBuffers] = useState(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    let cancelled = false
    sampleQrFromImage(QR_IMAGE)
      .then((list) => {
        if (cancelled) return
        if (!list.length) {
          setErr(true)
          return
        }
        setBuffers(buildBuffers(list))
      })
      .catch(() => {
        if (!cancelled) setErr(true)
      })
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      {err && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, background: '#000',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 14, padding: 24, textAlign: 'center',
        }}>
          No se pudo cargar el QR. Colocá hero-qr.png en /public.
        </div>
      )}
      <Suspense fallback={<CanvasFallback />}>
        <Canvas
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          dpr={[1, Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio : 1)]}
          camera={{ position: [0, 0, 9.2], fov: 42, near: 0.05, far: 80 }}
          style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
        >
          <Scene progress={progress} buffers={buffers} />
        </Canvas>
      </Suspense>
    </div>
  )
}

