import { SNAP_THRESHOLD } from './config.js';

/**
 * SnapEngine - Advanced Snapping Logic
 */
export class SnapEngine {
    constructor() {
        this.gridSize = 25; // Default grid size
    }

    /**
     * Snap a value to the nearest grid step
     */
    snapToGrid(val) {
        return Math.round(val / this.gridSize) * this.gridSize;
    }

    /**
     * Snap building logic for rooms
     * @param {Object} pos - Current logical position {x, y}
     * @param {Object} size - Room size {w, h}
     * @param {Array} otherRooms - Other rooms on same floor
     * @param {Number} zoom - Current camera zoom factor
     * @returns {Object} {x, y, guides} - Snapped position and guidance lines
     */
    snapRoom(pos, size, otherRooms, zoom) {
        let snappedX = pos.x;
        let snappedY = pos.y;
        let guides = { v: null, h: null };

        // Adjust threshold based on zoom level to maintain consistent screen-pixel snapping
        const threshold = SNAP_THRESHOLD / zoom;

        // Snap to grid if Alt NOT pressed
        if (!window.isAltPressed) {
            snappedX = this.snapToGrid(pos.x);
            snappedY = this.snapToGrid(pos.y);

            // Check other rooms for edge-to-edge snapping
            for (const other of otherRooms) {
                const ox = parseFloat(other.style.left);
                const oy = parseFloat(other.style.top);
                const ow = parseFloat(other.style.width);
                const oh = parseFloat(other.style.height);

                // Horizontal snap
                const leftDists = [
                    { diff: ox - pos.x, val: ox },                // Left to Left
                    { diff: (ox + ow) - pos.x, val: ox + ow },    // Left to Right
                    { diff: ox - (pos.x + size.w), val: ox - size.w },           // Right to Left
                    { diff: (ox + ow) - (pos.x + size.w), val: ox + ow - size.w } // Right to Right
                ];

                for (const d of leftDists) {
                    if (Math.abs(d.diff) < threshold) {
                        snappedX = d.val;
                        guides.v = (snappedX === d.val ? snappedX : snappedX + size.w);
                        break;
                    }
                }

                // Vertical snap
                const topDists = [
                    { diff: oy - pos.y, val: oy },                // Top to Top
                    { diff: (oy + oh) - pos.y, val: oy + oh },    // Top to Bottom
                    { diff: oy - (pos.y + size.h), val: oy - size.h },           // Bottom to Top
                    { diff: (oy + oh) - (pos.y + size.h), val: (oy + oh) - size.h } // Bottom to Bottom
                ];

                for (const d of topDists) {
                    if (Math.abs(d.diff) < threshold) {
                        snappedY = d.val;
                        guides.h = (snappedY === d.val ? snappedY : snappedY + size.h);
                        break;
                    }
                }
            }
        }

        return { x: snappedX, y: snappedY, guides };
    }

    /**
     * Snap rotation to 45 degree increments
     */
    snapRotation(angle) {
        const threshold = 5; // Degrees
        const steps = [0, 45, 90, 135, 180, 225, 270, 315, 360];
        for (const step of steps) {
            if (Math.abs((angle % 360) - step) < threshold) return step;
        }
        return angle;
    }
}
