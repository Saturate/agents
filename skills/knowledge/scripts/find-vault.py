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
    for v in vaults.values():
        if v.get("path", "").endswith(f"/{VAULT_NAME}"):
            print(v["path"])
            sys.exit(0)

sys.exit(1)
