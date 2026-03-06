export const SCALE = 12;
export const SNAP_THRESHOLD = 8;
export const WORKSPACE_SIZE = 50000;
/** Round logical coords to this precision so 2D, 3D and save/load stay in sync. */
export const LOGICAL_PRECISION = 1e6;
export function roundLogical(v) {
    return Number.isFinite(v) ? Math.round(Number(v) * LOGICAL_PRECISION) / LOGICAL_PRECISION : v;
}
/**
 * Global origin: center of infinite canvas. Logical (0,0) = CSS (WORKSPACE_OFFSET, WORKSPACE_OFFSET).
 * WORKSPACE_OFFSET is applied once when converting logical → display (room style.left/top).
 * Do not apply any additional per-floor or per-room origin offset.
 */
export const WORKSPACE_OFFSET = WORKSPACE_SIZE / 2;

/**
 * Circle radius in logical pixels from area in m². Single formula for all floors:
 *   radius = Math.sqrt(area / Math.PI) * SCALE
 */
export function areaM2ToCircleRadiusPx(areaM2) {
    if (!Number.isFinite(areaM2) || areaM2 <= 0) return SCALE * Math.sqrt(25 / Math.PI);
    return Math.sqrt(areaM2 / Math.PI) * SCALE;
}

/**
 * Circle diameter in logical pixels (2 * radius). Same SCALE for all floors.
 */
export function areaM2ToCircleDiameterPx(areaM2) {
    return 2 * areaM2ToCircleRadiusPx(areaM2);
}

/**
 * Square side length in logical pixels from area in m². area = sideM² ⇒ sidePx = sideM*SCALE.
 */
export function areaM2ToSquareSidePx(areaM2) {
    if (!Number.isFinite(areaM2) || areaM2 <= 0) return SCALE * 5; // fallback 60px
    return Math.sqrt(areaM2) * SCALE;
}

/** Circle diameter in meters from area in m². radius = sqrt(area/π), diameter = 2*radius. */
export function areaM2ToCircleDiameterM(areaM2) {
    if (!Number.isFinite(areaM2) || areaM2 <= 0) return 2 * Math.sqrt(25 / Math.PI);
    return 2 * Math.sqrt(areaM2 / Math.PI);
}

/** Escape for safe use in HTML text (not attributes). */
export function escapeHtml(s) {
    if (s == null) return '';
    const t = String(s);
    return t
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
