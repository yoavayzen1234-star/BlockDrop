import { SCALE, STANDARDS_DATA, WORKSPACE_OFFSET } from './js/config.js';
import { state } from './js/state.js';
import { createRoomElement, buildFloorTab, buildFloorPlan } from './js/ui-builder.js';
import { Plan3DEngine } from './js/plan3d.engine.js';
import { CanvasCamera } from './js/canvasCamera.js';
import { SelectionManager } from './js/selectionManager.js';

/**
 * SurferPlan Desktop - Main Application Orchestrator
 */

let camera = null;
let selectionManager = null;
let plan3dEngine = null;

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
    initApp();
    const hwid = await window.api.getHWID();
    console.log("Device ID:", hwid);
});

// Key bindings
window.isAltPressed = false;
window.onkeydown = (e) => {
    if (e.altKey) window.isAltPressed = true;
    if (e.key === 'Delete' || e.key === 'Backspace') deleteSelectedRooms();
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

    // Initialize Selection Manager
    selectionManager = new SelectionManager(camera, main);

    // Bind basic UI actions
    document.getElementById('save-btn').onclick = saveProject;
    document.getElementById('load-btn').onclick = loadProject;
    document.getElementById('add-room-btn').onclick = addNewRoomUI;
    document.getElementById('view-3d-btn').onclick = init3D;
    document.getElementById('close-3d').onclick = close3D;
    document.getElementById('toggle-sidebar').onclick = toggleSidebar;
    document.getElementById('std-input').onkeyup = runStandardsSearch;
    document.getElementById('reset-cam').onclick = () => camera.reset();
    document.getElementById('reset-view').onclick = () => camera.centerView();
    document.getElementById('add-floor-btn').onclick = addNewFloor;

    // Listen for room-merge events from editor2d.js
    document.addEventListener('room-merge', (e) => onRoomMerge(e.detail.parentId, e.detail.childId));

    // Default start
    camera.reset();
    addNewFloor();
    addNewFloor();
    const groundFloorId = state.floors[0].id;

    // Logical 0,0 is now the center of the giant workspace
    createRoom({ name: "לובי", area: 45, floorId: groundFloorId, color: "#fff3e0", leftPx: -100, topPx: -100 });
    createRoom({ name: "מחסן ציוד", area: 120, floorId: groundFloorId, color: "#e3f2fd", leftPx: 100, topPx: 100 });

    switchFloor(groundFloorId);
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

async function saveProject() {
    const projectData = {
        app: "SurferPlan Desktop",
        version: "1.2.0",
        floors: state.floors,
        rooms: getPlanState(),
        camera: { panX: camera.panX, panY: camera.panY, zoom: camera.zoom },
        selectedFloorId: state.activeFloorId,
        counter: state.roomIdCounter
    };
    const result = await window.api.saveFile(JSON.stringify(projectData, null, 2));
    if (result.success) alert("Project saved successfully!");
}

async function loadProject() {
    const result = await window.api.loadFile();
    if (result.success && result.content) {
        const data = JSON.parse(result.content);
        applyProjectData(data);
    }
}

function applyProjectData(data) {
    state.reset();
    const wrapper = document.getElementById('canvas-wrapper');
    wrapper.innerHTML = '';

    document.getElementById('tabs-bar').innerHTML = '<button class="add-tab" id="add-floor-btn">+</button>';
    document.getElementById('add-floor-btn').onclick = addNewFloor;

    state.roomIdCounter = data.counter || 0;
    data.floors.forEach(f => {
        state.addFloor(f);
        const tab = buildFloorTab(f, { onDeleteFloor: deleteFloor, onSwitchFloor: switchFloor });
        document.getElementById('tabs-bar').insertBefore(tab, document.getElementById('add-floor-btn'));
        const plan = buildFloorPlan(f);
        wrapper.appendChild(plan);
    });

    data.rooms.forEach(r => {
        createRoomElement(r, camera, {
            onDelete: deleteRoom,
            onSplit: splitRoom,
            onUpdateSize: updateRoomSize
        });
    });

    if (data.camera) {
        camera.panX = data.camera.panX;
        camera.panY = data.camera.panY;
        camera.zoom = data.camera.zoom;
        camera.updateTransform();
    } else {
        camera.reset();
    }

    updateHeightInputs();
    updateFloorSelect();
    switchFloor(data.selectedFloorId || state.floors[0].id);
}

function getPlanState() {
    return Array.from(document.querySelectorAll('.room')).map(r => ({
        id: r.id,
        name: r.querySelector('.room-label').innerText,
        floorId: r.dataset.floor,
        // Convert Physical CSS back to Logical LX/LY (Physical - OFFSET)
        leftPx: parseFloat(r.style.left) - WORKSPACE_OFFSET,
        topPx: parseFloat(r.style.top) - WORKSPACE_OFFSET,
        widthPx: parseFloat(r.style.width),
        heightPx: parseFloat(r.style.height),
        rotationDeg: parseFloat(r.dataset.rotation || 0),
        color: r.style.backgroundColor,
        customHeight: r.dataset.customHeight ? parseFloat(r.dataset.customHeight) : undefined,
        outer: r.polygon ? r.polygon.outer : null,
        holes: r.polygon ? r.polygon.holes : []
    }));
}

function init3D() {
    const container = document.getElementById('three-container');
    container.style.display = 'block';
    if (!plan3dEngine) {
        plan3dEngine = new Plan3DEngine();
        plan3dEngine.init(container);
    }
    plan3dEngine.buildFromState(state.floors, getPlanState());
}

function close3D() {
    document.getElementById('three-container').style.display = 'none';
    if (plan3dEngine) { plan3dEngine.destroy(); plan3dEngine = null; }
    document.getElementById('three-container').innerHTML = '<button id="close-3d">חזור לעריכה X</button>';
    document.getElementById('close-3d').onclick = close3D;
}

function addNewFloor() {
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
    const allRooms = document.querySelectorAll('.room');
    const lowerFloorIds = new Set(state.floors.slice(0, currentIdx).map(f => f.id));
    const floorNames = Object.fromEntries(state.floors.slice(0, currentIdx).map(f => [f.id, f.name]));
    const fragment = document.createDocumentFragment();
    allRooms.forEach(r => {
        const fid = r.dataset.floor;
        if (!lowerFloorIds.has(fid)) return;
        const ghost = document.createElement('div');
        ghost.className = 'room-ghost';
        ghost.style.width = r.style.width;
        ghost.style.height = r.style.height;
        ghost.style.left = r.style.left;
        ghost.style.top = r.style.top;
        ghost.style.transform = r.style.transform;
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
    const area = parseFloat(room.dataset.area);
    if (anchor === 'r' || anchor === 'l') hM = area / wM; else wM = area / hM;
    room.style.width = (wM * SCALE) + 'px';
    room.style.height = (hM * SCALE) + 'px';
    room.querySelector('.dim-w').innerText = wM.toFixed(1) + 'm';
    room.querySelector('.dim-l').innerText = hM.toFixed(1) + 'm';
    room.querySelector('.room-info').innerText = area.toFixed(0) + 'm²';
}

function splitRoom(id) {
    const room = document.getElementById(id);
    const totalArea = parseFloat(room.dataset.area);
    const splitVal = prompt(`הכנס שטח לפיצול (מתוך ${totalArea} מ"ר):`, totalArea / 2);
    if (splitVal && !isNaN(splitVal) && parseFloat(splitVal) < totalArea) {
        room.dataset.area = (totalArea - parseFloat(splitVal)).toFixed(1);
        updateRoomSize(id, Math.sqrt(room.dataset.area), Math.sqrt(room.dataset.area));
        createRoom({
            name: `${room.querySelector('.room-label').innerText} (פוצל)`,
            area: parseFloat(splitVal),
            floorId: room.dataset.floor,
            color: room.style.backgroundColor,
            leftPx: parseFloat(room.style.left) - WORKSPACE_OFFSET + 20,
            topPx: parseFloat(room.style.top) - WORKSPACE_OFFSET + 20
        });
        syncInventory();
    }
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

/** Get room area in m² from dataset or from current dimensions (fallback). */
function getRoomAreaM2(roomEl) {
    let area = parseFloat(roomEl.dataset.area);
    if (!Number.isFinite(area) || area <= 0) {
        const wPx = parseFloat(roomEl.style.width);
        const hPx = parseFloat(roomEl.style.height);
        if (Number.isFinite(wPx) && Number.isFinite(hPx) && wPx > 0 && hPx > 0) {
            area = (wPx / SCALE) * (hPx / SCALE);
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
        item.style.marginBottom = "5px";
        item.style.fontWeight = "bold";
        item.innerHTML = `<span>${r.querySelector('.room-label').innerText}</span> <input type="number" class="inventory-area-input" value="${areaM2.toFixed(1)}" min="0.1" step="0.1" title="שטח במ\"ר">`;
        list.appendChild(item);

        item.querySelector('input').onchange = (e) => {
            r.dataset.area = e.target.value;
            updateRoomSize(r.id, Math.sqrt(e.target.value), Math.sqrt(e.target.value));
            syncInventory();
        };

        // Show nested rooms for this parent
        if (state.nestedData[r.id]) {
            state.nestedData[r.id].forEach(child => {
                const subItem = document.createElement('div');
                subItem.className = 'inventory-sub-item';
                subItem.style.display = "flex";
                subItem.style.justifyContent = "space-between";
                subItem.style.paddingRight = "20px";
                subItem.style.fontSize = "12px";
                subItem.style.color = "#666";
                subItem.innerHTML = `<span>↳ ${child.name} (${child.area}m²)</span> <button class="btn-unnest-ui">📤</button>`;
                list.appendChild(subItem);

                subItem.querySelector('.btn-unnest-ui').onclick = () => unnestRoom(r.id, child.id);
            });
        }
    });
}

function onRoomMerge(parentId, childId) {
    const parent = document.getElementById(parentId);
    const child = document.getElementById(childId);
    if (!parent || !child) return;

    if (!confirm(`האם למזג את "${child.querySelector('.room-label').innerText}" לתוך "${parent.querySelector('.room-label').innerText}"?`)) {
        return;
    }

    const pArea = parseFloat(parent.dataset.area);
    const cArea = parseFloat(child.dataset.area);
    const newArea = pArea + cArea;

    // Store child data (logical LX/LY normalized)
    const childData = {
        id: child.id,
        name: child.querySelector('.room-label').innerText,
        area: cArea,
        color: child.style.backgroundColor,
        relLX: parseFloat(child.style.left) - parseFloat(parent.style.left),
        relLY: parseFloat(child.style.top) - parseFloat(parent.style.top)
    };

    if (!state.nestedData[parentId]) state.nestedData[parentId] = [];
    state.nestedData[parentId].push(childData);

    // Update parent area
    parent.dataset.area = newArea.toFixed(1);

    // Scale parent while maintaining aspect ratio: currentW / currentH = newW / newH
    // newW * newH = newArea * SCALE * SCALE
    const currentW = parseFloat(parent.style.width) / SCALE; // in meters
    const currentH = parseFloat(parent.style.height) / SCALE; // in meters
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

    const nestedArr = state.nestedData[parentId];
    const childIdx = nestedArr.findIndex(c => c.id === childId);
    if (childIdx === -1) return;

    const childData = nestedArr.splice(childIdx, 1)[0];
    if (nestedArr.length === 0) delete state.nestedData[parentId];

    const pArea = parseFloat(parent.dataset.area);
    const newArea = pArea - childData.area;

    // Update parent area
    parent.dataset.area = newArea.toFixed(1);

    // Rescale parent down
    const currentW = parseFloat(parent.style.width) / SCALE;
    const currentH = parseFloat(parent.style.height) / SCALE;
    const ratio = currentW / currentH;
    const newW_meters = Math.sqrt(newArea * ratio);
    const newH_meters = newArea / newW_meters;
    updateRoomSize(parentId, newW_meters, newH_meters);

    // Recreate child at global logical coords: parent logical + stored relative offset
    const parentLogicalX = parseFloat(parent.style.left) - WORKSPACE_OFFSET;
    const parentLogicalY = parseFloat(parent.style.top) - WORKSPACE_OFFSET;
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
    const n = document.getElementById('newName').value;
    const a = document.getElementById('newArea').value;
    const f = document.getElementById('newFloorSelect').value;
    const { x, y } = camera.screenToLogical(window.innerWidth / 2, window.innerHeight / 2);
    if (n && a > 0) createRoom({ name: n, area: parseFloat(a), floorId: f, leftPx: x, topPx: y });
}

function deleteRoom(id) {
    const room = document.getElementById(id);
    if (room) room.remove();
    syncInventory();
    refreshUnderlays();
}

function deleteSelectedRooms() {
    state.selectedRooms.forEach(r => r.remove());
    state.selectedRooms = [];
    syncInventory();
    refreshUnderlays();
}

function runStandardsSearch() {
    const val = document.getElementById('std-input').value.toLowerCase();
    const res = document.getElementById('std-result');
    if (!val) { res.innerText = "הקלד מילה לחיפוש תקן..."; return; }
    const key = Object.keys(STANDARDS_DATA).find(k => val.includes(k) || k.includes(val));
    res.innerText = key ? STANDARDS_DATA[key] : "מחפש בתקנות...";
}
