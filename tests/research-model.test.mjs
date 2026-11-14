import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../vendor/three/three.module.js";
import { createCentrifuge, inspectionPose } from "../research-model.js";

const colors = { metal: "#d9ded5", rim: "#586359", paper: "#fdfcf8", accent: "#28694b", balance: "#e7eae3" };

test("six equal tubes occupy equally spaced positions with three opposing balance pairs", () => {
  const model = createCentrifuge(colors);
  try {
    assert.equal(model.tubeGroups.length, 6);
    assert.equal(model.tubeGroups.filter(tube => tube.userData.kind === "research").length, 3);
    assert.equal(model.tubeGroups.filter(tube => tube.userData.kind === "balance").length, 3);
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

test("camera tilt never rotates the rotor and subsequent indexing preserves all tube poses", () => {
  const model = createCentrifuge(colors);
  try {
    model.assembly.updateMatrixWorld(true);
    const local = model.tubeGroups.map(tube => tube.matrix.clone());
    for (let step = 0; step <= 100; step++) {
      const pose = inspectionPose(step / 100);
      if (step <= 32) assert.ok(Math.abs(pose.rotorAngle) < 1e-12);
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
          assert.equal(hits[0].object.parent, tube);
        }
      }
    }
  } finally { model.dispose(); }
});
