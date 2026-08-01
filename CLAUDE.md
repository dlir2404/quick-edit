# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Install**: `npm install`
- **Development Server**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint` (runs Oxlint using `.oxlintrc.json`)
- **Preview Build**: `npm run preview`

*Note: There is currently no test runner (`npm test`) or TypeScript typechecker configured in this repository.*

## High-Level Architecture & Data Flow

QuickEdit is a zero-backend client-side video editor (React 19 + Vite 8) that performs multi-clip sequencing, overlay composition, filmstrip rendering, and video export entirely in the browser using HTML5 Canvas 2D, Web Audio API, and MediaRecorder APIs.

### Core Runtime Boundaries & Modules

- **Central State Store (`src/App.jsx`)**: Owns global timeline time (`currentTime`), clip sequences (`videoClips`), multiline text layers (`textLayers`), picture-in-picture video overlays (`overlayLayers`), and canvas crop bounds (`crop`). Also handles global timeline duration calculations and hidden base `<video>` source switching (`switchVideoSource`).
- **Interactive Render Canvas (`src/components/VideoCanvas.jsx`)**: Drives continuous `requestAnimationFrame` loop. Draws the cropped base video, visible overlay videos, and formatted text layers onto a canvas context, handling live drag/resize bounding boxes for layer manipulation.
- **Multi-Track Sequencer (`src/components/Timeline.jsx`)**: Renders time ruler, playhead scrubbing, multi-track clip/overlay/text bars, trimming handles, and drag-and-drop clip reordering.
- **Drawer Controls (`src/components/Sidebar.jsx`)**: Tabbed flyout panels for media ingestion, text styling, overlay management, crop presets, and default configuration persistence in `localStorage`.
- **Client-Side Export Engine (`src/utils/videoExporter.js`)**: Exports video by driving base video playback from `0.0s`, drawing frames to an offscreen export canvas at 30 FPS, routing Web Audio streams to a `MediaStreamDestination`, and recording via `MediaRecorder`.
- **Media Utilities (`src/utils/`)**:
  - `tiktokLoader.js`: Proxies TikWM API calls and converts remote videos into in-memory `Blob` URLs to prevent canvas CORS taints.
  - `sampleVideo.js`: Generates synthetic WebM sample video clips via offscreen canvas capture stream.
  - `filmstripGenerator.js`: Extracts periodic thumbnail frames into cached canvas data URLs for timeline preview bars.

### Architectural Constraints & Gotchas

1. **Blob URL Isolation**: Remote video URLs must be converted into local `Blob` URLs before drawing to canvas to avoid `TaintedCanvas` export failures.
2. **Real-Time Export Speed**: Client-side video export relies on synchronous real-time `<video>` playback; base video playback and Web Audio routing must not be interrupted or muted during export.
3. **Clip & Layer Identifiers**: Clips and overlay layers track both global timeline positions (`startTime`, `endTime`) and local offsets (`trimStart`, `trimEnd`).
