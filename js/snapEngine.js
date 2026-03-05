import { SNAP_THRESHOLD, SCALE } from './config.js';

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
        const guideV = [];
        const guideH = [];

        const threshold = SNAP_THRESHOLD / zoom;
        const addV = (x) => { if (guideV.indexOf(x) === -1) guideV.push(x); };
        const addH = (y) => { if (guideH.indexOf(y) === -1) guideH.push(y); };
        /** Round logical coords so (WORKSPACE_OFFSET + val) * zoom gives stable pixels */
        const roundLogical = (v) => Math.round(v * 1e4) / 1e4;

        // Bypass snapping when Alt is held
        if (!window.isAltPressed) {
            snappedX = this.snapToGrid(pos.x);
            snappedY = this.snapToGrid(pos.y);

            // Collect all candidate edges within threshold; snap to the closest for pixel-perfect alignment
            let bestX = { dist: threshold, val: snappedX, lineVal: null };
            let bestY = { dist: threshold, val: snappedY, lineVal: null };
            for (const other of otherRooms) {
                const ox = other.left != null ? other.left : parseFloat(other.style?.left);
                const oy = other.top != null ? other.top : parseFloat(other.style?.top);
                const ow = other.width != null ? other.width : parseFloat(other.style?.width);
                const oh = other.height != null ? other.height : parseFloat(other.style?.height);

                const leftDists = [
                    { diff: ox - pos.x, val: ox, lineVal: ox },
                    { diff: (ox + ow) - pos.x, val: ox + ow, lineVal: ox + ow },
                    { diff: ox - (pos.x + size.w), val: ox - size.w, lineVal: ox },
                    { diff: (ox + ow) - (pos.x + size.w), val: ox + ow - size.w, lineVal: ox + ow }
                ];
                for (const d of leftDists) {
                    const ad = Math.abs(d.diff);
                    if (ad < bestX.dist) {
                        bestX = { dist: ad, val: d.val, lineVal: d.lineVal };
                    }
                }

                const topDists = [
                    { diff: oy - pos.y, val: oy, lineVal: oy },
                    { diff: (oy + oh) - pos.y, val: oy + oh, lineVal: oy + oh },
                    { diff: oy - (pos.y + size.h), val: oy - size.h, lineVal: oy },
                    { diff: (oy + oh) - (pos.y + size.h), val: (oy + oh) - size.h, lineVal: oy + oh }
                ];
                for (const d of topDists) {
                    const ad = Math.abs(d.diff);
                    if (ad < bestY.dist) {
                        bestY = { dist: ad, val: d.val, lineVal: d.lineVal };
                    }
                }
            }
            if (bestX.dist < threshold) {
                snappedX = roundLogical(bestX.val);
                if (bestX.lineVal != null) addV(roundLogical(bestX.lineVal));
            }
            if (bestY.dist < threshold) {
                snappedY = roundLogical(bestY.val);
                if (bestY.lineVal != null) addH(roundLogical(bestY.lineVal));
            }

            // Collect all aligned edges for guide lines (all sides) — rounded for laser accuracy
            const myLeft = snappedX;
            const myRight = snappedX + size.w;
            const myTop = snappedY;
            const myBottom = snappedY + size.h;
            for (const other of otherRooms) {
                const ox = other.left != null ? other.left : parseFloat(other.style?.left);
                const oy = other.top != null ? other.top : parseFloat(other.style?.top);
                const ow = other.width != null ? other.width : parseFloat(other.style?.width);
                const oh = other.height != null ? other.height : parseFloat(other.style?.height);
                if (Math.abs(myLeft - ox) < threshold || Math.abs(myLeft - (ox + ow)) < threshold) addV(roundLogical(myLeft));
                if (Math.abs(myRight - ox) < threshold || Math.abs(myRight - (ox + ow)) < threshold) addV(roundLogical(myRight));
                if (Math.abs(myTop - oy) < threshold || Math.abs(myTop - (oy + oh)) < threshold) addH(roundLogical(myTop));
                if (Math.abs(myBottom - oy) < threshold || Math.abs(myBottom - (oy + oh)) < threshold) addH(roundLogical(myBottom));
            }
        }

        return { x: snappedX, y: snappedY, guides: { v: guideV, h: guideH } };
    }

    /**
     * Return guide line positions for a given rect (e.g. during resize).
     * @param {number} left - room left (px)
     * @param {number} top - room top (px)
     * @param {number} width - room width (px)
     * @param {number} height - room height (px)
     * @param {HTMLElement[]} otherRooms - other room elements on same floor
     * @param {number} zoom - camera zoom
     * @returns {{ v: number[], h: number[] }}
     */
    /** left/top/width/height and otherRooms .style are in display pixels (crisp zoom). */
    getGuideLines(left, top, width, height, otherRooms, zoom) {
        const guideV = [];
        const guideH = [];
        const threshold = SNAP_THRESHOLD;
        const addV = (x) => { if (guideV.indexOf(x) === -1) guideV.push(x); };
        const addH = (y) => { if (guideH.indexOf(y) === -1) guideH.push(y); };

        if (window.isAltPressed) return { v: guideV, h: guideH };

        const myLeft = left;
        const myRight = left + width;
        const myTop = top;
        const myBottom = top + height;

        const roundPx = (v) => Math.round(v);
        for (const other of otherRooms) {
            const ox = parseFloat(other.style.left);
            const oy = parseFloat(other.style.top);
            const ow = parseFloat(other.style.width);
            const oh = parseFloat(other.style.height);
            if (Math.abs(myLeft - ox) < threshold || Math.abs(myLeft - (ox + ow)) < threshold) addV(roundPx(myLeft));
            if (Math.abs(myRight - ox) < threshold || Math.abs(myRight - (ox + ow)) < threshold) addV(roundPx(myRight));
            if (Math.abs(myTop - oy) < threshold || Math.abs(myTop - (oy + oh)) < threshold) addH(roundPx(myTop));
            if (Math.abs(myBottom - oy) < threshold || Math.abs(myBottom - (oy + oh)) < threshold) addH(roundPx(myBottom));
        }
        return { v: guideV, h: guideH };
    }

    /**
     * Snap the moving edge during resize so it "stops" on alignment (laser line).
     * @param {number} desiredLeft - desired left (px) from mouse
     * @param {number} desiredTop - desired top (px) from mouse
     * @param {number} desiredWidth - desired width (px) from mouse
     * @param {number} desiredHeight - desired height (px) from mouse
     * @param {'r'|'l'|'t'|'b'} side - which edge is being dragged
     * @param {HTMLElement[]} otherRooms - other room elements
     * @param {number} zoom - camera zoom
     * @returns {{ left: number, top: number, width: number, height: number }}
     */
    /** desired* and otherRooms .style are in display pixels (crisp zoom). */
    snapResizeEdge(desiredLeft, desiredTop, desiredWidth, desiredHeight, side, otherRooms, zoom) {
        const minPx = SCALE * (zoom || 1);
        const threshold = SNAP_THRESHOLD;
        let outLeft = desiredLeft, outTop = desiredTop, outW = desiredWidth, outH = desiredHeight;

        if (window.isAltPressed) return { left: outLeft, top: outTop, width: outW, height: outH };

        const targetsV = [];
        const targetsH = [];
        for (const other of otherRooms) {
            const ox = parseFloat(other.style.left);
            const oy = parseFloat(other.style.top);
            const ow = parseFloat(other.style.width);
            const oh = parseFloat(other.style.height);
            targetsV.push(ox, ox + ow);
            targetsH.push(oy, oy + oh);
        }

        const findClosest = (val, targets) => {
            let best = null, bestDist = threshold;
            for (const t of targets) {
                const d = Math.abs(val - t);
                if (d < bestDist) { bestDist = d; best = t; }
            }
            return best;
        };

        const roundPx = (v) => Math.round(v);
        if (side === 'r') {
            const desiredRight = desiredLeft + desiredWidth;
            const snapped = findClosest(desiredRight, targetsV);
            if (snapped != null) outW = Math.max(minPx, roundPx(snapped - desiredLeft));
        } else if (side === 'l') {
            const snapped = findClosest(desiredLeft, targetsV);
            if (snapped != null) {
                outLeft = roundPx(snapped);
                outW = Math.max(minPx, roundPx((desiredLeft + desiredWidth) - snapped));
            }
        } else if (side === 'b') {
            const desiredBottom = desiredTop + desiredHeight;
            const snapped = findClosest(desiredBottom, targetsH);
            if (snapped != null) outH = Math.max(minPx, roundPx(snapped - desiredTop));
        } else if (side === 't') {
            const snapped = findClosest(desiredTop, targetsH);
            if (snapped != null) {
                outTop = roundPx(snapped);
                outH = Math.max(minPx, roundPx((desiredTop + desiredHeight) - snapped));
            }
        }

        return { left: outLeft, top: outTop, width: outW, height: outH };
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
