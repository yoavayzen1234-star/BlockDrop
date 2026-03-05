import { state } from './state.js';
import { WORKSPACE_OFFSET } from './config.js';

/**
 * SelectionManager - Lasso (selection box) with scaled coordinates.
 * Uses screenToLogical so selection works at any canvasZoom.
 */
export class SelectionManager {
    constructor(canvasCamera, mainEl) {
        this.camera = canvasCamera;
        this.main = mainEl;
        this.isSelecting = false;
        this.startX = 0;
        this.startY = 0;
        this.boxEl = null;

        this.initEvents();
    }

    initEvents() {
        this.main.addEventListener('mousedown', (e) => {
            const isEmptyArea = e.target === this.main ||
                (e.target.classList && e.target.classList.contains('floor-plan'));
            const notOnRoom = !e.target.closest('.room');
            if (e.button === 0 && !e.shiftKey && isEmptyArea && notOnRoom) {
                this.startSelection(e);
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isSelecting) {
                this.updateSelection(e);
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isSelecting) {
                this.finishSelection();
            }
        });
    }

    startSelection(e) {
        this.isSelecting = true;
        const logical = this.camera.screenToLogical(e.clientX, e.clientY);
        this.startX = logical.x;
        this.startY = logical.y;
        const z = this.camera.zoom;

        // Find or create selection box (positions in display pixels)
        const plan = document.getElementById(state.activeFloorId);
        if (!plan) return;
        this.boxEl = plan.querySelector('.selection-box');
        if (!this.boxEl) {
            this.boxEl = document.createElement('div');
            this.boxEl.className = 'selection-box';
            plan.appendChild(this.boxEl);
        }

        this.boxEl.style.display = 'block';
        this.boxEl.style.width = '0px';
        this.boxEl.style.height = '0px';
        this.boxEl.style.left = (this.startX + WORKSPACE_OFFSET) * z + 'px';
        this.boxEl.style.top = (this.startY + WORKSPACE_OFFSET) * z + 'px';

        // Clear existing selection
        this.clearSelection();
    }

    updateSelection(e) {
        const logical = this.camera.screenToLogical(e.clientX, e.clientY);
        const curX = logical.x;
        const curY = logical.y;
        const z = this.camera.zoom;

        const left = Math.min(this.startX, curX);
        const top = Math.min(this.startY, curY);
        const width = Math.abs(curX - this.startX);
        const height = Math.abs(curY - this.startY);

        this.boxEl.style.left = (left + WORKSPACE_OFFSET) * z + 'px';
        this.boxEl.style.top = (top + WORKSPACE_OFFSET) * z + 'px';
        this.boxEl.style.width = width * z + 'px';
        this.boxEl.style.height = height * z + 'px';
    }

    finishSelection() {
        const left = parseFloat(this.boxEl.style.left);
        const top = parseFloat(this.boxEl.style.top);
        const width = parseFloat(this.boxEl.style.width);
        const height = parseFloat(this.boxEl.style.height);
        const right = left + width;
        const bottom = top + height;

        const plan = document.getElementById(state.activeFloorId);
        if (plan) {
            const rooms = plan.querySelectorAll('.room');
            rooms.forEach(r => {
                const rx = parseFloat(r.style.left);
                const ry = parseFloat(r.style.top);
                const rw = parseFloat(r.style.width);
                const rh = parseFloat(r.style.height);
                // All in same space: physical (logical + WORKSPACE_OFFSET)
                const fullyInside = rx >= left && ry >= top && rx + rw <= right && ry + rh <= bottom;
                if (fullyInside) this.selectRoom(r, true);
            });
        }

        this.boxEl.style.display = 'none';
        this.isSelecting = false;
    }

    selectRoom(roomEl, multi = false) {
        if (!multi) this.clearSelection();
        if (!state.selectedRooms.includes(roomEl)) {
            state.selectedRooms.push(roomEl);
            roomEl.classList.add('selected');
        }
    }

    clearSelection() {
        state.selectedRooms.forEach(r => r.classList.remove('selected'));
        state.selectedRooms = [];
    }

    /**
     * Get the room element at logical coordinates (center-origin: 0,0 = canvas center).
     * Only checks rooms on the active floor.
     * @param {number} logicalX - logical x (center-origin)
     * @param {number} logicalY - logical y (center-origin)
     * @returns {HTMLElement|null} room element or null
     */
    getRoomAt(logicalX, logicalY) {
        const plan = document.getElementById(state.activeFloorId);
        if (!plan) return null;
        const z = this.camera.zoom;
        const rooms = plan.querySelectorAll('.room');
        for (const room of rooms) {
            const left = (parseFloat(room.style.left) / z) - WORKSPACE_OFFSET;
            const top = (parseFloat(room.style.top) / z) - WORKSPACE_OFFSET;
            const width = parseFloat(room.style.width) / z;
            const height = parseFloat(room.style.height) / z;
            if (logicalX >= left && logicalX <= left + width && logicalY >= top && logicalY <= top + height) {
                return room;
            }
        }
        return null;
    }
}
