# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ふにゃ秘書たん (Funya Secretary) - An Electron + FastAPI desktop application featuring a cute AI secretary character that reacts to game events (7 Days to Die zombie detection) with voice synthesis and emotional expressions.

## Development Commands

```bash
# Main development (runs all services)
pnpm run dev:all

# Individual services
pnpm run dev:frontend    # Vite dev server (port 5173)
pnpm run dev:backend     # FastAPI with reload (port 8000)
pnpm run dev:electron    # Electron app

# Build
pnpm run build           # Build frontend
pnpm run build:electron  # Full electron-builder build
pnpm run dist            # Create distribution package

# Linting & Formatting
pnpm run lint            # ESLint (JS)
pnpm run lint:fix        # ESLint fix
pnpm run format          # Prettier format all
pnpm run lint:py         # Ruff lint Python
pnpm run lint:py:fix     # Ruff fix Python
pnpm run typecheck:py    # MyPy type checking
pnpm run format:py       # Ruff format Python
```

## Architecture

### Tech Stack
- **Frontend**: Electron 24.x + Vite + Vanilla JS (ESM)
- **Backend**: FastAPI + uvicorn (Python 3.10+)
- **Voice**: VOICEVOX (local engine on port 50021)
- **ML**: YOLOv8 + PyTorch + OpenCV for zombie detection

### Key Directories
```
backend/app/
├── modules/     # Feature modules: emotion, voice, zombie, llm, ocr
├── routers/     # API endpoints
├── schemas/     # Pydantic models
├── ws/          # WebSocket handlers

frontend/src/
├── main/        # Electron entry (index.mjs, preload scripts)
├── emotion/     # Character expression system
├── ui/          # Components, styles, helpers
├── features/    # Feature handlers
├── core/        # Utilities, API clients, logger
├── voice/       # Audio playback
```

### Entry Points
- **Electron main**: `frontend/src/main/es-module-loader.cjs` → `index.mjs`
- **Backend**: `backend/main.py` → FastAPI app via `create_application()`
- **Frontend UI**: `frontend/index.html` (loads Vite bundle)

### Application Flow
1. Electron loads es-module-loader.cjs (CommonJS bridge)
2. index.mjs creates frameless transparent window, starts Python backend
3. Backend serves FastAPI on port 8000, connects to VOICEVOX on 50021
4. Frontend establishes WebSocket to backend for real-time events
5. Zombie detection triggers character reactions via emotion system

### Key Ports
- 5173: Vite dev server
- 8000: FastAPI backend
- 50021: VOICEVOX engine (external)

## Critical ESM Rules

**All frontend JavaScript MUST use ES Modules (ESM). NO CommonJS.**

```javascript
// ✅ Correct
import { something } from './module.js';
import path from 'node:path';

// ❌ Wrong - will break
const something = require('./module');
```

- Always include file extensions in imports: `'./bar.js'` not `'./bar'`
- Preload scripts use ESM: `import { contextBridge } from 'electron'`
- No mixing CommonJS and ESM in the same codebase

## Vite Path Aliases

Use these aliases in frontend code:
- `@features` → `src/features`
- `@shared` → `src/shared`
- `@core` → `src/core`
- `@ui` → `src/ui`
- `@emotion` → `src/emotion`
- `@voice` → `src/voice`
- `@renderer` → `src/renderer`

## Voice Playback Pattern

For responsive reactions (e.g., zombie detection):
1. Play pre-rendered WAV first (e.g., "きゃっ！？") for instant feedback
2. Follow with dynamically generated VOICEVOX line
3. Pre-cache emotional lines during idle time

## Language & Communication

- Respond in Japanese when working with this codebase
- Use Japanese comments for complex logic
- UI text and labels should be in Japanese
