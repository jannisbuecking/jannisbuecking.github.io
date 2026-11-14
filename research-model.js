// A rigid six-position rotor. Scrolling changes the inspection
// camera and indexes the complete assembly; tube poses never change locally.
import * as THREE from "./vendor/three/three.module.js";

export const SLOT_COUNT = 6;
export const SLOT_RADIUS = 2.8;
export const RESEARCH_SLOTS = [1, 2, 4];
export const EDUCATION_SLOTS = [0, 3];
export const EXPERIENCE_SLOTS = [0, 1, 2, 3, 4];
export const RESEARCH_STOPS = [.2016, .2856, .3696, .4536, .5376];
export const SAMPLE_SLOT = 5;
export const CAP_TOP = 1.781;
export const OPENING_END = .08;
export const OPENING_SPEED = 3;

const tau = Math.PI * 2;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

// Negative rotation about +Y is clockwise through the overhead camera.
// Brake with constant deceleration to the next complete revolution, never rewind.
export function createOpeningSpin() {
  let angle = 0, speed = OPENING_SPEED, mode = "idle", start = 0, elapsed = 0, duration = 0, destination = 0;
  const snapshot = () => ({ angle, speed, mode });
  function align() {
    angle = Math.floor(angle / tau) * tau; speed = 0; mode = "settled";
    return snapshot();
  }
  function update(seconds, progress) {
    if (progress < .0005) {
      mode = "idle"; speed = OPENING_SPEED; angle -= speed * seconds;
    } else {
      if (mode === "idle") {
        start = angle; elapsed = 0;
        destination = Math.floor((angle - OPENING_SPEED * .18) / tau) * tau;
        duration = 2 * (start - destination) / OPENING_SPEED;
        mode = "braking";
      }
      if (mode === "braking") {
        elapsed = Math.min(duration, elapsed + seconds);
        angle = start - OPENING_SPEED * elapsed + OPENING_SPEED * elapsed ** 2 / (2 * duration);
        speed = OPENING_SPEED * (1 - elapsed / duration);
        if (elapsed >= duration) { angle = destination; speed = 0; mode = "settled"; }
      }
    }
    return snapshot();
  }
  return { update, align, snapshot };
}

export function molecularPose(progress) {
  return {
    particles: smooth((progress - .90) / .02),
    unfold: smooth((progress - .905) / .075),
    bases: smooth((progress - .925) / .06),
    ribosome: smooth((progress - .93) / .065),
    labels: smooth((progress - .97) / .03),
    background: smooth((progress - .91) / .06),
  };
}

export function pelletComponent(index) {
  const radius = .12 * Math.sqrt((index + .5) / 100), angle = index * 2.39996323;
  return { x: Math.cos(angle) * radius, y: -1.567 + .055 * Math.sqrt(1 - (radius / .13) ** 2), z: Math.sin(angle) * radius };
}

export function unfoldPoint(origin, target, amount) {
  const t = clamp(amount);
  const arc = Math.sin(Math.PI * t) * Math.min(60, Math.hypot(target.x - origin.x, target.y - origin.y) * .08);
  return { x: origin.x + (target.x - origin.x) * t, y: origin.y + (target.y - origin.y) * t - arc };
}

// Each visible component owns a different grain throughout the transition.
export function molecularOwners(nodeCount) {
  let next = 0;
  const take = count => Array.from({ length: count }, () => next++ * 37 % 100);
  const owners = { sugars: take(nodeCount), phosphates: take(nodeCount - 1), bases: take(nodeCount), stems: take(nodeCount), bonds: take(2 * (nodeCount - 1)), subunits: take(2), labels: take(4) };
  if (next > 100) throw new Error("Molecular components exceed the available pellet grains");
  return owners;
}

export function samplePolygon(vertices, count = 64) {
  const lengths = vertices.map((point, index) => Math.hypot(point.x - vertices[(index + 1) % vertices.length].x, point.y - vertices[(index + 1) % vertices.length].y));
  const perimeter = lengths.reduce((sum, length) => sum + length, 0);
  return Array.from({ length: count }, (_, index) => {
    let remaining = index / count * perimeter, edge = 0;
    while (edge < lengths.length - 1 && remaining > lengths[edge]) remaining -= lengths[edge++];
    const a = vertices[edge], b = vertices[(edge + 1) % vertices.length], t = remaining / (lengths[edge] || 1);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  });
}

export function circleToShape(origin, target, amount) {
  const center = target.reduce((sum, point) => ({ x: sum.x + point.x / target.length, y: sum.y + point.y / target.length }), { x: 0, y: 0 });
  const area = target.reduce((sum, point, index) => {
    const next = target[(index + 1) % target.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  const startAngle = Math.atan2(target[0].y - center.y, target[0].x - center.x);
  const position = unfoldPoint(origin, center, amount);
  return target.map((point, index) => {
    const angle = startAngle + (area < 0 ? -1 : 1) * index / target.length * tau;
    return { x: position.x + Math.cos(angle) * origin.r * (1 - amount) + (point.x - center.x) * amount,
      y: position.y + Math.sin(angle) * origin.r * (1 - amount) + (point.y - center.y) * amount };
  });
}

export function inspectionPose(progress) {
  const reading = progress / .56;
  const rise = smooth((progress - .56) / .12);
  const select = smooth((progress - .68) / .06);
  const opening = smooth((progress - .74) / .06);
  const dive = smooth((progress - .80) / .12);
  const molecules = smooth((progress - .89) / .07);
  const handoff = smooth((progress - .94) / .06);
  const tilt = smooth((progress - OPENING_END) / (.1792 - OPENING_END)) * (1 - rise);
  let index = 0;
  while (index < RESEARCH_STOPS.length - 2 && progress > RESEARCH_STOPS[index + 1]) index++;
  const between = smooth((progress - RESEARCH_STOPS[index]) / (RESEARCH_STOPS[index + 1] - RESEARCH_STOPS[index]));
  const slot = EXPERIENCE_SLOTS[index] + (EXPERIENCE_SLOTS[index + 1] - EXPERIENCE_SLOTS[index]) * between;
  const rotorAngle = -tau / 6 * (slot + (SAMPLE_SLOT - EXPERIENCE_SLOTS.at(-1)) * select);
  const pullback = EXPERIENCE_SLOTS[index + 1] - EXPERIENCE_SLOTS[index] > 1 ? .55 : .35;
  const closeUp = smooth((reading - .26) / .1) * (1 - pullback * Math.sin(Math.PI * between) ** 2) * (1 - rise);
  const focus = smooth((progress - .72) / .08);
  const phase = progress < .56 ? (tilt < .02 ? "top" : tilt < .98 ? "turning" : "side")
    : progress < .68 ? "return" : progress < .74 ? "sample" : progress < .80 ? "opening"
    : progress < .92 ? "diving" : progress < .96 ? "molecular" : "ribosome";
  return { progress, tilt, cameraAngle: tilt * Math.PI / 2, rotorAngle, closeUp, focus, opening, dive, molecules, handoff, phase };
}

export function createCentrifuge(colors, textureFactory = () => null) {
  const assembly = new THREE.Group();
  assembly.name = "six-position-rotor";
  const tubeGroups = [];
  const textures = [];
  const materials = [];
  const standard = options => {
    const material = new THREE.MeshStandardMaterial({ roughness: .5, metalness: .12, ...options });
    materials.push(material);
    return material;
  };
  const metal = standard({ color: colors.metal, metalness: .55, roughness: .38 });
  const edge = standard({ color: colors.rim, metalness: .45, roughness: .3 });
  const plastic = standard({ color: colors.paper, metalness: 0, roughness: .32, transparent: true, opacity: .42, depthWrite: false, side: THREE.DoubleSide });
  const researchCap = standard({ color: colors.accent, roughness: .7, metalness: 0 });
  const balanceCap = standard({ color: colors.balance, roughness: .7, metalness: 0 });
  const researchLiquid = standard({ color: colors.accent, transparent: true, opacity: .45, metalness: 0, depthWrite: false });
  const balanceLiquid = standard({ color: colors.balance, transparent: true, opacity: .45, metalness: 0, depthWrite: false });
  const mount = (parent, geometry, material, x = 0, y = 0, z = 0, name = "") => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.name = name;
    parent.add(mesh);
    return mesh;
  };

  // The rotor plate has six real holes. It does not intersect the tubes.
  const plateShape = new THREE.Shape();
  plateShape.absarc(0, 0, 3.65, 0, tau, false);
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const theta = slot * tau / SLOT_COUNT;
    const hole = new THREE.Path();
    hole.absarc(Math.sin(theta) * SLOT_RADIUS, -Math.cos(theta) * SLOT_RADIUS, .66, 0, tau, true);
    plateShape.holes.push(hole);
  }
  const plate = mount(assembly, new THREE.ExtrudeGeometry(plateShape, { depth: .16, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 2, curveSegments: 48 }), metal, 0, 1.04, 0, "perforated-rotor-plate");
  plate.rotation.x = -Math.PI / 2;
  mount(assembly, new THREE.CylinderGeometry(.38, .38, .23, 48), edge, 0, 1.37, 0, "hub-nut");
  mount(assembly, new THREE.CylinderGeometry(.2, .2, 3.25, 32), edge, 0, -.43, 0, "spindle");

  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const theta = slot * tau / SLOT_COUNT;
    const researchIndex = EXPERIENCE_SLOTS.indexOf(slot);
    const tube = new THREE.Group();
    tube.name = `tube-${slot + 1}`;
    tube.userData = { slot, researchIndex, kind: RESEARCH_SLOTS.includes(slot) ? "research" : EDUCATION_SLOTS.includes(slot) ? "education" : "projects" };
    tube.position.set(Math.sin(theta) * SLOT_RADIUS, 0, Math.cos(theta) * SLOT_RADIUS);
    tube.rotation.y = theta;
    assembly.add(tube);
    tubeGroups.push(tube);
    const capMaterial = researchIndex >= 0 ? researchCap : balanceCap;
    const liquidMaterial = researchIndex >= 0 ? researchLiquid : balanceLiquid;
    // Equal dimensions and fill heights for all six positions.
    mount(tube, new THREE.CylinderGeometry(.48, .48, 2.5, 48, 1, true), plastic, 0, .25, 0, "tube-wall");
    mount(tube, new THREE.CylinderGeometry(.49, .49, .32, 48, 1, true), standard({ color: colors.metal, roughness: .32, metalness: 0, transparent: true, opacity: .7, depthWrite: false }), 0, 1.35, 0, "tube-neck");
    mount(tube, new THREE.CylinderGeometry(.48, .055, .7, 48, 1, true), plastic, 0, -1.35, 0, "conical-tip");
    mount(tube, new THREE.CylinderGeometry(.43, .43, .42, 40), liquidMaterial, 0, -.77, 0, "liquid-column");
    mount(tube, new THREE.CylinderGeometry(.43, .05, .64, 40), liquidMaterial, 0, -1.3, 0, "liquid-cone");
    const collar = mount(tube, new THREE.TorusGeometry(.59, .06, 12, 48), edge, 0, 1.25, 0, "support-collar");
    collar.rotation.x = Math.PI / 2;
    const cap = new THREE.Group();
    cap.name = "removable-cap";
    tube.add(cap);
    mount(cap, new THREE.CylinderGeometry(.625, .625, .27, 64), capMaterial, 0, 1.645, 0, "cap");
    for (let ridge = 0; ridge < 32; ridge++) {
      const phi = ridge * tau / 32;
      const rib = mount(cap, new THREE.BoxGeometry(.035, .22, .025), capMaterial, Math.sin(phi) * .627, 1.645, Math.cos(phi) * .627, "cap-rib");
      rib.rotation.y = phi;
    }
    const top = mount(cap, new THREE.CircleGeometry(.605, 64), capMaterial, 0, CAP_TOP, 0, "cap-top");
    top.rotation.x = -Math.PI / 2;
    if (slot === SAMPLE_SLOT) {
      const pelletMaterial = standard({ color: colors.accent, roughness: .9, metalness: 0 });
      const pellet = mount(tube, new THREE.SphereGeometry(1, 40, 24), pelletMaterial, 0, -1.57, 0, "sample-pellet");
      pellet.scale.set(.13, .055, .13);
      // Deterministic surface detail becomes visible as the camera approaches.
      const grainMaterial = standard({ color: colors.accent, roughness: .9, metalness: 0, transparent: true });
      const granules = new THREE.InstancedMesh(new THREE.SphereGeometry(.008, 8, 6), grainMaterial, 100);
      granules.name = "pellet-granules";
      const matrix = new THREE.Matrix4();
      for (let n = 0; n < 100; n++) {
        const point = pelletComponent(n);
        matrix.makeTranslation(point.x, point.y, point.z);
        granules.setMatrixAt(n, matrix);
      }
      tube.add(granules);
    }
    const labelTexture = textureFactory("label", slot, researchIndex);
    if (labelTexture) {
      textures.push(labelTexture);
      const labelMaterial = new THREE.MeshBasicMaterial({ map: labelTexture, toneMapped: false, side: THREE.FrontSide });
      materials.push(labelMaterial);
      // A curved label fixed to the outward-facing tube wall, never a billboard.
      mount(tube, new THREE.CylinderGeometry(.487, .487, 1.9, 48, 1, true, -Math.PI * .43, Math.PI * .86), labelMaterial, 0, .02, 0, "tube-label");
    }
  }
  const base = new THREE.Group();
  base.name = "stationary-stand";
  mount(base, new THREE.CylinderGeometry(3.9, 3.9, .3, 96), metal, 0, -2.13, 0, "base");
  mount(base, new THREE.CylinderGeometry(3.92, 3.92, .07, 96), edge, 0, -2.29, 0, "base-rim");

  function dispose() {
    assembly.traverse(object => object.geometry?.dispose());
    base.traverse(object => object.geometry?.dispose());
    materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
  }
  function openSample(amount) {
    const cap = tubeGroups[SAMPLE_SLOT].getObjectByName("removable-cap");
    cap.position.set(smooth((amount - .3) / .7) * 1.4, amount * 1.6, 0);
    cap.rotation.y = amount * Math.PI * .8;
    // Reveal the pellet through the liquid during the illustrative scale change.
    for (const name of ["liquid-column", "liquid-cone"]) tubeGroups[SAMPLE_SLOT].getObjectByName(name).visible = amount < .95;
  }
  function setLabelTexture(slot, texture) {
    const material = tubeGroups[slot].getObjectByName("tube-label").material;
    const previous = material.map;
    const index = textures.indexOf(previous);
    if (index >= 0) textures.splice(index, 1);
    previous?.dispose();
    if (previous?.image?.getContext) { previous.image.width = 1; previous.image.height = 1; }
    material.map = texture;
    textures.push(texture);
  }
  return { assembly, base, tubeGroups, openSample, setLabelTexture, dispose };
}
