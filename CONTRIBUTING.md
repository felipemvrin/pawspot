# Contributing

Thanks for your interest in contributing to PawSpot.

## Workflow

1. Create a feature branch from `main`.
2. Keep changes scoped to one concern.
3. Run quality checks locally.
4. Open a pull request with a clear summary.

## Commit Guidelines

- Use imperative commit messages.
- Keep commits small and reviewable.
- Avoid mixing refactors with behavior changes unless necessary.

## Local Quality Gates

Run before pushing:

```bash
npm run format:check
npm run lint
npm run build
```

## Pull Request Checklist

- Code compiles and lint passes.
- No secrets, tokens, or local paths are committed.
- Documentation is updated when relevant.
- Public API and behavior changes are described.
