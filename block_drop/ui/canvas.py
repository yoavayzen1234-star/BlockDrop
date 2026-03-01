"""
BlockDrop - 2D Floor Plan Canvas
"""
from __future__ import annotations
from PyQt6.QtCore import Qt, QPointF, QRectF, QLineF, pyqtSignal, QTimer
from PyQt6.QtGui import QPainter, QPen, QBrush, QColor, QWheelEvent, QMouseEvent, QKeyEvent
from PyQt6.QtWidgets import QGraphicsView, QGraphicsScene, QGraphicsLineItem
from block_drop.logic.engine import RoomData, FloorData, ScaleContext
from block_drop.ui.components import RoomItem

class SnapGuide(QGraphicsLineItem):
    def __init__(self):
        super().__init__()
        pen = QPen(QColor("#00BFFF"), 1, Qt.PenStyle.DashLine)
        pen.setDashPattern([5, 5])
        self.setPen(pen)
        self.setZValue(1000)
        self.hide()

class PlanScene(QGraphicsScene):
    room_added = pyqtSignal(object)
    room_removed = pyqtSignal(object)
    room_changed = pyqtSignal(object)
    selection_changed_room = pyqtSignal(object)
    SNAP_THRESHOLD = 10.0
    GRID_SIZE = 25.0

    def __init__(self, scale_ctx: ScaleContext, parent=None):
        super().__init__(parent)
        self._scale = scale_ctx
        self._room_items = []
        self._ghost_items = []
        self._snap_guides = []
        self._show_grid = True
        self._snap_enabled = True
        for _ in range(10):
            guide = SnapGuide()
            self._snap_guides.append(guide)
            self.addItem(guide)
        self.setSceneRect(-2000, -2000, 6000, 6000)

    @property
    def room_items(self): return self._room_items

    def drawBackground(self, painter, rect):
        painter.fillRect(rect, QColor("#1a1a2e"))
        if not self._show_grid: return
        grid = self.GRID_SIZE
        pen = QPen(QColor(255, 255, 255, 15), 0.5)
        painter.setPen(pen)
        l, t = int(rect.left()), int(rect.top())
        for x in range(l - (l%int(grid)), int(rect.right()), int(grid)):
            painter.drawLine(QPointF(x, rect.top()), QPointF(x, rect.bottom()))
        for y in range(t - (t%int(grid)), int(rect.bottom()), int(grid)):
            painter.drawLine(QPointF(rect.left(), y), QPointF(rect.right(), y))

    def add_room(self, room_data):
        item = RoomItem(room_data, self._scale)
        item.signals.geometry_changed.connect(lambda: self.room_changed.emit(item))
        item.signals.selection_changed.connect(lambda: self.selection_changed_room.emit(item if item.isSelected() else None))
        self.addItem(item)
        self._room_items.append(item)
        return item

    def remove_room(self, item):
        if item in self._room_items:
            self._room_items.remove(item)
            self.removeItem(item)
            self.room_removed.emit(item)

    def load_floor(self, floor, ghost_floors=None):
        for it in self._room_items + self._ghost_items: self.removeItem(it)
        self._room_items.clear(); self._ghost_items.clear()
        if ghost_floors:
            for gf in ghost_floors:
                for rd in gf.rooms:
                    gi = RoomItem(rd, self._scale, ghost=True)
                    self.addItem(gi); self._ghost_items.append(gi)
        for rd in floor.rooms: self.add_room(rd)

    def get_all_room_data(self):
        for it in self._room_items: it.sync_data_from_item()
        return [it.room_data for it in self._room_items]

    def selected_room(self):
        for it in self._room_items:
            if it.isSelected(): return it
        return None

    def set_grid_visible(self, v): self._show_grid = v; self.update()
    def set_snap_enabled(self, v): self._snap_enabled = v

class PlanCanvas(QGraphicsView):
    zoom_changed = pyqtSignal(float)
    cursor_position = pyqtSignal(float, float)

    def __init__(self, scene, parent=None):
        super().__init__(scene, parent)
        self._zoom = 1.0
        self.setRenderHints(QPainter.RenderHint.Antialiasing | QPainter.RenderHint.SmoothPixmapTransform)
        self.setTransformationAnchor(QGraphicsView.ViewportAnchor.AnchorUnderMouse)
        self.setStyleSheet("border: none; background: #1a1a2e;")

    def wheelEvent(self, event):
        f = 1.15 if event.angleDelta().y() > 0 else 1/1.15
        self.scale(f, f); self._zoom *= f
        self.zoom_changed.emit(self._zoom)

    def zoom_to_fit(self):
        r = self.scene().itemsBoundingRect()
        if not r.isNull(): self.fitInView(r.adjusted(-50,-50,50,50), Qt.AspectRatioMode.KeepAspectRatio)

    def mouseMoveEvent(self, event):
        sp = self.mapToScene(event.position().toPoint())
        self.cursor_position.emit(sp.x(), sp.y())
        super().mouseMoveEvent(event)
