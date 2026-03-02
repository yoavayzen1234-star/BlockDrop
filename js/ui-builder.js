import { SCALE, WORKSPACE_OFFSET } from './config.js';
import { state } from './state.js';
import { makeDraggable, setupResizing, startRotate } from './editor2d.js';

export function createRoomElement(r, camera, { onDelete, onSplit, onUpdateSize }) {
    const room = document.createElement('div');
    room.className = 'room';
    room.id = r.id || `room-${state.roomIdCounter++}`;
    room.dataset.area = r.area || (parseFloat(r.widthPx || 100) * parseFloat(r.heightPx || 100) / 100).toFixed(1);
    room.dataset.floor = r.floorId || r.floor;
    room.dataset.rotation = r.rotationDeg || r.rotation || "0";
    room.style.backgroundColor = r.color || "#ffffff";

    // Convert Logical LX/LY to Physical CSS (LX + OFFSET)
    const lx = r.leftPx || parseFloat(r.left) || 0;
    const ly = r.topPx || parseFloat(r.top) || 0;
    room.style.left = (lx + WORKSPACE_OFFSET) + "px";
    room.style.top = (ly + WORKSPACE_OFFSET) + "px";

    room.style.width = (r.widthPx || parseFloat(r.width) || 100) + "px";
    room.style.height = (r.heightPx || parseFloat(r.height) || 100) + "px";
    room.style.transform = `rotate(${room.dataset.rotation}deg)`;

    room.innerHTML = `
        <div class="room-btns">
            <button class="btn-sm btn-del" style="background:#ff4444">×</button>
            <button class="btn-sm btn-split" style="background:#2ecc71">✂️</button>
            <button class="btn-sm btn-rot" style="background:#0077be">🔄</button>
            <button class="btn-sm btn-merge" style="background:#ff8800; display:none;">🔗</button>
            <button class="btn-sm btn-unnest" style="background:#00aa00; display:none;">📤</button>
        </div>
        <input type="number" class="angle-pop" value="${Math.round(room.dataset.rotation)}">
        <div class="dim dim-w"></div><div class="dim dim-l"></div>
        <div class="room-label">${r.name || "חדר"}</div>
        <div class="room-info" style="font-size:9px; opacity:0.6"></div>
        <div class="h-r"></div><div class="h-l"></div><div class="h-t"></div><div class="h-b"></div>
    `;

    const floorContainer = document.getElementById(room.dataset.floor);
    if (floorContainer) floorContainer.appendChild(room);

    // Bindings
    room.querySelector('.btn-del').onclick = () => onDelete(room.id);
    room.querySelector('.btn-split').onclick = () => onSplit(room.id);
    room.querySelector('.btn-rot').onmousedown = (e) => startRotate(e, room.id, camera);

    const mergeBtn = room.querySelector('.btn-merge');
    mergeBtn.onclick = (e) => {
        e.stopPropagation();
        if (room.dataset.potentialParent) {
            const event = new CustomEvent('room-merge', {
                detail: { parentId: room.dataset.potentialParent, childId: room.id }
            });
            document.dispatchEvent(event);
        }
    };

    const angleInp = room.querySelector('.angle-pop');
    angleInp.onmousedown = (e) => e.stopPropagation();
    angleInp.oninput = (e) => {
        const val = parseFloat(e.target.value) || 0;
        room.dataset.rotation = val;
        room.style.transform = `rotate(${val}deg)`;
    };
    angleInp.onblur = () => { angleInp.style.display = 'none'; };

    // Update size initially
    onUpdateSize(room.id, parseFloat(room.style.width) / SCALE, parseFloat(room.style.height) / SCALE);

    makeDraggable(room, camera);
    setupResizing(room, camera, onUpdateSize);

    return room;
}

export function buildFloorTab(f, { onDeleteFloor, onSwitchFloor }) {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.id = 'tab-' + f.id;
    tab.innerHTML = `<span>${f.name}</span><button class="del-floor">×</button>`;
    tab.onclick = () => onSwitchFloor(f.id);

    tab.querySelector('.del-floor').onclick = (e) => {
        e.stopPropagation();
        onDeleteFloor(f.id);
    };
    return tab;
}

export function buildFloorPlan(f) {
    const plan = document.createElement('div');
    plan.className = 'floor-plan';
    plan.id = f.id;
    plan.innerHTML = `
        <div class="floor-title">${f.name}</div>
        <div class="v-guide"></div>
        <div class="h-guide"></div>
    `;
    return plan;
}
