# agent-browser Quick Reference

## Navigation
| Command | Description |
|---|---|
| `open <url>` | Navigate to URL |
| `wait --load networkidle` | Wait until network settles (preferred over blind waits) |
| `wait <ms>` | Blind wait — only use ≤500ms as post-render buffer |
| `get url` | Return current URL |

## Snapshots & Screenshots
| Command | Description |
|---|---|
| `snapshot -i` | Interactive elements with @eN refs |
| `snapshot -i --urls` | Interactive elements + page URLs |
| `snapshot` | Full accessibility tree |
| `diff snapshot` | Compare current vs previous snapshot |
| `screenshot <path>` | Save PNG screenshot |

## Interaction
| Command | Description |
|---|---|
| `click @eN` | Click element by ref |
| `fill @eN "text"` | Set input value (bulk) |
| `type @eN "text"` | Type character-by-character (for video) |
| `press "key"` | Press key (e.g., "Enter", "Escape", "Control+k") |
| `select @eN "value"` | Select dropdown option |

## Batch & Eval
| Command | Description |
|---|---|
| `batch "cmd1" "cmd2"` | Run multiple commands sequentially |
| `eval 'js code'` | Execute JavaScript in page context |

## Console & Errors
| Command | Description |
|---|---|
| `console --clear` | Clear console messages |
| `console --json` | Get console messages as JSON |
| `errors` | Show page errors |

## Network Mocking
| Command | Description |
|---|---|
| `network route "*/api/*" --body '{"error":"mock"}'` | Mock API response |
| `network route "*/api/*" --abort` | Simulate network failure |
| `network unroute` | Remove all mocks |

## Video Recording
| Command | Description |
|---|---|
| `record start <path.webm>` | Start recording |
| `record stop` | Stop recording |

## Dialogs
| Command | Description |
|---|---|
| `dialog status` | Check for blocking dialogs |
| `dialog accept` | Accept confirm dialog |
| `dialog dismiss` | Dismiss confirm dialog |

## Session Management
| Command | Description |
|---|---|
| `--session <name> --headed open <url>` | Start named session |
| `set viewport <w> <h>` | Set viewport size |
| `close` | Close session |

---

## Behavioral Notes

### Screenshot directory override

Set `AGENT_BROWSER_SCREENSHOT_DIR` to control where screenshots land:
```bash
export AGENT_BROWSER_SCREENSHOT_DIR="${RUN_DIR}/2560x1440/screenshots"
```
This eliminates the archive-path problem. If the env var is not set, fall back to manual verification.

### Screenshot path fallback

`agent-browser screenshot <path>` may save to `docs/archive/screenshots/` instead of the given path. Always verify and fall back:

```bash
agent-browser --session shqa-2560 screenshot "${TARGET}"
if [[ ! -f "${TARGET}" ]]; then
  LATEST=$(ls -t docs/archive/screenshots/screenshot-*.png 2>/dev/null | head -1)
  [[ -n "$LATEST" ]] && cp "$LATEST" "${TARGET}"
fi
```

### Content wait strategy

Never use blind `wait 1500` before screenshots. Pages may still be loading data.

```bash
# WRONG — may capture loading spinner
agent-browser open "http://localhost:4000/queue"
agent-browser wait 1500
agent-browser screenshot ...

# RIGHT — wait for content, verify, then capture
agent-browser open "http://localhost:4000/queue"
agent-browser wait --load networkidle
agent-browser wait 300
SNAP=$(agent-browser snapshot -i 2>&1)
echo "$SNAP" | head -10  # verify real content visible
agent-browser screenshot ...
```

### Stale refs

After any click, navigation, or DOM change, all `@eN` refs are invalid. Re-snapshot before interacting with any element.

### Console error tracking

Check `errors` after every meaningful interaction. For precision, capture errors before AND after:

```bash
agent-browser errors > /tmp/pre.txt   # baseline
agent-browser click @e7               # interaction
agent-browser errors > /tmp/post.txt  # compare
```

New errors after the interaction are attributed to that specific action.
