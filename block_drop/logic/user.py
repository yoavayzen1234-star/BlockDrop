"""
BlockDrop - User Management
Handles user profile and session.
"""

from dataclasses import dataclass

@dataclass
class User:
    id: int
    name: str
    role: str = "Admin"

# Mock user for now
CURRENT_USER = User(id=1, name="יואב")

def get_current_user() -> User:
    return CURRENT_USER
