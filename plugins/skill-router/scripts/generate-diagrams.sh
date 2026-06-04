#!/bin/bash
#
# Generates Mermaid diagrams from skill-router source files.
#
# Hook flow:  parsed from advisor-rules.conf
# Skill flows: parsed from SKILL.md progress checklists
#
# Usage:
#   bash generate-diagrams.sh [--render]
#   --render  also produces PNGs via mmdc (requires @mermaid-js/mermaid-cli)
#
# Output: diagrams/ directory next to this script

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RULES_FILE="$SCRIPT_DIR/advisor-rules.conf"
SKILLS_DIR="$SCRIPT_DIR/../../../skills"
OUT_DIR="$SCRIPT_DIR/../diagrams"
RENDER=false

[ "${1:-}" = "--render" ] && RENDER=true

mkdir -p "$OUT_DIR"

# ── Hook flow diagram ────────────────────────────────────────────────

generate_hook_diagram() {
  local gates="" blocks="" flows=""
  local gate_nodes="" block_nodes="" flow_nodes=""
  local gate_idx=0 block_idx=0 flow_idx=0

  while IFS=$'\t' read -r action pattern skills message || [ -n "$action" ]; do
    case "$action" in ''|'#'*) continue ;; esac
    [ -z "${pattern:-}" ] && continue
    [ -z "${skills:-}" ] && continue

    local label="${skills// /}"
    # Shorten the regex for display
    local short_pat
    short_pat=$(printf '%s' "$pattern" | sed -E '
      s/\[\[:space:\]\]\*/\\s/g
      s/\[\[:space:\]\]\+/\\s+/g
      s/\[\[:alpha:\]\]/[a-z]/g
      s/\^\[\\s\]\*//
      s/\[\\s\]\+/ /g
    ' | head -c 40)

    if [ "$action" = "gate" ]; then
      gate_idx=$((gate_idx + 1))
      gate_nodes="${gate_nodes}        G${gate_idx}[\"${label}\n${short_pat}\"]
"
    elif [ "$action" = "block" ]; then
      block_idx=$((block_idx + 1))
      block_nodes="${block_nodes}        B${block_idx}[\"/${label}\n${short_pat}\"]
"
    elif [ "$action" = "flow" ]; then
      flow_idx=$((flow_idx + 1))
      flow_nodes="${flow_nodes}        F${flow_idx}[\"${label}\n${short_pat}\"]
"
    fi
  done < "$RULES_FILE"

  cat > "$OUT_DIR/hook-flow.mmd" << MERMAID
%% Auto-generated from advisor-rules.conf — do not edit by hand
%% Regenerate: bash plugins/skill-router/scripts/generate-diagrams.sh
flowchart TB
    subgraph hook["PreToolUse Hook · skill-advisor.sh"]
        direction TB
        CMD[/"Bash command"/]
        NORM["Split on && and ;"]
        ACK{"SKILL_ACK\npresent?"}
        STRIP["Strip ACK'd segments\nkeep the rest"]
        EMPTY{"Segments\nremaining?"}
        MATCH{"Match rules\n(first hit wins)"}

        CMD --> NORM --> ACK
        ACK -->|"Some"| STRIP --> EMPTY
        ACK -->|"No"| MATCH
        EMPTY -->|"None"| PASS1(("Pass"))
        EMPTY -->|"Yes"| MATCH
    end

    GATE["GATE\nBlock + custom message"]
    BLOCK["BLOCK\nBlock + skill nudge"]
    PASS2(("Pass"))

    MATCH -->|"gate"| GATE
    MATCH -->|"block"| BLOCK
    MATCH -->|"no match"| PASS2

    subgraph gates["Gate Rules · ${gate_idx} rules"]
${gate_nodes}    end

    subgraph blocks["Block Rules · ${block_idx} rules"]
${block_nodes}    end

    GATE -.-> gates
    BLOCK -.-> blocks

    style hook fill:#1e1e2e,stroke:#89b4fa,color:#cdd6f4
    style GATE fill:#f38ba8,stroke:#f38ba8,color:#1e1e2e
    style BLOCK fill:#fab387,stroke:#fab387,color:#1e1e2e
    style PASS1 fill:#a6e3a1,stroke:#a6e3a1,color:#1e1e2e
    style PASS2 fill:#a6e3a1,stroke:#a6e3a1,color:#1e1e2e
    style gates fill:#302040,stroke:#cba6f7,color:#cdd6f4
    style blocks fill:#1e2030,stroke:#89b4fa,color:#cdd6f4
MERMAID

  echo "  hook-flow.mmd (${gate_idx} gates, ${block_idx} blocks)"
}

# ── Skill flow diagram ───────────────────────────────────────────────

generate_skill_diagram() {
  local skill_name="$1"
  local skill_file="$SKILLS_DIR/$skill_name/SKILL.md"

  [ -f "$skill_file" ] || return

  # Extract progress checklist lines: "- [ ] Step N: description"
  local steps
  steps=$(grep -E '^\- \[ \] ' "$skill_file" | sed 's/- \[ \] //')

  local step_count
  step_count=$(echo "$steps" | wc -l | tr -d ' ')
  [ "$step_count" -lt 2 ] && return

  # Detect skill invocations within the file
  local invokes
  invokes=$(grep -oE 'invoke.*/[a-z-]+|Run /[a-z-]+|run `/[a-z-]+' "$skill_file" 2>/dev/null | grep -oE '/[a-z-]+' | sort -u || true)

  # Detect decision points (steps with conditional language)
  local has_review=false
  grep -qi 'code-review\|self-review\|/code-review' "$skill_file" && has_review=true

  # Build mermaid
  local mmd=""
  local prev_id=""
  local idx=0

  mmd="flowchart TD
    subgraph flow[\"${skill_name} workflow\"]
        direction TB
"

  while IFS= read -r step; do
    idx=$((idx + 1))
    local id="S${idx}"
    local clean
    clean=$(printf '%s' "$step" | sed 's/"/\\"/g')

    mmd="${mmd}        ${id}[\"${clean}\"]
"
    if [ -n "$prev_id" ]; then
      mmd="${mmd}        ${prev_id} --> ${id}
"
    fi

    # If this step mentions review, add a loop arrow
    if printf '%s' "$step" | grep -qi 'review'; then
      local fix_id="FIX${idx}"
      local next_idx=$((idx + 1))
      mmd="${mmd}        ${id} -->|\"findings\"| ${fix_id}[\"Fix + re-review\"]
        ${fix_id} -->|\"loop\"| ${id}
"
    fi

    prev_id="$id"
  done <<< "$steps"

  # Add invoked skills as notes
  if [ -n "$invokes" ]; then
    mmd="${mmd}
"
    for inv in $invokes; do
      mmd="${mmd}        INV_${inv#/}(\"${inv}\"):::invoke
"
    done
  fi

  mmd="${mmd}    end

    style flow fill:#1e1e2e,stroke:#89b4fa,color:#cdd6f4
    classDef invoke fill:#302040,stroke:#cba6f7,color:#cdd6f4
"

  echo "$mmd" > "$OUT_DIR/${skill_name}-flow.mmd"
  echo "  ${skill_name}-flow.mmd (${step_count} steps)"
}

# ── Main ─────────────────────────────────────────────────────────────

echo "Generating diagrams from source..."
echo ""

echo "Hook diagram:"
generate_hook_diagram

echo ""
echo "Skill diagrams:"
for skill in push make-pr commit; do
  generate_skill_diagram "$skill"
done

# Render PNGs if requested
if $RENDER; then
  echo ""
  echo "Rendering PNGs..."
  for mmd_file in "$OUT_DIR"/*.mmd; do
    local_name=$(basename "$mmd_file" .mmd)
    if npx --yes @mermaid-js/mermaid-cli -i "$mmd_file" -o "$OUT_DIR/${local_name}.png" -b transparent --scale 2 2>/dev/null; then
      echo "  ${local_name}.png"
    else
      echo "  ${local_name}.png FAILED"
    fi
  done
fi

echo ""
echo "Output: $OUT_DIR/"
ls "$OUT_DIR/"
