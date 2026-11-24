# @statetrail/react

React UI for `@statetrail/core`.

## What it shows

- **Trail map** grouped by action (expand to see notes + requests)
- Flat event log toggle
- Duration bars and outcome labels
- **Export JSON** via `trail.exportReport()`

```tsx
import { StateTrailPanel, useTrailEvents, useTrailActions } from '@statetrail/react';

<StateTrailPanel trail={trail} />
```
