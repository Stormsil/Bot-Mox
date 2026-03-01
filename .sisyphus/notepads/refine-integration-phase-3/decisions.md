## 2026-02-28T01:56:12.382Z Task: initialization
Using TDD workflow per plan.

## 2026-02-28T02:35:00Z Architecture decisions
- Keep explicit React routes for target resources but remove hardcoded duplication by generating both `resources` and `<Route>` entries from one source map (`refineResourcePages`) in `App.tsx`.
- Standardize subscription forms to pass `formProps` directly and perform payload transformation in wrapper `onFinish` adapters, avoiding manual submit try/catch in page and bot modal flows.
