// ═══ CAR ═══
var car = new THREE.Group();
car.position.set(0, 0, 5);

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

function makeTrafficCar(color) {
  var g = new THREE.Group();
  var mat = neonMat(color, 1.5);
  var body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 3.2), mat);
  body.position.y = 0.5;
  g.add(body);
  var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 1.5), mat);
  cabin.position.set(0, 1.0, -0.2);
  g.add(cabin);
  var wGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.2, 8);
  var wMat = neonMat(new THREE.Color(0xff00ff), 1.5);
  [[-0.8,0.28,1],[0.8,0.28,1],[-0.8,0.28,-1],[0.8,0.28,-1]].forEach(function(p) {
    var w = new THREE.Mesh(wGeo, wMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(p[0], p[1], p[2]);
    g.add(w);
  });
  g.userData.isTraffic = true;
  return g;
}

function initCarGLB() {
  dbg('Attempting GLB load: synth_car.glb', 'warn');
  var gltfLoader = new THREE.GLTFLoader();
  gltfLoader.load('synth_car.glb',
    function(gltf) {
      dbg('GLB loaded!');
      var gc = gltf.scene;
      var box = new THREE.Box3().setFromObject(gc);
      var sz = box.getSize(new THREE.Vector3());
      var scaleFactor = 4.2 / Math.max(sz.x, sz.y, sz.z);
      gc.scale.setScalar(scaleFactor);
      gc.rotation.y = 0;
      var sb = new THREE.Box3().setFromObject(gc);
      var ctr = sb.getCenter(new THREE.Vector3());
      gc.position.sub(ctr);
      gc.position.y = -sb.min.y;
      car.remove(placeholderBody);
      car.add(gc);
      dbg('Car swapped to GLB!');
    },
    null,
    function(err) {
      dbg('GLB load failed, using placeholder', 'warn');
    }
  );
}
