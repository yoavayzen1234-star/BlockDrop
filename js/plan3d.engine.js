/**
 * Plan3DEngine - Upgraded with Polygon (Shape) support.
 * Uses same SCALE as 2D (config) so 3D is in perfect alignment with the plan.
 */
import { SCALE } from './config.js';

export class Plan3DEngine {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.container = null;
        this.animationId = null;
        this.meshes = [];
        /** Pickable room meshes only (exclude edge lines/grid). */
        this.roomPickables = [];
        /** Pixels per meter - must match 2D config.SCALE for alignment */
        this.SCALE = SCALE;
        this._onResize = null;
        this._onDblClick = null;
        this.raycaster = null;
        this.pointerNdc = null;
        /** Callback: (roomId: string) => void */
        this.onRoomDblClick = null;
    }

    _computeRoomBox() {
        const box = new THREE.Box3();
        if (!this.scene || this.roomPickables.length === 0) return box;

        this.scene.updateMatrixWorld(true);
        this.roomPickables.forEach(m => {
            if (!m?.geometry) return;
            m.geometry.computeBoundingBox();
            if (!m.geometry.boundingBox) return;
            const b = m.geometry.boundingBox.clone();
            b.applyMatrix4(m.matrixWorld);
            box.union(b);
        });
        return box;
    }

    /** Fit camera so the model fills the view—close, no need to zoom in. */
    fitCameraToModel({ padding = 1, zoomInFactor = 0.78 } = {}) {
        if (!this.camera || !this.controls) return;
        const box = this._computeRoomBox();
        if (box.isEmpty()) return;

        const center = box.getCenter(new THREE.Vector3());
        const sphere = box.getBoundingSphere(new THREE.Sphere());

        const vFov = THREE.MathUtils.degToRad(this.camera.fov || 60);
        const aspect = this.camera.aspect || 1;
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
        const limitingFov = Math.min(vFov, hFov);

        let distance = (sphere.radius * (padding || 1)) / Math.sin(limitingFov / 2);
        if (!Number.isFinite(distance) || distance <= 0) distance = 10;
        distance *= zoomInFactor;
        distance = Math.max(distance, 2);

        const currentTarget = this.controls.target?.clone?.() ?? new THREE.Vector3();
        const dir = new THREE.Vector3().subVectors(this.camera.position, currentTarget);
        if (dir.lengthSq() < 1e-8) dir.set(1, 1, 1);
        dir.normalize();

        this.controls.target.copy(center);
        this.camera.position.copy(center).addScaledVector(dir, distance);

        this.camera.near = Math.max(0.1, distance / 200);
        this.camera.far = Math.max(this.camera.near + 1, distance * 200);
        this.camera.updateProjectionMatrix();

        this.controls.maxDistance = Math.max(this.controls.maxDistance || 0, distance * 10);
        this.controls.update();
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
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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

        // Picking (double click)
        this.raycaster = new THREE.Raycaster();
        this.pointerNdc = new THREE.Vector2();
        this._onDblClick = (e) => {
            if (!this.renderer || !this.camera || !this.raycaster || !this.pointerNdc) return;
            const rect = this.renderer.domElement.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            this.pointerNdc.set(x * 2 - 1, -(y * 2 - 1));

            this.raycaster.setFromCamera(this.pointerNdc, this.camera);
            const hits = this.raycaster.intersectObjects(this.roomPickables, true);
            const hit = hits.find(h => h?.object?.userData?.roomId);
            const roomId = hit?.object?.userData?.roomId;
            if (roomId && this.onRoomDblClick) this.onRoomDblClick(roomId);
        };
        this.renderer.domElement.addEventListener('dblclick', this._onDblClick);

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
    buildFromState(floors, rooms, { fitCamera = false, padding = 1, zoomInFactor = 0.65 } = {}) {
        this.clearScene();
        this.roomPickables = [];
        let accumulatedHeight = 0;

        floors.forEach((floor) => {
            const floorRooms = rooms.filter(r => r.floorId === floor.id);
            floorRooms.forEach(r => {
                let geometry;
                const h = r.customHeight || floor.height;

                if (r.outer && r.outer.length >= 3) {
                    // Polygon Extrusion (points are expected in the same 2D px space as leftPx/topPx)
                    // We center the geometry around its bounds center so positioning matches 2D precisely.
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    r.outer.forEach(p => {
                        minX = Math.min(minX, p.x);
                        minY = Math.min(minY, p.y);
                        maxX = Math.max(maxX, p.x);
                        maxY = Math.max(maxY, p.y);
                    });
                    const centerPxX = (minX + maxX) / 2;
                    const centerPxY = (minY + maxY) / 2;

                    const shape = new THREE.Shape();
                    shape.moveTo((r.outer[0].x - centerPxX) / this.SCALE, (r.outer[0].y - centerPxY) / this.SCALE);
                    for (let i = 1; i < r.outer.length; i++) {
                        shape.lineTo((r.outer[i].x - centerPxX) / this.SCALE, (r.outer[i].y - centerPxY) / this.SCALE);
                    }
                    shape.closePath();

                    if (r.holes) {
                        r.holes.forEach(hole => {
                            if (hole.length < 3) return;
                            const holePath = new THREE.Path();
                            holePath.moveTo((hole[0].x - centerPxX) / this.SCALE, (hole[0].y - centerPxY) / this.SCALE);
                            for (let i = 1; i < hole.length; i++) {
                                holePath.lineTo((hole[i].x - centerPxX) / this.SCALE, (hole[i].y - centerPxY) / this.SCALE);
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
                mesh.userData.roomId = r.id;
                mesh.userData.floorId = r.floorId;

                if (r.outer) {
                    // Place centered polygon back to its 2D position (center-based)
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                    r.outer.forEach(p => {
                        minX = Math.min(minX, p.x);
                        minY = Math.min(minY, p.y);
                        maxX = Math.max(maxX, p.x);
                        maxY = Math.max(maxY, p.y);
                    });
                    const centerPxX = (minX + maxX) / 2;
                    const centerPxY = (minY + maxY) / 2;
                    mesh.position.set(centerPxX / this.SCALE, accumulatedHeight + (h / 2), centerPxY / this.SCALE);
                    mesh.rotation.y = -((r.rotationDeg ?? r.rotation ?? 0) * (Math.PI / 180));
                } else {
                    // Rectangles: 2D left/top are top-left in px. Three.js meshes are centered.
                    const leftPx = (r.leftPx ?? r.left ?? 0);
                    const topPx = (r.topPx ?? r.top ?? 0);
                    const widthPx = (r.widthPx ?? r.width ?? 0);
                    const heightPx = (r.heightPx ?? r.height ?? 0);

                    const cx = (leftPx + (widthPx / 2)) / this.SCALE;
                    const cz = (topPx + (heightPx / 2)) / this.SCALE;
                    mesh.position.set(cx, accumulatedHeight + (h / 2), cz);
                    mesh.rotation.y = -((r.rotationDeg ?? r.rotation ?? 0) * (Math.PI / 180));
                }

                mesh.castShadow = true;
                mesh.receiveShadow = true;
                this.scene.add(mesh);
                this.meshes.push(mesh);
                this.roomPickables.push(mesh);

                const edges = new THREE.EdgesGeometry(geometry);
                const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000 }));
                line.position.copy(mesh.position);
                line.rotation.copy(mesh.rotation);
                this.scene.add(line);
                this.meshes.push(line);
            });
            accumulatedHeight += floor.height;
        });

        // Center orbit target on model bounds and fit camera so model is close (no zoom needed)
        if (this.controls && this.roomPickables.length > 0) {
            const box = this._computeRoomBox();
            if (!box.isEmpty()) {
                const center = box.getCenter(new THREE.Vector3());
                this.controls.target.copy(center);
                if (fitCamera) {
                    this._updateSize();
                    this.fitCameraToModel({ padding, zoomInFactor });
                }
            }
        }
    }

    _updateSize() {
        if (!this.container || !this.camera || !this.renderer) return;
        const w = this.container.clientWidth || window.innerWidth;
        const h = this.container.clientHeight || window.innerHeight;
        this.camera.aspect = Math.max(0.1, Math.min(10, w / h));
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
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
        if (this._onDblClick && this.renderer?.domElement) {
            this.renderer.domElement.removeEventListener('dblclick', this._onDblClick);
        }
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
        this._onDblClick = null;
        this.raycaster = null;
        this.pointerNdc = null;
        this.roomPickables = [];
    }
}
