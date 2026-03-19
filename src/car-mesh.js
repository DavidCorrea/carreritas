import { C } from './constants.js';
import { hexToRgb, intToHex } from './utils.js';

export var sharedGeom = {
  disc:           new THREE.CircleGeometry(C.car.radius, 20),
  halfA:          new THREE.CircleGeometry(C.car.radius, 20, 0, Math.PI),
  halfB:          new THREE.CircleGeometry(C.car.radius, 20, Math.PI, Math.PI),
  ring:           new THREE.RingGeometry(C.car.radius * 0.82, C.car.radius, 20),
  dot:            new THREE.CircleGeometry(C.car.radius * 0.22, 12),
  shadow:         new THREE.CircleGeometry(C.car.radius * 1.1, 20),
  dotsDot:        new THREE.CircleGeometry(C.car.radius * 0.17, 10),
  bullseyeMid:    new THREE.CircleGeometry(C.car.radius * 0.65, 16),
  bullseyeCenter: new THREE.CircleGeometry(C.car.radius * 0.35, 12),
  stripe:         new THREE.PlaneGeometry(C.car.radius * 2, C.car.radius * 0.35),
  spiral0:        new THREE.CircleGeometry(C.car.radius, 8, 0, Math.PI / 3),
  spiral1:        new THREE.CircleGeometry(C.car.radius, 8, Math.PI / 3, Math.PI / 3),
  spiral2:        new THREE.CircleGeometry(C.car.radius, 8, Math.PI * 2 / 3, Math.PI / 3),
  spiral3:        new THREE.CircleGeometry(C.car.radius, 8, Math.PI, Math.PI / 3),
  spiral4:        new THREE.CircleGeometry(C.car.radius, 8, Math.PI * 4 / 3, Math.PI / 3),
  spiral5:        new THREE.CircleGeometry(C.car.radius, 8, Math.PI * 5 / 3, Math.PI / 3)
};

for (var k in sharedGeom) sharedGeom[k]._shared = true;

export function createCarMesh(opts) {
  var group = new THREE.Group();
  var transparent = opts.opacity < 1;
  var primary = opts.color;
  var secondary = opts.secondaryColor || primary;
  var pattern = opts.pattern || 'solid';
  var matOpts = { transparent: transparent, opacity: opts.opacity };

  if (pattern === 'half') {
    var halfA = new THREE.Mesh(
      sharedGeom.halfA,
      new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
    );
    halfA.rotation.x = -Math.PI / 2;
    halfA.position.y = 2;
    halfA._colorRole = 'primary';
    group.add(halfA);

    var halfB = new THREE.Mesh(
      sharedGeom.halfB,
      new THREE.MeshLambertMaterial(Object.assign({ color: secondary }, matOpts))
    );
    halfB.rotation.x = -Math.PI / 2;
    halfB.position.y = 2;
    halfB._colorRole = 'secondary';
    group.add(halfB);
  } else if (pattern === 'gradient' || pattern === 'radial') {
    var aSegs = 32;
    var rSegs = 10;
    var pRgb = hexToRgb(intToHex(primary));
    var sRgb = hexToRgb(intToHex(secondary));
    var gPositions = [];
    var gColors = [];
    var gIndices = [];

    for (var ri = 0; ri <= rSegs; ri++) {
      var rFrac = ri / rSegs;
      var rad = rFrac * C.car.radius;
      for (var ai = 0; ai <= aSegs; ai++) {
        var ang = (ai / aSegs) * Math.PI * 2;
        var px = Math.cos(ang) * rad;
        var py = Math.sin(ang) * rad;
        gPositions.push(px, py, 0);
        var t;
        if (pattern === 'gradient') {
          t = (py / C.car.radius + 1) * 0.5;
        } else {
          t = 1 - rFrac;
        }
        gColors.push(pRgb.r * t + sRgb.r * (1 - t));
        gColors.push(pRgb.g * t + sRgb.g * (1 - t));
        gColors.push(pRgb.b * t + sRgb.b * (1 - t));
      }
    }

    var stride = aSegs + 1;
    for (var ri = 0; ri < rSegs; ri++) {
      for (var ai = 0; ai < aSegs; ai++) {
        var a = ri * stride + ai;
        var b = a + 1;
        var c = a + stride;
        var d = c + 1;
        gIndices.push(a, c, b, b, c, d);
      }
    }

    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(gPositions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(gColors, 3));
    geom.setIndex(gIndices);
    geom.computeVertexNormals();
    var gDisc = new THREE.Mesh(geom, new THREE.MeshLambertMaterial({
      vertexColors: true, transparent: transparent, opacity: opts.opacity
    }));
    gDisc._colorRole = 'gradient';
    gDisc.rotation.x = -Math.PI / 2;
    gDisc.position.y = 2;
    group.add(gDisc);
  } else if (pattern === 'spiral') {
    for (var si = 0; si < 6; si++) {
      var sliceColor = si % 2 === 0 ? primary : secondary;
      var slice = new THREE.Mesh(
        sharedGeom['spiral' + si],
        new THREE.MeshLambertMaterial(Object.assign({ color: sliceColor }, matOpts))
      );
      slice.rotation.x = -Math.PI / 2;
      slice.position.y = 2;
      slice._colorRole = si % 2 === 0 ? 'primary' : 'secondary';
      group.add(slice);
    }
  } else if (pattern === 'dots') {
    var dotsDisc = new THREE.Mesh(
      sharedGeom.disc,
      new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
    );
    dotsDisc.rotation.x = -Math.PI / 2;
    dotsDisc.position.y = 2;
    dotsDisc._colorRole = 'primary';
    group.add(dotsDisc);
    var dotAngles = [0.4, 1.4, 2.5, 3.7, 5.0];
    var dotDist = C.car.radius * 0.55;
    for (var di = 0; di < dotAngles.length; di++) {
      var da = dotAngles[di];
      var dMesh = new THREE.Mesh(
        sharedGeom.dotsDot,
        new THREE.MeshLambertMaterial(Object.assign({ color: secondary }, matOpts))
      );
      dMesh.rotation.x = -Math.PI / 2;
      dMesh.position.set(Math.sin(da) * dotDist, 2.15, Math.cos(da) * dotDist);
      dMesh._colorRole = 'secondary';
      group.add(dMesh);
    }
  } else if (pattern === 'bullseye') {
    var beDisc = new THREE.Mesh(
      sharedGeom.disc,
      new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
    );
    beDisc.rotation.x = -Math.PI / 2;
    beDisc.position.y = 2;
    beDisc._colorRole = 'primary';
    group.add(beDisc);
    var beRing = new THREE.Mesh(
      sharedGeom.bullseyeMid,
      new THREE.MeshLambertMaterial(Object.assign({ color: secondary }, matOpts))
    );
    beRing.rotation.x = -Math.PI / 2;
    beRing.position.y = 2.1;
    beRing._colorRole = 'secondary';
    group.add(beRing);
    var beCenter = new THREE.Mesh(
      sharedGeom.bullseyeCenter,
      new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
    );
    beCenter.rotation.x = -Math.PI / 2;
    beCenter.position.y = 2.15;
    beCenter._colorRole = 'primary';
    group.add(beCenter);
  } else {
    var disc = new THREE.Mesh(
      sharedGeom.disc,
      new THREE.MeshLambertMaterial(Object.assign({ color: primary }, matOpts))
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 2;
    disc._colorRole = 'primary';
    group.add(disc);
  }

  if (pattern === 'stripe') {
    var stripe = new THREE.Mesh(
      sharedGeom.stripe,
      new THREE.MeshLambertMaterial(Object.assign({ color: secondary }, matOpts))
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.y = 2.15;
    stripe._colorRole = 'secondary';
    group.add(stripe);
  }

  var ringColor = pattern === 'ring' ? secondary : 0x000000;
  var ringOpacity = pattern === 'ring' ? 0.8 * opts.opacity : 0.3 * opts.opacity;
  var ring = new THREE.Mesh(
    sharedGeom.ring,
    new THREE.MeshLambertMaterial({ color: ringColor, transparent: true, opacity: ringOpacity })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 2.1;
  ring._colorRole = 'ring';
  group.add(ring);

  var dot = new THREE.Mesh(
    sharedGeom.dot,
    new THREE.MeshLambertMaterial(Object.assign({ color: 0xffffff }, matOpts))
  );
  dot.rotation.x = -Math.PI / 2;
  dot.position.set(0, 2.5, C.car.radius * 0.55);
  group.add(dot);

  if (!transparent) {
    var shadow = new THREE.Mesh(
      sharedGeom.shadow,
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(1, 0.005, -1);
    group.add(shadow);
  }

  group.position.set(opts.x, 0, opts.z);
  group.rotation.y = opts.angle;
  return group;
}

export function updateCarColors(group, primaryInt, secondaryInt, pattern) {
  var pRgb = hexToRgb(intToHex(primaryInt));
  var sRgb = hexToRgb(intToHex(secondaryInt));
  group.traverse(function(child) {
    if (!child.isMesh || !child._colorRole) return;
    var role = child._colorRole;
    if (role === 'primary') {
      child.material.color.setHex(primaryInt);
    } else if (role === 'secondary') {
      child.material.color.setHex(secondaryInt);
    } else if (role === 'ring' && pattern === 'ring') {
      child.material.color.setHex(secondaryInt);
    } else if (role === 'gradient') {
      var colors = child.geometry.getAttribute('color');
      var positions = child.geometry.getAttribute('position');
      for (var i = 0; i < colors.count; i++) {
        var t;
        if (pattern === 'gradient') {
          t = (positions.getY(i) / C.car.radius + 1) * 0.5;
        } else {
          var px = positions.getX(i), py = positions.getY(i);
          t = 1 - Math.sqrt(px * px + py * py) / C.car.radius;
        }
        colors.setXYZ(i, pRgb.r * t + sRgb.r * (1 - t), pRgb.g * t + sRgb.g * (1 - t), pRgb.b * t + sRgb.b * (1 - t));
      }
      colors.needsUpdate = true;
    }
  });
}
