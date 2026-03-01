/**
 * CanvasCamera - Handles Infinite Canvas Pan & Zoom
 */
export class CanvasCamera {
    constructor(wrapperEl, mainEl) {
        this.wrapper = wrapperEl;
        this.main = mainEl;

        this.panX = 0;
        this.panY = 0;
        this.zoom = 1;
        this.minZoom = 0.1;
        this.maxZoom = 5;

        this.isPanning = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.initEvents();
        this.updateTransform();
    }

    initEvents() {
        // Pan with Middle Mouse or Shift + Left Mouse
        this.main.addEventListener('mousedown', (e) => {
            if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
                this.isPanning = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this.main.style.cursor = 'grabbing';
                e.preventDefault();
            }
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

        window.addEventListener('mouseup', () => {
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
    }

    applyZoom(factor, centerX, centerY) {
        const newZoom = Math.min(Math.max(this.zoom * factor, this.minZoom), this.maxZoom);
        if (newZoom === this.zoom) return;

        // Zoom towards mouse cursor
        const rect = this.main.getBoundingClientRect();
        const mouseX = centerX - rect.left;
        const mouseY = centerY - rect.top;

        // Adjust pan to keep internal point under cursor
        this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
        this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);

        this.zoom = newZoom;
        this.updateTransform();
    }

    updateTransform() {
        requestAnimationFrame(() => {
            this.wrapper.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
            const zoomLabel = document.getElementById('zoom-level');
            if (zoomLabel) zoomLabel.innerText = Math.round(this.zoom * 100) + '%';
        });
    }

    reset() {
        const rect = this.main.getBoundingClientRect();
        this.panX = rect.width / 2;
        this.panY = rect.height / 2;
        this.zoom = 1;
        this.updateTransform();
    }

    /**
     * Convert screen coordinates to logical canvas coordinates
     */
    screenToLogical(x, y) {
        const rect = this.main.getBoundingClientRect();
        return {
            x: (x - rect.left - this.panX) / this.zoom,
            y: (y - rect.top - this.panY) / this.zoom
        };
    }

    /**
     * Convert logical canvas coordinates to screen coordinates
     */
    logicalToScreen(x, y) {
        const rect = this.main.getBoundingClientRect();
        return {
            x: x * this.zoom + this.panX + rect.left,
            y: y * this.zoom + this.panY + rect.top
        };
    }
}
