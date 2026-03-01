"""
BlockDrop - Calculation & Standards Engine
Handles area calculations, unit conversions, and Hebrew building standards.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
import math


class Unit(Enum):
    METERS = "מטרים"
    CENTIMETERS = "סנטימטרים"
    FEET = "רגל"
    INCHES = "אינצ׳"


class RoomType(Enum):
    LIVING_ROOM = "סלון"
    BEDROOM = "חדר שינה"
    KITCHEN = "מטבח"
    BATHROOM = "חדר אמבטיה"
    TOILET = "שירותים"
    BALCONY = "מרפסת"
    STORAGE = "מחסן"
    CORRIDOR = "מסדרון"
    OFFICE = "משרד"
    LAUNDRY = "חדר כביסה"
    CUSTOM = "מותאם אישית"


# Hebrew building standards (Israeli Standard SI 1045)
ROOM_STANDARDS: dict[RoomType, dict] = {
    RoomType.LIVING_ROOM: {
        "min_area_m2": 20.0,
        "min_width_m": 3.3,
        "min_height_m": 2.5,
        "label": "סלון",
        "color": "#4A90D9",
    },
    RoomType.BEDROOM: {
        "min_area_m2": 8.0,
        "min_width_m": 2.6,
        "min_height_m": 2.5,
        "label": "חדר שינה",
        "color": "#7B68EE",
    },
    RoomType.KITCHEN: {
        "min_area_m2": 6.0,
        "min_width_m": 1.7,
        "min_height_m": 2.5,
        "label": "מטבח",
        "color": "#E8A838",
    },
    RoomType.BATHROOM: {
        "min_area_m2": 3.5,
        "min_width_m": 1.5,
        "min_height_m": 2.5,
        "label": "חדר אמבטיה",
        "color": "#5BC0DE",
    },
    RoomType.TOILET: {
        "min_area_m2": 1.1,
        "min_width_m": 0.8,
        "min_height_m": 2.2,
        "label": "שירותים",
        "color": "#5BC0AA",
    },
    RoomType.BALCONY: {
        "min_area_m2": 4.0,
        "min_width_m": 1.2,
        "min_height_m": 2.2,
        "label": "מרפסת",
        "color": "#8BC34A",
    },
    RoomType.STORAGE: {
        "min_area_m2": 1.5,
        "min_width_m": 1.0,
        "min_height_m": 2.0,
        "label": "מחסן",
        "color": "#9E9E9E",
    },
    RoomType.CORRIDOR: {
        "min_area_m2": 0.0,
        "min_width_m": 0.9,
        "min_height_m": 2.2,
        "label": "מסדרון",
        "color": "#BDBDBD",
    },
    RoomType.OFFICE: {
        "min_area_m2": 7.0,
        "min_width_m": 2.3,
        "min_height_m": 2.5,
        "label": "משרד",
        "color": "#FF7043",
    },
    RoomType.LAUNDRY: {
        "min_area_m2": 2.0,
        "min_width_m": 1.2,
        "min_height_m": 2.2,
        "label": "חדר כביסה",
        "color": "#AB47BC",
    },
    RoomType.CUSTOM: {
        "min_area_m2": 0.0,
        "min_width_m": 0.0,
        "min_height_m": 0.0,
        "label": "מותאם אישית",
        "color": "#78909C",
    },
}

# Default colors palette for automatic room coloring
ROOM_COLORS = [
    "#4A90D9", "#7B68EE", "#E8A838", "#5BC0DE", "#8BC34A",
    "#FF7043", "#AB47BC", "#26A69A", "#EF5350", "#42A5F5",
    "#66BB6A", "#FFA726", "#EC407A", "#5C6BC0", "#29B6F6",
]


# ────────────────────────────────────────────────────────
#  Conversion factors
# ────────────────────────────────────────────────────────
_TO_METERS = {
    Unit.METERS: 1.0,
    Unit.CENTIMETERS: 0.01,
    Unit.FEET: 0.3048,
    Unit.INCHES: 0.0254,
}


def convert_length(value: float, from_unit: Unit, to_unit: Unit) -> float:
    """Convert a length value between units."""
    meters = value * _TO_METERS[from_unit]
    return meters / _TO_METERS[to_unit]


def convert_area(value: float, from_unit: Unit, to_unit: Unit) -> float:
    """Convert an area value between units (squared)."""
    sq_meters = value * (_TO_METERS[from_unit] ** 2)
    return sq_meters / (_TO_METERS[to_unit] ** 2)


# ────────────────────────────────────────────────────────
#  Pixel ↔ Real-world mapping
# ────────────────────────────────────────────────────────
DEFAULT_PIXELS_PER_METER = 50.0  # 1 meter = 50 pixels on canvas


@dataclass
class ScaleContext:
    """Manages the mapping between pixel coordinates and real-world units."""
    pixels_per_meter: float = DEFAULT_PIXELS_PER_METER
    display_unit: Unit = Unit.METERS

    def px_to_m(self, px: float) -> float:
        return px / self.pixels_per_meter

    def m_to_px(self, m: float) -> float:
        return m * self.pixels_per_meter

    def px_to_display(self, px: float) -> float:
        meters = self.px_to_m(px)
        return convert_length(meters, Unit.METERS, self.display_unit)

    def display_to_px(self, val: float) -> float:
        meters = convert_length(val, self.display_unit, Unit.METERS)
        return self.m_to_px(meters)

    def area_px_to_display(self, area_px: float) -> float:
        area_m2 = area_px / (self.pixels_per_meter ** 2)
        return convert_area(area_m2, Unit.METERS, self.display_unit)

    def format_length(self, px: float, decimals: int = 2) -> str:
        val = self.px_to_display(px)
        return f"{val:.{decimals}f} {self.display_unit.value}"

    def format_area(self, area_px: float, decimals: int = 2) -> str:
        val = self.area_px_to_display(area_px)
        unit_label = self.display_unit.value
        return f"{val:.{decimals}f} {unit_label}²"


# ────────────────────────────────────────────────────────
#  Room data model
# ────────────────────────────────────────────────────────
@dataclass
class RoomData:
    """Pure data representation of a room (no Qt dependencies)."""
    id: Optional[int] = None
    name: str = "חדר"
    room_type: RoomType = RoomType.CUSTOM
    x: float = 0.0
    y: float = 0.0
    width: float = 200.0
    height: float = 150.0
    rotation: float = 0.0
    floor_id: int = 0
    color: Optional[str] = None
    locked: bool = False

    @property
    def area_px(self) -> float:
        return self.width * self.height

    def area_m2(self, scale: ScaleContext) -> float:
        return self.area_px / (scale.pixels_per_meter ** 2)

    def width_m(self, scale: ScaleContext) -> float:
        return self.width / scale.pixels_per_meter

    def height_m(self, scale: ScaleContext) -> float:
        return self.height / scale.pixels_per_meter

    def get_color(self) -> str:
        if self.color:
            return self.color
        std = ROOM_STANDARDS.get(self.room_type)
        return std["color"] if std else "#78909C"


@dataclass
class FloorData:
    """Pure data representation of a floor."""
    id: int = 0
    name: str = "קומה 0"
    order: int = 0
    rooms: list[RoomData] = field(default_factory=list)

    @property
    def total_area_px(self) -> float:
        return sum(r.area_px for r in self.rooms)


# ────────────────────────────────────────────────────────
#  Standards validation
# ────────────────────────────────────────────────────────
@dataclass
class ValidationResult:
    passed: bool
    message: str
    rule_name: str


def validate_room(room: RoomData, scale: ScaleContext) -> list[ValidationResult]:
    """Validate a room against Israeli building standards (SI 1045)."""
    results: list[ValidationResult] = []
    std = ROOM_STANDARDS.get(room.room_type)
    if not std or room.room_type == RoomType.CUSTOM:
        return results

    # Area check
    area = room.area_m2(scale)
    min_area = std["min_area_m2"]
    if min_area > 0:
        passed = area >= min_area
        # Fix: avoid backslash in f-string expression
        status_ok = '✓ עומד בתקן'
        status_fail = f'✗ מינימום {min_area} מ"ר'
        status_msg = status_ok if passed else status_fail
        results.append(ValidationResult(
            passed=passed,
            message=f"שטח {room.name}: {area:.1f} מ\"ר ({status_msg})",
            rule_name="בדיקת שטח מינימלי"
        ))

    # Width check (minimum dimension)
    w = room.width_m(scale)
    h = room.height_m(scale)
    min_dim = min(w, h)
    min_width = std["min_width_m"]
    if min_width > 0:
        passed = min_dim >= min_width
        # Fix: avoid backslash in f-string expression
        status_ok = '✓ עומד בתקן'
        status_fail = f'✗ מינימום {min_width} מ"'
        status_msg = status_ok if passed else status_fail
        results.append(ValidationResult(
            passed=passed,
            message=f"רוחב מינימלי {room.name}: {min_dim:.2f} מ' ({status_msg})",
            rule_name="בדיקת רוחב מינימלי"
        ))

    return results


def validate_floor(floor: FloorData, scale: ScaleContext) -> list[ValidationResult]:
    """Validate all rooms on a floor."""
    results: list[ValidationResult] = []
    for room in floor.rooms:
        results.extend(validate_room(room, scale))
    return results


# ────────────────────────────────────────────────────────
#  Room splitting
# ────────────────────────────────────────────────────────
def split_room_horizontal(room: RoomData, ratio: float = 0.5) -> tuple[RoomData, RoomData]:
    """Split a room horizontally into two rooms."""
    h1 = room.height * ratio
    h2 = room.height * (1 - ratio)

    top = RoomData(
        name=f"{room.name} א",
        room_type=room.room_type,
        x=room.x, y=room.y,
        width=room.width, height=h1,
        floor_id=room.floor_id,
        color=room.color,
    )
    bottom = RoomData(
        name=f"{room.name} ב",
        room_type=room.room_type,
        x=room.x, y=room.y + h1,
        width=room.width, height=h2,
        floor_id=room.floor_id,
        color=room.color,
    )
    return top, bottom


def split_room_vertical(room: RoomData, ratio: float = 0.5) -> tuple[RoomData, RoomData]:
    """Split a room vertically into two rooms."""
    w1 = room.width * ratio
    w2 = room.width * (1 - ratio)

    left = RoomData(
        name=f"{room.name} א",
        room_type=room.room_type,
        x=room.x, y=room.y,
        width=w1, height=room.height,
        floor_id=room.floor_id,
        color=room.color,
    )
    right = RoomData(
        name=f"{room.name} ב",
        room_type=room.room_type,
        x=room.x + w1, y=room.y,
        width=w2, height=room.height,
        floor_id=room.floor_id,
        color=room.color,
    )
    return left, right
