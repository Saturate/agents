# Migration & Deprecation Patterns

Reference for safely evolving codebases. Loaded on-demand when relevant.

## Migration Patterns

### Strangler Fig
Replace a system piece by piece rather than rewriting all at once:
1. Build the new version alongside the old
2. Route traffic gradually (by feature, endpoint, or user segment)
3. Old and new coexist until migration is complete
4. Remove old code only after verifying zero usage

### Adapter Pattern
When replacing an internal dependency:
1. Create an interface/adapter that wraps the old implementation
2. Build new implementation behind the same interface
3. Swap implementations (feature flag or config)
4. Remove old implementation after validation

### Database Migrations
- Always backwards-compatible: new code must work with both old and new schema
- Deploy schema change first, then deploy code that uses it
- Never rename/drop columns in the same deployment as the code change
- Add columns as nullable or with defaults
- Backfill data in a separate migration step
- Test rollback: can you revert the code without reverting the schema?

## API Deprecation

1. Add `Deprecated` header or field to responses
2. Document migration path and timeline
3. Monitor usage of deprecated endpoints
4. Remove only after confirmed zero usage (or after deadline with advance notice)

## Dead Code Detection

Signs of dead code:
- No test coverage and no references
- Feature flags that are always off
- Commented-out blocks with no explanation
- Imports that are never used
- API endpoints with zero traffic (check monitoring)

Remove dead code when found. Version control is the backup, not comments.
