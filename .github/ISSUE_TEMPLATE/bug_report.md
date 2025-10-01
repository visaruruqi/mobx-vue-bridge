---
name: Bug report
about: Create a report to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Create MobX observable with '...'
2. Use useMobxBridge with options '...'
3. Perform action '...'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Minimal code example**
```javascript
// Please provide a minimal, reproducible example
import { useMobxBridge } from 'mobx-vue-bridge'
import { makeAutoObservable } from 'mobx'

class ExampleStore {
  constructor() {
    makeAutoObservable(this)
  }
  // ... your code
}

const store = new ExampleStore()
const state = useMobxBridge(store)
// ... steps that cause the bug
```

**Environment:**
- mobx-vue-bridge version: [e.g. 1.1.0]
- Vue version: [e.g. 3.4.0]
- MobX version: [e.g. 6.12.0]
- Browser/Node.js version: [e.g. Chrome 118, Node 18.17.0]
- OS: [e.g. macOS, Windows, Linux]

**Error messages**
If applicable, include any error messages or stack traces.

**Additional context**
Add any other context about the problem here.