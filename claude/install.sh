#!/bin/bash

# Show usage information
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Create symlinks for Claude configuration files to ~/.claude/

OPTIONS:
    -f, --force           Automatically backup existing files and create symlinks
    -s, --skip-existing   Skip existing files without prompting
    --hooks               Symlink hooks/ directory to enable tool-usage logging
    -h, --help           Show this help message

Without options, the script will prompt interactively for existing files.

EOF
    exit 0
}

# Determine the script's directory (works even if called from elsewhere)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Initialize submodules (skills live in a separate repo)
git -C "$SCRIPT_DIR" submodule update --init

# Define source files and target directory
SOURCE_FILES=("CLAUDE.md" "settings.json" "statusline-command.sh")
TARGET_DIR="$HOME/.claude"

# Auto-detect skills: any directory under skills/ containing a SKILL.md
SKILL_DIRS=()
for skill_dir in "$SCRIPT_DIR"/skills/*/; do
    if [ -f "$skill_dir/SKILL.md" ]; then
        SKILL_DIRS+=("$(basename "$skill_dir")")
    fi
done

# Parse command line flags
FORCE_BACKUP=false
SKIP_EXISTING=false
INSTALL_HOOKS=false

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
        --hooks)
            INSTALL_HOOKS=true
            shift
            ;;
        -h|--help)
            show_usage
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Create target directory if it doesn't exist
mkdir -p "$TARGET_DIR"

echo "Setting up Claude configuration symlinks..."
echo "Source directory: $SCRIPT_DIR"
echo "Target directory: $TARGET_DIR"
echo ""

# Track what was linked
linked_files=()
skipped_files=()
backed_up_files=()

# Function to backup and create symlink
backup_and_link() {
    local file=$1
    local source_path=$2
    local target_path=$3
    local backup_path="${target_path}.backup"

    # Backup existing file
    mv "$target_path" "$backup_path"
    if [ $? -ne 0 ]; then
        echo "✗ Failed to backup $file"
        skipped_files+=("$file (backup failed)")
        return 1
    fi

    echo "  Backed up existing file to: ${backup_path}"
    backed_up_files+=("$file")

    # Create symlink
    ln -s "$source_path" "$target_path"
    if [ $? -eq 0 ]; then
        echo "✓ Created symlink: $file"
        linked_files+=("$file")
        return 0
    else
        echo "✗ Failed to create symlink for $file"
        # Try to restore backup
        mv "$backup_path" "$target_path"
        echo "  Restored original file from backup"
        skipped_files+=("$file (link failed)")
        return 1
    fi
}

# Process each file
for file in "${SOURCE_FILES[@]}"; do
    source_path="$SCRIPT_DIR/$file"
    target_path="$TARGET_DIR/$file"

    # Check if source file exists
    if [ ! -f "$source_path" ]; then
        echo "⚠️  Warning: Source file not found: $source_path"
        skipped_files+=("$file (source missing)")
        continue
    fi

    # Check if target already exists
    if [ -e "$target_path" ] || [ -L "$target_path" ]; then
        # Check if it's already a symlink to the correct source
        if [ -L "$target_path" ]; then
            current_target=$(readlink "$target_path")
            if [ "$current_target" = "$source_path" ]; then
                echo "✓ $file is already correctly symlinked"
                skipped_files+=("$file (already linked)")
                continue
            fi
        fi

        # File exists but is not the correct symlink
        echo "⚠️  File exists: $target_path"

        # Handle based on flags
        if [ "$SKIP_EXISTING" = true ]; then
            echo "  Skipping (--skip-existing flag set)"
            skipped_files+=("$file (exists)")
            continue
        elif [ "$FORCE_BACKUP" = true ]; then
            echo "  Backing up and replacing (--force flag set)"
            backup_and_link "$file" "$source_path" "$target_path"
            continue
        else
            # Interactive prompt
            while true; do
                read -p "  Backup existing file and create symlink? [y/n/q] " answer
                case $answer in
                    [Yy]* )
                        backup_and_link "$file" "$source_path" "$target_path"
                        break
                        ;;
                    [Nn]* )
                        echo "  Skipped $file"
                        skipped_files+=("$file (user skipped)")
                        break
                        ;;
                    [Qq]* )
                        echo ""
                        echo "Installation cancelled by user"
                        exit 0
                        ;;
                    * )
                        echo "  Please answer y (yes), n (no), or q (quit)"
                        ;;
                esac
            done
            continue
        fi
    fi

    # Create the symlink (file doesn't exist)
    ln -s "$source_path" "$target_path"
    if [ $? -eq 0 ]; then
        echo "✓ Created symlink: $file"
        linked_files+=("$file")
    else
        echo "✗ Failed to create symlink for $file"
        skipped_files+=("$file (error)")
    fi
done

# Process skill directories
SKILLS_TARGET_DIR="$TARGET_DIR/skills"
mkdir -p "$SKILLS_TARGET_DIR"

for skill in "${SKILL_DIRS[@]}"; do
    source_path="$SCRIPT_DIR/skills/$skill"
    target_path="$SKILLS_TARGET_DIR/$skill"

    # Check if source directory exists
    if [ ! -d "$source_path" ]; then
        echo "⚠️  Warning: Source skill directory not found: $source_path"
        skipped_files+=("skills/$skill (source missing)")
        continue
    fi

    # Check if target already exists
    if [ -e "$target_path" ] || [ -L "$target_path" ]; then
        # Check if it's already a symlink to the correct source
        if [ -L "$target_path" ]; then
            current_target=$(readlink "$target_path")
            if [ "$current_target" = "$source_path" ]; then
                echo "✓ skills/$skill is already correctly symlinked"
                skipped_files+=("skills/$skill (already linked)")
                continue
            fi
        fi

        # Directory exists but is not the correct symlink
        echo "⚠️  Skill directory exists: $target_path"

        # Handle based on flags
        if [ "$SKIP_EXISTING" = true ]; then
            echo "  Skipping (--skip-existing flag set)"
            skipped_files+=("skills/$skill (exists)")
            continue
        elif [ "$FORCE_BACKUP" = true ]; then
            echo "  Backing up and replacing (--force flag set)"
            backup_and_link "skills/$skill" "$source_path" "$target_path"
            continue
        else
            # Interactive prompt
            while true; do
                read -p "  Backup existing directory and create symlink? [y/n/q] " answer
                case $answer in
                    [Yy]* )
                        backup_and_link "skills/$skill" "$source_path" "$target_path"
                        break
                        ;;
                    [Nn]* )
                        echo "  Skipped skills/$skill"
                        skipped_files+=("skills/$skill (user skipped)")
                        break
                        ;;
                    [Qq]* )
                        echo ""
                        echo "Installation cancelled by user"
                        exit 0
                        ;;
                    * )
                        echo "  Please answer y (yes), n (no), or q (quit)"
                        ;;
                esac
            done
            continue
        fi
    fi

    # Create the symlink (directory doesn't exist)
    ln -s "$source_path" "$target_path"
    if [ $? -eq 0 ]; then
        echo "✓ Created symlink: skills/$skill"
        linked_files+=("skills/$skill")
    else
        echo "✗ Failed to create symlink for skills/$skill"
        skipped_files+=("skills/$skill (error)")
    fi
done

# Install hooks if requested
# Hook config lives in settings.json already — this just symlinks the scripts
if [ "$INSTALL_HOOKS" = true ]; then
    echo ""
    echo "Setting up tool-usage logging hooks..."

    HOOKS_SOURCE="$SCRIPT_DIR/hooks"
    HOOKS_TARGET="$TARGET_DIR/hooks"

    if [ -L "$HOOKS_TARGET" ]; then
        current_target=$(readlink "$HOOKS_TARGET")
        if [ "$current_target" = "$HOOKS_SOURCE" ]; then
            echo "✓ hooks/ is already correctly symlinked"
        else
            rm "$HOOKS_TARGET"
            ln -s "$HOOKS_SOURCE" "$HOOKS_TARGET"
            echo "✓ Updated hooks/ symlink"
            linked_files+=("hooks/")
        fi
    elif [ -e "$HOOKS_TARGET" ]; then
        echo "⚠️  $HOOKS_TARGET already exists and is not a symlink — skipping"
        echo "  Remove it manually if you want the symlink instead"
        skipped_files+=("hooks/ (exists, not a symlink)")
    else
        ln -s "$HOOKS_SOURCE" "$HOOKS_TARGET"
        echo "✓ Created symlink: hooks/"
        linked_files+=("hooks/")
    fi
fi

# Display summary
echo ""
echo "=== Summary ==="
if [ ${#linked_files[@]} -gt 0 ]; then
    echo "Successfully linked ${#linked_files[@]} file(s):"
    for file in "${linked_files[@]}"; do
        echo "  - $file"
    done
fi

if [ ${#backed_up_files[@]} -gt 0 ]; then
    echo "Backed up ${#backed_up_files[@]} file(s):"
    for file in "${backed_up_files[@]}"; do
        echo "  - $file (saved as $file.backup)"
    done
fi

if [ ${#skipped_files[@]} -gt 0 ]; then
    echo "Skipped ${#skipped_files[@]} file(s):"
    for file in "${skipped_files[@]}"; do
        echo "  - $file"
    done
fi

echo ""
echo "You can verify the symlinks with: ls -la $TARGET_DIR"
