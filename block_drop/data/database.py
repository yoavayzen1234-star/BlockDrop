"""
BlockDrop - SQLite Database Manager
Handles project save/load (.block files).
Device-locking and hardware registration have been removed.
"""

from __future__ import annotations
import sqlite3
import os
import time
from typing import Optional

from block_drop.logic.engine import RoomData, FloorData, RoomType


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS floors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT 'קומה',
    floor_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    floor_id INTEGER NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'חדר',
    room_type TEXT NOT NULL DEFAULT 'CUSTOM',
    x REAL NOT NULL DEFAULT 0,
    y REAL NOT NULL DEFAULT 0,
    width REAL NOT NULL DEFAULT 200,
    height REAL NOT NULL DEFAULT 150,
    rotation REAL NOT NULL DEFAULT 0,
    color TEXT,
    locked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    last_login REAL
);

CREATE TABLE IF NOT EXISTS project_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

class DatabaseManager:
    def __init__(self, filepath: Optional[str] = None):
        self._filepath = filepath
        self._conn: Optional[sqlite3.Connection] = None

    @property
    def is_open(self) -> bool:
        return self._conn is not None

    @property
    def filepath(self) -> Optional[str]:
        return self._filepath

    def create_new(self, filepath: str) -> None:
        self.close()
        self._filepath = filepath
        self._conn = sqlite3.connect(filepath)
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._conn.executescript(SCHEMA_SQL)
        self._conn.execute("INSERT INTO floors (name, floor_order) VALUES (?, ?)", ("קומת קרקע", 0))
        self._conn.commit()

    def open(self, filepath: str) -> None:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Project path not found: {filepath}")
        self.close()
        self._filepath = filepath
        self._conn = sqlite3.connect(filepath)
        self._conn.execute("PRAGMA foreign_keys = ON")

    def close(self) -> None:
        if self._conn:
            self._conn.commit()
            self._conn.close()
            self._conn = None

    def save(self) -> None:
        if self._conn:
            self._conn.commit()

    def get_floors(self) -> list[FloorData]:
        assert self._conn
        floors: list[FloorData] = []
        cursor = self._conn.execute("SELECT id, name, floor_order FROM floors ORDER BY floor_order")
        for row in cursor:
            floor = FloorData(id=row[0], name=row[1], order=row[2])
            floor.rooms = self._get_rooms_for_floor(floor.id)
            floors.append(floor)
        return floors

    def add_floor(self, name: str, order: int) -> int:
        assert self._conn
        cursor = self._conn.execute("INSERT INTO floors (name, floor_order) VALUES (?, ?)", (name, order))
        self._conn.commit()
        return cursor.lastrowid # type: ignore

    def _get_rooms_for_floor(self, floor_id: int) -> list[RoomData]:
        assert self._conn
        rooms: list[RoomData] = []
        cursor = self._conn.execute(
            "SELECT id, name, room_type, x, y, width, height, rotation, color, locked FROM rooms WHERE floor_id = ?",
            (floor_id,)
        )
        for row in cursor:
            try: rtype = RoomType[row[2]]
            except KeyError: rtype = RoomType.CUSTOM
            rooms.append(RoomData(
                id=row[0], name=row[1], room_type=rtype,
                x=row[3], y=row[4], width=row[5], height=row[6],
                rotation=row[7], floor_id=floor_id, color=row[8],
                locked=bool(row[9]),
            ))
        return rooms

    def save_room(self, room: RoomData) -> int:
        assert self._conn
        if room.id is not None:
            self._conn.execute(
                "UPDATE rooms SET floor_id=?, name=?, room_type=?, x=?, y=?, width=?, height=?, rotation=?, color=?, locked=? WHERE id=?",
                (room.floor_id, room.name, room.room_type.name, room.x, room.y, room.width, room.height, room.rotation, room.color, int(room.locked), room.id)
            )
            self._conn.commit()
            return room.id
        else:
            cursor = self._conn.execute(
                "INSERT INTO rooms (floor_id, name, room_type, x, y, width, height, rotation, color, locked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (room.floor_id, room.name, room.room_type.name, room.x, room.y, room.width, room.height, room.rotation, room.color, int(room.locked))
            )
            self._conn.commit()
            room.id = cursor.lastrowid
            return room.id # type: ignore
