import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import { createClinicalRoom, READING_STOPS } from '../previews/clinical-room-model.js';

for (const variant of ['laboratory', 'consultation']) {
  test(`${variant}: optical entry and clinical documents are unobstructed and fit desktop/mobile cameras`, () => {
    const room = createClinicalRoom(variant);
    try {
      assert.equal(room.readings.length, 3);
      const camera = new THREE.PerspectiveCamera(42, 1, .003, 180), ray = new THREE.Raycaster();
      function setCamera(progress, aspect) {
        const view = room.pose(progress, aspect);
        camera.aspect = aspect; camera.position.copy(view.position); camera.up.copy(view.up); camera.lookAt(view.target);
        camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); room.update(progress); room.group.updateMatrixWorld(true);
        return view;
      }
      for (const aspect of [1.44, 390 / 844]) {
        const source = setCamera(0, aspect);
        ray.set(source.position, source.target.clone().sub(source.position).normalize());
        assert.equal(ray.intersectObject(room.group, true)[0].object, room.entrance.object, 'the first view reaches the actual optical/screen image');
        if (variant === 'consultation') {
          const view = room.pose(READING_STOPS[0], aspect);
          const label = room.folders[0].getObjectByName('folder-cover-label');
          ray.set(view.position, label.getWorldPosition(new THREE.Vector3()).sub(view.position).normalize());
          assert.equal(ray.intersectObject(room.group, true)[0].object, label, 'the cover title is outside the solid folder cover');
        }
        READING_STOPS.forEach((progress, index) => {
          const view = setCamera(progress, aspect), item = room.readings[index];
          const paperCenter = item.paper.getWorldPosition(new THREE.Vector3());
          ray.set(view.position, paperCenter.clone().sub(view.position).normalize());
          assert.equal(ray.intersectObject(room.group, true)[0].object, item.paper, 'the record stays readable after its folder opens');
          for (const x of [-item.width / 2, item.width / 2]) for (const y of [-item.height / 2, item.height / 2]) {
            const point = item.object.localToWorld(new THREE.Vector3(x, y, .07)).project(camera);
            assert.ok(Math.abs(point.x) < .9 && Math.abs(point.y) < .9 && point.z > -1 && point.z < 1, 'the whole record fits inside the viewport');
          }
        });
      }
    } finally { room.dispose(); }
  });
  test(`${variant}: scrolling and reversing move the camera and folder hinges, never the furniture or records`, () => {
    const room = createClinicalRoom(variant);
    try {
      const original = room.readings.map(item => item.object.matrix.clone());
      const entrance = room.entrance.object.matrixWorld.clone();
      for (const progress of [0, .34, .56, .74, .92, .74, .56, .34, 0]) {
        room.update(progress); room.group.updateMatrixWorld(true);
        room.readings.forEach((item, index) => assert.ok(item.object.matrix.equals(original[index])));
        assert.ok(room.entrance.object.matrixWorld.equals(entrance));
        const view = room.pose(progress, 1.44);
        assert.ok(view.position.distanceTo(view.target) > .01);
        assert.ok(Math.abs(view.up.length() - 1) < 1e-9);
      }
      room.folders.forEach(cover => assert.ok(Math.abs(cover.rotation.y) < 1e-12));
    } finally { room.dispose(); }
  });
}
