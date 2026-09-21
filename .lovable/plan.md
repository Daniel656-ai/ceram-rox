# UX plan

## Scope
- Add synchronized top horizontal scrolling to Projects and Results Database tables.
- Improve selected-point labels in DIL and STA charts with automatic placement, drag movement, and a leader line.

## Constraints
- Frontend presentation only; no data, backend, authentication, calculations, or business-logic changes.
- Preserve filters, sorting, pagination, row sizing, chart values, axes, and curves.

## Verification
- Exercise both table scrollbars and synchronization.
- Exercise selected labels in DIL and STA, including drag and chart-boundary behavior.
- Confirm the shared frontend path used by Web and Desktop.
