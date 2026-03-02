export class AppState {
    constructor() {
        this.reset();
    }

    reset() {
        this.floors = [];
        this.activeFloorId = '';
        this.roomIdCounter = 0;
        this.selectedRooms = [];
        this.camera = {
            panX: 0,
            panY: 0,
            zoom: 1
        };
        // Nested rooms mapping: parentId -> array of child room ids
        this.nestedData = {};
    }

    addFloor(floor) {
        this.floors.push(floor);
    }

    deleteFloor(id) {
        const index = this.floors.findIndex(f => f.id === id);
        if (index !== -1) {
            this.floors.splice(index, 1);
            return true;
        }
        return false;
    }

    getFloorById(id) {
        return this.floors.find(f => f.id === id);
    }

    getFloorIndex(id) {
        return this.floors.findIndex(f => f.id === id);
    }

    getRoomById(id) {
        const rooms = Array.from(document.querySelectorAll('.room'));
        return rooms.find(r => r.id === id);
    }
}

export const state = new AppState();
