// ═══ CAR ═══
// Persistent car group with placeholder body and GLB swap
// NOTE: scene.add(car) is done in game.js after scene is created

var car = new THREE.Group();
car.position.set(0, 0, 5);

// --- Permanent neon wheels ---
var carWheels = [];
var wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12);
var wheelMat = neonMat(new THREE.Color(0xff00ff), 2);

[[-1,0.35,1.3],[1,0.35,1.3],[-1,0.35,-1.3],[1,0.35,-1.3]].forEach(function(p) {
  var w = new THREE.Mesh(wheelGeo, wheelMat);
  w.rotation.z = Math.PI / 2;
  w.position.set(p[0], p[1], p[2]);
  car.add(w);
  carWheels.push(w);
});

// --- Permanent lights ---
[-0.6, 0.6].forEach(function(x) {
  var l = new THREE.PointLight(0x00ffff, 1.5, 15);
  l.position.set(x, 0.7, 2.3);
  car.add(l);
});
[-0.6, 0.6].forEach(function(x) {
  var l = new THREE.PointLight(0xff0044, 0.8, 8);
  l.position.set(x, 0.7, -2.3);
  car.add(l);
});

// --- Placeholder body ---
var placeholderBody = new THREE.Group();
placeholderBody.name = 'placeholderBody';
var bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4.2), neonMat(new THREE.Color(0x00ffff), 2));
bodyMesh.position.y = 0.7;
placeholderBody.add(bodyMesh);
var cabinMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 2), neonMat(new THREE.Color(0x00ffff), 1.8));
cabinMesh.position.set(0, 1.3, -0.3);
placeholderBody.add(cabinMesh);
car.add(placeholderBody);
dbg('Placeholder car built');

// --- GLB loading (called from game.js after scene exists) ---
function initCarGLB() {
  dbg('Attempting GLB load: synth_car.glb', 'warn');
  var gltfLoader = new THREE.GLTFLoader();

  gltfLoader.load('synth_car.glb',
    function(gltf) {
      dbg('GLB loaded successfully!');
      var gc = gltf.scene;

      var meshCount = 0;
      gc.traverse(function(child) { if (child.isMesh) meshCount++; });
      dbg('GLB meshes: ' + meshCount);

      // Auto-scale to ~4.2 units
      var box = new THREE.Box3().setFromObject(gc);
      var sz = box.getSize(new THREE.Vector3());
      dbg('GLB raw size: ' + sz.x.toFixed(1) + 'x' + sz.y.toFixed(1) + 'x' + sz.z.toFixed(1));
      var scaleFactor = 4.2 / Math.max(sz.x, sz.y, sz.z);
      gc.scale.setScalar(scaleFactor);

      // Rotation fix — model faces +Z by default, no rotation needed
      gc.rotation.y = 0;

      // Re-center after scale + rotation
      var sb = new THREE.Box3().setFromObject(gc);
      var ctr = sb.getCenter(new THREE.Vector3());
      gc.position.sub(ctr);
      gc.position.y = -sb.min.y;

      dbg('GLB final rotation.y: ' + gc.rotation.y.toFixed(2) + ' rad');

      // Swap placeholder for GLB
      car.remove(placeholderBody);
      car.add(gc);
      dbg('Car swapped to GLB model!');
    },
    function(progress) {
      if (progress.total > 0) {
        dbg('GLB loading: ' + Math.round(progress.loaded / progress.total * 100) + '%', 'warn');
      }
    },
    function(err) {
      dbg('GLB load failed: ' + (err.message || err), 'err');
      dbg('Using placeholder car', 'warn');
    }
  );
}
