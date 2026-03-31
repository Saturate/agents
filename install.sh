#!/bin/bash

# Show usage information
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] [TARGETS...]

Create symlinks for AI agent configuration.

TARGETS:
    claude          Set up Claude Code (config, skills, statusline)
    opencode        Set up OpenCode (commands, agents)
    all             Set up everything (default if no target specified)

OPTIONS:
    -f, --force           Automatically backup existing files and create symlinks
    -s, --skip-existing   Skip existing files without prompting
    -h, --help           Show this help message

Without options, the script will prompt interactively for existing files.

PLUGIN (observability):
    Hook logging is a Claude Code plugin. After running this script:
      /plugin marketplace add Saturate/agents
      /plugin install observability@Saturate-agents

EOF
    exit 0
}

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Parse command line flags
FORCE_BACKUP=false
SKIP_EXISTING=false
TARGETS=()
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE_BACKUP=true
            shift
            ;;
        -s|--skip-existing)
            SKIP_EXISTING=true
            shift
            ;;
        -h|--help)
            show_usage
            ;;
        claude|opencode|all)
            TARGETS+=("$1")
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Default to all targets
if [ ${#TARGETS[@]} -eq 0 ] || [[ " ${TARGETS[*]} " =~ " all " ]]; then
    TARGETS=("claude" "opencode")
fi

# Track what was linked
linked_files=()
skipped_files=()
backed_up_files=()

# Backup and create symlink
backup_and_link() {
    local file=$1
    local source_path=$2
    local target_path=$3
    local backup_path="${target_path}.backup"

    mv "$target_path" "$backup_path"
    if [ $? -ne 0 ]; then
        echo "✗ Failed to backup $file"
        skipped_files+=("$file (backup failed)")
        return 1
    fi

    echo "  Backed up existing file to: ${backup_path}"
    backed_up_files+=("$file")

    ln -s "$source_path" "$target_path"
    if [ $? -eq 0 ]; then
        echo "✓ Created symlink: $file"
        linked_files+=("$file")
        return 0
    else
        echo "✗ Failed to create symlink for $file"
        mv "$backup_path" "$target_path"
        echo "  Restored original file from backup"
        skipped_files+=("$file (link failed)")
        return 1
    fi
}

# Create a symlink, handling existing files
create_link() {
    local label=$1
    local source_path=$2
    local target_path=$3

    # Check if source exists
    if [ ! -e "$source_path" ]; then
        echo "⚠️  Warning: Source not found: $source_path"
        skipped_files+=("$label (source missing)")
        return
    fi

    # Check if target already exists
    if [ -e "$target_path" ] || [ -L "$target_path" ]; then
        # Already correctly linked?
        if [ -L "$target_path" ]; then
            current_target=$(readlink "$target_path")
            if [ "$current_target" = "$source_path" ]; then
                echo "✓ $label is already correctly symlinked"
                skipped_files+=("$label (already linked)")
                return
            fi
        fi

        echo "⚠️  Exists: $target_path"

        if [ "$SKIP_EXISTING" = true ]; then
            echo "  Skipping (--skip-existing)"
            skipped_files+=("$label (exists)")
            return
        elif [ "$FORCE_BACKUP" = true ]; then
            echo "  Backing up and replacing (--force)"
            backup_and_link "$label" "$source_path" "$target_path"
            return
        else
            while true; do
                read -p "  Backup and create symlink? [y/n/q] " answer
                case $answer in
                    [Yy]* ) backup_and_link "$label" "$source_path" "$target_path"; break ;;
                    [Nn]* ) echo "  Skipped"; skipped_files+=("$label (user skipped)"); break ;;
                    [Qq]* ) echo ""; echo "Cancelled."; exit 0 ;;
                    * ) echo "  Please answer y, n, or q" ;;
                esac
            done
            return
        fi
    fi

    # Create the symlink
    mkdir -p "$(dirname "$target_path")"
    ln -s "$source_path" "$target_path"
    if [ $? -eq 0 ]; then
        echo "✓ Created symlink: $label"
        linked_files+=("$label")
    else
        echo "✗ Failed to create symlink for $label"
        skipped_files+=("$label (error)")
    fi
}

# Auto-detect skills
detect_skills() {
    local skills=()
    for skill_dir in "$SCRIPT_DIR"/skills/*/; do
        if [ -f "$skill_dir/SKILL.md" ]; then
            skills+=("$(basename "$skill_dir")")
        fi
    done
    echo "${skills[@]}"
}

# ─── Claude Code ───────────────────────────────────────────────

setup_claude() {
    local target_dir="$HOME/.claude"
    echo "Setting up Claude Code..."
    echo "  Source: $SCRIPT_DIR"
    echo "  Target: $target_dir"
    echo ""

    mkdir -p "$target_dir"

    # Config files
    for file in CLAUDE.md settings.json statusline-command.sh; do
        create_link "$file" "$SCRIPT_DIR/claude/$file" "$target_dir/$file"
    done

    # Skills
    mkdir -p "$target_dir/skills"
    local skills=($(detect_skills))
    for skill in "${skills[@]}"; do
        create_link "skills/$skill" "$SCRIPT_DIR/skills/$skill" "$target_dir/skills/$skill"
    done

    echo ""
}

# ─── OpenCode ──────────────────────────────────────────────────

setup_opencode() {
    echo "Setting up OpenCode..."
    echo "  Source: $SCRIPT_DIR"
    echo ""

    # User-level commands
    local cmd_dir="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/commands"
    mkdir -p "$cmd_dir"

    for cmd_file in "$SCRIPT_DIR"/opencode/command/*.md; do
        [ -f "$cmd_file" ] || continue
        local name=$(basename "$cmd_file")
        create_link "opencode/command/$name" "$cmd_file" "$cmd_dir/$name"
    done

    # User-level agents
    local agent_dir="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/agents"
    mkdir -p "$agent_dir"

    for agent_file in "$SCRIPT_DIR"/opencode/agent/*.md; do
        [ -f "$agent_file" ] || continue
        local name=$(basename "$agent_file")
        create_link "opencode/agent/$name" "$agent_file" "$agent_dir/$name"
    done

    echo ""
}

# ─── Run selected targets ─────────────────────────────────────

for target in "${TARGETS[@]}"; do
    case $target in
        claude)   setup_claude ;;
        opencode) setup_opencode ;;
    esac
done

# ─── Summary ──────────────────────────────────────────────────

echo "=== Summary ==="
if [ ${#linked_files[@]} -gt 0 ]; then
    echo "Linked ${#linked_files[@]} item(s):"
    for file in "${linked_files[@]}"; do
        echo "  - $file"
    done
fi

if [ ${#backed_up_files[@]} -gt 0 ]; then
    echo "Backed up ${#backed_up_files[@]} item(s):"
    for file in "${backed_up_files[@]}"; do
        echo "  - $file (saved as $file.backup)"
    done
fi

if [ ${#skipped_files[@]} -gt 0 ]; then
    echo "Skipped ${#skipped_files[@]} item(s):"
    for file in "${skipped_files[@]}"; do
        echo "  - $file"
    done
fi
