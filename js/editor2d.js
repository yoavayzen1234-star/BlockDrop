import { SCALE, SNAP_THRESHOLD, WORKSPACE_OFFSET } from './config.js';
import { getRoomCorners } from './geometry.js';
import { state } from './state.js';
import { SnapEngine } from './snapEngine.js';

const snapEngine = new SnapEngine();

/** Returns room elements from all floors below the active floor (for snap/alignment with ground floor). */
function getLowerFloorRooms() {
    const currentIdx = state.getFloorIndex(state.activeFloorId);
    if (currentIdx <= 0) return [];
    const lowerFloors = state.floors.slice(0, currentIdx);
    const rooms = [];
    for (const floor of lowerFloors) {
        const plan = document.getElementById(floor.id);
        if (!plan) continue;
        rooms.push(...Array.from(plan.querySelectorAll('.room')));
    }
    return rooms;
}

/**
 * Handle room dragging with camera/zoom awareness
 */
export function makeDraggable(el, camera, updateCallback) {
    el.onmousedown = (e) => {
        // Only left mouse drag, check if not over buttons/inputs
        if (e.button !== 0 || e.shiftKey || e.target.className.includes('h-') || e.target.tagName === 'BUTTON' || e.target.className === 'angle-pop') return;

        e.stopPropagation();

        // Multi-select or single
        if (!state.selectedRooms.includes(el)) {
            if (!e.ctrlKey && !e.metaKey) {
                state.selectedRooms.forEach(r => r.classList.remove('selected'));
                state.selectedRooms = [el];
            } else {
                state.selectedRooms.push(el);
            }
            el.classList.add('selected');
        }

        const startMouse = camera.screenToLogical(e.clientX, e.clientY);
        const z = camera.zoom;
        // Room style.left/top are in display pixels (logical * zoom); logical = (style / zoom) - WORKSPACE_OFFSET
        const startPositions = state.selectedRooms.map(r => ({
            el: r,
            left: (parseFloat(r.style.left) / z) - WORKSPACE_OFFSET,
            top: (parseFloat(r.style.top) / z) - WORKSPACE_OFFSET
        }));

        const plan = el.parentElement;
        const vGuides = plan.querySelectorAll('.v-guide');
        const hGuides = plan.querySelectorAll('.h-guide');

        let dragRafId = 0;
        let lastMove = null;

        const applyDrag = () => {
            dragRafId = 0;
            if (!lastMove) return;
            const { clientX, clientY } = lastMove;
            lastMove = null;

            const currentMouse = camera.screenToLogical(clientX, clientY);
            const dx = currentMouse.x - startMouse.x;
            const dy = currentMouse.y - startMouse.y;

            let finalSnapX = null, finalSnapY = null;
            const leader = startPositions.find(p => p.el === el);
            const leadNewL = leader.left + dx;
            const leadNewT = leader.top + dy;
            const leadW = el.offsetWidth / z;
            const leadH = el.offsetHeight / z;

            const otherRooms = Array.from(plan.querySelectorAll('.room')).filter(r => !state.selectedRooms.includes(r));
            const lowerRooms = getLowerFloorRooms();
            const otherRoomsLogical = otherRooms.map(r => ({
                left: (parseFloat(r.style.left) / z) - WORKSPACE_OFFSET,
                top: (parseFloat(r.style.top) / z) - WORKSPACE_OFFSET,
                width: parseFloat(r.style.width) / z,
                height: parseFloat(r.style.height) / z
            }));
            const lowerRoomsLogical = lowerRooms.map(r => ({
                left: (parseFloat(r.style.left) / z) - WORKSPACE_OFFSET,
                top: (parseFloat(r.style.top) / z) - WORKSPACE_OFFSET,
                width: parseFloat(r.style.width) / z,
                height: parseFloat(r.style.height) / z
            }));
            const allForSnap = [...otherRoomsLogical, ...lowerRoomsLogical];
            const snapResult = snapEngine.snapRoom({ x: leadNewL, y: leadNewT }, { w: leadW, h: leadH }, allForSnap, camera.canvasZoom);

            finalSnapX = snapResult.x;
            finalSnapY = snapResult.y;

            const gv = snapResult.guides.v || [];
            const gh = snapResult.guides.h || [];
            const toDisplayPx = (logical) => Math.round((WORKSPACE_OFFSET + logical) * z);
            vGuides.forEach((vg, i) => {
                if (gv[i] != null) {
                    vg.style.display = 'block';
                    vg.style.left = toDisplayPx(gv[i]) + 'px';
                } else {
                    vg.style.display = 'none';
                }
            });
            hGuides.forEach((hg, i) => {
                if (gh[i] != null) {
                    hg.style.display = 'block';
                    hg.style.top = toDisplayPx(gh[i]) + 'px';
                } else {
                    hg.style.display = 'none';
                }
            });

            const toDisplayX = (logicalX) => Math.round((WORKSPACE_OFFSET + logicalX) * z);
            const toDisplayY = (logicalY) => Math.round((WORKSPACE_OFFSET + logicalY) * z);
            startPositions.forEach(pos => {
                let finalX = pos.left + dx, finalY = pos.top + dy;
                if (finalSnapX !== null && pos.el === el) {
                    finalX = finalSnapX;
                    const diffX = finalSnapX - leadNewL;
                    startPositions.forEach(p => { p.el.style.left = toDisplayX(p.left + dx + diffX) + 'px'; });
                } else if (pos.el === el) {
                    pos.el.style.left = toDisplayX(finalX) + 'px';
                }

                if (finalSnapY !== null && pos.el === el) {
                    finalY = finalSnapY;
                    const diffY = finalSnapY - leadNewT;
                    startPositions.forEach(p => { p.el.style.top = toDisplayY(p.top + dy + diffY) + 'px'; });
                } else if (pos.el === el) {
                    pos.el.style.top = toDisplayY(finalY) + 'px';
                }
            });

            const dRect = {
                left: parseFloat(el.style.left),
                top: parseFloat(el.style.top),
                right: parseFloat(el.style.left) + el.offsetWidth,
                bottom: parseFloat(el.style.top) + el.offsetHeight
            };
            let canMergeParent = null;
            for (const sib of otherRooms) {
                const sRect = {
                    left: parseFloat(sib.style.left),
                    top: parseFloat(sib.style.top),
                    right: parseFloat(sib.style.left) + sib.offsetWidth,
                    bottom: parseFloat(sib.style.top) + sib.offsetHeight
                };
                if (dRect.left >= sRect.left && dRect.top >= sRect.top && dRect.right <= sRect.right && dRect.bottom <= sRect.bottom) {
                    canMergeParent = sib.id;
                    break;
                }
            }

            const mergeBtn = el.querySelector('.btn-merge');
            if (mergeBtn) {
                if (canMergeParent) {
                    mergeBtn.style.display = 'block';
                    el.dataset.potentialParent = canMergeParent;
                } else {
                    mergeBtn.style.display = 'none';
                    delete el.dataset.potentialParent;
                }
            }
        };

        document.onmousemove = (me) => {
            lastMove = { clientX: me.clientX, clientY: me.clientY };
            if (dragRafId === 0) dragRafId = requestAnimationFrame(applyDrag);
        };

        document.onmouseup = () => {
            document.onmousemove = null;
            vGuides.forEach(vg => { vg.style.display = 'none'; });
            hGuides.forEach(hg => { hg.style.display = 'none'; });
            if (state.selectedRooms.length) {
                document.dispatchEvent(new CustomEvent('room-moved', {
                    detail: { roomIds: state.selectedRooms.map(r => r.id) }
                }));
            }
            if (updateCallback) updateCallback();
        };
    };
}

export function setupResizing(room, camera, updateRoomSizeFn, onComplete) {
    const plan = room.parentElement;
    const vGuides = plan.querySelectorAll('.v-guide');
    const hGuides = plan.querySelectorAll('.h-guide');

    const getOtherRooms = () => {
        const sameFloor = Array.from(plan.querySelectorAll('.room')).filter(r => r !== room);
        const lower = getLowerFloorRooms();
        return [...sameFloor, ...lower];
    };

    /** Check if two segments on the same axis overlap (by more than 1px). */
    const edgesOverlap = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 1;

    /** Check if one side of rect is touching (aligned + overlapping) another room. */
    const isSideTouching = (rect, other, side, threshold) => {
        const oL = parseFloat(other.style.left);
        const oT = parseFloat(other.style.top);
        const oW = parseFloat(other.style.width);
        const oH = parseFloat(other.style.height);
        const oR = oL + oW;
        const oB = oT + oH;

        if (side === 'l') {
            return Math.abs(rect.left - oR) < threshold && edgesOverlap(rect.top, rect.bottom, oT, oB);
        }
        if (side === 'r') {
            return Math.abs(rect.right - oL) < threshold && edgesOverlap(rect.top, rect.bottom, oT, oB);
        }
        if (side === 't') {
            return Math.abs(rect.top - oB) < threshold && edgesOverlap(rect.left, rect.right, oL, oR);
        }
        // side === 'b'
        return Math.abs(rect.bottom - oT) < threshold && edgesOverlap(rect.left, rect.right, oL, oR);
    };

    /** If exactly one edge on this axis is touching another room, move the opposite edge (keep connected edge anchored). rect/otherRooms in display px. */
    const pickMoveSide = (initialSide, rect, otherRooms, zoom) => {
        const threshold = SNAP_THRESHOLD;

        if (initialSide === 'l' || initialSide === 'r') {
            const cL = otherRooms.some(o => isSideTouching(rect, o, 'l', threshold));
            const cR = otherRooms.some(o => isSideTouching(rect, o, 'r', threshold));
            if (cL !== cR) return cL ? 'r' : 'l';
            return initialSide;
        }

        const cT = otherRooms.some(o => isSideTouching(rect, o, 't', threshold));
        const cB = otherRooms.some(o => isSideTouching(rect, o, 'b', threshold));
        if (cT !== cB) return cT ? 'b' : 't';
        return initialSide;
    };

    function updateResizeGuides() {
        const left = parseFloat(room.style.left);
        const top = parseFloat(room.style.top);
        const w = room.offsetWidth;
        const h = room.offsetHeight;
        const otherRooms = getOtherRooms();
        const { v: gv, h: gh } = snapEngine.getGuideLines(left, top, w, h, otherRooms, camera.canvasZoom);
        vGuides.forEach((vg, i) => {
            if (gv[i] != null) { vg.style.display = 'block'; vg.style.left = Math.round(gv[i]) + 'px'; } else { vg.style.display = 'none'; }
        });
        hGuides.forEach((hg, i) => {
            if (gh[i] != null) { hg.style.display = 'block'; hg.style.top = Math.round(gh[i]) + 'px'; } else { hg.style.display = 'none'; }
        });
    }

    const z = () => camera.canvasZoom;
    ['r', 'l', 't', 'b'].forEach(side => {
        const handle = room.querySelector('.h-' + side);
        if (!handle) return;
        handle.onmousedown = (e) => {
            e.stopPropagation(); e.preventDefault();
            const zoom = z();
            const startMouse = camera.screenToLogical(e.clientX, e.clientY);
            const sW = room.offsetWidth, sH = room.offsetHeight, sL = parseFloat(room.style.left), sT = parseFloat(room.style.top);
            const otherRooms = getOtherRooms();
            const startRect = { left: sL, top: sT, right: sL + sW, bottom: sT + sH };
            const moveSide = pickMoveSide(side, startRect, otherRooms, zoom);
            const invertDelta = moveSide !== side;

            updateResizeGuides();

            document.onmousemove = (me) => {
                const curZoom = z();
                const currentMouse = camera.screenToLogical(me.clientX, me.clientY);
                const rawDx = currentMouse.x - startMouse.x;
                const rawDy = currentMouse.y - startMouse.y;
                const dx = (invertDelta ? -rawDx : rawDx) * curZoom;
                const dy = (invertDelta ? -rawDy : rawDy) * curZoom;

                let desiredLeft = sL, desiredTop = sT, desiredWidth = sW, desiredHeight = sH;
                if (moveSide === 'r') desiredWidth = Math.max(SCALE * curZoom, sW + dx);
                else if (moveSide === 'b') desiredHeight = Math.max(SCALE * curZoom, sH + dy);
                else if (moveSide === 'l') {
                    desiredLeft = sL + dx;
                    desiredWidth = Math.max(SCALE * curZoom, sW - dx);
                } else if (moveSide === 't') {
                    desiredTop = sT + dy;
                    desiredHeight = Math.max(SCALE * curZoom, sH - dy);
                }

                const snapped = snapEngine.snapResizeEdge(desiredLeft, desiredTop, desiredWidth, desiredHeight, moveSide, getOtherRooms(), curZoom);

                if (moveSide === 'r') {
                    updateRoomSizeFn(room.id, Math.max(1, snapped.width / (SCALE * curZoom)), null, 'r');
                } else if (moveSide === 'b') {
                    updateRoomSizeFn(room.id, null, Math.max(1, snapped.height / (SCALE * curZoom)), 'b');
                } else if (moveSide === 'l') {
                    room.style.left = Math.round(snapped.left) + 'px';
                    updateRoomSizeFn(room.id, Math.max(1, snapped.width / (SCALE * curZoom)), null, 'l');
                } else if (moveSide === 't') {
                    room.style.top = Math.round(snapped.top) + 'px';
                    updateRoomSizeFn(room.id, null, Math.max(1, snapped.height / (SCALE * curZoom)), 't');
                }
                updateResizeGuides();
            };
            document.onmouseup = () => {
                document.onmousemove = null;
                vGuides.forEach(vg => { vg.style.display = 'none'; });
                hGuides.forEach(hg => { hg.style.display = 'none'; });
                if (onComplete) onComplete();
            };
        };
    });
}

export function startRotate(e, id, camera, onUpdate, onComplete) {
    e.stopPropagation(); e.preventDefault();
    const room = document.getElementById(id);
    const angleInp = room.querySelector('.angle-pop');
    angleInp.style.display = 'block'; angleInp.focus();

    // Rotation center in screen coordinates
    const rect = room.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2;
    const startAngle = parseFloat(room.dataset.rotation || 0);
    const startMouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);

    document.onmousemove = (me) => {
        const currentMouseAngle = Math.atan2(me.clientY - centerY, me.clientX - centerX);
        let angle = startAngle + (currentMouseAngle - startMouseAngle) * (180 / Math.PI);

        if (!window.isAltPressed) angle = snapEngine.snapRotation(angle);

        room.dataset.rotation = angle;
        room.style.transform = `rotate(${angle}deg)`;
        angleInp.value = Math.round(angle);
        if (onUpdate) onUpdate(angle);
    };
    document.onmouseup = () => {
        document.onmousemove = null;
        if (onComplete) onComplete();
    };
}
