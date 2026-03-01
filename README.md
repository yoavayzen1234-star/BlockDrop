# SurferPlan Desktop 🏗️

Professional Desktop Application for Floor Planning and 3D Modeling.
Built with Electron, Three.js, and Node.js.

## Features
- **2D Editor**: Professional vector-based room drawing.
- **3D Engine**: Extruded 3D preview with stacking floor logic.
- **Local Storage**: Save and load projects locally as `.spp` files.
- **Multi-Floor Support**: Manage and stack multiple floors with custom heights.
- **Offline Mode**: 100% functional without internet connection.
- **Hardware Security**: Integrated machine fingerprinting for licensing.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (Recommended version 18+)

### Installation
```bash
npm install
```

### Run Locally (Development)
```bash
npm start
```

### Build for Windows (.exe)
```bash
npm run build
```

## Security & Storage
- **Local Files**: Projects are saved locally using the Electron dialog system.
- **Privacy**: No external tracking or server calls.
- **HWID**: Device fingerprinting enabled in the main process.

## Project Structure
- `main.js`: Main process handling windows and OS dialogs.
- `preload.js`: Secure bridge between main and renderer.
- `index.html`: UI structure and styles.
- `renderer.js`: UI logic and state management.
- `plan3d.engine.js`: 3D rendering engine.

---
©2026 SurferPlan
