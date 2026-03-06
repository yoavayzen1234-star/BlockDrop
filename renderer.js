/**
 * WORKSPACE_OFFSET is applied once when converting logical coords → display (style.left/top).
 * It is the single origin for all floors; do not add any redundant offset inside floor rendering.
 * All rooms use global state logical (leftPx, topPx); display = (WORKSPACE_OFFSET + logical) * zoom.
 */
import { SCALE, WORKSPACE_OFFSET, roundLogical, areaM2ToCircleDiameterM, areaM2ToCircleDiameterPx, areaM2ToSquareSidePx } from './js/config.js';
import { state } from './js/state.js';
import { createRoomElement, buildFloorTab, buildFloorPlan } from './js/ui-builder.js';
import { Plan3DEngine } from './js/plan3d.engine.js';
import { CanvasCamera } from './js/canvasCamera.js';
import { SelectionManager } from './js/selectionManager.js';
const APP_NAME = 'SurferPlan Desktop';
const APP_VERSION = '1.2.0';

// --- Core refs (set in initApp) ---
let camera = null;
let selectionManager = null;
let plan3dEngine = null;

// --- Alternatives (חלופות) ---
let alternatives = [];
let currentProjectData = null;
let activeAltIndex = 0;

// --- Undo (מחסנית צעד אחורה) ---
const UNDO_LIMIT = 50;
let undoStack = [];

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    initApp();
});

// Key bindings
window.isAltPressed = false;
window.onkeydown = (e) => {
    if (e.altKey) window.isAltPressed = true;
    if (e.key === 'Delete' || e.key === 'Backspace') deleteSelectedRooms();
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
    }
    const tag = e.target && e.target.tagName && e.target.tagName.toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (state.selectedRooms.length === 0 || !camera) return;
    let dx = 0, dy = 0;
    if (e.key === 'ArrowLeft') dx = -1;
    else if (e.key === 'ArrowRight') dx = 1;
    else if (e.key === 'ArrowUp') dy = -1;
    else if (e.key === 'ArrowDown') dy = 1;
    if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        nudgeSelectedRoomsByOnePixel(dx, dy);
    }
};
window.onkeyup = (e) => {
    window.isAltPressed = false;
};

function initApp() {
    const wrapper = document.getElementById('canvas-wrapper');
    const main = document.getElementById('main');

    // Initialize Camera
    camera = new CanvasCamera(wrapper, main);
    window.camera = camera;
    camera.onZoomChange = refreshRoomsForZoom;

    // Initialize Selection Manager
    selectionManager = new SelectionManager(camera, main);

    // Bind basic UI actions
    document.getElementById('save-btn').onclick = saveProject;
    document.getElementById('load-btn').onclick = loadProject;
    document.getElementById('add-room-btn').onclick = addNewRoomUI;
    const shapeToggleBtn = document.getElementById('shape-toggle-btn');
    if (shapeToggleBtn) {
        shapeToggleBtn.onclick = () => {
            const isEllipse = shapeToggleBtn.dataset.shape === 'ellipse';
            shapeToggleBtn.dataset.shape = isEllipse ? 'rect' : 'ellipse';
            shapeToggleBtn.title = isEllipse ? 'עיגול – לחץ כדי להוסיף חדר כעיגול' : 'מלבן – החדר הבא יהיה מלבן';
            shapeToggleBtn.textContent = isEllipse ? '⭕' : '🔘';
            shapeToggleBtn.style.background = isEllipse ? '#fff' : 'rgba(0, 119, 190, 0.2)';
            shapeToggleBtn.style.borderColor = isEllipse ? '#cbd5e1' : 'var(--primary)';
        };
    }
    document.getElementById('view-3d-btn').onclick = init3D;
    document.getElementById('close-3d').onclick = close3D;
    document.getElementById('toggle-sidebar').onclick = toggleSidebar;
    document.getElementById('reset-cam').onclick = () => camera.reset();
    document.getElementById('reset-view').onclick = () => camera.centerView();
    document.getElementById('add-floor-btn').onclick = addNewFloor;

    document.addEventListener('room-merge', (e) => onRoomMerge(e.detail.parentId, e.detail.childId));

    // סגירת מודל פיצול בלחיצה על הרקע
    const splitModal = document.getElementById('split-modal');
    if (splitModal) {
        splitModal.onclick = (e) => { if (e.target === splitModal) closeSplitModal(); };
        const splitContent = splitModal.querySelector('.split-modal-content');
        if (splitContent) splitContent.onclick = (e) => e.stopPropagation();
    }

    // Default start
    camera.reset();
    addNewFloor();
    addNewFloor();
    const groundFloorId = state.floors[0].id;

    // Logical 0,0 is now the center of the giant workspace
    createRoom({ name: "לובי", area: 45, floorId: groundFloorId, color: "#fff3e0", leftPx: -100, topPx: -100 });
    createRoom({ name: "מחסן ציוד", area: 120, floorId: groundFloorId, color: "#e3f2fd", leftPx: 100, topPx: 100 });

    switchFloor(groundFloorId);
    currentProjectData = getCurrentProjectData();
    activeAltIndex = 0;
    renderAltTabs();
}

/** Nudge selected rooms by 1 display pixel (zoom-dependent: finer when zoomed in). */
function nudgeSelectedRoomsByOnePixel(dxPx, dyPx) {
    if (!camera || state.selectedRooms.length === 0) return;
    const z = camera.zoom;
    const dxLogical = dxPx / z;
    const dyLogical = dyPx / z;
    state.selectedRooms.forEach(room => {
        const logicalLeft = Number.isFinite(parseFloat(room.dataset.logicalLeftPx))
            ? parseFloat(room.dataset.logicalLeftPx)
            : (parseFloat(room.style.left) / z) - WORKSPACE_OFFSET;
        const logicalTop = Number.isFinite(parseFloat(room.dataset.logicalTopPx))
            ? parseFloat(room.dataset.logicalTopPx)
            : (parseFloat(room.style.top) / z) - WORKSPACE_OFFSET;
        const newLeft = roundLogical(logicalLeft + dxLogical);
        const newTop = roundLogical(logicalTop + dyLogical);
        room.dataset.logicalLeftPx = String(newLeft);
        room.dataset.logicalTopPx = String(newTop);
        room.style.left = ((WORKSPACE_OFFSET + newLeft) * z) + 'px';
        room.style.top = ((WORKSPACE_OFFSET + newTop) * z) + 'px';
    });
    refreshUnderlays();
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

function getCurrentProjectData() {
    return {
        app: APP_NAME,
        version: APP_VERSION,
        floors: JSON.parse(JSON.stringify(state.floors)),
        rooms: getPlanState(),
        camera: { panX: camera.panX, panY: camera.panY, zoom: camera.zoom },
        selectedFloorId: state.activeFloorId,
        counter: state.roomIdCounter,
        nestedData: JSON.parse(JSON.stringify(state.nestedData))
    };
}

async function saveProject() {
    if (activeAltIndex === 0) currentProjectData = getCurrentProjectData();
    const payload = {
        app: APP_NAME,
        version: APP_VERSION,
        current: currentProjectData,
        alternatives
    };
    const result = await window.api.saveFile(JSON.stringify(payload, null, 2));
    if (result.success) {
        alert(result.filePath ? `הפרויקט נשמר בהצלחה.\n${result.filePath}` : 'הפרויקט נשמר בהצלחה.');
    } else if (result.error) {
        alert('שגיאה בשמירה: ' + result.error);
    } else {
        alert('שמירה בוטלה.');
    }
}

async function loadProject() {
    const result = await window.api.loadFile();
    if (!result.success) {
        if (result.error) alert("שגיאה בטעינת הקובץ: " + result.error);
        return;
    }
    if (!result.content) return;
    let data;
    try {
        data = JSON.parse(result.content);
    } catch (e) {
        alert("הקובץ לא תקין (לא JSON).");
        return;
    }
    if (data.current != null && Array.isArray(data.alternatives)) {
        const current = data.current;
        if (!current.floors || !Array.isArray(current.floors) || current.floors.length === 0) {
            alert("פורמט פרויקט לא נתמך (חסרות קומות בחלופה הנוכחית).");
            return;
        }
        applyProjectData(current);
        currentProjectData = JSON.parse(JSON.stringify(current));
        alternatives = data.alternatives;
        undoStack = [];
    } else {
        if (!data.floors || !Array.isArray(data.floors) || data.floors.length === 0) {
            alert("פורמט פרויקט לא נתמך או קובץ פגום (חסרות קומות).");
            return;
        }
        if (data.rooms != null && !Array.isArray(data.rooms)) {
            alert("פורמט פרויקט לא נתמך (רשימת חדרים לא תקינה).");
            return;
        }
        applyProjectData(data);
        currentProjectData = getCurrentProjectData();
        alternatives = [];
    }
    activeAltIndex = 0;
    undoStack = [];
    renderAltTabs();
}

function applyProjectData(data) {
    state.reset();
    const wrapper = document.getElementById('canvas-wrapper');
    wrapper.innerHTML = '';

    document.getElementById('tabs-bar').innerHTML = '<button class="add-tab" id="add-floor-btn" title="הוספת קומה">+</button>';
    document.getElementById('add-floor-btn').onclick = addNewFloor;

    state.roomIdCounter = data.counter || 0;
    data.floors.forEach(f => {
        state.addFloor(f);
        const tab = buildFloorTab(f, { onDeleteFloor: deleteFloor, onSwitchFloor: switchFloor });
        document.getElementById('tabs-bar').insertBefore(tab, document.getElementById('add-floor-btn'));
        const plan = buildFloorPlan(f);
        wrapper.appendChild(plan);
    });

    if (data.nestedData && typeof data.nestedData === 'object') {
        state.nestedData = JSON.parse(JSON.stringify(data.nestedData));
    }

    if (data.camera) {
        camera.panX = data.camera.panX;
        camera.panY = data.camera.panY;
        camera.zoom = data.camera.zoom;
        if (camera._prevZoom !== undefined) camera._prevZoom = camera.zoom;
        camera.updateTransform();
    } else {
        camera.reset();
    }

    (data.rooms || []).forEach(r => {
        createRoomElement(r, camera, {
            onDelete: deleteRoom,
            onSplit: splitRoom,
            onUpdateSize: updateRoomSize
        });
    });

    updateHeightInputs();
    updateFloorSelect();
    switchFloor(data.selectedFloorId || state.floors[0].id);
}

function pushUndo() {
    try {
        const snapshot = getCurrentProjectData();
        undoStack.push(snapshot);
        if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    } catch (err) {
        console.warn('Undo snapshot failed', err);
    }
}

function undo() {
    if (undoStack.length === 0) return;
    const snapshot = undoStack.pop();
    applyProjectData(snapshot);
}

function createAlternative() {
    const name = 'חלופה ' + (alternatives.length + 1);
    alternatives.push({
        id: 'alt-' + Date.now(),
        name,
        createdAt: new Date().toISOString(),
        projectData: JSON.parse(JSON.stringify(getCurrentProjectData()))
    });
    renderAltTabs();
}

function switchAltTab(index) {
    if (index === activeAltIndex) return;
    if (activeAltIndex === 0) {
        currentProjectData = getCurrentProjectData();
    } else {
        alternatives[activeAltIndex - 1].projectData = getCurrentProjectData();
    }
    activeAltIndex = index;
    if (index === 0) {
        applyProjectData(currentProjectData);
    } else {
        applyProjectData(alternatives[index - 1].projectData);
    }
    renderAltTabs();
}

function renameAlternative(id) {
    const alt = alternatives.find(a => a.id === id);
    if (!alt) return;
    const name = prompt('שם חדש:', alt.name);
    if (name != null && name.trim()) {
        alt.name = name.trim();
        renderAltTabs();
    }
}

function deleteAlternative(id) {
    const alt = alternatives.find(a => a.id === id);
    if (!alt || !confirm('למחוק את החלופה "' + alt.name + '"?')) return;
    const idx = alternatives.findIndex(a => a.id === id);
    const wasActive = activeAltIndex === idx + 1;
    if (wasActive) {
        switchAltTab(0);
    } else if (activeAltIndex > idx + 1) {
        activeAltIndex--;
    }
    alternatives = alternatives.filter(a => a.id !== id);
    renderAltTabs();
}

function renderAltTabs() {
    const bar = document.getElementById('alt-tabs-bar');
    if (!bar) return;
    bar.innerHTML = '';
    const tab0 = document.createElement('button');
    tab0.type = 'button';
    tab0.className = 'alt-tab' + (activeAltIndex === 0 ? ' active' : '');
    tab0.textContent = 'נוכחי';
    tab0.onclick = () => switchAltTab(0);
    bar.appendChild(tab0);
    alternatives.forEach((alt, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'alt-tab-wrap' + (activeAltIndex === i + 1 ? ' active' : '');
        wrap.title = 'לחיצה כפולה לשינוי שם';
        const label = document.createElement('span');
        label.className = 'alt-tab-label';
        label.textContent = alt.name;
        label.onclick = () => switchAltTab(i + 1);
        label.ondblclick = (e) => { e.preventDefault(); renameAlternative(alt.id); };
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'alt-tab-del';
        delBtn.textContent = '×';
        delBtn.title = 'מחק חלופה';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteAlternative(alt.id); };
        wrap.appendChild(label);
        wrap.appendChild(delBtn);
        bar.appendChild(wrap);
    });
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'alt-tab add-alt-tab';
    addBtn.textContent = '+';
    addBtn.title = 'צור חלופה';
    addBtn.onclick = createAlternative;
    bar.appendChild(addBtn);
}

/** When zoom changes, redraw room positions/sizes in display pixels so text stays crisp (no scale blur). Uses stored logical dimensions so all floors stay consistent. */
function refreshRoomsForZoom(oldZoom, newZoom) {
    const minSizePx = Math.max(1, Math.round(4 * newZoom)); // minimum room size in display px so they don't vanish when zoomed
    document.querySelectorAll('.room').forEach(room => {
        let logicalLeft = parseFloat(room.dataset.logicalLeftPx);
        let logicalTop = parseFloat(room.dataset.logicalTopPx);
        let logicalW = parseFloat(room.dataset.logicalWidthPx);
        let logicalH = parseFloat(room.dataset.logicalHeightPx);
        if (!Number.isFinite(logicalLeft)) {
            logicalLeft = roundLogical((parseFloat(room.style.left) / oldZoom) - WORKSPACE_OFFSET);
            room.dataset.logicalLeftPx = String(logicalLeft);
        }
        if (!Number.isFinite(logicalTop)) {
            logicalTop = roundLogical((parseFloat(room.style.top) / oldZoom) - WORKSPACE_OFFSET);
            room.dataset.logicalTopPx = String(logicalTop);
        }
        if (!Number.isFinite(logicalW)) {
            logicalW = room.dataset.shape === 'ellipse' && Number.isFinite(parseFloat(room.dataset.area))
                ? roundLogical(areaM2ToCircleDiameterPx(parseFloat(room.dataset.area)))
                : roundLogical(parseFloat(room.style.width) / oldZoom);
            room.dataset.logicalWidthPx = String(logicalW);
        }
        if (!Number.isFinite(logicalH)) {
            logicalH = room.dataset.shape === 'ellipse' && Number.isFinite(parseFloat(room.dataset.area))
                ? roundLogical(areaM2ToCircleDiameterPx(parseFloat(room.dataset.area)))
                : roundLogical(parseFloat(room.style.height) / oldZoom);
            room.dataset.logicalHeightPx = String(logicalH);
        }
        const wPx = Math.round(logicalW * newZoom);
        const hPx = Math.round(logicalH * newZoom);
        room.style.left = Math.round((WORKSPACE_OFFSET + logicalLeft) * newZoom) + 'px';
        room.style.top = Math.round((WORKSPACE_OFFSET + logicalTop) * newZoom) + 'px';
        room.style.width = Math.max(minSizePx, wPx) + 'px';
        room.style.height = Math.max(minSizePx, hPx) + 'px';
    });
    refreshUnderlays();
}

/** Returns room state in 2D logical coordinates (same origin as config) for 3D alignment. Uses stored logical dimensions; same precision as 3D so floors and 3D stay in sync. */
function getPlanState() {
    const z = camera ? camera.zoom : 1;
    return Array.from(document.querySelectorAll('.room')).map(r => {
        const leftPx = Number.isFinite(parseFloat(r.dataset.logicalLeftPx))
            ? parseFloat(r.dataset.logicalLeftPx)
            : (parseFloat(r.style.left) / z) - WORKSPACE_OFFSET;
        const topPx = Number.isFinite(parseFloat(r.dataset.logicalTopPx))
            ? parseFloat(r.dataset.logicalTopPx)
            : (parseFloat(r.style.top) / z) - WORKSPACE_OFFSET;
        const isEllipse = r.dataset.shape === 'ellipse';
        const area = parseFloat(r.dataset.area);
        let widthPx = Number.isFinite(parseFloat(r.dataset.logicalWidthPx))
            ? parseFloat(r.dataset.logicalWidthPx)
            : parseFloat(r.style.width) / z;
        let heightPx = Number.isFinite(parseFloat(r.dataset.logicalHeightPx))
            ? parseFloat(r.dataset.logicalHeightPx)
            : parseFloat(r.style.height) / z;
        if (isEllipse && Number.isFinite(area) && area > 0) {
            widthPx = heightPx = roundLogical(areaM2ToCircleDiameterPx(area));
        }
        return {
            id: r.id,
            name: r.querySelector('.room-label').innerText,
            floorId: r.dataset.floor,
            leftPx: roundLogical(leftPx),
            topPx: roundLogical(topPx),
            widthPx: roundLogical(widthPx),
            heightPx: roundLogical(heightPx),
            rotationDeg: parseFloat(r.dataset.rotation || 0),
            color: r.style.backgroundColor,
            customHeight: r.dataset.customHeight ? parseFloat(r.dataset.customHeight) : undefined,
            shape: r.dataset.shape || 'rect'
        };
    });
}

function init3D() {
    const container = document.getElementById('three-container');
    container.style.display = 'block';
    if (!plan3dEngine) {
        plan3dEngine = new Plan3DEngine();
        plan3dEngine.init(container);
        plan3dEngine.onRoomDblClick = (roomId) => openHeightModal(roomId);
    }
    plan3dEngine.buildFromState(state.floors, getPlanState(), { fitCamera: true });
}

function ensureHeightModal() {
    const container = document.getElementById('three-container');
    let modal = document.getElementById('height-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'height-modal';
    modal.style.cssText = [
        'position:absolute',
        'inset:0',
        'display:none',
        'background:rgba(0,0,0,0.35)',
        'z-index:3000',
        'align-items:center',
        'justify-content:center',
        "font-family:'Segoe UI', system-ui, sans-serif"
    ].join(';');

    modal.innerHTML = `
        <div style="width:320px; background:#fff; border-radius:12px; padding:14px; box-shadow:0 10px 30px rgba(0,0,0,0.25)">
            <div style="font-weight:700; margin-bottom:8px;">גובה לחדר</div>
            <input id="height-modal-input" type="number" step="0.1" min="0.1"
                style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; box-sizing:border-box; font-size:14px;" />
            <div style="font-size:12px; color:#64748b; margin-top:6px;">ריק = חזרה לגובה קומה</div>
            <div style="display:flex; gap:8px; margin-top:12px;">
                <button id="height-modal-cancel" type="button"
                    style="flex:1; padding:10px; border-radius:8px; border:1px solid #cbd5e1; background:#fff; cursor:pointer;">
                    ביטול
                </button>
                <button id="height-modal-save" type="button"
                    style="flex:1; padding:10px; border-radius:8px; border:none; background:#0077be; color:#fff; cursor:pointer; font-weight:700;">
                    שמור
                </button>
            </div>
        </div>
    `;

    modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    container.appendChild(modal);
    return modal;
}

function openHeightModal(roomId) {
    if (!plan3dEngine) return;
    const roomEl = document.getElementById(roomId);
    if (!roomEl) return;

    const modal = ensureHeightModal();
    const input = modal.querySelector('#height-modal-input');
    const btnSave = modal.querySelector('#height-modal-save');
    const btnCancel = modal.querySelector('#height-modal-cancel');

    const floor = state.getFloorById(roomEl.dataset.floor);
    const fallback = floor?.height ?? 3.5;
    const current = roomEl.dataset.customHeight ? parseFloat(roomEl.dataset.customHeight) : fallback;

    input.value = Number.isFinite(current) ? String(current) : String(fallback);
    modal.style.display = 'flex';
    input.focus();
    input.select();

    const cleanup = () => {
        btnSave.onclick = null;
        btnCancel.onclick = null;
        input.onkeydown = null;
    };

    const close = () => {
        modal.style.display = 'none';
        cleanup();
    };

    const save = () => {
        const trimmed = (input.value ?? '').toString().trim();
        if (trimmed === '') {
            delete roomEl.dataset.customHeight;
        } else {
            const h = parseFloat(trimmed);
            if (!Number.isFinite(h) || h <= 0) return;
            roomEl.dataset.customHeight = String(h);
        }
        plan3dEngine.buildFromState(state.floors, getPlanState());
        close();
    };

    input.onkeydown = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        if (e.key === 'Enter') { e.preventDefault(); save(); }
    };

    btnCancel.onclick = close;
    btnSave.onclick = save;
}

function close3D() {
    document.getElementById('three-container').style.display = 'none';
    if (plan3dEngine) { plan3dEngine.destroy(); plan3dEngine = null; }
    document.getElementById('three-container').innerHTML = '<button id="close-3d">חזור לעריכה X</button>';
    document.getElementById('close-3d').onclick = close3D;
}

function addNewFloor() {
    pushUndo();
    const id = `floor-${state.floors.length}-${Math.random().toString(36).substr(2, 5)}`;
    const names = ["קרקע", "א'", "ב'", "ג'", "ד'"];
    const name = "קומה " + (names[state.floors.length] || state.floors.length);
    const floor = { id, name, height: 3.5 };

    state.addFloor(floor);

    const tab = buildFloorTab(floor, { onDeleteFloor: deleteFloor, onSwitchFloor: switchFloor });
    const addBtn = document.getElementById('add-floor-btn');
    document.getElementById('tabs-bar').insertBefore(tab, addBtn);

    const plan = buildFloorPlan(floor);
    document.getElementById('canvas-wrapper').appendChild(plan);

    updateHeightInputs();
    updateFloorSelect();
    if (state.floors.length === 1) switchFloor(id);
}

function deleteFloor(id) {
    if (state.floors.length <= 1) return alert("לא ניתן למחוק קומה אחרונה.");
    if (!confirm("למחוק קומה זו וכל תוכנה?")) return;
    pushUndo();
    if (state.deleteFloor(id)) {
        document.getElementById('tab-' + id).remove();
        document.getElementById(id).remove();
        updateHeightInputs();
        updateFloorSelect();
        if (state.activeFloorId === id) switchFloor(state.floors[0].id);
    }
}

function switchFloor(id) {
    state.activeFloorId = id;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const activeTab = document.getElementById('tab-' + id);
    if (activeTab) activeTab.classList.add('active');

    document.querySelectorAll('.floor-plan').forEach(p => p.classList.remove('active'));
    const activePlan = document.getElementById(id);
    if (activePlan) activePlan.classList.add('active');

    document.getElementById('newFloorSelect').value = id;
    refreshUnderlays();
    syncInventory();
}

function refreshUnderlays() {
    const currentPlan = document.getElementById(state.activeFloorId);
    if (!currentPlan) return;
    currentPlan.querySelectorAll('.room-ghost').forEach(g => g.remove());
    const currentIdx = state.getFloorIndex(state.activeFloorId);
    if (currentIdx === 0) return;
    const z = camera ? camera.zoom : 1;
    const allRooms = document.querySelectorAll('.room');
    const lowerFloorIds = new Set(state.floors.slice(0, currentIdx).map(f => f.id));
    const floorNames = Object.fromEntries(state.floors.slice(0, currentIdx).map(f => [f.id, f.name]));
    const fragment = document.createDocumentFragment();
    allRooms.forEach(r => {
        const fid = r.dataset.floor;
        if (!lowerFloorIds.has(fid)) return;
        const lw = parseFloat(r.dataset.logicalWidthPx);
        const lh = parseFloat(r.dataset.logicalHeightPx);
        const ll = parseFloat(r.dataset.logicalLeftPx);
        const lt = parseFloat(r.dataset.logicalTopPx);
        if (!Number.isFinite(lw) || !Number.isFinite(lh) || !Number.isFinite(ll) || !Number.isFinite(lt)) return;
        const ghost = document.createElement('div');
        ghost.className = 'room-ghost';
        if (r.dataset.shape === 'ellipse') ghost.classList.add('room--ellipse');
        ghost.style.width = Math.round(lw * z) + 'px';
        ghost.style.height = Math.round(lh * z) + 'px';
        ghost.style.left = Math.round((WORKSPACE_OFFSET + ll) * z) + 'px';
        ghost.style.top = Math.round((WORKSPACE_OFFSET + lt) * z) + 'px';
        ghost.style.transform = r.style.transform || '';
        ghost.innerText = `נעול (${floorNames[fid]})`;
        fragment.appendChild(ghost);
    });
    currentPlan.appendChild(fragment);
}

function createRoom(roomObj) {
    createRoomElement(roomObj, camera, {
        onDelete: deleteRoom,
        onSplit: splitRoom,
        onUpdateSize: updateRoomSize
    });
    syncInventory();
    refreshUnderlays();
}

function updateRoomSize(id, wM, hM, anchor = 'tl') {
    const room = document.getElementById(id);
    if (!room) return;
    const isEllipse = room.dataset.shape === 'ellipse';
    let area = parseFloat(room.dataset.area);
    if (!isEllipse) {
        if (anchor === 'r' || anchor === 'l') hM = area / wM; else wM = area / hM;
    } else {
        // עיגול: תמיד רוחב = גובה; השטח נגזר מהגודל שבמתיחה
        if (wM == null || wM === undefined) wM = hM;
        if (hM == null || hM === undefined) hM = wM;
        const sizeM = (wM + hM) / 2;
        wM = hM = sizeM;
        area = (Math.PI * sizeM * sizeM) / 4;
        room.dataset.area = area.toFixed(1);
    }
    const z = camera ? camera.zoom : 1;
    // עיגול: קוטר לוגי תמיד מהשטח (פונקציה קנונית אחת) — יישור מושלם בין קומות
    const logicalW = isEllipse
        ? roundLogical(areaM2ToCircleDiameterPx(area))
        : roundLogical(wM * SCALE);
    const logicalH = isEllipse
        ? roundLogical(areaM2ToCircleDiameterPx(area))
        : roundLogical(hM * SCALE);
    room.dataset.logicalWidthPx = String(logicalW);
    room.dataset.logicalHeightPx = String(logicalH);
    room.style.width = (logicalW * z) + 'px';
    room.style.height = (logicalH * z) + 'px';
    room.querySelector('.dim-w').innerText = wM.toFixed(1) + ' m';
    room.querySelector('.dim-l').innerText = hM.toFixed(1) + ' m';
    room.querySelector('.room-info').innerText = area.toFixed(0) + ' m²';
    syncInventory();
}

function closeSplitModal() {
    const modal = document.getElementById('split-modal');
    if (modal) {
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function showSplitModal(room, totalArea, onConfirm) {
    const modal = document.getElementById('split-modal');
    const desc = document.getElementById('split-modal-desc');
    const input = document.getElementById('split-area-input');
    const cancelBtn = document.getElementById('split-modal-cancel');
    const confirmBtn = document.getElementById('split-modal-confirm');
    if (!modal || !input) return;

    const roomName = (room.querySelector('.room-label') && room.querySelector('.room-label').innerText) || 'החדר';
    desc.textContent = `כמה מ"ר לפצל מ"${roomName}" לטובת פונקציה חדשה? (סה״כ ${totalArea} מ"ר). השטח ייגרע מהפונקציה הנוכחית ויועבר לחדר חדש.`;
    input.min = 0.1;
    input.max = totalArea - 0.1;
    input.step = 0.1;
    input.value = (totalArea / 2).toFixed(1);

    const doClose = () => {
        closeSplitModal();
        cancelBtn.onclick = null;
        confirmBtn.onclick = null;
        input.onkeydown = null;
    };

    cancelBtn.onclick = () => doClose();

    confirmBtn.onclick = () => {
        const splitArea = parseFloat(input.value);
        if (!Number.isFinite(splitArea) || splitArea <= 0 || splitArea >= totalArea) {
            input.reportValidity();
            return;
        }
        doClose();
        onConfirm(splitArea);
    };

    input.onkeydown = (e) => {
        if (e.key === 'Enter') confirmBtn.click();
        if (e.key === 'Escape') cancelBtn.click();
    };

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    input.focus();
    input.select();
}

function splitRoom(id) {
    const room = document.getElementById(id);
    if (!room || !room.dataset.area) return;
    const totalArea = parseFloat(room.dataset.area);
    if (totalArea <= 0.1) return;

    showSplitModal(room, totalArea, (splitArea) => {
        pushUndo();
        const remainingArea = totalArea - splitArea;
        room.dataset.area = remainingArea.toFixed(1);
        const sideM = Math.sqrt(remainingArea);
        updateRoomSize(id, sideM, sideM);
        const z = camera ? camera.zoom : 1;
        const sidePx = areaM2ToSquareSidePx(splitArea);
        const baseLeft = Number.isFinite(parseFloat(room.dataset.logicalLeftPx)) ? parseFloat(room.dataset.logicalLeftPx) : (parseFloat(room.style.left) / z) - WORKSPACE_OFFSET;
        const baseTop = Number.isFinite(parseFloat(room.dataset.logicalTopPx)) ? parseFloat(room.dataset.logicalTopPx) : (parseFloat(room.style.top) / z) - WORKSPACE_OFFSET;
        createRoom({
            name: `${room.querySelector('.room-label').innerText} (פוצל)`,
            area: splitArea,
            floorId: room.dataset.floor,
            color: room.style.backgroundColor,
            leftPx: baseLeft + 20,
            topPx: baseTop + 20,
            widthPx: sidePx,
            heightPx: sidePx
        });
        syncInventory();
    });
}

function updateHeightInputs() {
    const container = document.getElementById('heights-inputs');
    container.innerHTML = '';
    state.floors.forEach(f => {
        const div = document.createElement('div');
        div.style.display = "flex"; div.style.alignItems = "center"; div.style.gap = "5px";
        div.innerHTML = `<span style="font-size:11px; width:60px">${f.name}:</span><input type="number" value="${f.height}" step="0.1">`;
        container.appendChild(div);
        div.querySelector('input').onchange = (e) => {
            f.height = parseFloat(e.target.value);
        };
    });
}

function updateFloorSelect() {
    const select = document.getElementById('newFloorSelect');
    select.innerHTML = '';
    state.floors.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id; opt.innerText = f.name;
        select.appendChild(opt);
    });
    if (state.activeFloorId) select.value = state.activeFloorId;
}

/** Get room area in m² from dataset or from stored logical dimensions (fallback). */
function getRoomAreaM2(roomEl) {
    let area = parseFloat(roomEl.dataset.area);
    if (!Number.isFinite(area) || area <= 0) {
        const wPx = parseFloat(roomEl.dataset.logicalWidthPx) || (camera ? parseFloat(roomEl.style.width) / camera.zoom : parseFloat(roomEl.style.width));
        const hPx = parseFloat(roomEl.dataset.logicalHeightPx) || (camera ? parseFloat(roomEl.style.height) / camera.zoom : parseFloat(roomEl.style.height));
        if (Number.isFinite(wPx) && Number.isFinite(hPx) && wPx > 0 && hPx > 0) {
            const wM = wPx / SCALE;
            const hM = hPx / SCALE;
            area = roomEl.dataset.shape === 'ellipse' ? (Math.PI * wM * hM) / 4 : wM * hM;
            roomEl.dataset.area = area.toFixed(1);
        } else {
            area = 0;
        }
    }
    return area;
}

function syncInventory() {
    const list = document.getElementById('inventory-list');
    list.innerHTML = '';

    // Top-level rooms
    document.querySelectorAll(`.room[data-floor="${state.activeFloorId}"]`).forEach(r => {
        const areaM2 = getRoomAreaM2(r);

        const item = document.createElement('div');
        item.className = 'inventory-item';
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        item.style.gap = "8px";
        item.style.marginBottom = "5px";
        item.style.fontWeight = "bold";

        const left = document.createElement('div');
        left.className = "inventory-left";
        left.style.display = "flex";
        left.style.alignItems = "center";
        left.style.gap = "6px";
        left.style.flex = "1";
        left.style.minWidth = "0";

        const nameSpan = document.createElement('span');
        nameSpan.className = "inventory-room-name";
        nameSpan.textContent = r.querySelector('.room-label')?.innerText || "חדר";
        nameSpan.title = "לחיצה כפולה לשינוי שם";
        nameSpan.style.overflow = "hidden";
        nameSpan.style.textOverflow = "ellipsis";
        nameSpan.style.whiteSpace = "nowrap";
        nameSpan.style.cursor = "text";

        const nameInput = document.createElement('input');
        nameInput.type = "text";
        nameInput.className = "inventory-name-input";
        nameInput.value = (nameSpan.textContent || "").trim();
        nameInput.style.display = "none";

        const beginRename = () => {
            nameInput.value = (r.querySelector('.room-label')?.innerText || "").trim();
            nameSpan.style.display = "none";
            nameInput.style.display = "block";
            nameInput.focus();
            nameInput.select();
        };

        const commitRename = () => {
            if (nameInput.style.display === "none") return;
            const trimmed = (nameInput.value || "").trim();
            nameSpan.style.display = "";
            nameInput.style.display = "none";
            if (!trimmed) { syncInventory(); return; }
            const label = r.querySelector('.room-label');
            if (label) label.innerText = trimmed;
            syncInventory();
        };

        const cancelRename = () => {
            if (nameInput.style.display === "none") return;
            syncInventory();
        };

        nameSpan.ondblclick = (e) => {
            e.preventDefault();
            beginRename();
        };

        nameInput.onblur = commitRename;
        nameInput.onkeydown = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
        };

        const renameBtn = document.createElement('button');
        renameBtn.type = "button";
        renameBtn.className = "btn-rename-room";
        renameBtn.title = "שינוי שם";
        renameBtn.textContent = "✎";
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            beginRename();
        };

        left.appendChild(nameSpan);
        left.appendChild(nameInput);
        left.appendChild(renameBtn);

        const areaInput = document.createElement('input');
        areaInput.type = "number";
        areaInput.className = "inventory-area-input";
        areaInput.value = areaM2.toFixed(1);
        areaInput.min = "0.1";
        areaInput.step = "0.1";
        areaInput.title = "שטח במ\"ר";
        areaInput.onchange = (e) => {
            const next = parseFloat(e.target.value);
            if (!Number.isFinite(next) || next <= 0) {
                e.target.value = getRoomAreaM2(r).toFixed(1);
                return;
            }
            r.dataset.area = String(next);
            if (r.dataset.shape === 'ellipse') {
                updateRoomSize(r.id, areaM2ToCircleDiameterM(next), null);
            } else {
                updateRoomSize(r.id, Math.sqrt(next), Math.sqrt(next));
            }
        };

        item.appendChild(left);
        item.appendChild(areaInput);
        list.appendChild(item);

        // Show nested rooms for this parent
        if (state.nestedData[r.id]) {
            state.nestedData[r.id].forEach(child => {
                const subItem = document.createElement('div');
                subItem.className = 'inventory-sub-item';
                subItem.style.display = "flex";
                subItem.style.justifyContent = "space-between";
                subItem.style.alignItems = "center";
                subItem.style.gap = "8px";
                subItem.style.paddingRight = "20px";
                subItem.style.fontSize = "12px";
                subItem.style.color = "#666";

                const subLeft = document.createElement('div');
                subLeft.style.display = "flex";
                subLeft.style.alignItems = "center";
                subLeft.style.gap = "6px";
                subLeft.style.flex = "1";
                subLeft.style.minWidth = "0";

                const childName = document.createElement('span');
                childName.textContent = `↳ ${child.name} (${child.area}m²)`;
                childName.title = "לחיצה כפולה לשינוי שם";
                childName.style.overflow = "hidden";
                childName.style.textOverflow = "ellipsis";
                childName.style.whiteSpace = "nowrap";
                childName.style.cursor = "text";

                const childNameInput = document.createElement('input');
                childNameInput.type = "text";
                childNameInput.className = "inventory-name-input";
                childNameInput.value = (child.name || "").trim();
                childNameInput.style.display = "none";

                const beginChildRename = () => {
                    childNameInput.value = (child.name || "").trim();
                    childName.style.display = "none";
                    childNameInput.style.display = "block";
                    childNameInput.focus();
                    childNameInput.select();
                };

                const commitChildRename = () => {
                    if (childNameInput.style.display === "none") return;
                    const trimmed = (childNameInput.value || "").trim();
                    childName.style.display = "";
                    childNameInput.style.display = "none";
                    if (!trimmed) { syncInventory(); return; }
                    child.name = trimmed;
                    syncInventory();
                };

                const cancelChildRename = () => {
                    if (childNameInput.style.display === "none") return;
                    syncInventory();
                };

                childName.ondblclick = (e) => {
                    e.preventDefault();
                    beginChildRename();
                };

                childNameInput.onblur = commitChildRename;
                childNameInput.onkeydown = (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitChildRename(); }
                    if (e.key === 'Escape') { e.preventDefault(); cancelChildRename(); }
                };

                const childRenameBtn = document.createElement('button');
                childRenameBtn.type = "button";
                childRenameBtn.className = "btn-rename-room";
                childRenameBtn.title = "שינוי שם";
                childRenameBtn.textContent = "✎";
                childRenameBtn.onclick = (e) => {
                    e.stopPropagation();
                    beginChildRename();
                };

                subLeft.appendChild(childName);
                subLeft.appendChild(childNameInput);
                subLeft.appendChild(childRenameBtn);

                const unnestBtn = document.createElement('button');
                unnestBtn.type = "button";
                unnestBtn.className = "btn-unnest-ui";
                unnestBtn.textContent = "📤";
                unnestBtn.title = "הוצאה מהטמעה";
                unnestBtn.onclick = () => unnestRoom(r.id, child.id);

                subItem.appendChild(subLeft);
                subItem.appendChild(unnestBtn);
                list.appendChild(subItem);
            });
        }
    });
}

function onRoomMerge(parentId, childId) {
    const parent = document.getElementById(parentId);
    const child = document.getElementById(childId);
    if (!parent || !child) return;
    pushUndo();

    if (!confirm(`האם למזג את "${child.querySelector('.room-label').innerText}" לתוך "${parent.querySelector('.room-label').innerText}"?`)) {
        return;
    }

    const pArea = parseFloat(parent.dataset.area);
    const cArea = parseFloat(child.dataset.area);
    const newArea = pArea + cArea;
    const z = camera ? camera.zoom : 1;

    // Store child data (logical relative offset)
    const childData = {
        id: child.id,
        name: child.querySelector('.room-label').innerText,
        area: cArea,
        color: child.style.backgroundColor,
        relLX: (parseFloat(child.style.left) - parseFloat(parent.style.left)) / z,
        relLY: (parseFloat(child.style.top) - parseFloat(parent.style.top)) / z
    };

    if (!state.nestedData[parentId]) state.nestedData[parentId] = [];
    state.nestedData[parentId].push(childData);

    // Update parent area
    parent.dataset.area = newArea.toFixed(1);

    // Scale parent while maintaining aspect ratio (use logical size: display/zoom)
    const currentW = parseFloat(parent.style.width) / z / SCALE; // in meters
    const currentH = parseFloat(parent.style.height) / z / SCALE; // in meters
    const ratio = currentW / currentH;

    const newW_meters = Math.sqrt(newArea * ratio);
    const newH_meters = newArea / newW_meters;

    updateRoomSize(parentId, newW_meters, newH_meters);

    // Remove child
    child.remove();
    syncInventory();
}

function unnestRoom(parentId, childId) {
    const parent = document.getElementById(parentId);
    if (!parent) return;
    pushUndo();
    const nestedArr = state.nestedData[parentId];
    const childIdx = nestedArr.findIndex(c => c.id === childId);
    if (childIdx === -1) return;

    const childData = nestedArr.splice(childIdx, 1)[0];
    if (nestedArr.length === 0) delete state.nestedData[parentId];

    const pArea = parseFloat(parent.dataset.area);
    const newArea = pArea - childData.area;

    // Update parent area
    parent.dataset.area = newArea.toFixed(1);

    const z = camera ? camera.zoom : 1;
    // Rescale parent down (logical size)
    const currentW = parseFloat(parent.style.width) / z / SCALE;
    const currentH = parseFloat(parent.style.height) / z / SCALE;
    const ratio = currentW / currentH;
    const newW_meters = Math.sqrt(newArea * ratio);
    const newH_meters = newArea / newW_meters;
    updateRoomSize(parentId, newW_meters, newH_meters);

    // Recreate child at global logical coords: parent logical + stored relative offset
    const parentLogicalX = Number.isFinite(parseFloat(parent.dataset.logicalLeftPx)) ? parseFloat(parent.dataset.logicalLeftPx) : (parseFloat(parent.style.left) / z) - WORKSPACE_OFFSET;
    const parentLogicalY = Number.isFinite(parseFloat(parent.dataset.logicalTopPx)) ? parseFloat(parent.dataset.logicalTopPx) : (parseFloat(parent.style.top) / z) - WORKSPACE_OFFSET;
    createRoom({
        id: childData.id,
        name: childData.name,
        area: childData.area,
        floorId: parent.dataset.floor,
        color: childData.color,
        leftPx: parentLogicalX + childData.relLX,
        topPx: parentLogicalY + childData.relLY
    });

    syncInventory();
}

function addNewRoomUI() {
    const n = (document.getElementById('newName').value || '').trim();
    const a = parseFloat(document.getElementById('newArea').value);
    const f = document.getElementById('newFloorSelect').value;
    const shapeBtn = document.getElementById('shape-toggle-btn');
    const shape = (shapeBtn && shapeBtn.dataset.shape === 'ellipse') ? 'ellipse' : 'rect';
    if (!n) {
        alert('הזן שם לחדר.');
        return;
    }
    if (!Number.isFinite(a) || a <= 0) {
        alert('הזן שטח תקין (מספר גדול מ־0).');
        return;
    }
    if (!f) return;
    pushUndo();
    const { x, y } = camera.screenToLogical(window.innerWidth / 2, window.innerHeight / 2);
    createRoom({ name: n, area: a, floorId: f, leftPx: x, topPx: y, shape });
}

function deleteRoom(id) {
    const room = document.getElementById(id);
    if (!room) return;
    pushUndo();
    room.remove();
    syncInventory();
    refreshUnderlays();
}

function deleteSelectedRooms() {
    if (state.selectedRooms.length === 0) return;
    pushUndo();
    state.selectedRooms.forEach(r => r.remove());
    state.selectedRooms = [];
    syncInventory();
    refreshUnderlays();
}