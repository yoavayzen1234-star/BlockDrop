"""
BlockDrop - Main Window
Professional RTL Hebrew layout with sidebar and floor management.
"""
from __future__ import annotations
import os
import sys
from typing import Optional

from PyQt6.QtCore import Qt, QTimer, QSize
from PyQt6.QtGui import QAction, QIcon, QFont, QColor, QKeySequence
from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QSplitter, QTabWidget, 
    QToolBar, QStatusBar, QLabel, QPushButton, QComboBox, QDoubleSpinBox,
    QLineEdit, QGroupBox, QScrollArea, QFileDialog, QMessageBox, QFrame
)

from block_drop.logic.engine import (
    RoomData, FloorData, RoomType, ScaleContext, Unit,
    ROOM_STANDARDS, validate_floor
)
from block_drop.data.database import DatabaseManager
from block_drop.ui.canvas import PlanCanvas, PlanScene

DARK_STYLE = """
QMainWindow { background-color: #0f0f23; color: #e0e0e0; }
QWidget { font-family: 'Segoe UI', sans-serif; font-size: 13px; color: #e0e0e0; }
QToolBar { background-color: #16162b; border-bottom: 1px solid #2a2a4a; padding: 4px; }
QPushButton { background-color: #2a2a4a; border: 1px solid #3a3a6a; border-radius: 8px; padding: 8px; }
QPushButton#primary { background: #4a90d9; color: white; font-weight: bold; }
QGroupBox { font-weight: bold; border: 1px solid #2a2a4a; border-radius: 8px; margin-top: 12px; padding: 10px; }
QLineEdit, QDoubleSpinBox, QComboBox { background-color: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 6px; padding: 5px; }
"""

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self._db = DatabaseManager()
        self._scale = ScaleContext()
        self._floors = [FloorData(id=0, name="קומת קרקע", order=0)]
        self._current_floor_idx = 0
        
        self.setWindowTitle("BlockDrop")
        self.resize(1200, 800)
        self.setLayoutDirection(Qt.LayoutDirection.RightToLeft)
        self.setStyleSheet(DARK_STYLE)

        self._scene = PlanScene(self._scale)
        self._canvas = PlanCanvas(self._scene)
        
        self._setup_ui()
        self._load_current_floor()

    def _setup_ui(self):
        central = QWidget()
        self.setCentralWidget(central)
        layout = QHBoxLayout(central)

        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        # Sidebar
        sidebar = QWidget(); sidebar.setFixedWidth(320)
        side_layout = QVBoxLayout(sidebar)
        
        logo = QLabel("🏗️ BlockDrop")
        logo.setStyleSheet("font-size: 18px; font-weight: bold; color: #4a90d9; padding: 10px;")
        side_layout.addWidget(logo)

        # Room Creation
        add_group = QGroupBox("הוספת חדר")
        add_form = QVBoxLayout(add_group)
        
        self._room_type_combo = QComboBox()
        for rt in RoomType:
            self._room_type_combo.addItem(ROOM_STANDARDS.get(rt, {}).get("label", rt.value), rt)
        add_form.addWidget(QLabel("סוג חדר:"))
        add_form.addWidget(self._room_type_combo)

        self._room_name_input = QLineEdit("חדר חדש")
        add_form.addWidget(QLabel("שם:"))
        add_form.addWidget(self._room_name_input)

        add_btn = QPushButton("➕ הוסף חדר")
        add_btn.setObjectName("primary")
        add_btn.clicked.connect(self._add_room)
        add_form.addWidget(add_btn)
        
        side_layout.addWidget(add_group)
        
        # Summary
        summary_group = QGroupBox("סיכום")
        self._summary_label = QLabel("חדרים: 0\nשטח כולל: 0 מ\"ר")
        summary_group.layout().addWidget(self._summary_label) if summary_group.layout() else summary_group.setLayout(QVBoxLayout())
        summary_group.layout().addWidget(self._summary_label)
        side_layout.addWidget(summary_group)

        side_layout.addStretch()
        
        # Editor Area
        editor_area = QWidget()
        editor_layout = QVBoxLayout(editor_area)
        self._tabs = QTabWidget()
        self._tabs.addTab(QWidget(), "קומת קרקע")
        editor_layout.addWidget(self._tabs)
        editor_layout.addWidget(self._canvas)
        
        splitter.addWidget(editor_area)
        splitter.addWidget(sidebar)
        layout.addWidget(splitter)

        # Toolbar
        self._create_toolbar()

    def _create_toolbar(self):
        tb = self.addToolBar("קובץ")
        new_act = QAction("📄 חדש", self); new_act.triggered.connect(self._new_project); tb.addAction(new_act)
        save_act = QAction("💾 שמור", self); save_act.triggered.connect(self._save_project); tb.addAction(save_act)
        tb.addSeparator()
        zoom_fit = QAction("⊞ התאם", self); zoom_fit.triggered.connect(self._canvas.zoom_to_fit); tb.addAction(zoom_fit)

    def _add_room(self):
        rtype = self._room_type_combo.currentData()
        name = self._room_name_input.text()
        rd = RoomData(name=name, room_type=rtype, x=100, y=100, width=200, height=150)
        self._scene.add_room(rd)
        self._update_summary()

    def _load_current_floor(self):
        self._scene.load_floor(self._floors[self._current_floor_idx])
        self._update_summary()

    def _update_summary(self):
        rooms = self._scene.room_items
        area = sum(r.room_data.area_px for r in rooms)
        self._summary_label.setText(f"חדרים: {len(rooms)}\nשטח כולל: {self._scale.format_area(area)}")

    def _new_project(self):
        self._scene.load_floor(FloorData())
        self._update_summary()

    def _save_project(self):
        path, _ = QFileDialog.getSaveFileName(self, "שמור פרויקט", "", "BlockDrop (*.block)")
        if path:
            self._db.create_new(path)
            for r in self._scene.get_all_room_data():
                r.floor_id = 0
                self._db.save_room(r)
            self._db.close()
            QMessageBox.information(self, "הצלחה", "הפרויקט נשמר בהצלחה!")
