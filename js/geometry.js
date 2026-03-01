export function getRoomCorners(room, customX = null, customY = null) {
    const w = parseFloat(room.style.width);
    const h = parseFloat(room.style.height);
    const cx = (customX !== null ? customX : room.offsetLeft) + w / 2;
    const cy = (customY !== null ? customY : room.offsetTop) + h / 2;
    const rad = (parseFloat(room.dataset.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const corners = [
        { x: -w / 2, y: -h / 2 },
        { x: w / 2, y: -h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w / 2, y: h / 2 }
    ];
    return corners.map(p => ({
        x: cx + p.x * cos - p.y * sin,
        y: cy + p.x * sin + p.y * cos
    }));
}

export function rotatePoint(x, y, cx, cy, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const nx = (cos * (x - cx)) + (sin * (y - cy)) + cx;
    const ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
    return { x: nx, y: ny };
}
