import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from '../vendor/CSS2DRenderer.js';
import {
  PLAN,
  CATEGORIES,
  BUILDINGS,
  DOUBLES,
  SURFACES,
  CARPARKS,
  ROADS,
  PATHS,
  ENTRANCES,
} from './data.js';

/* ------------------------------------------------------------------ helpers */

const STOREY = 16; // one storey in plan-pixel units
const HEIGHT_SCALE = 1.55; // slight vertical exaggeration, like a physical site model
const PLAN_MID = { x: 800, z: 565 };

const palette = Object.fromEntries(
  Object.entries(CATEGORIES).map(([k, v]) => [k, new THREE.Color(Number(v.color))])
);

const toHex = (c) => `#${c.getHexString()}`;

// The clock button holds an icon plus its time, so only the time is rewritten.
const clockLabel = document.getElementById('clock-time');

/** Crisp, screen-space label that always faces the camera. */
function makeLabel(text, cls = '', priority = 2) {
  const el = document.createElement('div');
  el.className = `lbl ${cls}`.trim();
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.priority = priority;
  return obj;
}

/* ------------------------------------------------------------------- scene */

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// HTML label layer above the canvas, below the HUD
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.className = 'label-layer';
document.getElementById('app').appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfeaf6);
// Haze hides the edge of the terrain without washing out the campus itself.
scene.fog = new THREE.Fog(0xdfeaf6, 5000, 8600);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 10, 9000);
const HOME_TARGET = new THREE.Vector3(0, 0, -20);
// Camera sits south of the site, looking north — the same way up as the plan.
const HOME_DIR = new THREE.Vector3(-0.16, 1.15, 0.86).normalize();

// The eight corners of the site, used to frame the whole campus exactly.
const FIT_CORNERS = [];
for (const x of [-850, 850]) {
  for (const z of [-610, 610]) {
    for (const y of [0, 46]) FIT_CORNERS.push(new THREE.Vector3(x, y, z));
  }
}

/**
 * Distance along `dir` at which every site corner still projects inside the
 * frustum, so the plan fits whatever shape the window is.
 */
function fitDistance(dir, target, margin = 0.9) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanH = tanV * camera.aspect;
  const up = Math.abs(dir.y) > 0.985 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const forward = dir.clone().negate();
  const right = new THREE.Vector3().crossVectors(forward, up).normalize();
  const upScreen = new THREE.Vector3().crossVectors(right, forward).normalize();

  let distance = 0;
  const q = new THREE.Vector3();
  for (const corner of FIT_CORNERS) {
    q.copy(corner).sub(target);
    const horizontal = Math.abs(q.dot(right)) / (tanH * margin);
    const vertical = Math.abs(q.dot(upScreen)) / (tanV * margin);
    distance = Math.max(distance, -q.dot(dir) + horizontal, -q.dot(dir) + vertical);
  }
  return distance;
}

function homeView() {
  const dir = HOME_DIR.clone().normalize();
  // Wide windows have room to spare, narrow ones need a little crop to stay readable.
  const t = THREE.MathUtils.clamp((camera.aspect - 0.6) / 0.8, 0, 1);
  const zoom = THREE.MathUtils.lerp(0.72, 0.93, t);
  const pos = dir.multiplyScalar(fitDistance(dir, HOME_TARGET, 0.86) * zoom).add(HOME_TARGET);
  return { pos, target: HOME_TARGET.clone() };
}

camera.position.copy(homeView().pos);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.minDistance = 90;
controls.maxDistance = 4800; // must exceed the widest fit distance, or the plan gets cropped
controls.maxPolarAngle = Math.PI * 0.487;
controls.screenSpacePanning = false;

/* lights */

const hemi = new THREE.HemisphereLight(0xffffff, 0x8fa07c, 0.95);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff4e2, 1.75);
sun.position.set(620, 880, 400);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -820;
sun.shadow.camera.right = 820;
sun.shadow.camera.top = 820;
sun.shadow.camera.bottom = -820;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 2600;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.6;
scene.add(sun);

const fill = new THREE.DirectionalLight(0xcfe0ff, 0.28);
fill.position.set(-500, 400, -600);
scene.add(fill);

/* ------------------------------------------------------- day / night cycle */

const DAY_SECONDS = 150; // one full 24 hour day, start to finish, in real seconds
let dayTime = 0.4; // start mid-morning, close to the old fixed daylight look
let timePaused = false;
const sunDir = new THREE.Vector3();
const sunWarm = new THREE.Color(0xffa95e);
const sunNoon = new THREE.Color(0xfff4e2);
const moonColor = new THREE.Color(0x9fb6e8);
const hemiDaySky = new THREE.Color(0xffffff);
const hemiNightSky = new THREE.Color(0x36466b);
const hemiDayGround = new THREE.Color(0x8fa07c);
const hemiNightGround = new THREE.Color(0x161d26);

const skyTones = {
  day: {
    zenith: new THREE.Color(0x2f6fb5),
    horizon: new THREE.Color(0xdcebf7),
    ground: new THREE.Color(0xcfe0ee),
  },
  dusk: {
    zenith: new THREE.Color(0x3d4778),
    horizon: new THREE.Color(0xf5a45c),
    ground: new THREE.Color(0xc9a184),
  },
  night: {
    zenith: new THREE.Color(0x050a16),
    horizon: new THREE.Color(0x16233c),
    ground: new THREE.Color(0x0b1220),
  },
};

const skyUniforms = {
  uZenith: { value: skyTones.day.zenith.clone() },
  uHorizon: { value: skyTones.day.horizon.clone() },
  uGround: { value: skyTones.day.ground.clone() },
  uSunColor: { value: new THREE.Color(0xfff1cc) },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uNight: { value: 0 },
  uTime: { value: 0 },
};

const skyMaterial = new THREE.ShaderMaterial({
  uniforms: skyUniforms,
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  vertexShader: /* glsl */ `
    varying vec3 vDir;

    void main() {
      vDir = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uZenith;
    uniform vec3 uHorizon;
    uniform vec3 uGround;
    uniform vec3 uSunColor;
    uniform vec3 uSunDir;
    uniform float uNight;
    uniform float uTime;

    varying vec3 vDir;

    float hash31(vec3 p) {
      p = fract(p * 0.1031);
      p += dot(p, p.yzx + 33.33);
      return fract((p.x + p.y) * p.z);
    }

    void main() {
      vec3 dir = normalize(vDir);
      float h = dir.y;

      // horizon-to-zenith gradient, eased so the bright band sits low in the sky
      float t = pow(clamp(h, 0.0, 1.0), 0.55);
      vec3 col = mix(uHorizon, uZenith, t);
      col = mix(uGround, col, smoothstep(-0.18, 0.02, h));

      // sun: tight disc plus a soft atmospheric halo
      vec3 sunDir = normalize(uSunDir);
      float sunUp = smoothstep(-0.08, 0.05, sunDir.y);
      float sd = max(dot(dir, sunDir), 0.0);
      col += uSunColor * (pow(sd, 900.0) * 3.2 + pow(sd, 12.0) * 0.22) * sunUp;

      // moon opposite the sun, only once it is dark
      vec3 moonDir = -sunDir;
      float moonUp = smoothstep(-0.06, 0.12, moonDir.y);
      float md = max(dot(dir, moonDir), 0.0);
      float moonDisc = smoothstep(0.9994, 0.9997, md) * moonUp * uNight;
      col = mix(col, vec3(0.88, 0.92, 1.0), moonDisc);
      col += vec3(0.42, 0.52, 0.8) * pow(md, 420.0) * moonUp * uNight * 2.4;

      // procedural stars, fading in above the horizon after sunset
      if (uNight > 0.02 && h > 0.0) {
        vec3 cell = floor(dir * 380.0);
        float r = hash31(cell);
        float star = step(0.9979, r);
        float twinkle = 0.62 + 0.38 * sin(uTime * 2.4 + r * 120.0);
        col += vec3(0.85, 0.9, 1.0) * star * twinkle * uNight * smoothstep(0.0, 0.3, h);
      }

      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }
  `,
});

const sky = new THREE.Mesh(new THREE.SphereGeometry(7000, 32, 16), skyMaterial);
sky.frustumCulled = false;
sky.renderOrder = -1;
sky.userData.ignorePick = true;
scene.add(sky);

const smooth = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);
let clockText = '';

function blendTone(uniform, key, dayF, duskF, duskWeight) {
  uniform.value
    .copy(skyTones.night[key])
    .lerp(skyTones.day[key], dayF)
    .lerp(skyTones.dusk[key], duskF * duskWeight);
}

/** Advance the clock and drive the sky shader, sun/moon light and fog from it. */
function updateSky(dt) {
  if (!timePaused) dayTime = (dayTime + dt / DAY_SECONDS) % 1;
  skyUniforms.uTime.value += dt;

  // 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
  const ang = (dayTime - 0.25) * Math.PI * 2;
  sunDir.set(Math.cos(ang) * 0.72, Math.sin(ang), Math.cos(ang) * 0.42 + 0.18).normalize();

  const e = sunDir.y; // sun elevation, -1 .. 1
  const dayF = smooth(e, -0.03, 0.3);
  const duskF = Math.max(0, 1 - Math.abs(e) / 0.3);
  const nightF = 1 - smooth(e, -0.2, 0.05);

  blendTone(skyUniforms.uZenith, 'zenith', dayF, duskF, 0.4);
  blendTone(skyUniforms.uHorizon, 'horizon', dayF, duskF, 0.92);
  blendTone(skyUniforms.uGround, 'ground', dayF, duskF, 0.7);
  skyUniforms.uSunColor.value.copy(sunWarm).lerp(sunNoon, smooth(e, 0.02, 0.4));
  skyUniforms.uSunDir.value.copy(sunDir);
  skyUniforms.uNight.value = nightF;

  // the sky follows the camera so it always fills the frame
  sky.position.copy(camera.position);

  // one directional light plays both sun and moon, whichever is up
  if (e > -0.02) {
    sun.position.copy(sunDir).multiplyScalar(1400);
    sun.color.copy(sunWarm).lerp(sunNoon, smooth(e, 0.02, 0.42));
    sun.intensity = 1.75 * smooth(e, -0.02, 0.2);
  } else {
    sun.position.copy(sunDir).multiplyScalar(-1400);
    sun.color.copy(moonColor);
    sun.intensity = 0.6 * nightF;
  }

  hemi.intensity = 0.32 + 0.63 * dayF;
  hemi.color.copy(hemiNightSky).lerp(hemiDaySky, dayF);
  hemi.groundColor.copy(hemiNightGround).lerp(hemiDayGround, dayF);
  fill.intensity = 0.08 + 0.2 * dayF;

  // haze matches the horizon so the far ground melts into the sky at any hour
  scene.fog.color.copy(skyUniforms.uHorizon.value);

  // after dark the building shells glow gently, so the plan stays readable
  const glow = 0.24 * nightF;
  for (const mat of nightLitMats) {
    mat.userData.nightGlow = glow;
    mat.emissive.copy(mat.color).multiplyScalar(glow);
  }

  const hours = dayTime * 24;
  const hh = Math.floor(hours) % 24;
  const mm = Math.floor((hours % 1) * 60);
  const label = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  if (label !== clockText) {
    clockText = label;
    if (clockLabel) clockLabel.textContent = label;
  }
}

/* root group holds the whole plan, offset so the campus centres on the origin */
const root = new THREE.Group();
root.position.set(-PLAN_MID.x, 0, -PLAN_MID.z);
scene.add(root);

const buildingGroup = new THREE.Group();
const groundGroup = new THREE.Group();
const labelGroup = new THREE.Group();
root.add(groundGroup, buildingGroup, labelGroup);

/* ---------------------------------------------------------------- ground */

{
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40000, 40000),
    new THREE.MeshStandardMaterial({ color: 0xa2b78a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.userData.ignorePick = true;
  root.add(ground);

  // a soft darker verge around the campus boundary
  const verge = new THREE.Mesh(
    new THREE.PlaneGeometry(1680, 1160),
    new THREE.MeshStandardMaterial({ color: 0xafc696, roughness: 1 })
  );
  verge.rotation.x = -Math.PI / 2;
  verge.position.set(800, 0.08, 565);
  verge.receiveShadow = true;
  root.add(verge);

  // mown stripes give the open grass some scale and depth
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xb8cda0, roughness: 1 });
  for (let x = -820; x < 840; x += 120) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(60, 1160), stripeMat);
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(800 + x + 30, 0.12, 565);
    stripe.receiveShadow = true;
    root.add(stripe);
  }
}

/* roads + paths */
const roadMat = new THREE.MeshStandardMaterial({ color: 0x8d949c, roughness: 0.95 });
const pathMat = new THREE.MeshStandardMaterial({ color: 0xded8c8, roughness: 1 });

function flatRect(w, d, mat, x, z, y = 0.2) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

ROADS.forEach((road) => {
  const [x, z, w, d] = road.r;
  groundGroup.add(flatRect(w, d, roadMat, x + w / 2, z + d / 2, 0.22));

  // dashed centre line
  const vertical = road.vertical;
  const count = Math.floor((vertical ? d : w) / 90);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf2f0e6 });
  for (let i = 0; i < count; i++) {
    const len = 42;
    const dash = flatRect(vertical ? 5 : len, vertical ? len : 5, dashMat,
      vertical ? x + w / 2 : x + 40 + i * 90 + 20,
      vertical ? z + 40 + i * 90 + 20 : z + d / 2,
      0.26);
    groundGroup.add(dash);
  }
});

PATHS.forEach((p) => {
  const [x, z, w, d] = p.r;
  groundGroup.add(flatRect(w, d, pathMat, x + w / 2, z + d / 2, 0.3));
});

/* ------------------------------------------------------------------ items */

const pickables = [];
const categoryCounts = {};

/* -------------------------------- deep links from the Compass userscript */

/** "WA22", "wa 22" and "WA-22" all collapse to the same key. */
function locationKey(name) {
  return String(name ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Every room and building a Compass location name could point at. */
const locationIndex = new Map();

function rememberLocation(name, mesh, planPoint) {
  const key = locationKey(name);
  if (!key || locationIndex.has(key)) return;
  // planPoint stays in plan pixels and is moved into world space at fly time.
  locationIndex.set(key, { name, mesh, point: planPoint.clone() });
}

function heightFor(item) {
  const base = item.h ?? ((item.f || 1) * STOREY + 4);
  return base * HEIGHT_SCALE;
}

function footprint(item) {
  if (item.s) return item.s;
  const [x, z, w, d] = item.r;
  return [[x, z], [x + w, z], [x + w, z + d], [x, z + d]];
}

function shapeFromPoints(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, z) : shape.lineTo(x, z)));
  shape.closePath();
  return shape;
}

function boundsOf(item) {
  const pts = footprint(item);
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return { minX, maxX, minZ, maxZ, w: maxX - minX, d: maxZ - minZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
}

const edgeMat = new THREE.LineBasicMaterial({ color: 0x16283a, transparent: true, opacity: 0.22 });

// building shells that pick up a soft glow once it is dark
const nightLitMats = [];

function addBuilding(item) {
  const h = heightFor(item);
  const colour = palette[item.c] || palette.kblock;
  const b = boundsOf(item);

  const material = new THREE.MeshStandardMaterial({
    color: colour,
    roughness: 0.78,
    metalness: 0.02,
    side: item.s ? THREE.DoubleSide : THREE.FrontSide,
  });
  nightLitMats.push(material);

  let mesh;
  if (item.s) {
    const geo = new THREE.ExtrudeGeometry(shapeFromPoints(item.s), {
      depth: h,
      bevelEnabled: false,
      curveSegments: 1,
    });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, h, 0);
    geo.computeVertexNormals();
    mesh = new THREE.Mesh(geo, material);
    mesh.position.y = 0;
  } else {
    const geo = new THREE.BoxGeometry(b.w, h, b.d);
    mesh = new THREE.Mesh(geo, material);
    mesh.position.set(b.cx, h / 2, b.cz);
  }

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const group = new THREE.Group();
  group.add(mesh);

  // roof cap — reads as a parapet / flat school roof
  const roofMat = new THREE.MeshStandardMaterial({
    color: colour.clone().multiplyScalar(0.82),
    roughness: 0.9,
  });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w - 1.5, 1.8, b.d - 1.5), roofMat);
  roof.position.set(b.cx, h + 0.6, b.cz);
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // crisp outline for the architectural-model look
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(b.w, h, b.d), 25),
    edgeMat
  );
  edges.position.set(b.cx, h / 2, b.cz);
  group.add(edges);

  // floor band on double-storey buildings
  if ((item.f || 1) > 1 && b.w > 46) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(b.w + 1.4, 1.6, b.d + 1.4),
      new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.9 })
    );
    band.position.set(b.cx, h * 0.5, b.cz);
    group.add(band);
  }

  mesh.userData.item = item;
  mesh.userData.pickable = true;
  mesh.userData.baseEmissive = new THREE.Color(0x000000);
  pickables.push(mesh);

  item._mesh = mesh;
  item._bounds = b;
  item._height = h;

  buildingGroup.add(group);
  categoryCounts[item.c] = (categoryCounts[item.c] || 0) + 1;

  rememberLocation(item.n, mesh, new THREE.Vector3(b.cx, h * 0.35, b.cz));

  if (item.top) {
    const label = makeLabel(item.n, 'major', 5);
    label.position.set(b.cx, h + 10, b.cz);
    label.userData.cat = item.c;
    labelGroup.add(label);
  }
}

/* --------------------------------------------------- two-storey buildings */

/** Footprint of a whole double-storey block, union of its room cells. */
function doubleBounds(d) {
  const xs = d.rooms.flatMap((r) => [r.r[0], r.r[0] + r.r[2]]);
  const zs = d.rooms.flatMap((r) => [r.r[1], r.r[1] + r.r[3]]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return { minX, maxX, minZ, maxZ, w: maxX - minX, d: maxZ - minZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
}

/**
 * A block marked "G" on the plan is one building: the G rooms sit on the
 * ground and the rooms paired with them stand directly above, sharing the
 * footprint. So it is drawn as a single two-storey volume with a floor line,
 * ground labels at the base and first-floor labels up at the roof.
 */
function addDouble(d) {
  const b = doubleBounds(d);
  const h = (2 * STOREY + 4) * HEIGHT_SCALE;
  const colour = palette[d.c] || palette.wblock;

  const material = new THREE.MeshStandardMaterial({
    color: colour,
    roughness: 0.78,
    metalness: 0.02,
  });
  nightLitMats.push(material);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, h, b.d), material);
  mesh.position.set(b.cx, h / 2, b.cz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const group = new THREE.Group();
  group.add(mesh);

  const roofMat = new THREE.MeshStandardMaterial({
    color: colour.clone().multiplyScalar(0.82),
    roughness: 0.9,
  });
  const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w - 1.5, 1.8, b.d - 1.5), roofMat);
  roof.position.set(b.cx, h + 0.6, b.cz);
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(b.w, h, b.d), 25),
    edgeMat
  );
  edges.position.set(b.cx, h / 2, b.cz);
  group.add(edges);

  // the floor slab between ground and first floor
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(b.w + 1.4, 1.6, b.d + 1.4),
    new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.9 })
  );
  band.position.set(b.cx, h * 0.5, b.cz);
  group.add(band);

  const item = {
    n: d.n,
    c: d.c,
    f: 2,
    rooms: d.rooms,
    d: 'Double-storey building: the rooms marked G are on the ground floor, and the rooms paired with them sit directly above on the same footprint.',
  };

  mesh.userData.item = item;
  mesh.userData.pickable = true;
  mesh.userData.baseEmissive = new THREE.Color(0x000000);
  pickables.push(mesh);

  item._mesh = mesh;
  item._bounds = b;
  item._height = h;

  buildingGroup.add(group);
  categoryCounts[d.c] = (categoryCounts[d.c] || 0) + 1;

  d.rooms.forEach((room) => {
    const [rx, rz, rw, rd] = room.r;
    const label = makeLabel(room.n, room.lv ? 'upper' : 'ground', room.lv ? 4 : 3);
    label.title = room.lv ? `${room.n} · first floor` : `${room.n} · ground floor`;
    label.position.set(rx + rw / 2, room.lv ? h + 8 : 7, rz + rd / 2);
    label.userData.cat = d.c;
    labelGroup.add(label);

    rememberLocation(
      room.n,
      mesh,
      new THREE.Vector3(rx + rw / 2, room.lv ? h * 0.62 : h * 0.22, rz + rd / 2)
    );
  });
}

BUILDINGS.forEach(addBuilding);
DOUBLES.forEach(addDouble);

/* ------------------------------------------------------- flat surfaces */

function addSurface(s) {
  const b = boundsOf(s);
  const base = palette[s.c] || palette.courtyard;
  const isField = s.n.includes('Sports Field');
  const isCourt = s.n.includes('Basketball') || s.n.includes('Tennis') || s.n.includes('STC');

  const colour = isField || isCourt ? base.clone().lerp(new THREE.Color(0xffffff), 0.06) : base;
  const mat = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.94 });

  const geo = s.s
    ? new THREE.ExtrudeGeometry(shapeFromPoints(s.s), { depth: 1.4, bevelEnabled: false })
    : new THREE.BoxGeometry(b.w, 1.4, b.d);
  if (s.s) {
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 1.4, 0);
  }

  const mesh = new THREE.Mesh(geo, mat);
  if (!s.s) mesh.position.set(b.cx, 0.7, b.cz);
  mesh.receiveShadow = true;
  mesh.userData.item = s;
  mesh.userData.pickable = true;
  mesh.userData.baseEmissive = new THREE.Color(0x000000);
  pickables.push(mesh);
  groundGroup.add(mesh);

  s._mesh = mesh;
  s._height = 1.4;
  categoryCounts[s.c] = (categoryCounts[s.c] || 0) + 1;

  if (s.top) {
    const label = makeLabel(s.n, '', 1);
    label.position.set(b.cx, 8, b.cz);
    label.userData.cat = s.c;
    labelGroup.add(label);
  }

  // white court markings
  if (s.n.includes('Tennis')) {
    const cols = 2;
    const rows = 3;
    const cw = b.w / cols;
    const cd = b.d / rows;
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = b.minX + c * cw + cw / 2;
        const z = b.minZ + r * cd + cd / 2;
        const w1 = cw - 14;
        const d1 = cd - 14;
        const lw = 1.6;
        groundGroup.add(flatRect(w1, lw, lineMat, x, z - d1 / 2, 1.95));
        groundGroup.add(flatRect(w1, lw, lineMat, x, z + d1 / 2, 1.95));
        groundGroup.add(flatRect(lw, d1, lineMat, x - w1 / 2, z, 1.95));
        groundGroup.add(flatRect(lw, d1, lineMat, x + w1 / 2, z, 1.95));
        groundGroup.add(flatRect(1.2, d1, lineMat, x, z, 1.96)); // net
      }
    }
  }

  if (s.mini) {
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let c = 0; c < 2; c++) {
      for (let r = 0; r < 2; r++) {
        const w1 = b.w / 2 - 8;
        const d1 = b.d / 2 - 8;
        const x = b.minX + (c + 0.5) * (b.w / 2);
        const z = b.minZ + (r + 0.5) * (b.d / 2);
        groundGroup.add(flatRect(w1, 1.4, lineMat, x, z - d1 / 2, 1.95));
        groundGroup.add(flatRect(w1, 1.4, lineMat, x, z + d1 / 2, 1.95));
        groundGroup.add(flatRect(1.4, d1, lineMat, x - w1 / 2, z, 1.95));
        groundGroup.add(flatRect(1.4, d1, lineMat, x + w1 / 2, z, 1.95));
      }
    }
  }

  if (isField) {
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xf3f7ff });
    groundGroup.add(flatRect(b.w - 34, 1.8, lineMat, b.cx, b.minZ + 20, 1.95));
    groundGroup.add(flatRect(b.w - 34, 1.8, lineMat, b.cx, b.maxZ - 20, 1.95));
    groundGroup.add(flatRect(1.8, b.d - 40, lineMat, b.minX + 17, b.cz, 1.95));
    groundGroup.add(flatRect(1.8, b.d - 40, lineMat, b.maxX - 17, b.cz, 1.95));
    const circle = new THREE.Mesh(
      new THREE.RingGeometry(34, 36, 48),
      new THREE.MeshBasicMaterial({ color: 0xf3f7ff, side: THREE.DoubleSide })
    );
    circle.rotation.x = -Math.PI / 2;
    circle.position.set(b.cx, 1.96, b.cz);
    groundGroup.add(circle);
  }
}

SURFACES.forEach(addSurface);

/* covered basketball courts: slender columns + translucent roof */
{
  const s = SURFACES.find((x) => x.n.includes('Basketball'));
  const b = boundsOf(s);
  const columnMat = new THREE.MeshStandardMaterial({ color: 0xe6e9ec, roughness: 0.7 });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0xf2f6fa,
    roughness: 0.4,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
  });

  const cols = [b.minX + 10, b.cx, b.maxX - 10];
  const rows = [b.minZ + 10, b.maxZ - 10];
  cols.forEach((x) => {
    rows.forEach((z) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 24, 10), columnMat);
      col.position.set(x, 12, z);
      col.castShadow = true;
      root.add(col);
    });
  });

  const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w - 4, 1.6, b.d - 4), roofMat);
  roof.position.set(b.cx, 24.5, b.cz);
  roof.castShadow = true;
  root.add(roof);
}

/* --------------------------------------------------------------- carparks */

CARPARKS.forEach((cp) => {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(cp.r, cp.r, 1.2, 40),
    new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.95 })
  );
  mesh.position.set(cp.x, 0.6, cp.z);
  mesh.receiveShadow = true;
  mesh.userData.item = { n: cp.n, c: 'courtyard', flat: true, d: 'Staff and visitor parking.' };
  mesh.userData.pickable = true;
  mesh.userData.baseEmissive = new THREE.Color(0x000000);
  pickables.push(mesh);
  groundGroup.add(mesh);

  const label = makeLabel(cp.n, '', 1);
  label.position.set(cp.x, 8, cp.z);
  labelGroup.add(label);

  categoryCounts.courtyard = (categoryCounts.courtyard || 0) + 1;
});

/* ------------------------------------------------------------------ trees */

{
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6d5b46, roughness: 1 });
  const leafMatA = new THREE.MeshStandardMaterial({ color: 0x5d8f4e, roughness: 1 });
  const leafMatB = new THREE.MeshStandardMaterial({ color: 0x4d7a41, roughness: 1 });

  const blocked = BUILDINGS.map((b) => {
    const bb = boundsOf(b);
    return { ...bb, pad: 8 };
  }).concat(
    DOUBLES.map((d) => ({ ...doubleBounds(d), pad: 8 })),
    SURFACES.map((s) => ({ ...boundsOf(s), pad: 6 })),
    ROADS.map((r) => ({ minX: r.r[0], maxX: r.r[0] + r.r[2], minZ: r.r[1], maxZ: r.r[1] + r.r[3], pad: 0 }))
  );

  const isFree = (x, z) =>
    !blocked.some((b) => x > b.minX - b.pad && x < b.maxX + b.pad && z > b.minZ - b.pad && z < b.maxZ + b.pad);

  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  let placed = 0;
  let guard = 0;
  while (placed < 90 && guard < 4000) {
    guard++;
    const x = 40 + rand() * 1520;
    const z = 40 + rand() * 1040;
    if (!isFree(x, z)) continue;

    const scale = 0.7 + rand() * 0.8;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 10 * scale, 6), trunkMat);
    trunk.position.y = 5 * scale;
    trunk.castShadow = true;
    tree.add(trunk);

    const leaves = new THREE.Mesh(
      new THREE.IcosahedronGeometry(8.5 * scale, 0),
      rand() > 0.5 ? leafMatA : leafMatB
    );
    leaves.position.y = 13 * scale;
    leaves.scale.y = 0.85;
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    tree.add(leaves);

    tree.position.set(x, 0, z);
    root.add(tree);
    placed++;
  }
}

/* ------------------------------------------------------ street / entrance */

ROADS.forEach((road) => {
  const label = makeLabel(road.label, 'street', 3);
  label.position.set(road.lx, 6, road.lz);
  labelGroup.add(label);
});

ENTRANCES.forEach((e) => {
  const label = makeLabel(e.n, 'entry', 2);
  label.position.set(e.x, 12, e.z);
  labelGroup.add(label);
});

/* ------------------------------------------------------------------- HUD */

const legendList = document.getElementById('legend-list');
const info = document.getElementById('info');
const tooltip = document.getElementById('tooltip');

const hidden = new Set();

Object.entries(CATEGORIES).forEach(([key, cat]) => {
  const li = document.createElement('li');
  li.dataset.cat = key;
  const count = categoryCounts[key] || 0;
  li.innerHTML = `<span class="swatch" style="background:${toHex(palette[key])}"></span>
    <span class="name">${cat.label}</span><span class="count">${count}</span>`;
  li.tabIndex = 0;
  li.setAttribute('role', 'button');
  li.setAttribute('aria-pressed', 'false');
  li.title = count ? `${count} ${cat.label.toLowerCase()} on the plan` : cat.label;

  const toggle = () => {
    if (hidden.has(key)) hidden.delete(key);
    else hidden.add(key);
    li.classList.toggle('off', hidden.has(key));
    li.setAttribute('aria-pressed', String(hidden.has(key)));
    pickables.forEach((m) => {
      if (m.userData.item && m.userData.item.c === key) m.visible = !hidden.has(key);
    });
    applyLabelVisibility();
    selection = null;
    info.classList.remove('show');
  };

  li.addEventListener('click', toggle);
  li.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggle();
  });
  legendList.appendChild(li);
});

function applyLabelVisibility() {
  labelGroup.children.forEach((label) => {
    const key = label.userData.cat;
    label.visible = labelsOn && !(key && hidden.has(key));
  });
}

/* hover + click */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;
let selection = null;
const outlineBox = new THREE.BoxHelper(new THREE.Object3D(), 0xffffff);
outlineBox.visible = false;
// box helpers measure world space, so they live on the scene, not the offset root
scene.add(outlineBox);

function setHovered(mesh) {
  if (hovered === mesh) return;
  if (hovered && hovered.material.emissive) {
    const base = hovered.material.userData.nightGlow || 0;
    hovered.material.emissive.copy(hovered.material.color).multiplyScalar(base);
  }
  hovered = mesh;
  if (hovered && hovered.material.emissive) {
    const base = hovered.material.userData.nightGlow || 0;
    hovered.material.emissive.copy(hovered.material.color).multiplyScalar(0.28 + base);
  }
  renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
}

function showInfo(mesh) {
  const item = mesh.userData.item;
  const cat = CATEGORIES[item.c] || CATEGORIES.kblock;
  const floors = item.f || 1;
  const b = item._bounds;
  const size = item.flat ? 'Open space' : `${floors} ${floors > 1 ? 'storeys' : 'storey'}`;
  const area = b ? Math.round((b.w * b.d * 0.04) / 10) * 10 : null;
  const floorList = item.rooms
    ? ['Ground floor', 'First floor']
        .map((label, lv) => {
          const names = item.rooms
            .filter((r) => r.lv === lv)
            .map((r) => r.n)
            .join(' · ');
          return names ? `<div><span>${label}</span><b>${names}</b></div>` : '';
        })
        .join('')
    : '';

  info.innerHTML = `
    <div class="kicker"><span class="dot" style="background:${toHex(palette[item.c] || palette.kblock)}"></span>${cat.label}</div>
    <h3>${item.n}</h3>
    ${item.d ? `<p>${item.d}</p>` : ''}
    ${floorList ? `<div class="floors">${floorList}</div>` : ''}
    <div class="meta">
      <div><span>${item.flat ? 'Type' : 'Height'}</span><b>${size}</b></div>
      ${area ? `<div><span>Approx. area</span><b>${area.toLocaleString()} m²</b></div>` : ''}
    </div>`;
  info.classList.add('show');
}

function pick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickables.filter((m) => m.visible), false);
  return hits.length ? hits[0].object : null;
}

renderer.domElement.addEventListener('pointermove', (event) => {
  const mesh = pick(event);
  setHovered(mesh);

  if (mesh) {
    const item = mesh.userData.item;
    tooltip.textContent = item.n;
    tooltip.style.left = `${event.clientX}px`;
    tooltip.style.top = `${event.clientY}px`;
    tooltip.classList.add('show');
  } else {
    tooltip.classList.remove('show');
  }
});

let downPos = null;
renderer.domElement.addEventListener('pointerdown', (event) => {
  downPos = { x: event.clientX, y: event.clientY };
});

renderer.domElement.addEventListener('pointerup', (event) => {
  if (!downPos) return;
  const moved = Math.hypot(event.clientX - downPos.x, event.clientY - downPos.y);
  downPos = null;
  if (moved > 6) return;

  const mesh = pick(event);
  if (!mesh) {
    selection = null;
    outlineBox.visible = false;
    info.classList.remove('show');
    return;
  }
  selection = mesh;
  showInfo(mesh);

  outlineBox.setFromObject(mesh);
  outlineBox.visible = true;
  outlineBox.material.color.setHex(0xffffff);
  outlineBox.material.transparent = true;
  outlineBox.material.opacity = 0.85;
});

/* buttons */

let labelsOn = true;
const btnLabels = document.getElementById('btn-labels');
const btnTop = document.getElementById('btn-top');
const btnReset = document.getElementById('btn-reset');
const btnTime = document.getElementById('btn-time');

btnTime.addEventListener('click', () => {
  timePaused = !timePaused;
  btnTime.classList.toggle('paused', timePaused);
  btnTime.title = timePaused
    ? 'Day/night cycle paused — click to resume'
    : 'Click to pause the day/night cycle';
});

btnLabels.classList.toggle('active', labelsOn);
btnLabels.addEventListener('click', () => {
  labelsOn = !labelsOn;
  btnLabels.classList.toggle('active', labelsOn);
  applyLabelVisibility();
});

let flight = null;
function flyTo(position, target, duration = 900) {
  flight = {
    fromPos: camera.position.clone(),
    toPos: position.clone(),
    fromTarget: controls.target.clone(),
    toTarget: target.clone(),
    start: performance.now(),
    duration,
  };
}

btnTop.addEventListener('click', () => {
  btnTop.classList.toggle('active');
  if (btnTop.classList.contains('active')) {
    const dir = new THREE.Vector3(0, 1, 0.0001).normalize();
    const pos = dir.clone().multiplyScalar(fitDistance(dir, HOME_TARGET, 0.9)).add(HOME_TARGET);
    flyTo(pos, HOME_TARGET.clone(), 1000);
  } else {
    flyTo(homeView().pos, homeView().target, 1000);
  }
});

btnReset.addEventListener('click', () => {
  btnTop.classList.remove('active');
  flyTo(homeView().pos, homeView().target, 900);
});

/* -------------------------------------------------- Compass deep links */

const toast = document.getElementById('toast');
let toastTimer = 0;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 4200);
}

/**
 * Frame one room or building, e.g. when the Compass userscript opens
 * ?room=WA22. Matching is forgiving: Compass may print "WA 22", "WA022" or
 * "WA22A" for the room the plan calls WA22.
 */
function focusLocation(rawName) {
  const key = locationKey(rawName);
  if (!key) return false;

  let hit = locationIndex.get(key);
  const wanted = /^([A-Z]+)0*(\d+)[A-Z]?$/.exec(key);

  if (!hit && wanted) {
    for (const entry of locationIndex.values()) {
      const parts = /^([A-Z]+)0*(\d+)[A-Z]?$/.exec(locationKey(entry.name));
      if (parts && parts[1] === wanted[1] && Number(parts[2]) === Number(wanted[2])) {
        hit = entry;
        break;
      }
    }
  }

  if (!hit) {
    showToast(`${rawName} is not on the map yet — showing the whole campus`);
    return false;
  }

  const target = hit.point.clone().sub(new THREE.Vector3(PLAN_MID.x, 0, PLAN_MID.z));
  const b = hit.mesh.userData.item?._bounds;
  const span = b ? Math.max(b.w, b.d) : 120;
  const distance = THREE.MathUtils.clamp(span * 3.4, 180, 620);
  flyTo(HOME_DIR.clone().multiplyScalar(distance).add(target), target, 1200);

  selection = hit.mesh;
  showInfo(hit.mesh);
  outlineBox.setFromObject(hit.mesh);
  outlineBox.visible = true;
  outlineBox.material.color.setHex(0xffffff);
  outlineBox.material.transparent = true;
  outlineBox.material.opacity = 0.85;

  const cat = CATEGORIES[hit.mesh.userData.item?.c];
  showToast(cat ? `${hit.name} · ${cat.label}` : hit.name);
  return true;
}

/* ---------------------------------------------------- keyboard navigation */

const keys = new Set();
const MOVE_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyQ', 'KeyE', 'ShiftLeft', 'ShiftRight',
]);

window.addEventListener('keydown', (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (!MOVE_KEYS.has(event.code)) return;
  event.preventDefault();
  keys.add(event.code);
  flight = null; // steering by hand takes over from an animated move
});

window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());

const UP = new THREE.Vector3(0, 1, 0);
const moveForward = new THREE.Vector3();
const moveRight = new THREE.Vector3();
const turnOffset = new THREE.Vector3();

/**
 * Walk the camera over the campus without dragging: WASD or the arrow keys
 * travel along the ground, Q and E swing around the point you are looking at,
 * Shift sprints. Speed follows the distance to the target, so it stays gentle
 * once you are down among the buildings.
 */
function keyboardCamera(dt) {
  const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2.4 : 1;
  const distance = camera.position.distanceTo(controls.target);

  let ahead = 0;
  let side = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) ahead += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) ahead -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) side += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) side -= 1;
  const turn = (keys.has('KeyQ') ? 1 : 0) - (keys.has('KeyE') ? 1 : 0);

  if (ahead || side) {
    moveForward.subVectors(controls.target, camera.position);
    moveForward.y = 0;
    if (moveForward.lengthSq() < 1e-4) moveForward.set(0, 0, -1);
    moveForward.normalize();
    moveRight.crossVectors(moveForward, UP).normalize();

    const speed = THREE.MathUtils.clamp(distance * 0.9, 55, 1100) * sprint;
    moveRight.multiplyScalar(side).addScaledVector(moveForward, ahead);
    if (moveRight.lengthSq() > 1) moveRight.normalize();
    moveRight.multiplyScalar(speed * dt);

    camera.position.add(moveRight);
    controls.target.add(moveRight);
  }

  if (turn) {
    turnOffset.subVectors(camera.position, controls.target);
    turnOffset.applyAxisAngle(UP, turn * dt * 0.85 * sprint);
    camera.position.copy(controls.target).add(turnOffset);
  }
}

/* Double-click a building to fly over to it, so you can travel around the
   site without any dragging at all. */
renderer.domElement.addEventListener('dblclick', (event) => {
  const mesh = pick(event);
  if (!mesh) return;

  const box = new THREE.Box3().setFromObject(mesh);
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const distance = THREE.MathUtils.clamp(Math.max(size.x, size.z, size.y) * 3.6, 150, 680);
  const pos = HOME_DIR.clone().normalize().multiplyScalar(distance).add(centre);

  flyTo(pos, centre, 900);

  selection = mesh;
  showInfo(mesh);
  outlineBox.setFromObject(mesh);
  outlineBox.visible = true;
  outlineBox.material.color.setHex(0xffffff);
  outlineBox.material.transparent = true;
  outlineBox.material.opacity = 0.85;
});

/* ------------------------------------------------------------------ loop */

/**
 * Hide labels that would collide on screen, keeping the most important ones.
 * Screen-space, so it works at every zoom level.
 */
let lastDeclutter = 0;
function declutterLabels(now) {
  if (!labelsOn || now - lastDeclutter < 160) return;
  lastDeclutter = now;

  const items = labelGroup.children
    .filter((o) => o.visible)
    .map((o) => ({ el: o.element, p: o.priority ?? 2 }))
    .sort((a, b) => b.p - a.p);

  const placed = [];
  // try nudging a label out of the way before dropping it
  const offsetSteps = [0, -13, 13];

  for (const item of items) {
    item.el.style.visibility = 'visible';
    let done = false;

    for (const dy of offsetSteps) {
      item.el.style.translate = dy ? `0 ${dy}px` : '0 0';
      const r = item.el.getBoundingClientRect();
      if (r.width === 0) break; // off screen / hidden by the renderer
      const clash = placed.some(
        (q) => !(r.right < q.left - 3 || r.left > q.right + 3 || r.bottom < q.top - 3 || r.top > q.bottom + 3)
      );
      if (!clash) {
        placed.push(r);
        done = true;
        break;
      }
    }

    if (!done) item.el.style.visibility = 'hidden';
  }
}

const compassArrow = document.querySelector('.compass .arrow');
const camDir = new THREE.Vector3();

const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);

  const dt = Math.min(clock.getDelta(), 0.05);
  keyboardCamera(dt);
  updateSky(dt);

  if (flight) {
    const t = Math.min((performance.now() - flight.start) / flight.duration, 1);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    camera.position.lerpVectors(flight.fromPos, flight.toPos, e);
    controls.target.lerpVectors(flight.fromTarget, flight.toTarget, e);
    if (t >= 1) flight = null;
  }

  controls.update();

  // keep the compass needle honest: project due north into screen space
  camera.getWorldDirection(camDir);
  const p0 = new THREE.Vector3(0, 0, 0).project(camera);
  const p1 = new THREE.Vector3(0, 0, -1).project(camera);
  const dx = (p1.x - p0.x) * renderer.domElement.clientWidth;
  const dy = (p0.y - p1.y) * renderer.domElement.clientHeight;
  compassArrow.style.transform = `rotate(${(Math.atan2(dx, -dy) * 180) / Math.PI}deg)`;

  if (selection) {
    // keep the outline glued to the object (materials never resize, so this is cheap)
    outlineBox.update();
  }

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  declutterLabels(performance.now());
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onResize);

applyLabelVisibility();

// The Compass userscript opens the map as ?room=WA22, so the room that class is
// in is already framed when the page appears.
const deepLinkRoom = new URLSearchParams(window.location.search).get('room');
if (deepLinkRoom) focusLocation(deepLinkRoom);

// The splash goes away as soon as the first frame of the campus is ready.
const loading = document.getElementById('loading');
if (loading) {
  requestAnimationFrame(() => {
    loading.classList.add('hide');
    setTimeout(() => loading.remove(), 600);
  });
}

tick();
