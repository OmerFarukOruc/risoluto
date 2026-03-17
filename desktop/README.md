# Symphony Desktop

This directory contains a minimal Tauri desktop shell for local Symphony operations.

## Scope

- Provide a host process that can start and stop the local Symphony service.
- Reuse Symphony's existing HTTP dashboard and API instead of duplicating logic.
- Keep packaging concerns isolated from the core orchestration modules in `src/`.

## Current Layout

- `src-tauri/`: Rust host with process lifecycle commands and Tauri config.
- `web/`: desktop wrapper UI that controls lifecycle and embeds the dashboard.

## Lifecycle Wiring

The desktop host exposes these commands:

- `desktop_status`
- `desktop_start_service(workflowPath?, port?)`
- `desktop_stop_service`

When started from the desktop shell, Symphony launches via:

- `node dist/cli.js <workflow-path> --port <port>`

## Local Run Checklist

Run these from repository root first:

- `npm install`
- `npm run build`

Then run Tauri from `desktop/src-tauri` with your preferred workflow.

## Caveats

- The desktop host resolves repository root relative to `desktop/src-tauri`.
- Current process output is redirected to null in desktop mode; inspect archive data and dashboard/API for run behavior.
- This shell is intended for local development use, not yet for bundled production distribution.
