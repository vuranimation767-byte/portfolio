/* Hero globe — a small voxel Earth, loaded on demand so the page never
   waits for Three.js. Drag to spin; zoom with trackpad pinch or +/-. */

const HOST = document.querySelector("#globe");

/* 2.5° land mask, "#" land and "." sea, rasterised from Natural Earth 110m. */
const MASK = `................................................................................................................................................
................................................................................................................................................
................................................................................................................................................
....................................#########..####################.............................................................................
...........................#..##..########..####################.............###................................##..............................
.......................#..#.#..##..#........####################................................###............######...........................
......................####........##.#............##############.............................##..........############...........#...............
#........#...............#####...##.#######........############..............................##....###.#####################.########...........
.....#####################.#.#....###.##..###......##########..................########......#.####.#.##########################################
####..################################....#####....#######.......#...........#########.#..######################################################
........############################.#.#...###.....#####........#...........####.##############################################################.
......############################.......##.........###...................#####..######################################################.#####...
.......####......##################......####.#...........................#####..################################################.......#.......
........#..........##################....######.......................#....#.#..###############################################.......###.......
....................###################.#########...................##.#...#####################################################......##........
.....................#############################....................##########################################################................
......................######################.#..###...................##########################################################................
......................########################.........................#############.#.########################################.................
......................######################...........................####.#.#####.....######################################...#..............
......................#####################.........................#####....##.####.##.####################################....#...............
.......................###################..........................####......#.#..####################################...#.....#...............
.......................###################..............................####.........###################################...#..##................
.........................################............................#######..........##################################.....#..................
.........................#.############.............................###########.###.#.###################################.......................
..........................########.....#............................#######################.#############################.......................
............................#####......#..........................####################.#####..##########################........................
.............................####.................................####################.########....####################.#.......................
..............................###...#............................######################.########....#######..######.............................
..............................####.##......##.....................#####################.#######......#####....####.#............................
.................................####............................#######################.####........####......####.....#.......................
....................................###..........................##########################...........##.......#####....##......................
..........................................#.#.....................#######################..#..........##.......#.##.............................
.......................................#.#######...................#########################...................#..........#.....................
.........................................########...................#####.##################............#.......#...............................
.........................................###########........................###############....................##....##.........................
........................................############........................##############......................##..###.........................
........................................##############......................#############.......................##..###.#...##..................
........................................#################...................############.........................#......#.....####..............
........................................##################...................###########..........................#............####.............
........................................##################...................###########...............................##.#.....#...............
.........................................################....................###########........................................................
.........................................###############.....................###########...#................................##..................
...........................................#############.....................###########..##.............................######..#..............
............................................############.....................#########....##.............................##########.............
............................................############.....................#########...##...........................##############............
............................................##########........................########...##..........................###############............
............................................#########.........................#######................................################...........
...........................................#########...........................######.................................###############...........
...........................................#########...........................#####..................................###############...........
...........................................########............................###....................................####....#######...........
...........................................######...............................................................................####............
...........................................#####..................................................................................#...........#.
..........................................####....................................................................................#..........#..
...........................................###..............................................................................................#...
..........................................###..............................................................................................#....
..........................................###...................................................................................................
..........................................##....#...............................................................................................
...........................................##...................................................................................................
................................................................................................................................................
................................................................................................................................................
................................................................................................................................................
................................................#...............................................................................................
..............................................#..............................................##..................#...#..........................
.............................................#.......................................#...###########...##############################...........
..........................................#####......................#.############################..#######################################....
.......................#.......##########.######.................##########################################################################.....
..............##############################..................###########################################################################.......
.......#..###############################...........###...#################################################################################.....
..........###################################............###############################################################################........
...........#################################################################################################################################....
################################################################################################################################################
################################################################################################################################################`.split("\n");

const MASK_W = 144;
const MASK_H = 72;

const BIOMES = {
  light: {
    ocean: 0x93b9de,
    shallow: 0xafcbe8,
    ice: 0xedf5fb,
    tundra: 0xa9bda6,
    taiga: 0x6f9b74,
    forest: 0x74a26e,
    plains: 0x8dba7f,
    desert: 0xdccd9c,
    savanna: 0xbfbf87,
    jungle: 0x5f9464,
  },
  dark: {
    ocean: 0x0f3057,
    shallow: 0x1a4c7d,
    ice: 0xbfd9ef,
    tundra: 0x5c7a68,
    taiga: 0x2c5c40,
    forest: 0x35704a,
    plains: 0x417f4e,
    desert: 0x9c8f63,
    savanna: 0x7d7c4f,
    jungle: 0x2a6b3c,
  },
};

const LOOK = {
  light: {
    hemiSky: 0xffffff,
    hemiGround: 0xd7e3ee,
    hemi: 1.15,
    sun: 0xffffff,
    sunIntensity: 1.95,
    core: 0xa9c8e6,
    cloud: 0xffffff,
    cloudOpacity: 0.78,
    glow: 0xc7ddf3,
    glowStrength: 0.55,
    stars: 0,
  },
  dark: {
    hemiSky: 0x8fb6ff,
    hemiGround: 0x05080f,
    hemi: 0.85,
    sun: 0xcfe0ff,
    sunIntensity: 1.7,
    core: 0x0b2545,
    cloud: 0xd6e6fa,
    cloudOpacity: 0.3,
    glow: 0x2f6fd0,
    glowStrength: 0.8,
    stars: 0.85,
  },
};

const R = 10;
const BLOCK = 0.6;

const rand = (a, b) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

const noise2 = (x, y) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = rand(xi, yi);
  const b = rand(xi + 1, yi);
  const c = rand(xi, yi + 1);
  const d = rand(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
};

function sampleLand(lat, lon) {
  const row = Math.min(MASK_H - 1, Math.max(0, Math.floor((90 - lat) / (180 / MASK_H))));
  const col = ((Math.floor((lon + 180) / (360 / MASK_W)) % MASK_W) + MASK_W) % MASK_W;
  return MASK[row][col] === "#";
}

function nearLand(lat, lon) {
  const dr = 180 / MASK_H;
  const dc = 360 / MASK_W;
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (sampleLand(lat + i * dr, lon + j * dc)) return true;
    }
  }
  return false;
}

function biomeAt(lat, lon, land, shallow) {
  if (!land) return shallow ? "shallow" : "ocean";
  const a = Math.abs(lat);
  const n = noise2(lon * 0.085, lat * 0.085);
  if (a > 74) return "ice";
  if (a > 63) return n > 0.25 ? "tundra" : "ice";
  if (a > 48) return n > 0.35 ? "taiga" : "tundra";
  if (a > 36) return n > 0.45 ? "forest" : "taiga";
  if (a > 27) return n > 0.5 ? "desert" : "plains";
  if (a > 17) return n > 0.55 ? "desert" : n > 0.25 ? "savanna" : "plains";
  if (a > 8) return n > 0.4 ? "jungle" : "savanna";
  return n > 0.25 ? "jungle" : "plains";
}

if (HOST) {
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        io.disconnect();
        start();
      }
    },
    { rootMargin: "300px" }
  );
  io.observe(HOST);
}

async function start() {
  let THREE;
  try {
    THREE = await import("../vendor/three.module.js");
  } catch {
    HOST.dataset.globe = "off";
    return;
  }
  try {
    build(THREE);
  } catch {
    HOST.dataset.globe = "off";
  }
}

function build(THREE) {
  const UP = new THREE.Vector3(0, 1, 0);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";

  /* ---- blocks ---- */
  const dummy = new THREE.Object3D();
  const blocks = [];
  const stepLat = THREE.MathUtils.radToDeg(BLOCK / R);

  for (let lat = -90 + stepLat / 2; lat < 90; lat += stepLat) {
    const ringRadius = Math.sin(THREE.MathUtils.degToRad(90 - lat)) * R;
    const count = Math.max(1, Math.round((2 * Math.PI * ringRadius) / BLOCK));

    for (let k = 0; k < count; k++) {
      const lon = -180 + ((k + 0.5) * 360) / count;
      const land = sampleLand(lat, lon);
      const biome = biomeAt(lat, lon, land, !land && nearLand(lat, lon));

      const phi = THREE.MathUtils.degToRad(lat);
      const lam = THREE.MathUtils.degToRad(lon);
      const normal = new THREE.Vector3(
        Math.cos(phi) * Math.cos(lam),
        Math.sin(phi),
        Math.cos(phi) * Math.sin(lam)
      );

      const height = land ? 0.95 + rand(lat * 3.1, lon * 1.7) * 0.85 : 0.5;
      const base = land ? R - 0.35 : R - 0.55;
      const pos = normal.clone().multiplyScalar(base + height / 2);

      const quat = new THREE.Quaternion().setFromUnitVectors(UP, normal);
      quat.multiply(
        new THREE.Quaternion().setFromAxisAngle(
          UP,
          Math.round(rand(lat, lon * 2.3) * 4) * (Math.PI / 2)
        )
      );

      blocks.push({
        pos,
        quat,
        scale: new THREE.Vector3(BLOCK * 0.93, height * 0.97, BLOCK * 0.93),
        biome,
        land,
        shade: land ? (noise2(lon * 0.9, lat * 0.9) - 0.5) * 0.08 : 0,
      });
    }
  }

  /* ---- renderer ---- */
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.setAttribute("aria-hidden", "true");
  HOST.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);

  const tilt = new THREE.Group();
  const spin = new THREE.Group();
  tilt.add(spin);
  scene.add(tilt);
  spin.rotation.y = -1.22;

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial(), blocks.length);
  blocks.forEach((block, i) => {
    dummy.position.copy(block.pos);
    dummy.quaternion.copy(block.quat);
    dummy.scale.copy(block.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, new THREE.Color(0xffffff));
  });
  mesh.instanceMatrix.needsUpdate = true;
  spin.add(mesh);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(R - 0.12, 64, 48),
    new THREE.MeshLambertMaterial({ color: LOOK.light.core })
  );
  spin.add(core);

  /* ---- clouds ---- */
  const CLOUD_CLUSTERS = 58;
  const CLOUD_PER_CLUSTER = 9;
  const clouds = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({
      color: LOOK.light.cloud,
      transparent: true,
      opacity: LOOK.light.cloudOpacity,
      depthWrite: false,
    }),
    CLOUD_CLUSTERS * CLOUD_PER_CLUSTER
  );

  let cloudIndex = 0;
  for (let c = 0; c < CLOUD_CLUSTERS; c++) {
    const y = rand(c, 3) * 2 - 1;
    const theta = Math.acos(y);
    const lon = rand(c, 7) * Math.PI * 2;
    const center = new THREE.Vector3(
      Math.sin(theta) * Math.cos(lon),
      Math.cos(theta),
      Math.sin(theta) * Math.sin(lon)
    );
    const axis = Math.abs(center.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const t1 = new THREE.Vector3().crossVectors(axis, center).normalize();
    const t2 = new THREE.Vector3().crossVectors(center, t1).normalize();

    for (let i = 0; i < CLOUD_PER_CLUSTER; i++) {
      const n = center
        .clone()
        .addScaledVector(t1, ((rand(c, i) - 0.5) * 1.1) / R)
        .addScaledVector(t2, ((rand(i, c + 9) - 0.5) * 1.1) / R)
        .normalize();
      dummy.position.copy(n).multiplyScalar(R * 1.15);
      dummy.quaternion.setFromUnitVectors(UP, n);
      dummy.scale.set(
        0.45 + rand(c + i, 1) * 0.6,
        0.3 + rand(c + i, 2) * 0.22,
        0.45 + rand(c + i, 4) * 0.6
      );
      dummy.updateMatrix();
      clouds.setMatrixAt(cloudIndex++, dummy.matrix);
    }
  }
  clouds.instanceMatrix.needsUpdate = true;
  const cloudDrift = new THREE.Group();
  cloudDrift.add(clouds);
  scene.add(cloudDrift);

  /* ---- atmosphere ---- */
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.16, 48, 32),
    new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(LOOK.light.glow) },
        strength: { value: LOOK.light.glowStrength },
      },
      vertexShader: `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float strength;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float edge = pow(1.0 - abs(dot(vN, vV)), 2.8);
          gl_FragColor = vec4(glowColor, edge * strength);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    })
  );
  scene.add(glow);

  /* ---- stars ---- */
  const STARS = 900;
  const starPos = new Float32Array(STARS * 3);
  for (let i = 0; i < STARS; i++) {
    const r = 55 + rand(i, 1) * 40;
    const y = rand(i, 2) * 2 - 1;
    const theta = Math.acos(y);
    const lon = rand(i, 3) * Math.PI * 2;
    starPos[i * 3] = r * Math.sin(theta) * Math.cos(lon);
    starPos[i * 3 + 1] = r * Math.cos(theta);
    starPos[i * 3 + 2] = r * Math.sin(theta) * Math.sin(lon);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: 0xcfe0ff,
      size: 0.5,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  scene.add(stars);

  /* ---- lights ---- */
  const hemi = new THREE.HemisphereLight(LOOK.light.hemiSky, LOOK.light.hemiGround, LOOK.light.hemi);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(LOOK.light.sun, LOOK.light.sunIntensity);
  sun.position.set(9, 7, 11);
  scene.add(sun);

  /* ---- theme ---- */
  function paint() {
    const palette = BIOMES[theme];
    const look = LOOK[theme];
    const color = new THREE.Color();

    blocks.forEach((block, i) => {
      color.setHex(palette[block.biome]);
      if (block.shade) color.offsetHSL(0, 0, block.shade);
      mesh.setColorAt(i, color);
    });
    mesh.instanceColor.needsUpdate = true;

    core.material.color.setHex(look.core);
    clouds.material.color.setHex(look.cloud);
    clouds.material.opacity = look.cloudOpacity;
    glow.material.uniforms.glowColor.value.setHex(look.glow);
    glow.material.uniforms.strength.value = look.glowStrength;
    stars.material.opacity = look.stars;

    hemi.color.setHex(look.hemiSky);
    hemi.groundColor.setHex(look.hemiGround);
    hemi.intensity = look.hemi;
    sun.color.setHex(look.sun);
    sun.intensity = look.sunIntensity;
  }
  paint();

  document.addEventListener("themechange", (event) => {
    theme = event.detail?.theme === "dark" ? "dark" : "light";
    paint();
  });

  /* ---- sizing ---- */
  let fit = 1;
  let zoom = 1;
  let zoomTarget = 1;

  function resize() {
    const width = HOST.clientWidth || 1;
    const height = HOST.clientHeight || 1;
    camera.aspect = width / height;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    fit = 12.6 / Math.sin(Math.min(vFov, hFov) / 2);
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
  }

  resize();
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(HOST);
  else window.addEventListener("resize", resize);

  /* ---- interaction ---- */
  const canvas = renderer.domElement;
  const pointers = new Map();
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let velY = 0;
  let startDistance = 0;

  canvas.addEventListener("pointerdown", (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      startDistance = Math.hypot(a.x - b.x, a.y - b.y);
      dragging = false;
      return;
    }
    dragging = true;
    velY = 0;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    HOST.classList.add("is-dragging");
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2 && startDistance > 0) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      zoomTarget = THREE.MathUtils.clamp(zoomTarget * (startDistance / distance), 0.74, 1.5);
      startDistance = distance;
      return;
    }
    if (!dragging) return;

    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;

    spin.rotation.y += dx * 0.006;
    tilt.rotation.x = THREE.MathUtils.clamp(tilt.rotation.x + dy * 0.004, -0.5, 0.5);
    velY = dx * 0.006;
  });

  function release(event) {
    pointers.delete(event.pointerId);
    if (pointers.size > 0) return;
    dragging = false;
    HOST.classList.remove("is-dragging");
  }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") release(event);
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomTarget = THREE.MathUtils.clamp(zoomTarget + event.deltaY * 0.002, 0.74, 1.5);
    },
    { passive: false }
  );

  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "Voxel globe of Earth. Use the arrow keys to spin it.");
  canvas.addEventListener("keydown", (event) => {
    const step = 0.16;
    if (event.key === "ArrowLeft") spin.rotation.y -= step;
    else if (event.key === "ArrowRight") spin.rotation.y += step;
    else if (event.key === "ArrowUp") tilt.rotation.x = Math.max(-0.5, tilt.rotation.x - step * 0.4);
    else if (event.key === "ArrowDown") tilt.rotation.x = Math.min(0.5, tilt.rotation.x + step * 0.4);
    else if (event.key === "+" || event.key === "=") zoomTarget = Math.max(0.74, zoomTarget - 0.08);
    else if (event.key === "-") zoomTarget = Math.min(1.5, zoomTarget + 0.08);
    else return;
    event.preventDefault();
  });

  /* ---- loop ---- */
  let visible = true;
  if ("IntersectionObserver" in window) {
    visible = false;
    new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
      },
      { rootMargin: "120px" }
    ).observe(HOST);
  }

  const clock = new THREE.Clock();
  let painted = false;

  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;

    const dt = Math.min(clock.getDelta(), 0.05);

    if (!dragging && !reduceMotion) {
      if (Math.abs(velY) > 0.0002) {
        spin.rotation.y += velY;
        velY *= 0.94;
      } else {
        spin.rotation.y += dt * 0.055;
      }
    }

    if (!reduceMotion) cloudDrift.rotation.y += dt * 0.012;

    zoom += (zoomTarget - zoom) * Math.min(1, dt * 8);
    camera.position.set(0, 0, fit * zoom);
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);

    if (!painted) {
      painted = true;
      HOST.dataset.globe = "ready";
    }
  }

  frame();
}
