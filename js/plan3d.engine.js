/**
 * Plan3DEngine - Upgraded with Polygon (Shape) support
 */
export class Plan3DEngine {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.container = null;
        this.animationId = null;
        this.meshes = [];
        this.SCALE = 12;
        this._onResize = null;
    }

    init(containerEl) {
        this.container = containerEl;
        const width = containerEl.clientWidth || window.innerWidth;
        const height = containerEl.clientHeight || window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff);

        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 10000);
        this.camera.position.set(500, 500, 500);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        containerEl.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(400, 800, 400);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // Huge Grid
        this.scene.add(new THREE.GridHelper(5000, 200, 0xdddddd, 0xeeeeee));

        this._onResize = () => {
            const w = this.container.clientWidth || window.innerWidth;
            const h = this.container.clientHeight || window.innerHeight;
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
        };
        window.addEventListener('resize', this._onResize);

        this._animate();
    }

    _animate() {
        this.animationId = requestAnimationFrame(() => this._animate());
        if (this.controls) this.controls.update();
        this.renderOnce();
    }

    /**
     * Build 3D from 2D state. Logical coords (leftPx, topPx) use global origin 0,0 =
     * infinite canvas center; 3D XZ origin is the same so the model is aligned with 2D.
     */
    buildFromState(floors, rooms) {
        this.clearScene();
        let accumulatedHeight = 0;

        floors.forEach((floor) => {
            const floorRooms = rooms.filter(r => r.floorId === floor.id);
            floorRooms.forEach(r => {
                let geometry;
                const h = r.customHeight || floor.height;

                if (r.outer && r.outer.length >= 3) {
                    // Polygon Extrusion
                    const shape = new THREE.Shape();
                    shape.moveTo(r.outer[0].x / this.SCALE, r.outer[0].y / this.SCALE);
                    for (let i = 1; i < r.outer.length; i++) {
                        shape.lineTo(r.outer[i].x / this.SCALE, r.outer[i].y / this.SCALE);
                    }
                    shape.closePath();

                    if (r.holes) {
                        r.holes.forEach(hole => {
                            if (hole.length < 3) return;
                            const holePath = new THREE.Path();
                            holePath.moveTo(hole[0].x / this.SCALE, hole[0].y / this.SCALE);
                            for (let i = 1; i < hole.length; i++) {
                                holePath.lineTo(hole[i].x / this.SCALE, hole[i].y / this.SCALE);
                            }
                            holePath.closePath();
                            shape.holes.push(holePath);
                        });
                    }

                    geometry = new THREE.ExtrudeGeometry(shape, {
                        depth: h,
                        bevelEnabled: false
                    });

                    // Rotate so y is up in Three.js
                    geometry.rotateX(Math.PI / 2);
                } else {
                    // Box Fallback
                    const w = (r.widthPx || r.width) / this.SCALE;
                    const d = (r.heightPx || r.height) / this.SCALE;
                    geometry = new THREE.BoxGeometry(w, h, d);
                }

                const material = new THREE.MeshPhongMaterial({
                    color: r.color,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.9,
                    polygonOffset: true,
                    polygonOffsetFactor: 1,
                    polygonOffsetUnits: 1
                });

                const mesh = new THREE.Mesh(geometry, material);

                if (r.outer) {
                    mesh.position.set(0, accumulatedHeight + (h / 2), 0);
                } else {
                    // Map 2D global origin (0,0) to 3D (0, y, 0)
                    const x = (r.leftPx ?? r.left ?? 0) / this.SCALE;
                    const z = (r.topPx ?? r.top ?? 0) / this.SCALE;
                    mesh.position.set(x, accumulatedHeight + (h / 2), z);
                    mesh.rotation.y = -((r.rotationDeg ?? r.rotation ?? 0) * (Math.PI / 180));
                }

                mesh.castShadow = true;
                mesh.receiveShadow = true;
                this.scene.add(mesh);
                this.meshes.push(mesh);

                const edges = new THREE.EdgesGeometry(geometry);
                const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000 }));
                line.position.copy(mesh.position);
                line.rotation.copy(mesh.rotation);
                this.scene.add(line);
                this.meshes.push(line);
            });
            accumulatedHeight += floor.height;
        });

        // Center orbit target on model bounds (sync with 2D global origin)
        if (this.controls && this.meshes.length > 0) {
            this.scene.updateMatrixWorld(true);
            const box = new THREE.Box3();
            this.meshes.forEach(m => {
                if (m.geometry) {
                    m.geometry.computeBoundingBox();
                    if (m.geometry.boundingBox) {
                        const b = m.geometry.boundingBox.clone();
                        b.applyMatrix4(m.matrixWorld);
                        box.union(b);
                    }
                }
            });
            const center = box.getCenter(new THREE.Vector3());
            this.controls.target.copy(center);
        }
    }

    clearScene() {
        this.meshes.forEach(m => {
            if (m.geometry) m.geometry.dispose();
            if (m.material) {
                if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
                else m.material.dispose();
            }
            this.scene.remove(m);
        });
        this.meshes = [];
    }

    renderOnce() {
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    destroy() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        if (this._onResize) window.removeEventListener('resize', this._onResize);
        this.clearScene();
        if (this.controls) this.controls.dispose();
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
    }
}
