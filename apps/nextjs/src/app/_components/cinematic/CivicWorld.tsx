"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { cameraAt, layoutMix, phoneFootprint, prismMorph } from "./journey";
import { CinematicPalette, GOLD_RGB, IVORY_RGB } from "./palette";
import {
  lineFragment,
  lineVertex,
  pointFragment,
  pointVertex,
} from "./shaders";
import { useJourney } from "./use-journey";
import {
  createCapitolLines,
  createEdges,
  createLayouts,
  createParticles,
  edgeCountForViewport,
  mixLayouts,
  particleCountForViewport,
} from "./world-layout";

function contourGeometry() {
  const geo = new THREE.BufferGeometry();
  const points: number[] = [];
  const pushRing = (
    count: number,
    rx: number,
    ry: number,
    z: number,
    dx = 0,
  ) => {
    for (let i = 0; i < count; i++) {
      const t0 = (i / count) * Math.PI * 2;
      const t1 = ((i + 1) / count) * Math.PI * 2;
      points.push(
        Math.cos(t0) * rx + dx,
        Math.sin(t0) * ry,
        z,
        Math.cos(t1) * rx + dx,
        Math.sin(t1) * ry,
        z,
      );
    }
  };
  pushRing(64, 5.4, 2.15, -1.8);
  pushRing(48, 3.6, 1.4, -1.2, 0.8);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return geo;
}

function CivicScene() {
  const { progressRef, width, focusTopic } = useJourney();
  const count = particleCountForViewport(width);
  const edgeCount = edgeCountForViewport(width);
  const holeVec = useMemo(() => new THREE.Vector4(), []);

  const world = useMemo(() => {
    const particles = createParticles(count);
    const layouts = createLayouts(particles);
    const edges = createEdges(particles, edgeCount);
    const mixed = new Float32Array(count * 3);
    mixed.set(layouts.quiet);
    const importance = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      importance[i] = particles[i]?.importance ?? 0;
    }
    return { particles, layouts, edges, mixed, importance };
  }, [count, edgeCount]);

  const pointsGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(world.mixed, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    geo.setAttribute(
      "aImportance",
      new THREE.BufferAttribute(world.importance, 1),
    );
    return geo;
  }, [world]);

  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array((world.edges.length / 2) * 2 * 3);
    const strength = new Float32Array((world.edges.length / 2) * 2);
    for (let i = 0; i < strength.length; i++) {
      strength[i] = i % 7 === 0 ? 0.22 : 0.07;
    }
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geo.setAttribute("aStrength", new THREE.BufferAttribute(strength, 1));
    return geo;
  }, [world]);

  const contours = useMemo(() => contourGeometry(), []);
  const capitolGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const lines = createCapitolLines();
    geo.setAttribute("position", new THREE.BufferAttribute(lines, 3));
    const strength = new Float32Array(lines.length / 3);
    strength.fill(0.62);
    geo.setAttribute("aStrength", new THREE.BufferAttribute(strength, 1));
    return geo;
  }, []);

  const holeUniforms = useMemo(
    () => ({
      uHole: { value: holeVec },
      uHoleOn: { value: 0 },
    }),
    [holeVec],
  );

  const pointsMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexShader: pointVertex,
        fragmentShader: pointFragment,
        uniforms: {
          uTime: { value: 0 },
          uProgress: { value: 0 },
          uSize: { value: width < 720 ? 0.75 : 0.95 },
          uGold: { value: new THREE.Vector3(...GOLD_RGB) },
          uIvory: { value: new THREE.Vector3(...IVORY_RGB) },
          ...holeUniforms,
        },
      }),
    [width, holeUniforms],
  );

  const lineMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexShader: lineVertex,
        fragmentShader: lineFragment,
        uniforms: {
          uProgress: { value: 0 },
          uMorph: { value: 0 },
          uInvertMorph: { value: 0 },
          uColor: { value: new THREE.Vector3(...GOLD_RGB) },
          ...holeUniforms,
        },
      }),
    [holeUniforms],
  );

  const capitolMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexShader: lineVertex,
        fragmentShader: lineFragment,
        uniforms: {
          uProgress: { value: 0 },
          uMorph: { value: 0 },
          uInvertMorph: { value: 1 },
          uColor: { value: new THREE.Vector3(...GOLD_RGB) },
          uHole: { value: new THREE.Vector4() },
          uHoleOn: { value: 0 },
        },
      }),
    [],
  );

  const mixedRef = useRef(world.mixed);
  const worldRef = useRef(world);
  const pointsMatRef = useRef(pointsMat);
  const lineMatRef = useRef(lineMat);
  const capitolMatRef = useRef(capitolMat);
  const pointsGeoRef = useRef(pointsGeo);
  const lineGeoRef = useRef(lineGeo);
  const prismGroupRef = useRef<THREE.Group>(null);
  const capitolGroupRef = useRef<THREE.Group>(null);
  const prismMeshRef = useRef<THREE.Mesh>(null);
  const contourRef = useRef<THREE.LineSegments>(null);

  useEffect(() => {
    mixedRef.current = world.mixed;
    worldRef.current = world;
    pointsMatRef.current = pointsMat;
    lineMatRef.current = lineMat;
    capitolMatRef.current = capitolMat;
    pointsGeoRef.current = pointsGeo;
    lineGeoRef.current = lineGeo;
  }, [world, pointsMat, lineMat, capitolMat, pointsGeo, lineGeo]);

  useEffect(() => {
    return () => {
      pointsGeo.dispose();
      lineGeo.dispose();
      contours.dispose();
      capitolGeo.dispose();
      pointsMat.dispose();
      lineMat.dispose();
      capitolMat.dispose();
    };
  }, [
    pointsGeo,
    lineGeo,
    pointsMat,
    lineMat,
    contours,
    capitolGeo,
    capitolMat,
  ]);

  useFrame(({ camera, clock, size, gl }) => {
    const progress = progressRef.current;
    const cam = cameraAt(progress);
    camera.position.set(cam.position[0], cam.position[1], cam.position[2]);
    camera.lookAt(cam.lookAt[0], cam.lookAt[1], cam.lookAt[2]);
    if (camera instanceof THREE.PerspectiveCamera) {
      if (Math.abs(camera.fov - cam.fov) > 0.05) {
        camera.fov = cam.fov;
        camera.updateProjectionMatrix();
      }
    }

    const current = worldRef.current;
    const mixed = mixedRef.current;
    const mix = layoutMix(progress);
    mixLayouts(
      current.layouts[mix.from],
      current.layouts[mix.to],
      mix.t,
      mixed,
    );

    if (focusTopic && (mix.from === "threads" || mix.to === "threads")) {
      const topicIndex = [
        "technology",
        "defense",
        "economy",
        "energy",
        "healthcare",
      ].indexOf(focusTopic);
      for (let i = 0; i < current.particles.length; i++) {
        const particle = current.particles[i];
        if (!particle || particle.topic === topicIndex) continue;
        const o = i * 3;
        mixed[o] = (mixed[o] ?? 0) * 1.12;
        mixed[o + 1] = (mixed[o + 1] ?? 0) * 0.72;
      }
    }

    const pos = pointsGeoRef.current.getAttribute("position");
    pos.needsUpdate = true;

    const linePos = lineGeoRef.current.getAttribute("position");
    const arr = linePos.array;
    if (arr instanceof Float32Array) {
      const edges = current.edges;
      for (let e = 0; e < edges.length; e += 2) {
        const ia = (edges[e] ?? 0) * 3;
        const ib = (edges[e + 1] ?? 0) * 3;
        const o = e * 3;
        arr[o] = mixed[ia] ?? 0;
        arr[o + 1] = mixed[ia + 1] ?? 0;
        arr[o + 2] = mixed[ia + 2] ?? 0;
        arr[o + 3] = mixed[ib] ?? 0;
        arr[o + 4] = mixed[ib + 1] ?? 0;
        arr[o + 5] = mixed[ib + 2] ?? 0;
      }
      linePos.needsUpdate = true;
    }

    const timeUniform = pointsMatRef.current.uniforms.uTime;
    const progressUniform = pointsMatRef.current.uniforms.uProgress;
    const lineProgress = lineMatRef.current.uniforms.uProgress;
    const lineMorph = lineMatRef.current.uniforms.uMorph;
    const capitolProgress = capitolMatRef.current.uniforms.uProgress;
    const capitolMorph = capitolMatRef.current.uniforms.uMorph;
    const form = prismMorph(progress);
    if (timeUniform) timeUniform.value = clock.elapsedTime;
    if (progressUniform) progressUniform.value = progress;
    if (lineProgress) lineProgress.value = progress;
    if (lineMorph) lineMorph.value = form.morph;
    if (capitolProgress) capitolProgress.value = progress;
    if (capitolMorph) capitolMorph.value = form.fillOpacity;

    const dpr = gl.getPixelRatio();
    const foot = phoneFootprint(progress, size.width, size.height);
    holeVec.set(
      (foot.xPct / 100) * size.width * dpr,
      (1 - foot.yPct / 100) * size.height * dpr,
      (foot.halfWPct / 100) * size.width * dpr,
      (foot.halfHPct / 100) * size.height * dpr,
    );
    const holeOnUniform = pointsMatRef.current.uniforms.uHoleOn;
    if (holeOnUniform) holeOnUniform.value = foot.opacity;

    if (prismGroupRef.current) {
      prismGroupRef.current.rotation.y =
        clock.elapsedTime * 0.055 * form.spin + form.morph * 0.52;
      prismGroupRef.current.rotation.x = 0.28 * form.spin + form.morph * 0.02;
      prismGroupRef.current.scale.setScalar(form.scale);
    }
    if (capitolGroupRef.current) {
      const show = form.fillOpacity;
      capitolGroupRef.current.visible = show > 0.01;
      capitolGroupRef.current.scale.setScalar(0.54);
      capitolGroupRef.current.position.set(-0.04, -0.34, 0.15);
      capitolGroupRef.current.rotation.set(0.05, 0.36, 0);
    }
    const prismMat = prismMeshRef.current?.material;
    if (prismMat instanceof THREE.MeshBasicMaterial) {
      prismMat.opacity = form.prismOpacity;
    }
    const contourMat = contourRef.current?.material;
    if (contourMat instanceof THREE.LineBasicMaterial) {
      contourMat.opacity = 0.045 * (1 - form.morph);
    }
  });

  return (
    <>
      <points geometry={pointsGeo} frustumCulled={false} material={pointsMat} />
      <lineSegments
        geometry={lineGeo}
        frustumCulled={false}
        material={lineMat}
      />
      <lineSegments ref={contourRef} geometry={contours} frustumCulled={false}>
        <lineBasicMaterial
          color={CinematicPalette.gold}
          transparent
          opacity={0.045}
        />
      </lineSegments>
      <group ref={prismGroupRef}>
        <mesh ref={prismMeshRef} frustumCulled={false} renderOrder={1}>
          <icosahedronGeometry args={[1, 1]} />
          <meshBasicMaterial
            color={CinematicPalette.gold}
            wireframe
            transparent
            opacity={0.05}
            depthWrite={false}
          />
        </mesh>
      </group>
      <group ref={capitolGroupRef}>
        <lineSegments
          geometry={capitolGeo}
          frustumCulled={false}
          material={capitolMat}
        />
      </group>
    </>
  );
}

export function CivicWorld() {
  return (
    <Canvas
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
      }}
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.12, 8.2], fov: 32, near: 0.08, far: 60 }}
      resize={{ debounce: 0 }}
      style={{
        pointerEvents: "none",
        background: CinematicPalette.void,
        width: "100%",
        height: "100%",
      }}
    >
      <color attach="background" args={[CinematicPalette.void]} />
      <fog attach="fog" args={[CinematicPalette.void, 12, 28]} />
      <CivicScene />
    </Canvas>
  );
}
