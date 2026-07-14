#!/usr/bin/env bash
# PreToolUse hook for Edit/Write on Cargo.toml:
# Block adding NEW dependencies via file edit; force `cargo add` so agents
# always resolve the latest compatible version from crates.io.
# Modifying existing deps (features, version bumps, etc.) is allowed.
#
# Section-aware: only flags lines inside [*dependencies*] sections.
# Edits to [package], [profile], [workspace], etc. pass through untouched.
set -euo pipefail

input=$(cat)
tool=$(echo "$input" | jq -r '.tool_name // empty')
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

[[ "$file_path" =~ Cargo\.toml$ ]] || exit 0
[[ -f "$file_path" ]] || exit 0

file_content=$(/bin/cat "$file_path")

# Find the TOML section that contains a given line number in the file
section_at_line() {
  local target_line="$1"
  /usr/bin/awk -v target="$target_line" '
    /^\[/ { section = $0; gsub(/[\[\]]/, "", section) }
    NR == target { print section; exit }
  ' <<< "$file_content"
}

# Check if a section is a flat dependency table (keys are crate names).
# [dependencies] → yes; [dependencies.reqwest] → no (keys are metadata).
is_flat_dep_section() {
  local s="$1"
  local leaf="${s##*.}"
  [[ "$leaf" == "dependencies" || "$leaf" == "dev-dependencies" || "$leaf" == "build-dependencies" ]]
}

# Map a dep section name to the cargo add flag
dep_section_flag() {
  local s="$1"
  local leaf="${s##*.}"
  case "$leaf" in
    dev-dependencies)   echo " --dev" ;;
    build-dependencies) echo " --build" ;;
  esac
}

# Detect new dep-like lines in a dependencies section
# Args: $1=new_content  $2=reference (old_string or existing deps list)
#        $3=starting section (from file context, for Edit)
scan_for_new_deps() {
  local new_content="$1"
  local reference="$2"
  local current_section="${3:-}"
  local found=""

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    # Track section headers
    if [[ "$line" =~ ^\[([^]]+)\] ]]; then
      current_section="${BASH_REMATCH[1]}"
      continue
    fi
    # Only care about flat dep sections (not sub-tables like [dependencies.reqwest])
    is_flat_dep_section "$current_section" || continue
    # Match: crate-name = "..." or crate-name = { ...
    echo "$line" | /usr/bin/grep -qE '^[a-z][a-z0-9_-]* *= *("|'"'"'|\{)' || continue
    local crate
    crate=$(echo "$line" | /usr/bin/sed 's/ *=.*//')
    # Skip if crate already in reference (it's a modification, not an addition)
    echo "$reference" | /usr/bin/grep -qE "^${crate} *=" && continue

    local flags
    flags=$(dep_section_flag "$current_section")

    # Extract features if specified in the edit
    local features=""
    if echo "$line" | /usr/bin/grep -qE 'features *= *\['; then
      features=$(echo "$line" | /usr/bin/sed 's/.*features *= *\[//;s/\].*//;s/"//g;s/ //g')
      if [[ -n "$features" ]]; then
        features=" --features ${features}"
      fi
    fi

    found="${found}  cargo add ${crate}${flags}${features}"$'\n'
  done <<< "$new_content"

  printf '%s' "$found"
}

new_deps=""

if [[ "$tool" == "Edit" ]]; then
  old=$(echo "$input" | jq -r '.tool_input.old_string // empty')
  new=$(echo "$input" | jq -r '.tool_input.new_string // empty')
  [[ -z "$new" ]] && exit 0

  # Determine which section old_string starts in
  start_section=""
  first_old_line=$(echo "$old" | head -1)
  if [[ -n "$first_old_line" ]]; then
    line_num=$(echo "$file_content" | /usr/bin/grep -nF -- "$first_old_line" | head -1 | cut -d: -f1)
    if [[ -n "${line_num:-}" ]]; then
      start_section=$(section_at_line "$line_num")
    fi
  fi

  new_deps=$(scan_for_new_deps "$new" "$old" "$start_section")

elif [[ "$tool" == "Write" ]]; then
  content=$(echo "$input" | jq -r '.tool_input.content // empty')
  [[ -z "$content" ]] && exit 0

  # Build a list of existing dep names from flat dep sections only
  existing_deps=$(/usr/bin/awk '
    /^\[/ {
      section = $0; gsub(/[\[\]]/, "", section)
      n = split(section, parts, ".")
      leaf = parts[n]
      is_flat_dep = (leaf == "dependencies" || leaf == "dev-dependencies" || leaf == "build-dependencies")
    }
    is_flat_dep && /^[a-z][a-z0-9_-]* *= */ {
      sub(/ *=.*/, ""); print
    }
  ' <<< "$file_content")

  new_deps=$(scan_for_new_deps "$content" "$existing_deps" "")
fi

if [[ -n "${new_deps:-}" ]]; then
  cat <<EOF
BLOCKED: Use \`cargo add\` to add new dependencies instead of editing Cargo.toml.
\`cargo add\` resolves the latest compatible version from crates.io.

Run these commands instead:
${new_deps}
Then edit Cargo.toml to adjust features or version constraints if needed.
EOF
  exit 2
fi

exit 0
