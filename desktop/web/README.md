# Desktop Web Wrapper

This folder now contains a lightweight desktop wrapper UI that:

- invokes Tauri commands to start/stop the Symphony service process,
- polls service status from the Rust host, and
- embeds the existing Symphony dashboard in an iframe.

## Files

- `index.html`: host controls and iframe container
- `styles.css`: desktop shell styling
- `app.js`: invokes `desktop_status`, `desktop_start_service`, and `desktop_stop_service`

## Runtime Notes

- The iframe target defaults to `http://127.0.0.1:4000/`.
- Status polling is host-driven; this wrapper does not call `/api/v1/*` directly.
- The Rust host resolves default workflow path to:
  - `<repo>/WORKFLOW.example.md` if present
  - otherwise `<repo>/WORKFLOW.md`
