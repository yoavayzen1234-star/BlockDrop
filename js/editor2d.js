import { SCALE, SNAP_THRESHOLD } from './config.js';
import { getRoomCorners } from './geometry.js';
import { state } from './state.js';
import { SnapEngine } from './snapEngine.js';

const snapEngine = new SnapEngine();

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
        const startPositions = state.selectedRooms.map(r => ({
            el: r,
            left: parseFloat(r.style.left) || 0,
            top: parseFloat(r.style.top) || 0
        }));

        const plan = el.parentElement;
        const vg = plan.querySelector('.v-guide');
        const hg = plan.querySelector('.h-guide');

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
            const leadW = el.offsetWidth, leadH = el.offsetHeight;

            const otherRooms = Array.from(plan.querySelectorAll('.room')).filter(r => !state.selectedRooms.includes(r));
            const snapResult = snapEngine.snapRoom({ x: leadNewL, y: leadNewT }, { w: leadW, h: leadH }, otherRooms, camera.canvasZoom);

            finalSnapX = snapResult.x;
            finalSnapY = snapResult.y;

            if (vg) {
                vg.style.display = snapResult.guides.v !== null ? 'block' : 'none';
                if (snapResult.guides.v !== null) vg.style.left = snapResult.guides.v + 'px';
            }
            if (hg) {
                hg.style.display = snapResult.guides.h !== null ? 'block' : 'none';
                if (snapResult.guides.h !== null) hg.style.top = snapResult.guides.h + 'px';
            }

            startPositions.forEach(pos => {
                let finalX = pos.left + dx, finalY = pos.top + dy;
                if (finalSnapX !== null && pos.el === el) {
                    finalX = finalSnapX;
                    const diffX = finalSnapX - leadNewL;
                    startPositions.forEach(p => p.el.style.left = (p.left + dx + diffX) + 'px');
                } else if (pos.el === el) {
                    pos.el.style.left = finalX + 'px';
                }

                if (finalSnapY !== null && pos.el === el) {
                    finalY = finalSnapY;
                    const diffY = finalSnapY - leadNewT;
                    startPositions.forEach(p => p.el.style.top = (p.top + dy + diffY) + 'px');
                } else if (pos.el === el) {
                    pos.el.style.top = finalY + 'px';
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
            if (vg) vg.style.display = 'none';
            if (hg) hg.style.display = 'none';
            if (updateCallback) updateCallback();
        };
    };
}

export function setupResizing(room, camera, updateRoomSizeFn, onComplete) {
    ['r', 'l', 't', 'b'].forEach(side => {
        const handle = room.querySelector('.h-' + side);
        if (!handle) return;
        handle.onmousedown = (e) => {
            e.stopPropagation(); e.preventDefault();
            const startMouse = camera.screenToLogical(e.clientX, e.clientY);
            const sW = room.offsetWidth, sH = room.offsetHeight, sL = room.offsetLeft, sT = room.offsetTop;

            document.onmousemove = (me) => {
                const currentMouse = camera.screenToLogical(me.clientX, me.clientY);
                const dx = currentMouse.x - startMouse.x;
                const dy = currentMouse.y - startMouse.y;

                if (side === 'r') updateRoomSizeFn(room.id, Math.max(1, (sW + dx) / SCALE), null, 'r');
                else if (side === 'b') updateRoomSizeFn(room.id, null, Math.max(1, (sH + dy) / SCALE), 'b');
                else if (side === 'l') {
                    let w = Math.max(1, (sW - dx) / SCALE);
                    room.style.left = (sL + (sW - w * SCALE)) + "px";
                    updateRoomSizeFn(room.id, w, null, 'l');
                }
                else if (side === 't') {
                    let h = Math.max(1, (sH - dy) / SCALE);
                    room.style.top = (sT + (sH - h * SCALE)) + "px";
                    updateRoomSizeFn(room.id, null, h, 't');
                }
            };
            document.onmouseup = () => {
                document.onmousemove = null;
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
