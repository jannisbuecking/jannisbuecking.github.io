// A loaded, stationary six-position rotor. Scrolling changes the inspection
// camera and indexes the complete assembly; tube poses never change locally.
import * as THREE from "./vendor/three/three.module.js";

export const SLOT_COUNT = 6;
export const SLOT_RADIUS = 2.8;
export const RESEARCH_SLOTS = [0, 2, 4];
export const CAP_TOP = 1.781;

const tau = Math.PI * 2;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

export function inspectionPose(progress) {
  const tilt = smooth((progress - .1) / .22);
  const rotorAngle = -tau / 3 * (smooth((progress - .44) / .14) + smooth((progress - .7) / .14));
  return { tilt, cameraAngle: tilt * 78 * Math.PI / 180, rotorAngle };
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
  const plastic = standard({ color: colors.paper, metalness: 0, roughness: .32, transparent: true, opacity: .42, depthWrite: false });
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
    const researchIndex = RESEARCH_SLOTS.indexOf(slot);
    const tube = new THREE.Group();
    tube.name = `tube-${slot + 1}`;
    tube.userData = { slot, researchIndex, kind: researchIndex >= 0 ? "research" : "balance" };
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
    mount(tube, new THREE.CylinderGeometry(.625, .625, .27, 64), capMaterial, 0, 1.645, 0, "cap");
    for (let ridge = 0; ridge < 32; ridge++) {
      const phi = ridge * tau / 32;
      const rib = mount(tube, new THREE.BoxGeometry(.035, .22, .025), capMaterial, Math.sin(phi) * .627, 1.645, Math.cos(phi) * .627, "cap-rib");
      rib.rotation.y = phi;
    }
    const capTexture = textureFactory("cap", slot, researchIndex);
    if (capTexture) {
      textures.push(capTexture);
      const topMaterial = new THREE.MeshBasicMaterial({ map: capTexture, toneMapped: false });
      materials.push(topMaterial);
      const top = mount(tube, new THREE.CircleGeometry(.605, 64), topMaterial, 0, CAP_TOP, 0, "cap-top");
      top.rotation.x = -Math.PI / 2;
    }
    const labelTexture = textureFactory("label", slot, researchIndex);
    if (labelTexture) {
      textures.push(labelTexture);
      const labelMaterial = new THREE.MeshBasicMaterial({ map: labelTexture, toneMapped: false, side: THREE.FrontSide });
      materials.push(labelMaterial);
      // A curved label fixed to the outward-facing tube wall, never a billboard.
      mount(tube, new THREE.CylinderGeometry(.487, .487, 1.75, 48, 1, true, -Math.PI * .43, Math.PI * .86), labelMaterial, 0, .12, 0, "tube-label");
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
  return { assembly, base, tubeGroups, dispose };
}
