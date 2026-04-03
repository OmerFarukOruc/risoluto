#!/usr/bin/env python3
import json
import re
import sys


TRIGGERS = [
    r"\broadmap\b",
    r"\bbundle\b",
    r"\bexecplan\b",
    r"\bplan and build\b",
    r"\bissue[s]?\b",
    r"#\d+",
]


def main() -> int:
    payload = json.load(sys.stdin)
    prompt = payload.get("prompt", "")
    if not any(re.search(pattern, prompt, re.IGNORECASE) for pattern in TRIGGERS):
        return 0

    context = (
        "This prompt looks like medium or large bundled work in Risoluto. "
        "Prefer the repo-local anvil factory so the run gets durable .anvil state, "
        "planning, review, verification, docs/tests closeout, and a final single push."
    )
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": context,
                }
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
