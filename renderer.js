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
    for (let i = 0; i < currentIdx; i++) {
        const lowerFloor = state.floors[i];
        document.querySelectorAll(`.room[data-floor="${lowerFloor.id}"]`).forEach(r => {
            const ghost = document.createElement('div');
            ghost.className = 'room-ghost';
            ghost.style.width = r.style.width; ghost.style.height = r.style.height;
            ghost.style.left = r.style.left; ghost.style.top = r.style.top;
            ghost.style.transform = r.style.transform;
            ghost.innerText = `נעול (${lowerFloor.name})`;
            currentPlan.appendChild(ghost);
        });
    }
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

function syncInventory() {
    const list = document.getElementById('inventory-list');
    list.innerHTML = '';
    document.querySelectorAll(`.room[data-floor="${state.activeFloorId}"]`).forEach(r => {
        const item = document.createElement('div');
        item.className = 'inventory-item';
        item.style.display = "flex"; item.style.justifyContent = "space-between"; item.style.marginBottom = "5px";
        item.innerHTML = `<span>${r.querySelector('.room-label').innerText}</span> <input type="number" style="width:50px" value="${parseFloat(r.dataset.area).toFixed(0)}">`;
        list.appendChild(item);
        item.querySelector('input').onchange = (e) => {
            r.dataset.area = e.target.value;
            updateRoomSize(r.id, Math.sqrt(e.target.value), Math.sqrt(e.target.value));
            syncInventory();
        };
    });
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
