import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { createResearchBench } from "../research-bench.js";
import { createCentrifuge, inspectionPose, createOpeningSpin, OPENING_END, OPENING_SPEED, molecularPose, molecularOwners, pelletComponent, unfoldPoint, samplePolygon, circleToShape, EXPERIENCE_SLOTS, SAMPLE_SLOT, RESEARCH_STOPS } from "../research-model.js";

const colors = { metal: "#d9ded5", rim: "#586359", paper: "#fdfcf8", accent: "#28694b", balance: "#e7eae3" };

test("replacing a reading label releases its old texture and canvas", () => {
  const model = createCentrifuge(colors, () => new THREE.Texture());
  const previous = model.tubeGroups[0].getObjectByName("tube-label").material.map;
  previous.image = { width: 2048, height: 3072, getContext() {} };
  let oldDisposals = 0, newDisposals = 0;
  previous.addEventListener("dispose", () => oldDisposals++);
  const replacement = new THREE.Texture(); replacement.addEventListener("dispose", () => newDisposals++);
  model.setLabelTexture(0, replacement);
  assert.equal(oldDisposals, 1);
  assert.equal(previous.image.width, 1);
  assert.equal(previous.image.height, 1);
  assert.equal(model.tubeGroups[0].getObjectByName("tube-label").material.map, replacement);
  model.dispose();
  assert.equal(oldDisposals, 1);
  assert.equal(newDisposals, 1);
});

test("every molecular component owns a distinct pellet circle and preserves its shape at both endpoints", () => {
  const owners = molecularOwners(13), ids = Object.values(owners).flat();
  assert.equal(ids.length, 81);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(index => Number.isInteger(index) && index >= 0 && index < 100));
  assert.throws(() => molecularOwners(17), /exceed/);
  const origin = { x: 215, y: 340, r: 19 };
  const target = samplePolygon([{ x: 700, y: 500 }, { x: 800, y: 500 }, { x: 800, y: 650 }, { x: 700, y: 650 }]);
  const first = circleToShape(origin, target, 0), last = circleToShape(origin, target, 1);
  first.forEach(point => assert.ok(Math.abs(Math.hypot(point.x - origin.x, point.y - origin.y) - origin.r) < 1e-9));
  last.forEach((point, index) => assert.ok(Math.hypot(point.x - target[index].x, point.y - target[index].y) < 1e-9));
  for (const amount of [0, .2, .5, .8, 1]) {
    const a = circleToShape(origin, target, amount), b = circleToShape(origin, target, Math.min(1, amount + 1e-6));
    assert.ok(a.every((point, index) => Math.hypot(point.x - b[index].x, point.y - b[index].y) < .002), "the contour has no sudden geometry changes");
  }
});

test("molecular particles originate at the modeled pellet grains and arrive exactly on their destinations", () => {
  const model = createCentrifuge(colors);
  try {
    const grains = model.tubeGroups[SAMPLE_SLOT].getObjectByName("pellet-granules"), matrix = new THREE.Matrix4();
    for (let index = 0; index < 100; index++) {
      grains.getMatrixAt(index, matrix);
      const position = new THREE.Vector3().setFromMatrixPosition(matrix), origin = pelletComponent(index);
      assert.ok(position.distanceTo(new THREE.Vector3(origin.x, origin.y, origin.z)) < 1e-6);
    }
    const origin = { x: 313, y: 298 }, target = { x: 728, y: 607 };
    assert.deepEqual(unfoldPoint(origin, target, 0), origin);
    const final = unfoldPoint(origin, target, 1);
    assert.ok(Math.hypot(final.x - target.x, final.y - target.y) < 1e-9);
    for (let step = 0; step < 100; step++) {
      const a = molecularPose(.90 + step / 1000), b = molecularPose(.90 + (step + 1) / 1000);
      for (const key of Object.keys(a)) assert.ok(b[key] >= a[key] && b[key] <= 1);
      if (a.labels > 0) assert.ok(a.unfold > .95, "project information appears after the strand is formed");
    }
    assert.ok(Object.values(molecularPose(1)).every(value => value === 1));
  } finally { model.dispose(); }
});

test("research, education, and projects follow the requested six-tube sequence", () => {
  const model = createCentrifuge(colors);
  try {
    assert.equal(model.tubeGroups.length, 6);
    assert.equal(model.tubeGroups.filter(tube => tube.userData.kind === "research").length, 3);
    assert.equal(model.tubeGroups.filter(tube => tube.userData.kind === "education").length, 2);
    assert.equal(model.tubeGroups.filter(tube => tube.userData.kind === "projects").length, 1);
    assert.deepEqual(model.tubeGroups.map(tube => tube.userData.kind), ["education", "research", "research", "education", "research", "projects"]);
    assert.ok(model.tubeGroups.every(tube => tube.getObjectByName("cap-top").material.map === null), "caps are plain geometry with no printed labels");
    assert.deepEqual(EXPERIENCE_SLOTS.map(slot => model.tubeGroups[slot].userData.researchIndex), [0, 1, 2, 3, 4]);
    for (let index = 0; index < 6; index++) {
      const tube = model.tubeGroups[index];
      const next = model.tubeGroups[(index + 1) % 6];
      const opposite = model.tubeGroups[(index + 3) % 6];
      const cosine = tube.position.dot(next.position) / (tube.position.length() * next.position.length());
      assert.ok(Math.abs(Math.acos(cosine) - Math.PI / 3) < 1e-9);
      assert.ok(tube.position.clone().add(opposite.position).length() < 1e-9);
      assert.deepEqual(tube.getObjectByName("tube-wall").geometry.parameters, opposite.getObjectByName("tube-wall").geometry.parameters);
      assert.deepEqual(tube.getObjectByName("liquid-column").geometry.parameters, opposite.getObjectByName("liquid-column").geometry.parameters);
    }
  } finally { model.dispose(); }
});

test("continuous scrolling brings all five research and education labels forward", () => {
  const model = createCentrifuge(colors);
  try {
    RESEARCH_STOPS.forEach((progress, index) => {
      const pose = inspectionPose(progress);
      model.assembly.rotation.y = pose.rotorAngle;
      model.assembly.updateMatrixWorld(true);
      const position = model.tubeGroups[EXPERIENCE_SLOTS[index]].getWorldPosition(new THREE.Vector3());
      assert.ok(Math.abs(position.x) < 1e-9);
      assert.ok(position.z > 0);
      assert.ok(Math.abs(pose.closeUp - 1) < 1e-9);
    });
    for (let progress = RESEARCH_STOPS[0] + .01; progress < RESEARCH_STOPS.at(-1) - .01; progress += .01) {
      assert.ok(inspectionPose(progress + .005).rotorAngle < inspectionPose(progress).rotorAngle);
    }
  } finally { model.dispose(); }
});

test("the opening spin is clockwise and brakes continuously without reversing", () => {
  for (const idleTime of [.01, .3, 1.5, 3, 7]) {
    const spin = createOpeningSpin();
    let previous = spin.update(idleTime, 0);
    assert.equal(previous.angle, -OPENING_SPEED * idleTime);
    let settled = false;
    for (let step = 0; step < 400; step++) {
      const state = spin.update(1 / 60, .03 + step / 1000);
      assert.ok(state.angle <= previous.angle + 1e-10, "rotation never rewinds during braking");
      assert.ok(state.speed <= previous.speed + 1e-10 && state.speed >= 0, "angular speed only decreases");
      assert.ok(previous.angle - state.angle <= OPENING_SPEED / 60 + 1e-9, "braking cannot produce a speed spike");
      if (state.mode === "braking") assert.equal(inspectionPose(OPENING_END).cameraAngle, 0);
      previous = state;
      if (state.mode === "settled") { settled = true; break; }
    }
    assert.ok(settled);
    assert.ok(Math.abs(Math.sin(previous.angle)) < 1e-9 && Math.cos(previous.angle) > .9999999);
    const resumed = spin.update(.1, 0);
    assert.ok(resumed.angle < previous.angle && resumed.speed === OPENING_SPEED);
  }
  // Through the overhead camera, clockwise carries the bottom tube to the left.
  const point = new THREE.Vector3(0, 0, 2.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), -.1);
  assert.ok(point.x < 0 && point.z > 0);
});

test("the top-view tools stay stationary, on the correct sides, and clear of the tubes", () => {
  const bench = createResearchBench(colors);
  try {
    for (const aspect of [1512 / 820, 390 / 670]) {
      bench.update(1, aspect); bench.group.updateMatrixWorld(true);
      assert.ok(bench.lab.position.x < 0 && bench.clinic.position.x > 0);
      assert.equal(bench.lab.getObjectsByProperty("name", "micropipette").length, 3);
      assert.ok(bench.clinic.getObjectByName("stethoscope-chestpiece"));
      const matrices = [bench.lab.matrix.clone(), bench.clinic.matrix.clone()];
      const height = Math.max(8.6, (aspect < 1.1 ? 11.4 : 17.5) / aspect);
      bench.group.traverse(object => {
        if (!object.geometry || object.geometry.type === "CircleGeometry") return;
        const positions = object.geometry.attributes.position;
        for (let vertex = 0; vertex < positions.count; vertex++) {
          const point = new THREE.Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(object.matrixWorld);
          assert.ok(Math.abs(point.x) < height * aspect / 2 && Math.abs(point.z) < height / 2, "tools fit the overhead framing");
          assert.ok(Math.hypot(point.x, point.z) > 3.92, "equipment does not overlap the rotor");
        }
      });
      bench.update(.2, aspect); bench.group.updateMatrixWorld(true);
      assert.ok(bench.lab.matrix.equals(matrices[0]) && bench.clinic.matrix.equals(matrices[1]));
    }
  } finally { bench.dispose(); }
});

test("camera tilt never rotates the rotor and subsequent indexing preserves all tube poses", () => {
  const model = createCentrifuge(colors);
  try {
    model.assembly.updateMatrixWorld(true);
    const local = model.tubeGroups.map(tube => tube.matrix.clone());
    for (let step = 0; step <= 100; step++) {
      const pose = inspectionPose(step / 100);
      if (step <= 17) assert.ok(Math.abs(pose.rotorAngle) < 1e-12);
      assert.ok(pose.cameraAngle >= 0 && pose.cameraAngle <= Math.PI / 2);
      assert.ok(pose.closeUp >= 0 && pose.closeUp <= 1);
      model.assembly.rotation.y = pose.rotorAngle;
      model.assembly.updateMatrixWorld(true);
      model.tubeGroups.forEach((tube, index) => {
        assert.ok(tube.matrix.equals(local[index]));
        const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(tube.getWorldQuaternion(new THREE.Quaternion()));
        assert.ok(axis.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-9);
      });
    }
  } finally { model.dispose(); }
});

test("an overhead ray sees the cap before any wall or label at every tube position", () => {
  const model = createCentrifuge(colors, () => new THREE.Texture());
  try {
    model.assembly.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    for (const tube of model.tubeGroups) {
      for (const radius of [0, .25, .47]) {
        for (let sample = 0; sample < 8; sample++) {
          const angle = sample * Math.PI / 4;
          ray.set(new THREE.Vector3(tube.position.x + Math.sin(angle) * radius, 20, tube.position.z + Math.cos(angle) * radius), new THREE.Vector3(0, -1, 0));
          const hits = ray.intersectObject(model.assembly, true);
          assert.ok(hits.length > 0);
          // Rays exactly on a triangle seam may hit the closed cap beneath
          // its texture disc; both are the same opaque physical cap surface.
          assert.ok(["cap-top", "cap"].includes(hits[0].object.name));
          assert.equal(hits[0].object.parent.parent, tube);
        }
      }
    }
  } finally { model.dispose(); }
});

test("the camera returns overhead before tube six opens and the molecular handoff begins", () => {
  const model = createCentrifuge(colors);
  try {
    assert.equal(inspectionPose(.68).cameraAngle, 0);
    assert.equal(inspectionPose(.68).opening, 0);
    const aligned = inspectionPose(.74);
    assert.ok(Math.abs(aligned.rotorAngle + 5 * Math.PI / 3) < 1e-9);
    model.assembly.rotation.y = aligned.rotorAngle;
    model.assembly.updateMatrixWorld(true);
    const sample = model.tubeGroups[SAMPLE_SLOT];
    const position = sample.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(position.x) < 1e-9 && position.z > 0);
    const fixed = model.tubeGroups.map(tube => tube.position.clone());
    for (const amount of [0, .25, .5, 1, .5, 0]) {
      model.openSample(amount);
      model.tubeGroups.forEach((tube, index) => assert.ok(tube.position.equals(fixed[index])));
      assert.equal(sample.getObjectByName("removable-cap").position.y, amount * 1.6);
      assert.equal(model.tubeGroups[0].getObjectByName("removable-cap").position.y, 0);
    }
    assert.equal(inspectionPose(.8).opening, 1);
    assert.equal(inspectionPose(.8).dive, 0);
    assert.equal(inspectionPose(.94).dive, 1);
    assert.equal(inspectionPose(.94).handoff, 0);
    assert.equal(inspectionPose(1).handoff, 1);
    assert.equal(inspectionPose(1).phase, "ribosome");
    for (const amount of [.72, .85, .94, .96, 1, .85]) {
      model.openSample(amount);
      model.assembly.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 18, position.z), new THREE.Vector3(0, -1, 0));
      const visibleHits = ray.intersectObject(model.assembly, true).filter(hit => hit.object.visible);
      assert.ok(["sample-pellet", "pellet-granules"].includes(visibleHits[0].object.name), "the pellet is clear throughout opening, without an intermediary layer");
    }
  } finally { model.dispose(); }
});
