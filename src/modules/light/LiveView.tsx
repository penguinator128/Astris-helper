import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { DiagramObject, DiagramLight } from '@/types/project';
import { EMITTING, evaluate, findSubject, illuminanceAt } from '@/lib/light/photometry';
import { kelvinToRgb } from '@/lib/colour/kelvin';

interface Props {
  objects: DiagramObject[];
  mode: 'camera' | 'orbit';
  verticalFovDeg: number;
}

/** Diagram space (x right, y up on the plan, z height) -> three (x right, y up, z towards viewer): three = (x, z, -y). */
const toThree = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);

function lightRgb(l: DiagramLight): THREE.Color {
  if (l.gel) return new THREE.Color(l.gel);
  const [r, g, b] = kelvinToRgb(l.kelvin);
  return new THREE.Color(r / 255, g / 255, b / 255);
}

function buildMannequin(): THREE.Group {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xb59a80, roughness: 0.7, metalness: 0 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x5a5a60, roughness: 0.9, metalness: 0 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 24), skin);
  head.position.set(0, 1.56, 0);
  head.scale.set(0.92, 1.12, 1);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.05, 12), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 1.54, 0.115);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 16), skin);
  neck.position.set(0, 1.41, 0);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.46, 6, 16), cloth);
  torso.position.set(0, 1.05, 0);
  torso.scale.set(1.25, 1, 0.7);
  const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.1, 6, 16), cloth);
  hips.position.set(0, 0.78, 0);
  hips.scale.set(1.2, 1, 0.8);
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.6, 6, 12), cloth);
  legL.position.set(-0.09, 0.38, 0);
  const legR = legL.clone();
  legR.position.x = 0.09;
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.5, 6, 12), cloth);
  armL.position.set(-0.26, 1.02, 0);
  const armR = armL.clone();
  armR.position.x = 0.26;
  for (const m of [head, nose, neck, torso, hips, legL, legR, armL, armR]) {
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

export default function LiveView({ objects, mode, verticalFovDeg }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    mannequin: THREE.Group;
    lightGroup: THREE.Group;
    kitGroup: THREE.Group;
    workLight: THREE.HemisphereLight;
    render: () => void;
  } | null>(null);
  const [unsupported] = useState(() => {
    try {
      const c = document.createElement('canvas');
      return !(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return true;
    }
  });

  // Set up renderer once
  useEffect(() => {
    const host = hostRef.current;
    if (!host || unsupported) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0b0c);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 1 }));
    back.position.set(0, 5, -6);
    back.receiveShadow = true;
    scene.add(back);
    scene.add(new THREE.AmbientLight(0xffffff, 0.035));

    const mannequin = buildMannequin();
    scene.add(mannequin);
    const lightGroup = new THREE.Group();
    const kitGroup = new THREE.Group();
    scene.add(kitGroup);
    // Soft work light so the whole layout reads in orbit; off in camera view so the lighting plan stays honest.
    const workLight = new THREE.HemisphereLight(0xf3f1ea, 0x2a2a2c, 0);
    scene.add(workLight);
    scene.add(lightGroup);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 1.5, 3.5);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.3, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.minDistance = 0.6;
    controls.maxDistance = 32;
    controls.maxPolarAngle = Math.PI * 0.52;

    let raf = 0;
    let dirty = true;
    const render = () => {
      dirty = true;
    };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const moved = controls.update();
      if (dirty || moved) {
        renderer.render(scene, camera);
        dirty = false;
      }
    };
    controls.addEventListener('change', render);
    const ro = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    });
    ro.observe(host);
    loop();
    stateRef.current = { renderer, scene, camera, controls, mannequin, lightGroup, kitGroup, workLight, render };
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      stateRef.current = null;
    };
  }, [unsupported]);

  // Rebuild lights when the diagram changes
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    const { lightGroup, mannequin, scene } = st;
    while (lightGroup.children.length) {
      const c = lightGroup.children[0];
      lightGroup.remove(c);
      c.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | undefined;
        if (mat) mat.dispose();
      });
    }
    const subject = findSubject(objects);
    const sx = subject?.x ?? 0;
    const sy = subject?.y ?? 0;
    mannequin.position.set(sx, 0, -sy);
    mannequin.rotation.y = subject ? THREE.MathUtils.degToRad(-subject.rotation + 180) : 0;
    const subjectHeight = subject?.height ?? 1.7;
    mannequin.scale.setScalar(subjectHeight / 1.7);
    const target = toThree(sx, sy, 1.45);

    const photometry = evaluate(objects);
    const lights = objects.filter((o): o is DiagramLight => o.type === 'light');
    const cardMat = (colour: number, opacity = 1) => new THREE.MeshStandardMaterial({ color: colour, roughness: 1, side: THREE.DoubleSide, transparent: opacity < 1, opacity });

    for (const l of lights) {
      const pos = toThree(l.x, l.y, l.height);
      const dir = new THREE.Vector3(Math.sin(THREE.MathUtils.degToRad(l.rotation)), 0, -Math.cos(THREE.MathUtils.degToRad(l.rotation)));
      if (EMITTING.includes(l.kind)) {
        if (l.power <= 0) continue;
        const colour = lightRgb(l);
        if (l.kind === 'sun') {
          const sun = new THREE.DirectionalLight(colour, (l.power / 100) * 9);
          sun.position.copy(target).add(dir.clone().multiplyScalar(-8).setY(Math.max(2, 8 * Math.tan(THREE.MathUtils.degToRad(-l.tilt || 30)))));
          sun.target.position.copy(target);
          sun.castShadow = true;
          sun.shadow.mapSize.set(2048, 2048);
          sun.shadow.camera.left = -4;
          sun.shadow.camera.right = 4;
          sun.shadow.camera.top = 4;
          sun.shadow.camera.bottom = -4;
          sun.shadow.bias = -0.0005;
          lightGroup.add(sun, sun.target);
          continue;
        }
        const spot = new THREE.SpotLight(colour);
        spot.position.copy(pos);
        // Aim along the facing direction with tilt, but centre on the subject when the beam covers it.
        const aimPoint = pos.clone().add(dir.clone().multiplyScalar(4));
        aimPoint.y = pos.y + 4 * Math.tan(THREE.MathUtils.degToRad(l.tilt));
        const toSubject = target.clone().sub(pos).normalize();
        const facing = aimPoint.clone().sub(pos).normalize();
        const offAxis = THREE.MathUtils.radToDeg(facing.angleTo(toSubject));
        spot.target.position.copy(offAxis <= l.spread / 2 ? target : aimPoint);
        // Penumbra from source size; widen the outer cone so the stated spread is roughly the half-power edge.
        spot.penumbra = THREE.MathUtils.clamp(0.1 + l.size * 0.25, 0.1, 0.5);
        spot.angle = THREE.MathUtils.degToRad(Math.min(88, Math.max(5, (l.spread / 2) * (1 + spot.penumbra))));
        spot.decay = 2;
        spot.distance = 0;
        // Physically based units: candela. A 100% key at 2 m should read as a normal exposure.
        const kindGain = l.kind === 'window' ? 2.5 : l.kind === 'practical' ? 0.35 : 1;
        spot.intensity = (l.power / 100) * 18 * kindGain;
        spot.castShadow = true;
        spot.shadow.mapSize.set(1024, 1024);
        spot.shadow.bias = -0.0008;
        spot.shadow.radius = 2 + l.size * 6;
        lightGroup.add(spot, spot.target);
        // Visible fixture
        const fixture = new THREE.Mesh(new THREE.BoxGeometry(Math.min(0.8, Math.max(0.12, l.size)), Math.min(0.7, Math.max(0.12, l.size * 0.9)), 0.05), new THREE.MeshStandardMaterial({ color: 0x202024, emissive: colour, emissiveIntensity: 0.3, roughness: 0.6 }));
        fixture.position.copy(pos);
        fixture.lookAt(spot.target.position);
        lightGroup.add(fixture);
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, l.height, 8), new THREE.MeshStandardMaterial({ color: 0x2a2a2c }));
        stand.position.set(pos.x, l.height / 2, pos.z);
        lightGroup.add(stand);
      } else {
        // Modifiers as cards in the scene; flags and negative fill block light, bounce cards add a soft source.
        const w = Math.max(0.3, l.size);
        const h = w * 0.75;
        const colour = l.kind === 'bounce' ? 0xf3f1ea : l.kind === 'diffusion' ? 0xffffff : 0x050505;
        const card = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cardMat(colour, l.kind === 'diffusion' ? 0.35 : 1));
        card.position.copy(pos);
        card.lookAt(pos.clone().add(dir));
        card.castShadow = l.kind !== 'diffusion';
        card.receiveShadow = true;
        lightGroup.add(card);
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, l.height, 8), new THREE.MeshStandardMaterial({ color: 0x2a2a2c }));
        stand.position.set(pos.x, l.height / 2, pos.z);
        lightGroup.add(stand);
        if (l.kind === 'bounce') {
          const onCard = lights.filter((x) => EMITTING.includes(x.kind)).reduce((s, x) => s + illuminanceAt(x, { x: l.x, y: l.y, z: l.height }, objects).illuminance, 0);
          if (onCard > 0.01) {
            const bounce = new THREE.SpotLight(0xfff4e0, Math.min(400, onCard * 140 * Math.min(1.5, l.size)));
            bounce.position.copy(pos).add(dir.clone().multiplyScalar(0.05));
            bounce.target.position.copy(target);
            bounce.angle = THREE.MathUtils.degToRad(50);
            bounce.penumbra = 1;
            bounce.decay = 2;
            lightGroup.add(bounce, bounce.target);
          }
        }
      }
    }
    // Auto exposure from the photometry so a 100% key at 2 m looks correctly exposed.
    st.renderer.toneMappingExposure = THREE.MathUtils.clamp(0.95 / Math.sqrt(Math.max(0.06, photometry.rawKey) / 0.25), 0.4, 1.8);
    scene.updateMatrixWorld(true);
    st.render();
  }, [objects]);

  // Everything else on the plan: extra talent, cameras, mics, recorders, monitors, walls, marks and areas.
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    const g = st.kitGroup;
    while (g.children.length) {
      const c = g.children[0];
      g.remove(c);
      c.traverse((n) => {
        const mesh = n as THREE.Mesh;
        mesh.geometry?.dispose();
        const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose();
      });
    }
    const mat = (colour: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: colour, roughness: 0.8, ...opts });
    const add = (mesh: THREE.Object3D) => {
      mesh.traverse((n) => {
        const m = n as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      g.add(mesh);
    };
    const facing = (deg: number) => new THREE.Vector3(Math.sin(THREE.MathUtils.degToRad(deg)), 0, -Math.cos(THREE.MathUtils.degToRad(deg)));
    const stand = (x: number, z: number, h: number, colour = 0x2a2a2c) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h, 8), mat(colour));
      m.position.set(x, h / 2, z);
      return m;
    };
    const subjects = objects.filter((o) => o.type === 'subject');
    const firstCam = objects.find((o) => o.type === 'camera');

    for (const o of objects) {
      const pos = toThree(o.x, o.y, 0);
      if (o.type === 'subject' && o !== subjects[0]) {
        if (o.subjectKind === 'person') {
          const m = buildMannequin();
          m.position.set(pos.x, 0, pos.z);
          m.rotation.y = THREE.MathUtils.degToRad(-o.rotation + 180);
          m.scale.setScalar(o.height / 1.7);
          add(m);
        } else {
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, o.height, 0.5), mat(0x6a6a70));
          b.position.set(pos.x, o.height / 2, pos.z);
          add(b);
        }
      } else if (o.type === 'wall') {
        const w = new THREE.Mesh(new THREE.BoxGeometry(o.length, 2.4, 0.1), mat(0x3a3a3e, { roughness: 1 }));
        w.position.set(pos.x, 1.2, pos.z);
        w.rotation.y = -THREE.MathUtils.degToRad(o.rotation);
        add(w);
      } else if (o.type === 'camera') {
        if (mode === 'camera' && o === firstCam) continue;
        const grp = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.08), mat(0x111113, { roughness: 0.5 }));
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 16), mat(0x1c1c1e, { roughness: 0.4 }));
        lens.rotation.x = Math.PI / 2;
        lens.position.z = 0.08;
        body.add(lens);
        body.position.set(0, 1.5, 0);
        grp.add(body);
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2;
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.55, 6), mat(0x2a2a2c));
          leg.position.set(Math.cos(a) * 0.22, 0.73, Math.sin(a) * 0.22);
          leg.lookAt(0, 1.45, 0);
          leg.rotateX(Math.PI / 2);
          grp.add(leg);
        }
        grp.position.set(pos.x, 0, pos.z);
        const f = facing(o.rotation);
        grp.lookAt(pos.x + f.x, 0, pos.z + f.z);
        add(grp);
      } else if (o.type === 'gear') {
        const f = facing(o.rotation);
        const isLav = /lav/i.test(o.label);
        if (o.category === 'mic' && !isLav) {
          // Mic on a boom stand at head height, angled down towards where it points
          const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 12), mat(0x1a1a1c, { roughness: 0.4 }));
          const head = new THREE.Group();
          head.add(mic);
          mic.rotation.x = Math.PI / 2;
          head.position.set(pos.x, 2.0, pos.z);
          head.lookAt(pos.x + f.x, 1.6, pos.z + f.z);
          add(head);
          add(stand(pos.x - f.x * 0.6, pos.z - f.z * 0.6, 2.0));
          const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.62, 6), mat(0x2a2a2c));
          boom.position.set(pos.x - f.x * 0.3, 2.0, pos.z - f.z * 0.3);
          boom.lookAt(pos.x, 2.0, pos.z);
          boom.rotateX(Math.PI / 2);
          add(boom);
        } else if (isLav) {
          const lav = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), mat(0x0b0b0c));
          lav.position.set(pos.x, 1.35, pos.z);
          add(lav);
        } else if (o.category === 'monitor') {
          const mon = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.03), mat(0x111113, { emissive: 0x334455, emissiveIntensity: 0.6 }));
          mon.position.set(pos.x, 1.4, pos.z);
          mon.lookAt(pos.x + f.x, 1.4, pos.z + f.z);
          add(mon);
          add(stand(pos.x, pos.z, 1.33));
        } else if (o.category === 'grip') {
          add(stand(pos.x, pos.z, 1.8));
        } else {
          const colour = o.category === 'power' ? 0x8a1f18 : o.category === 'recorder' ? 0x1a1a1c : 0x2e2e33;
          const box = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.15), mat(colour, { roughness: 0.6 }));
          box.position.set(pos.x, 0.045, pos.z);
          box.rotation.y = -THREE.MathUtils.degToRad(o.rotation);
          add(box);
        }
      } else if (o.type === 'zone') {
        const colour = o.zoneKind === 'base' ? 0xffc400 : o.zoneKind === 'nogo' || o.zoneKind === 'power' ? 0xb3261e : 0x9a978d;
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), new THREE.MeshStandardMaterial({ color: colour, transparent: true, opacity: o.zoneKind === 'base' ? 0.35 : 0.22, roughness: 1, depthWrite: false }));
        plane.rotation.x = -Math.PI / 2;
        plane.rotation.z = -THREE.MathUtils.degToRad(o.rotation);
        plane.position.set(pos.x, 0.006, pos.z);
        plane.receiveShadow = true;
        g.add(plane);
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(o.w, o.h)), new THREE.LineBasicMaterial({ color: colour }));
        edges.rotation.copy(plane.rotation);
        edges.position.set(pos.x, 0.008, pos.z);
        g.add(edges);
      } else if (o.type === 'mark') {
        const tMat = mat(0xffc400, { roughness: 0.6 });
        const a = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.004, 0.035), tMat);
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.004, 0.16), tMat);
        a.position.set(pos.x, 0.004, pos.z - 0.06);
        b.position.set(pos.x, 0.004, pos.z + 0.02);
        g.add(a, b);
      }
    }
    st.render();
  }, [objects, mode]);

  // Camera mode
  const prevMode = useRef<'camera' | 'orbit' | null>(null);
  useEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    const { camera, controls } = st;
    const cam = objects.find((o) => o.type === 'camera');
    const subject = findSubject(objects);
    const target = toThree(subject?.x ?? 0, subject?.y ?? 0, 1.45);
    if (mode === 'camera' && cam) {
      camera.fov = Math.max(5, Math.min(120, verticalFovDeg));
      camera.position.copy(toThree(cam.x, cam.y, 1.5));
      controls.target.copy(target);
      controls.enabled = false;
    } else {
      camera.fov = 40;
      controls.enabled = true;
      if (prevMode.current !== 'orbit') {
        // Start far enough back to see the whole plan.
        const extent = Math.max(3, ...objects.map((o) => Math.hypot(o.x - (subject?.x ?? 0), o.y - (subject?.y ?? 0))));
        const dist = Math.min(28, extent * 1.3 + 2);
        camera.position.set(target.x + dist * 0.55, Math.max(2.3, dist * 0.6), target.z + dist * 0.7);
      }
      controls.target.copy(target);
    }
    prevMode.current = mode;
    st.workLight.intensity = mode === 'orbit' ? 1.6 : 0;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    controls.update();
    st.render();
  }, [mode, objects, verticalFovDeg]);

  if (unsupported) {
    return (
      <div className="live-view live-view--off">
        <p className="small muted">WebGL is not available in this browser, so the live view is off. The diagram and readouts still work.</p>
      </div>
    );
  }
  return <div ref={hostRef} className="live-view" role="img" aria-label={mode === 'camera' ? 'Live preview from the camera position' : 'Live preview, orbit view'} />;
}
