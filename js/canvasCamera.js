/**
 * CanvasCamera - Infinite Canvas Pan & Zoom
 * All interactions use screenToLogical / logicalToScreen so coordinates are 1:1 with canvasZoom.
 */
export class CanvasCamera {
    constructor(wrapperEl, mainEl) {
        this.wrapper = wrapperEl;
        this.main = mainEl;

        this.panX = 0;
        this.panY = 0;
        /** @type {number} canvasZoom - scale factor for the canvas (1 = 100%) */
        this.zoom = 1;
        this.minZoom = 0.1;
        this.maxZoom = 5;

        this.isPanning = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this._transformRafId = null;
        this._rectCache = null;

        this.initEvents();
        this.updateTransform();
    }

    _getMainRect() {
        if (!this._rectCache) this._rectCache = this.main.getBoundingClientRect();
        return this._rectCache;
    }

    _invalidateRect() {
        this._rectCache = null;
    }

    /** Alias for zoom (canvasZoom in UI/docs) */
    get canvasZoom() {
        return this.zoom;
    }

    initEvents() {
        // Pan with Right Click, Middle Mouse or Shift + Left Mouse
        this.main.addEventListener('mousedown', (e) => {
            if (e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey)) {
                this.isPanning = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this.main.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });

        // Prevent context menu on right-click panning
        this.main.addEventListener('contextmenu', (e) => {
            if (this.isPanning || e.shiftKey) e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                const dx = e.clientX - this.lastMouseX;
                const dy = e.clientY - this.lastMouseY;
                this.panX += dx;
                this.panY += dy;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this.updateTransform();
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                this.main.style.cursor = '';
            }
        });

        // Zoom with Wheel
        this.main.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.applyZoom(delta, e.clientX, e.clientY);
        }, { passive: false });

        window.addEventListener('resize', () => this._invalidateRect());
    }

    applyZoom(factor, centerX, centerY) {
        const newZoom = Math.min(Math.max(this.zoom * factor, this.minZoom), this.maxZoom);
        if (newZoom === this.zoom) return;

        this._invalidateRect();
        const rect = this._getMainRect();
        const mouseX = centerX - rect.left;
        const mouseY = centerY - rect.top;

        // Adjust pan to keep internal point under cursor
        this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
        this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);

        this.zoom = newZoom;
        this.updateTransform();
    }

    updateTransform() {
        if (this._transformRafId !== null) return;
        this._transformRafId = requestAnimationFrame(() => {
            this._transformRafId = null;
            this.wrapper.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
            const zoomLabel = document.getElementById('zoom-level');
            if (zoomLabel) zoomLabel.innerText = Math.round(this.zoom * 100) + '%';
        });
    }

    /**
     * Center the view on the project origin (0,0 logical) at current zoom.
     * Use for "Center View" ⌖ button.
     */
    centerView() {
        const rect = this._getMainRect();
        this.panX = rect.width / 2;
        this.panY = rect.height / 2;
        this.updateTransform();
    }

    /**
     * Reset zoom to 100% and center view on project origin.
     */
    reset() {
        this.zoom = 1;
        this.centerView();
    }

    /**
     * Convert screen coordinates to logical canvas coordinates
     */
    screenToLogical(x, y) {
        const rect = this._getMainRect();
        return {
            x: (x - rect.left - this.panX) / this.zoom,
            y: (y - rect.top - this.panY) / this.zoom
        };
    }

    /**
     * Convert logical canvas coordinates to screen coordinates
     */
    logicalToScreen(x, y) {
        const rect = this._getMainRect();
        return {
            x: x * this.zoom + this.panX + rect.left,
            y: y * this.zoom + this.panY + rect.top
        };
    }
}
