/**
 * RoomModel - Handles room data and polygon logic
 */
export class RoomModel {
    constructor(data = {}) {
        this.id = data.id || `room-${Date.now()}`;
        this.name = data.name || "חדר";
        this.floorId = data.floorId || "";
        this.color = data.color || "#ffffff";
        this.customHeight = data.customHeight || null;
        this.rotationDeg = parseFloat(data.rotationDeg || 0);

        // Rectangle Fallback
        this.leftPx = parseFloat(data.leftPx || 0);
        this.topPx = parseFloat(data.topPx || 0);
        this.widthPx = parseFloat(data.widthPx || 100);
        this.heightPx = parseFloat(data.heightPx || 100);

        // Polygon Support
        this.outer = data.outer || null; // Array of points {x,y}
        this.holes = data.holes || [];  // Array of arrays of points
    }

    /**
     * Get bounding box for the room
     */
    getBounds() {
        if (!this.outer) {
            return {
                left: this.leftPx,
                top: this.topPx,
                right: this.leftPx + this.widthPx,
                bottom: this.topPx + this.heightPx
            };
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        this.outer.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });
        return { left: minX, top: minY, right: maxX, bottom: maxY };
    }

    /**
     * Calculate room area
     */
    calculateArea() {
        if (!this.outer) {
            return (this.widthPx * this.heightPx) / 10000; // Simplified scale
        }

        // Shoelace formula for polygon area
        let area = 0;
        for (let i = 0; i < this.outer.length; i++) {
            const current = this.outer[i];
            const next = this.outer[(i + 1) % this.outer.length];
            area += current.x * next.y - next.x * current.y;
        }

        // Subtract holes if needed
        return Math.abs(area) / 20000; // Simplified scale
    }
}
