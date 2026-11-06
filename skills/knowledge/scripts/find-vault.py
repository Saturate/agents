#!/usr/bin/env python3
"""Find the Obsidian Knowledge vault path from Obsidian's config."""
import json, os, sys

VAULT_NAME = "Knowledge"

config_paths = [
    "~/Library/Application Support/obsidian/obsidian.json",  # macOS
    "~/.config/obsidian/obsidian.json",                      # Linux
]

for cfg in config_paths:
    path = os.path.expanduser(cfg)
    if not os.path.exists(path):
        continue
    with open(path) as f:
        vaults = json.load(f).get("vaults", {})
    paths = [v.get("path", "") for v in vaults.values()]
    for p in paths:
        if p.endswith(f"/{VAULT_NAME}"):
            print(p)
            sys.exit(0)
    # The Knowledge folder can live inside a larger vault instead of being registered on its own
    for p in paths:
        nested = os.path.join(p, VAULT_NAME)
        if os.path.isfile(os.path.join(nested, f"{VAULT_NAME}.md")):
            print(nested)
            sys.exit(0)

sys.exit(1)
