# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: "[plugin:vite:import-analysis] Failed to resolve import \"../../context/GameContext\" from \"src/components/locker/ViewDeck.jsx\". Does the file exist?"
  - generic [ref=e5]: /Users/erenguner/Downloads/personal/supsub/supersub-poc/src/components/locker/ViewDeck.jsx:2:24
  - generic [ref=e6]: "2 | var _s = $RefreshSig$(); 3 | import React from \"react\"; 4 | import { useGame } from \"../../context/GameContext\"; | ^ 5 | import { getCardsByStatus } from \"../../data/mockInventory\"; 6 | import CardBase from \"../CardBase\";"
  - generic [ref=e7]: at TransformPluginContext._formatLog (file:///Users/erenguner/Downloads/personal/supsub/supersub-poc/node_modules/vite/dist/node/chunks/config.js:28999:43) at TransformPluginContext.error (file:///Users/erenguner/Downloads/personal/supsub/supersub-poc/node_modules/vite/dist/node/chunks/config.js:28996:14) at normalizeUrl (file:///Users/erenguner/Downloads/personal/supsub/supersub-poc/node_modules/vite/dist/node/chunks/config.js:27119:18) at process.processTicksAndRejections (node:internal/process/task_queues:103:5) at async file:///Users/erenguner/Downloads/personal/supsub/supersub-poc/node_modules/vite/dist/node/chunks/config.js:27177:32 at async Promise.all (index 2) at async TransformPluginContext.transform (file:///Users/erenguner/Downloads/personal/supsub/supersub-poc/node_modules/vite/dist/node/chunks/config.js:27145:4) at async EnvironmentPluginContainer.transform (file:///Users/erenguner/Downloads/personal/supsub/supersub-poc/node_modules/vite/dist/node/chunks/config.js:28797:14) at async loadAndTransform (file:///Users/erenguner/Downloads/personal/supsub/supersub-poc/node_modules/vite/dist/node/chunks/config.js:22670:26) at async viteTransformMiddleware (file:///Users/erenguner/Downloads/personal/supsub/supersub-poc/node_modules/vite/dist/node/chunks/config.js:24542:20)
  - generic [ref=e8]:
    - text: Click outside, press Esc key, or fix the code to dismiss.
    - text: You can also disable this overlay by setting
    - code [ref=e9]: server.hmr.overlay
    - text: to
    - code [ref=e10]: "false"
    - text: in
    - code [ref=e11]: vite.config.js
    - text: .
```