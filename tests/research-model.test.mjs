import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { createCentrifuge, inspectionPose, molecularPose, pelletComponent, unfoldPoint, RESEARCH_STOPS } from "../research-model.js";

const colors = { metal: "#d9ded5", rim: "#586359", paper: "#fdfcf8", accent: "#28694b", balance: "#e7eae3" };

test("molecular particles originate at the modeled pellet grains and arrive exactly on their destinations", () => {
  const model = createCentrifuge(colors);
  try {
    const grains = model.tubeGroups[3].getObjectByName("pellet-granules"), matrix = new THREE.Matrix4();
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

test("three adjacent research tubes and three balance tubes occupy six equal slots", () => {
  const model = createCentrifuge(colors);
  try {
    assert.equal(model.tubeGroups.length, 6);
    assert.equal(model.tubeGroups.filter(tube => tube.userData.kind === "research").length, 3);
    assert.equal(model.tubeGroups.filter(tube => tube.userData.kind === "balance").length, 3);
    assert.ok(model.tubeGroups.slice(0, 3).every(tube => tube.userData.kind === "research"));
    assert.ok(model.tubeGroups.slice(3).every(tube => tube.userData.kind === "balance"));
    for (let index = 0; index < 6; index++) {
      const tube = model.tubeGroups[index];
      const next = model.tubeGroups[(index + 1) % 6];
      const opposite = model.tubeGroups[(index + 3) % 6];
      const cosine = tube.position.dot(next.position) / (tube.position.length() * next.position.length());
      assert.ok(Math.abs(Math.acos(cosine) - Math.PI / 3) < 1e-9);
      assert.ok(tube.position.clone().add(opposite.position).length() < 1e-9);
      assert.notEqual(tube.userData.kind, opposite.userData.kind);
      assert.deepEqual(tube.getObjectByName("tube-wall").geometry.parameters, opposite.getObjectByName("tube-wall").geometry.parameters);
      assert.deepEqual(tube.getObjectByName("liquid-column").geometry.parameters, opposite.getObjectByName("liquid-column").geometry.parameters);
    }
  } finally { model.dispose(); }
});

test("continuous scrolling brings each adjacent research tube forward without intermediate stops", () => {
  const model = createCentrifuge(colors);
  try {
    RESEARCH_STOPS.forEach((progress, index) => {
      const pose = inspectionPose(progress);
      model.assembly.rotation.y = pose.rotorAngle;
      model.assembly.updateMatrixWorld(true);
      const position = model.tubeGroups[index].getWorldPosition(new THREE.Vector3());
      assert.ok(Math.abs(position.x) < 1e-9);
      assert.ok(position.z > 0);
      assert.ok(Math.abs(pose.closeUp - 1) < 1e-9);
    });
    for (let progress = RESEARCH_STOPS[0] + .01; progress < RESEARCH_STOPS[2] - .01; progress += .01) {
      assert.ok(inspectionPose(progress + .005).rotorAngle < inspectionPose(progress).rotorAngle);
    }
  } finally { model.dispose(); }
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

test("the camera returns overhead before tube four opens and the molecular handoff begins", () => {
  const model = createCentrifuge(colors);
  try {
    assert.equal(inspectionPose(.68).cameraAngle, 0);
    assert.equal(inspectionPose(.68).opening, 0);
    const aligned = inspectionPose(.74);
    assert.ok(Math.abs(aligned.rotorAngle + Math.PI) < 1e-9);
    model.assembly.rotation.y = aligned.rotorAngle;
    model.assembly.updateMatrixWorld(true);
    const sample = model.tubeGroups[3];
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
    model.openSample(1);
    model.assembly.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 18, position.z), new THREE.Vector3(0, -1, 0));
    const visibleHits = ray.intersectObject(model.assembly, true).filter(hit => hit.object.visible);
    assert.ok(["sample-pellet", "pellet-granules"].includes(visibleHits[0].object.name), "the open tube has a clear view down to its pellet");
  } finally { model.dispose(); }
});
