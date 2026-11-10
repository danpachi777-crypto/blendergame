import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { FOODS, matchesDirection, comboTier, cutScore } from "./slicing";
export type Snapshot = {
  phase: "loading" | "ready" | "playing" | "paused" | "result";
  score: number;
  combo: number;
  best: number;
  time: number;
  tier: number;
  food: string;
  arrow: string;
  progress: number;
  message: string;
  perfect: number;
  misses: number;
  practice: boolean;
};
export type Game = {
  start: (practice: boolean) => void;
  pause: () => void;
  finish: () => void;
  home: () => void;
  setSound: (v: boolean) => void;
  dispose: () => void;
};
type Food = {
  root: THREE.Group;
  whole: THREE.Object3D;
  halves: THREE.Object3D[];
  index: number;
  age: number;
  cut: boolean;
  side: number;
  cutAge: number;
  rotation: number;
};
type Particle = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  color: THREE.Color;
};
export async function createGame(
  host: HTMLElement,
  update: (s: Snapshot) => void,
  positionCue: (x: number, y: number, visible: boolean) => void,
): Promise<Game> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b2c24);
  scene.fog = new THREE.Fog(0x1b2c24, 6, 13);
  const camera = new THREE.PerspectiveCamera(43, 1, 0.05, 30);
  const cameraBase = new THREE.Vector3(0, 2.55, 3.18);
  camera.position.copy(cameraBase);
  camera.lookAt(0, 0.12, -0.14);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.87;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const fx = document.createElement("canvas");
  fx.className = "fx-canvas";
  Object.assign(fx.style, {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
    width: "100%",
    height: "100%",
  });
  host.appendChild(fx);
  const ctx = fx.getContext("2d")!;
  let width = 1,
    height = 1;
  const resize = () => {
    width = host.clientWidth;
    height = host.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    fx.width = width * renderer.getPixelRatio();
    fx.height = height * renderer.getPixelRatio();
    ctx.setTransform(
      renderer.getPixelRatio(),
      0,
      0,
      renderer.getPixelRatio(),
      0,
      0,
    );
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.7;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xfff4d9, 0x254333, 1.15));
  const key = new THREE.DirectionalLight(0xffdc9c, 2.6);
  key.position.set(-2, 5, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.bias = -0.001;
  key.shadow.normalBias = 0.025;
  scene.add(key);
  const rim = new THREE.PointLight(0xd4ffc1, 12, 8);
  rim.position.set(2, 2, -2);
  scene.add(rim);
  const loader = new GLTFLoader();
  const roots: THREE.Group[] = [];
  try {
    for (const name of ["kitchen", "knife", ...FOODS.map((f) => f.id)]) {
      const gltf = await loader.loadAsync(
        `${import.meta.env.BASE_URL}models/${name}.glb`,
      );
      gltf.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      roots.push(gltf.scene);
    }
  } catch (e) {
    ro.disconnect();
    renderer.dispose();
    renderer.domElement.remove();
    fx.remove();
    environment.dispose();
    throw e;
  }
  const [kitchen, knife, ...templates] = roots;
  scene.add(kitchen);
  scene.add(knife);
  knife.position.set(0.65, 0.3, 0.72);
  knife.rotation.set(0.2, -0.36, -0.15);
  const particleCount = 160,
    particleGeometry = new THREE.BufferGeometry(),
    positions = new Float32Array(particleCount * 3),
    colors = new Float32Array(particleCount * 3);
  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3),
  );
  particleGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const particleMaterial = new THREE.PointsMaterial({
    size: 0.033,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(particleGeometry, particleMaterial);
  points.frustumCulled = false;
  scene.add(points);
  const particles: Particle[] = [];
  const state: Snapshot = {
    phase: "ready",
    score: 0,
    combo: 0,
    best: 0,
    time: 60,
    tier: 0,
    food: "",
    arrow: "↓",
    progress: 1,
    message: "",
    perfect: 0,
    misses: 0,
    practice: false,
  };
  let food: Food | null = null,
    discarded: Food[] = [],
    sequence = 0,
    spawnDelay = 0.4,
    disposed = false,
    raf = 0,
    last = performance.now(),
    hudClock = 0,
    messageTime = 0,
    knifeSwing = 0,
    shake = 0,
    hitStop = 0,
    soundEnabled = true,
    audio: AudioContext | null = null,
    noiseBuffer: AudioBuffer | null = null,
    down = false,
    pointerId = -1,
    anchor = { x: 0, y: 0, time: 0 },
    pointer = { x: 0, y: 0 },
    swipeTime = 0;
  let cutDirection = { x: 0, y: 1 };
  const trail: { x: number; y: number; age: number }[] = [];
  const flashes: {
    x: number;
    y: number;
    angle: number;
    age: number;
    tier: number;
  }[] = [];
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const emit = () => update({ ...state });
  function initAudio() {
    try {
      audio ??= new AudioContext();
      if (audio.state === "suspended") void audio.resume();
      if (!noiseBuffer) {
        noiseBuffer = audio.createBuffer(
          1,
          audio.sampleRate * 0.18,
          audio.sampleRate,
        );
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++)
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      }
    } catch {}
  }
  function chopSound() {
    if (!soundEnabled || !audio || !noiseBuffer) return;
    const now = audio.currentTime;
    const noise = audio.createBufferSource();
    noise.buffer = noiseBuffer;
    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1400 + state.tier * 1300;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    noise.connect(filter).connect(gain).connect(audio.destination);
    noise.start();
    const osc = audio.createOscillator(),
      g = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(200 + state.tier * 110, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.1);
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(g).connect(audio.destination);
    osc.start();
    osc.stop(now + 0.15);
    if (state.tier > 0) {
      const tone = audio.createOscillator(),
        tg = audio.createGain();
      tone.type = "sine";
      tone.frequency.value = 440 * Math.pow(2, (state.combo % 7) / 12);
      tg.gain.setValueAtTime(0.045, now);
      tg.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      tone.connect(tg).connect(audio.destination);
      tone.start();
      tone.stop(now + 0.31);
    }
  }
  function removeFood(f: Food) {
    scene.remove(f.root);
  }
  function clear() {
    if (food) removeFood(food);
    discarded.forEach(removeFood);
    food = null;
    discarded = [];
    particles.length = 0;
    trail.length = 0;
    flashes.length = 0;
    positionCue(0, 0, false);
  }
  function spawn(demo = false) {
    const index = demo
      ? 0
      : sequence < 4
        ? sequence % 4
        : Math.floor(Math.random() * 4);
    sequence++;
    const root = templates[index].clone(true);
    const spec = FOODS[index];
    const whole = root.getObjectByName(`${spec.id}_whole`)!;
    const halves = [
      root.getObjectByName(`${spec.id}_halfA`)!,
      root.getObjectByName(`${spec.id}_halfB`)!,
    ];
    if (!whole || halves.some((h) => !h))
      throw new Error(`Invalid Blender asset: ${spec.id}`);
    whole.visible = true;
    halves.forEach((h) => (h.visible = false));
    const side = sequence % 2 ? 1 : -1;
    root.position.set(demo ? 0 : side * 2.6, 0.105, 0);
    root.rotation.y = [0, -0.65, Math.PI / 2, 0.65][index];
    scene.add(root);
    food = {
      root,
      whole,
      halves,
      index,
      age: demo ? 1 : 0,
      cut: false,
      side,
      cutAge: 0,
      rotation: 0,
    };
    state.food = spec.name;
    state.arrow = spec.arrow;
    state.progress = 1;
  }
  function cut(dx: number, dy: number) {
    const length = Math.hypot(dx, dy);
    cutDirection = { x: dx / length, y: dy / length };
    if (!food || food.cut || food.age < 0.43) return;
    const f = food;
    f.cut = true;
    f.cutAge = 0;
    f.whole.visible = false;
    f.halves.forEach((h) => (h.visible = true));
    state.combo++;
    state.best = Math.max(state.best, state.combo);
    state.tier = comboTier(state.combo);
    const perfect = f.age < 1.35;
    state.score += cutScore(state.combo, perfect);
    if (perfect) state.perfect++;
    state.message = perfect ? "PERFECT CUT" : "NICE CUT";
    messageTime = 0.65;
    knifeSwing = 1;
    shake = reducedMotion ? 0 : 0.025 + state.tier * 0.012;
    hitStop = 0.035;
    chopSound();
    if ("vibrate" in navigator) navigator.vibrate(12 + state.tier * 5);
    for (let i = 0; i < 16 + state.tier * 18; i++) {
      if (particles.length >= particleCount) particles.shift();
      const life = 0.3 + Math.random() * 0.5;
      particles.push({
        position: f.root.position.clone().add(new THREE.Vector3(0, 0.17, 0)),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          1 + Math.random() * 2,
          (Math.random() - 0.5) * 2,
        ),
        life,
        maxLife: life,
        color: new THREE.Color(
          state.tier >= 2
            ? i % 2
              ? 0xffd27d
              : 0xfff4c4
            : FOODS[f.index].color,
        ),
      });
    }
    const projected = f.root.position
      .clone()
      .add(new THREE.Vector3(0, 0.18, 0))
      .project(camera);
    flashes.push({
      x: (projected.x * 0.5 + 0.5) * width,
      y: (-0.5 * projected.y + 0.5) * height,
      angle: Math.atan2(dy, dx),
      age: 0,
      tier: state.tier,
    });
    discarded.push(f);
    food = null;
    spawnDelay = 0.29;
    positionCue(0, 0, false);
    emit();
  }
  const pointerDown = (e: PointerEvent) => {
    if (state.phase !== "playing" || down) return;
    e.preventDefault();
    initAudio();
    down = true;
    pointerId = e.pointerId;
    renderer.domElement.setPointerCapture(e.pointerId);
    anchor = { x: e.clientX, y: e.clientY, time: performance.now() };
    const r = host.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    trail.length = 0;
  };
  const pointerMove = (e: PointerEvent) => {
    if (!down || e.pointerId !== pointerId || state.phase !== "playing") return;
    e.preventDefault();
    const now = performance.now(),
      r = host.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    trail.push({ ...pointer, age: 0 });
    if (trail.length > 24) trail.shift();
    const dx = e.clientX - anchor.x,
      dy = e.clientY - anchor.y;
    if (now - anchor.time > 220) {
      anchor = { x: e.clientX, y: e.clientY, time: now };
      return;
    }
    if (food && !food.cut && Math.hypot(dx, dy) >= 34) {
      if (
        matchesDirection(dx, dy, FOODS[food.index].direction) &&
        now - swipeTime > 190
      ) {
        cut(dx, dy);
        swipeTime = now;
      }
      anchor = { x: e.clientX, y: e.clientY, time: now };
    }
  };
  const pointerUp = (e: PointerEvent) => {
    if (e.pointerId === pointerId) {
      down = false;
      pointerId = -1;
    }
  };
  const canvas = renderer.domElement;
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  canvas.addEventListener("lostpointercapture", () => {
    down = false;
  });
  const onVisibility = () => {
    if (document.hidden && state.phase === "playing") {
      state.phase = "paused";
      down = false;
      emit();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  function finish() {
    if (state.phase !== "playing" && state.phase !== "paused") return;
    state.phase = "result";
    down = false;
    positionCue(0, 0, false);
    emit();
  }
  function drawFX(dt: number) {
    ctx.clearRect(0, 0, width, height);
    for (const t of trail) t.age += dt;
    while (trail[0]?.age > 0.18) trail.shift();
    if (trail.length > 1) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.shadowColor = state.tier >= 2 ? "#ffda89" : "#e2ffac";
      ctx.shadowBlur = 10 + state.tier * 7;
      for (let i = 1; i < trail.length; i++) {
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.strokeStyle = `rgba(235,255,195,${Math.max(0, 1 - trail[i].age / 0.18) * 0.85})`;
        ctx.lineWidth = 2 + state.tier;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.age += dt;
      if (f.age > 0.3) {
        flashes.splice(i, 1);
        continue;
      }
      const alpha = 1 - f.age / 0.3;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = f.tier >= 2 ? "#ffb84a" : "#dfffad";
      ctx.shadowBlur = 20 + f.tier * 8;
      const length = 90 + f.tier * 25;
      const gradient = ctx.createLinearGradient(-length, 0, length, 0);
      gradient.addColorStop(0, "transparent");
      gradient.addColorStop(0.45, "#fff5d0");
      gradient.addColorStop(0.5, "white");
      gradient.addColorStop(0.55, "#fff5d0");
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(-length, 0);
      ctx.quadraticCurveTo(0, -12 - f.tier * 3, length, 0);
      ctx.quadraticCurveTo(0, 10 + f.tier * 3, -length, 0);
      ctx.fill();
      if (f.tier >= 1) {
        ctx.strokeStyle = "#f4ffcf";
        ctx.lineWidth = 1;
        for (let n = 0; n < 6 + f.tier * 3; n++) {
          const a = n * 2.4 + f.age * 2,
            r = 20 + f.age * 150;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx.lineTo(Math.cos(a) * (r + 12), Math.sin(a) * (r + 12));
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }
  function frame(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const elapsed = (now - last) / 1000;
    let dt = Math.min(elapsed, 0.04);
    last = now;
    const active = state.phase === "playing";
    if (hitStop > 0) {
      hitStop -= dt;
      dt *= 0.1;
    }
    if (active) {
      if (!state.practice) {
        state.time = Math.max(0, state.time - elapsed);
        if (state.time <= 0) finish();
      }
      if (messageTime > 0) {
        messageTime -= dt;
        if (messageTime <= 0) {
          state.message = "";
          emit();
        }
      }
      if (food) {
        food.age += dt;
        const entrance = Math.min(food.age / 0.47, 1),
          ease = 1 - Math.pow(1 - entrance, 3);
        food.root.position.x = food.side * 2.6 * (1 - ease);
        food.root.position.y = 0.105 + Math.sin(entrance * Math.PI) * 0.055;
        const deadline = state.practice
          ? Infinity
          : Math.max(2.1, 4 - state.combo * 0.035);
        state.progress = state.practice
          ? 1
          : Math.max(0, 1 - (food.age - 0.47) / deadline);
        if (food.age > deadline + 0.47) {
          state.misses++;
          state.combo = 0;
          state.tier = 0;
          state.message = "次の一切りへ";
          messageTime = 0.7;
          removeFood(food);
          food = null;
          spawnDelay = 0.15;
          emit();
        }
      } else {
        spawnDelay -= dt;
        if (spawnDelay <= 0) spawn();
      }
    }
    for (let i = discarded.length - 1; i >= 0; i--) {
      const f = discarded[i];
      if (active) f.cutAge += dt;
      const t = f.cutAge;
      for (let j = 0; j < 2; j++) {
        const h = f.halves[j],
          sign = j === 0 ? -1 : 1;
        h.position.x = sign * t * 1.65;
        h.position.y = Math.max(-0.35, t * 1.8 - t * t * 3);
        h.rotation.z = sign * t * 2;
        h.rotation.x = t * 0.7;
      }
      if (t > 0.7) {
        removeFood(f);
        discarded.splice(i, 1);
      }
    }
    if (state.phase !== "paused") {
      knifeSwing = Math.max(0, knifeSwing - dt * 5.5);
      shake *= Math.exp(-dt * 15);
      const swing = Math.sin((1 - knifeSwing) * Math.PI);
      knife.position.set(
        0.6 -
          swing * 0.45 +
          cutDirection.x * swing * 0.3 +
          (down ? (pointer.x / width - 0.5) * 0.18 : 0),
        0.28 + (knifeSwing ? Math.cos((1 - knifeSwing) * Math.PI) * 0.17 : 0),
        0.73 - swing * 0.38 + cutDirection.y * swing * 0.2,
      );
      knife.rotation.set(
        0.2 - swing * 0.4,
        -0.38 - swing * 0.55 + cutDirection.x * swing * 0.7,
        -0.15 - swing * 0.45,
      );
      camera.position.copy(cameraBase);
      if (!reducedMotion) {
        camera.position.x += Math.sin(now * 0.12) * shake;
        camera.position.y += Math.cos(now * 0.14) * shake;
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (state.phase !== "paused") {
        p.life -= dt;
        p.velocity.y -= 5 * dt;
        p.position.addScaledVector(p.velocity, dt);
      }
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = 0; i < particleCount; i++) {
      const p = particles[i];
      if (p) {
        positions.set(p.position.toArray(), i * 3);
        const fade = p.life / p.maxLife;
        colors[i * 3] = p.color.r * fade;
        colors[i * 3 + 1] = p.color.g * fade;
        colors[i * 3 + 2] = p.color.b * fade;
      } else {
        positions[i * 3] = 999;
        positions[i * 3 + 1] = 999;
        positions[i * 3 + 2] = 999;
      }
    }
    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.color.needsUpdate = true;
    if (active && food) {
      const p = food.root.position
        .clone()
        .add(new THREE.Vector3(0, 0.42, 0))
        .project(camera);
      positionCue(
        (p.x * 0.5 + 0.5) * width,
        (-p.y * 0.5 + 0.5) * height - 15,
        food.age > 0.3,
      );
    } else positionCue(0, 0, false);
    renderer.render(scene, camera);
    drawFX(state.phase === "paused" ? 0 : dt);
    hudClock += dt;
    if (active && hudClock > 0.07) {
      hudClock = 0;
      emit();
    }
  }
  spawn(true);
  emit();
  raf = requestAnimationFrame(frame);
  return {
    start(practice) {
      clear();
      Object.assign(state, {
        phase: "playing",
        score: 0,
        combo: 0,
        best: 0,
        time: 60,
        tier: 0,
        food: "",
        progress: 1,
        message: "",
        perfect: 0,
        misses: 0,
        practice,
      });
      sequence = 0;
      spawnDelay = 0.2;
      down = false;
      initAudio();
      emit();
    },
    pause() {
      if (state.phase === "playing") state.phase = "paused";
      else if (state.phase === "paused") state.phase = "playing";
      down = false;
      emit();
    },
    finish,
    home() {
      clear();
      state.phase = "ready";
      state.tier = 0;
      spawn(true);
      emit();
    },
    setSound(v) {
      soundEnabled = v;
      if (v) initAudio();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>(),
        textures = new Set<THREE.Texture>();
      roots.forEach((root) =>
        root.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            geometries.add(o.geometry);
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material]) {
              materials.add(m);
              for (const value of Object.values(m))
                if (value instanceof THREE.Texture) textures.add(value);
            }
          }
        }),
      );
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      particleGeometry.dispose();
      particleMaterial.dispose();
      environment.dispose();
      renderer.dispose();
      canvas.remove();
      fx.remove();
      void audio?.close();
    },
  };
}
