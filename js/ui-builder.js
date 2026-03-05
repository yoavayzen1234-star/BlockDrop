import { SCALE, WORKSPACE_OFFSET, escapeHtml } from './config.js';
import { state } from './state.js';
import { makeDraggable, setupResizing, startRotate } from './editor2d.js';

export function createRoomElement(r, camera, { onDelete, onSplit, onUpdateSize }) {
    const room = document.createElement('div');
    room.className = 'room';
    room.id = r.id || `room-${state.roomIdCounter++}`;

    const lx = r.leftPx ?? parseFloat(r.left) ?? 0;
    const ly = r.topPx ?? parseFloat(r.top) ?? 0;
    const isEllipse = r.shape === 'ellipse';
    let wPx = parseFloat(r.widthPx || r.width);
    let hPx = parseFloat(r.heightPx || r.height);
    if (!Number.isFinite(wPx) || !Number.isFinite(hPx) || wPx <= 0 || hPx <= 0) {
        const areaM2 = r.area != null && Number.isFinite(parseFloat(r.area)) ? parseFloat(r.area) : 25;
        const areaPx = areaM2 * SCALE * SCALE;
        if (isEllipse) {
            const sidePx = 2 * Math.sqrt(areaPx / Math.PI);
            wPx = hPx = sidePx;
        } else {
            const sidePx = Math.sqrt(areaPx);
            wPx = hPx = sidePx;
        }
    }
    const wM = wPx / SCALE;
    const hM = hPx / SCALE;
    const area = r.area != null ? parseFloat(r.area)
        : isEllipse ? (Math.PI * wPx * hPx) / (4 * SCALE * SCALE)
        : (wPx * hPx) / (SCALE * SCALE);

    room.dataset.area = area.toFixed(1);
    room.dataset.floor = r.floorId || r.floor;
    room.dataset.rotation = (r.rotationDeg ?? r.rotation ?? 0).toString();
    room.dataset.shape = isEllipse ? 'ellipse' : 'rect';
    if (isEllipse) room.classList.add('room--ellipse');
    room.style.backgroundColor = r.color || "#ffffff";
    if (r.customHeight != null && r.customHeight !== '' && Number.isFinite(parseFloat(r.customHeight))) {
        room.dataset.customHeight = String(parseFloat(r.customHeight));
    }

    const z = camera ? camera.zoom : 1;
    room.style.left = Math.round((lx + WORKSPACE_OFFSET) * z) + "px";
    room.style.top = Math.round((ly + WORKSPACE_OFFSET) * z) + "px";
    room.style.width = Math.round(wPx * z) + "px";
    room.style.height = Math.round(hPx * z) + "px";
    room.style.transform = `rotate(${room.dataset.rotation}deg)`;

    const dimW = (typeof wM === 'number' && !Number.isNaN(wM)) ? wM.toFixed(1) + ' m' : '';
    const dimL = (typeof hM === 'number' && !Number.isNaN(hM)) ? hM.toFixed(1) + ' m' : '';
    const areaStr = (typeof area === 'number' && !Number.isNaN(area)) ? area.toFixed(0) + ' m²' : '';

    room.innerHTML = `
        <div class="room-btns">
            <button class="btn-sm btn-del" style="background:#ff4444">×</button>
            <button class="btn-sm btn-split" style="background:#2ecc71">✂️</button>
            <button class="btn-sm btn-rot" style="background:#0077be">🔄</button>
            <button class="btn-sm btn-unnest" style="background:#00aa00; display:none;">📤</button>
        </div>
        <div class="room-merge-wrap">
            <button type="button" class="btn-merge" title="הטמעה בחדר הגדול" style="display:none;">🔗</button>
        </div>
        <input type="number" class="angle-pop" value="${Math.round(parseFloat(room.dataset.rotation))}">
        <div class="dim dim-w">${dimW}</div><div class="dim dim-l">${dimL}</div>
        <div class="room-label">${escapeHtml(r.name || "חדר")}</div>
        <div class="room-info" style="font-size:9px; opacity:0.6">${areaStr}</div>
        <div class="h-r"></div><div class="h-l"></div><div class="h-t"></div><div class="h-b"></div>
    `;

    const floorContainer = document.getElementById(room.dataset.floor);
    if (floorContainer) floorContainer.appendChild(room);

    if (isEllipse) {
        const splitBtn = room.querySelector('.btn-split');
        if (splitBtn) splitBtn.style.display = 'none';
    }

    const delBtn = room.querySelector('.btn-del');
    delBtn.onclick = (e) => { e.stopPropagation(); e.preventDefault(); onDelete(room.id); };
    delBtn.onmousedown = (e) => e.stopPropagation();
    const splitBtn = room.querySelector('.btn-split');
    splitBtn.onclick = (e) => { e.stopPropagation(); e.preventDefault(); onSplit(room.id); };
    splitBtn.onmousedown = (e) => { e.stopPropagation(); };
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

    onUpdateSize(room.id, wM, hM);

    makeDraggable(room, camera);
    setupResizing(room, camera, onUpdateSize);

    return room;
}

export function buildFloorTab(f, { onDeleteFloor, onSwitchFloor }) {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.id = 'tab-' + f.id;
    tab.innerHTML = `<span>${escapeHtml(f.name)}</span><button class="del-floor" aria-label="מחיקת קומה">×</button>`;
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
        <div class="v-guide"></div>
        <div class="v-guide"></div>
        <div class="v-guide"></div>
        <div class="v-guide"></div>
        <div class="v-guide"></div>
        <div class="v-guide"></div>
        <div class="h-guide"></div>
        <div class="h-guide"></div>
        <div class="h-guide"></div>
        <div class="h-guide"></div>
        <div class="h-guide"></div>
        <div class="h-guide"></div>
    `;
    return plan;
}
