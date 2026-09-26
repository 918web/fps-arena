// Картинка в оптике вне прицеливания (picture-in-picture): сцена рендерится с объектива в небольшую
// текстуру и выводится на окуляр вместе с сеткой. Выходной зрачок: при взгляде сбоку картинку
// закрывает тень кромки, как у настоящей оптики. Размер текстуры — по размеру окуляра на экране.
var PIP_VS = `
varying vec3 vP;
void main() {
  vP = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
var PIP_FS = `
uniform sampler2D uImg, uRet;
uniform vec2 uC;
uniform float uR, uRetK, uHasRet, uGain, uLive;
uniform vec3 uCamL, uTint;
varying vec3 vP;
void main() {
  // координаты на окуляре: x — вправо (+z объекта), y — вверх; ±1 — кромка линзы
  vec2 q = vec2(vP.z - uC.y, vP.y - uC.x) / uR;
  float r = length(q);
  vec3 v = normalize(vP - uCamL);
  vec2 off = vec2(v.z, v.y) / max(v.x, 0.25);
  vec3 col = texture2D(uImg, 0.5 + 0.5 * q).rgb * uGain;
  if (uHasRet > 0.5) {
    vec2 ru = 0.5 + 0.5 * q * uRetK;
    if (ru.x > 0.0 && ru.x < 1.0 && ru.y > 0.0 && ru.y < 1.0) {
      vec4 rt = texture2D(uRet, ru);
      col = mix(col, rt.rgb * 1.6, rt.a);
    }
  }
  float pupil = length(q + off * 0.55);
  float vig = (1.0 - smoothstep(0.72, 1.02, pupil)) * (1.0 - smoothstep(0.93, 1.0, r));
  col *= mix(0.0, vig, uLive);
  // просветление: слабый цветной отблеск к краю стекла
  col += uTint * (0.015 + 0.05 * smoothstep(0.35, 1.0, r));
  ${HDR_SAFE("col")}
  gl_FragColor = vec4(col, 1.0);
}`;
var PipScope = class {
  constructor(renderer, scene) {
    this.R = renderer;
    this.scene = scene;
    this.cam = new THREE.PerspectiveCamera(8, 1, 0.02, 400);
    this.rt = null;
    this.size = 0;
    this.lens = null;
    this.frame = 0;
    this.every = 1;
    this.maxSize = 512;
    this._v = new THREE.Vector3();
    this._c = new THREE.Vector3();
    this._m = new THREE.Matrix4();
  }
  target(px) {
    // шаги по степеням двойки с запасом ×1,6 к размеру окуляра: без мерцания при уменьшении
    let n = 128;
    while (n < px * 1.6 && n < this.maxSize) n *= 2;
    if (n === this.size && this.rt) return this.rt;
    this.rt?.dispose();
    this.size = n;
    this.rt = new THREE.WebGLRenderTarget(n, n, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, samples: 0 });
    if (this.lens) this.lens.userData.pipMat.uniforms.uImg.value = this.rt.texture;
    return this.rt;
  }
  material(lens) {
    if (lens.userData.pipMat) return lens.userData.pipMat;
    const g = lens.geometry;
    g.computeBoundingBox();
    const b = g.boundingBox;
    const glass = lens.material;
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uImg: { value: null },
        uRet: { value: null },
        uC: { value: new THREE.Vector2((b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2) },
        uR: { value: Math.max(b.max.y - b.min.y, b.max.z - b.min.z) / 2 },
        uRetK: { value: 1 },
        uHasRet: { value: 0 },
        uGain: { value: 0.9 },
        uLive: { value: 0 },
        uCamL: { value: new THREE.Vector3() },
        uTint: { value: (glass.color || new THREE.Color(0.3, 0.4, 0.6)).clone().multiplyScalar(0.5) }
      },
      vertexShader: PIP_VS,
      fragmentShader: PIP_FS
    });
    for (const k of ["stencilWrite", "stencilRef", "stencilFunc", "stencilZPass"]) m[k] = glass[k];
    lens.userData.pipMat = m;
    lens.userData.glassMat = glass;
    return m;
  }
  // вернуть стекло: прицеливание, модуль снят, картинка не нужна
  release() {
    const l = this.lens;
    if (!l) return;
    if (l.userData.glassMat) l.material = l.userData.glassMat;
    if (this.hidRet) this.hidRet.visible = true;
    this.lens = null;
    this.hidRet = null;
  }
  // o: { lens, gun, pos, dir, up, fov, retTex, retK, retMesh, main }
  render(o, camera, H) {
    const { lens } = o;
    if (this.lens !== lens) {
      this.release();
      this.lens = lens;
      lens.material = this.material(lens);
      lens.material.uniforms.uImg.value = this.rt?.texture ?? null;
      lens.material.uniforms.uLive.value = 0;
    }
    if (o.retMesh && o.retMesh.visible) {
      o.retMesh.visible = false;
      this.hidRet = o.retMesh;
    }
    const u = lens.material.uniforms;
    u.uRet.value = o.retTex || null;
    u.uHasRet.value = o.retTex ? 1 : 0;
    u.uRetK.value = o.retK || 1;
    lens.updateWorldMatrix(true, false);
    u.uCamL.value.copy(camera.position).applyMatrix4(this._m.copy(lens.matrixWorld).invert());
    // окуляр на экране: размер в пикселях и видимость; сзади камеры или спереди прицела — не рисуем
    const c = this._c.set(0, u.uC.value.x, u.uC.value.y).applyMatrix4(lens.matrixWorld);
    const toLens = this._v.copy(c).sub(camera.position);
    const dist = toLens.length();
    if (toLens.dot(o.dir) <= 0) return false;
    const rWorld = u.uR.value * lens.matrixWorld.getMaxScaleOnAxis();
    const px = rWorld / Math.max(1e-4, dist) / Math.tan(camera.fov * Math.PI / 360) * H;
    const ndc = c.clone().project(camera);
    if (ndc.z > 1 || Math.abs(ndc.x) > 1.2 || Math.abs(ndc.y) > 1.2 || px < 5) return false;
    if (u.uLive.value && this.frame++ % this.every) return false;
    const rt = this.target(px);
    u.uImg.value = rt.texture;
    const cam = this.cam;
    cam.fov = o.fov;
    cam.updateProjectionMatrix();
    cam.position.copy(o.pos);
    cam.up.copy(o.up);
    cam.lookAt(this._v.copy(o.pos).add(o.dir));
    cam.updateMatrixWorld();
    // оружие в кадр объектива не попадает (ось прицела выше ствола), а его сотни мешей — самое дорогое
    const vis = o.gun.visible;
    o.gun.visible = false;
    const prev = this.R.getRenderTarget();
    this.R.setRenderTarget(rt);
    this.R.render(this.scene, cam);
    this.R.setRenderTarget(prev);
    o.gun.visible = vis;
    u.uLive.value = 1;
    return true;
  }
  dispose() {
    this.release();
    this.rt?.dispose();
    this.rt = null;
    this.size = 0;
  }
};

