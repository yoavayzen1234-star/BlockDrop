"""
BlockDrop - RoomItem
"""
from __future__ import annotations
from PyQt6.QtCore import Qt, QRectF, QPointF, pyqtSignal, QObject
from PyQt6.QtGui import QPainter, QPen, QBrush, QColor, QFont, QFontMetrics, QCursor
from PyQt6.QtWidgets import QGraphicsRectItem, QGraphicsItem, QStyleOptionGraphicsItem
from block_drop.logic.engine import RoomData, ScaleContext

class RoomSignals(QObject):
    geometry_changed = pyqtSignal()
    selection_changed = pyqtSignal()

class RoomItem(QGraphicsRectItem):
    def __init__(self, room_data, scale_ctx, ghost=False):
        super().__init__(0, 0, room_data.width, room_data.height)
        self._data = room_data
        self._scale = scale_ctx
        self._ghost = ghost
        self.signals = RoomSignals()
        self.setPos(room_data.x, room_data.y)
        self.setRotation(room_data.rotation)
        if not ghost:
            self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemIsMovable)
            self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemIsSelectable)
            self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemSendsGeometryChanges)
        else:
            self.setOpacity(0.3)
        self._update_appearance()

    @property
    def room_data(self): return self._data

    def sync_data_from_item(self):
        self._data.x, self._data.y = self.pos().x(), self.pos().y()
        self._data.width, self._data.height = self.rect().width(), self.rect().height()
        self._data.rotation = self.rotation()

    def _update_appearance(self):
        c = QColor(self._data.get_color())
        if self._ghost: self.setBrush(QBrush(QColor(c.red(), c.green(), c.blue(), 40)))
        else: self.setBrush(QBrush(QColor(c.red(), c.green(), c.blue(), 60)))
        self.setPen(QPen(c, 2))

    def paint(self, painter, option, widget):
        super().paint(painter, option, widget)
        if self.isSelected():
            painter.setPen(QPen(Qt.GlobalColor.yellow, 2, Qt.PenStyle.DashLine))
            painter.drawRect(self.rect())
        painter.setPen(QPen(Qt.GlobalColor.white))
        painter.drawText(self.rect(), Qt.AlignmentFlag.AlignCenter, f"{self._data.name}\n{self._scale.format_area(self._data.area_px)}")

    def itemChange(self, change, value):
        if change == QGraphicsItem.GraphicsItemChange.ItemPositionHasChanged:
            self.signals.geometry_changed.emit()
        elif change == QGraphicsItem.GraphicsItemChange.ItemSelectedHasChanged:
            self.signals.selection_changed.emit()
        return super().itemChange(change, value)
