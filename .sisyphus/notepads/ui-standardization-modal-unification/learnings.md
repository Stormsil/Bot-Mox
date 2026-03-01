## 2026-02-27T00:41:45.323Z Task: initialization
- Plan focuses only on modal/form standardization around ThemeModal removal.
- ThemeModal currently applies mask blur/tint, panel/header/footer background, border lines, and shadow.
- Migration priority is AntD token consistency over exact pixel parity for wrapper-only effects.

## 2026-02-27 Task 2: proxy/license modal migration
- Replaced `ThemeModal` with native `Modal` in proxy and license modal group while preserving `open/onOk/onCancel/okText/width` wiring.
- Removed title color span wrappers and inline BoxMox color/background styles from modal controls.
- Used AntD `variant="filled"` for inputs that previously relied on muted surface background theming.
- Verified migration safety with `pnpm --filter @botmox/frontend typecheck` (pass).

## 2026-02-27 Task 1: global Modal token finalization
- `components.Modal` in theme runtime now maps modal shell visuals directly from global palette and shape runtime tokens.
- Explicit keys are present for `contentBg`, `headerBg`, `footerBg`, `titleColor`, `colorText`, `borderRadius`, and `boxShadow`.
- `borderRadius` is sourced from `sanitizeThemeShapeSettings(shape).radiusMd` via `safeShape.radiusMd` to stay shape-runtime driven.

## 2026-02-27 Task 3: finance/account/vm page modal migration
- Replaced `ThemeModal` with native `Modal` in `TransactionForm`, `ConfirmGenerationModal`, and `VMPageModals` without changing open/close/submit wiring.
- Removed wrapper-only title color span nodes and switched to plain string modal titles.
- Preserved required modal props including `confirmLoading` in finance form and `footer={null}`, `width={1100}`, `destroyOnHidden` in VM settings modal.

## 2026-02-27 Task 4: VM delete modal shell migration
- Replaced `ThemeModal` with native AntD `Modal` in `DeleteVmModal` while preserving the existing class-based structure and content layout.
- Preserved modal behavior wiring (`open`, `onCancel`, `onOk`, `okText`, `cancelText`, `width`, `destroyOnHidden`) and `okButtonProps` disabled/size logic.
- Kept popover filter interactions, selection action handlers, and `popoverInnerStyle` unchanged to avoid regressions in the dense VM delete workflow.

## 2026-02-27 Task 5: wrapper removal and verification suite
- Deleted `apps/frontend/src/components/ui/ThemeModal.tsx` and removed the barrel export from `apps/frontend/src/components/ui/index.ts`.
- Zero-usage check confirms no remaining `ThemeModal` references under `apps/frontend/src`.
- Verification suite passed for frontend scope: typecheck, lint, and Playwright E2E.
