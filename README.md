# 🌉 MobX-Vue Bridge

A seamless bridge between MobX observables and Vue 3's reactivity system, enabling effortless two-way data binding and state synchronization.

[![npm version](https://badge.fury.io/js/mobx-vue-bridge.svg)](https://www.npmjs.com/package/mobx-vue-bridge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🔄 **Two-way data binding** between MobX observables and Vue reactive state
- 🎯 **Automatic property detection** (properties, getters, setters, methods)
- 🏗️ **Deep object/array observation** with proper reactivity
- ⚙️ **Configurable mutation behavior** 
- 🔒 **Type-safe bridging** between reactive systems
- 🚀 **Optimized performance** with intelligent change detection
- 🛡️ **Error handling** for edge cases and circular references
- ⚡ **Zero-side-effect initialization** with lazy detection (v1.4.0+)
- 📦 **Modular architecture** for better maintainability

## 📦 Installation

```bash
npm install mobx-vue-bridge
```

**Peer Dependencies:**
- Vue 3.x
- MobX 6.x

```bash
npm install vue mobx
```

## 🚀 Quick Start

First, create your MobX presenter:

```javascript
// presenters/UserPresenter.js
import { makeAutoObservable } from 'mobx'

export class UserPresenter {
  constructor() {
    this.name = 'John'
    this.age = 25
    this.emails = []
    
    makeAutoObservable(this)
  }
  
  get displayName() {
    return `${this.name} (${this.age})`
  }
  
  addEmail(email) {
    this.emails.push(email)
  }
}
```

Then use it in your Vue component:

**Option 1: Modern `<script setup>` syntax (recommended)**

```vue
<script setup>
import { useMobxBridge } from 'mobx-vue-bridge'
import { UserPresenter } from './presenters/UserPresenter.js'

const userPresenter = new UserPresenter()

// Bridge MobX observable to Vue reactive state
const state = useMobxBridge(userPresenter)
</script>
```

**Option 2: Traditional Composition API**

```vue
<script>
import { useMobxBridge } from 'mobx-vue-bridge'
import { UserPresenter } from './presenters/UserPresenter.js'

export default {
  setup() {
    const userPresenter = new UserPresenter()
    
    // Bridge MobX observable to Vue reactive state
    const state = useMobxBridge(userPresenter)
    
    return {
      state
    }
  }
}
</script>
```

**Template usage:**

```html
<template>
  <div>
    <!-- Two-way binding works seamlessly -->
    <input v-model="state.name" />
    <input v-model.number="state.age" />
    
    <!-- Computed properties are reactive -->
    <p>{{ state.displayName }}</p>
    
    <!-- Methods are properly bound -->
    <button @click="state.addEmail('new@email.com')">
      Add Email
    </button>
    
    <!-- Arrays/objects are deeply reactive -->
    <ul>
      <li v-for="email in state.emails" :key="email">
        {{ email }}
      </li>
    </ul>
  </div>
</template>
```

## 📚 API Reference

### `useMobxBridge(mobxObject, options?)`

Bridges a MobX observable object with Vue's reactivity system.

**Parameters:**
- `mobxObject` - The MobX observable object to bridge
- `options` - Configuration options (optional)

**Options:**
- `allowDirectMutation` (boolean, default: `true`) - Whether to allow direct mutation of properties

**Returns:** Vue reactive state object

```javascript
// With configuration
const state = useMobxBridge(store, {
  allowDirectMutation: false // Prevents direct mutations
})
```

### `usePresenterState(presenter, options?)`

Alias for `useMobxBridge` - commonly used with presenter pattern.

```javascript
const state = usePresenterState(presenter, options)
```

## 🎯 Use Cases

### Presenter Pattern
```javascript
class TodoPresenter {
  constructor(todoService) {
    this.todoService = todoService
    this.todos = []
    this.filter = 'all'
    this.loading = false
    
    makeAutoObservable(this)
  }
  
  get filteredTodos() {
    switch (this.filter) {
      case 'active': return this.todos.filter(t => !t.completed)
      case 'completed': return this.todos.filter(t => t.completed)
      default: return this.todos
    }
  }
  
  async loadTodos() {
    this.loading = true
    try {
      this.todos = await this.todoService.fetchTodos()
    } finally {
      this.loading = false
    }
  }
}

// In component
const presenter = new TodoPresenter(todoService)
const state = usePresenterState(presenter)
```

### Store Integration
```javascript
// MobX store
class AppStore {
  constructor() {
    this.user = null
    this.theme = 'light'
    this.notifications = []
    
    makeAutoObservable(this)
  }
  
  get isAuthenticated() {
    return !!this.user
  }
  
  setTheme(theme) {
    this.theme = theme
  }
}

// Bridge in component
const state = useMobxBridge(appStore)
```

## 🔧 Advanced Features

### Configuration Options

The bridge accepts an optional configuration object to customize its behavior:

```javascript
const state = useMobxBridge(mobxObject, {
  allowDirectMutation: true  // default: true
})
```

#### `allowDirectMutation` (boolean)
Controls whether direct mutations are allowed on the Vue state:
- `true` (default): Allows `state.name = 'New Name'`
- `false`: Mutations must go through MobX actions

```javascript
// Allow direct mutations (default)
const state = useMobxBridge(presenter, { allowDirectMutation: true })
state.name = 'John' // ✅ Works

// Disable direct mutations (action-only mode)
const state = useMobxBridge(presenter, { allowDirectMutation: false })
state.name = 'John' // ❌ Warning: use actions instead
presenter.setName('John') // ✅ Works
```
- ✅ You can use `await nextTick()` when needed for immediate reads

### Deep Reactivity
The bridge automatically handles deep changes in objects and arrays:

```javascript
// These mutations are automatically synced
state.user.profile.name = 'New Name'  // Object mutation
state.todos.push(newTodo)             // Array mutation
state.settings.colors[0] = '#FF0000'  // Nested array mutation
```

**Note on Async Behavior:** Nested mutations (via the deep proxy) are batched using `queueMicrotask()` to prevent corruption during array operations like `shift()`, `unshift()`, and `splice()`. This ensures data correctness. If you need immediate access to updated values after nested mutations in the same function, use Vue's `nextTick()`:

```javascript
import { nextTick } from 'vue'

state.items.push(newItem)
await nextTick()  // Wait for batched update to complete
console.log(state.items)  // Now updated
```

**However, Vue templates, computed properties, and watchers work automatically without `nextTick()`:**

```vue
<template>
  <!-- Auto-updates, no nextTick needed -->
  <div>{{ state.items.length }}</div>
</template>

<script setup>
// Computed auto-updates, no nextTick needed
const itemCount = computed(() => state.items.length)

// Watcher auto-fires, no nextTick needed
watch(() => state.items, (newItems) => {
  console.log('Items changed:', newItems)
})
</script>
```

Top-level property assignments are synchronous:
```javascript
state.count = 42           // Immediate (sync)
state.items = [1, 2, 3]    // Immediate (sync)
state.items.push(4)        // Batched (async - requires nextTick for immediate read)
```

**Best Practice:** Keep business logic in your MobX Presenter. When you mutate via the Presenter, everything is synchronous:

```javascript
// ✅ Presenter pattern - always synchronous, no nextTick needed
presenter.items.push(newItem)
console.log(presenter.items)  // Immediately updated!
```

## 🏗️ Architecture & Implementation

### Modular Design (v1.4.0+)

The bridge uses a clean, modular architecture for better maintainability:

```
src/
├── mobxVueBridge.js           # Main bridge (321 lines)
└── utils/
    ├── memberDetection.js     # MobX property categorization (210 lines)
    ├── equality.js            # Deep equality with circular protection (47 lines)
    └── deepProxy.js           # Nested reactivity with batching (109 lines)
```

### Zero-Side-Effect Initialization

The bridge uses **lazy detection** to avoid calling setters during initialization:

```javascript
class GuestPresenter {
  get currentRoom() {
    return this.repository.currentRoomId
  }
  
  set currentRoom(val) {
    this.repository.currentRoomId = val
    this.refreshDataOnTabChange()  // Side effect!
  }
}

// ✅ v1.4.0+: No side effects during bridge creation
const state = useMobxBridge(presenter)  // refreshDataOnTabChange() NOT called

// ✅ Side effects only happen during actual mutations
state.currentRoom = 'room-123'  // refreshDataOnTabChange() called here
```

**How it works:**
1. **Detection phase**: Checks descriptor existence only (`descriptor.get && descriptor.set`)
2. **First write**: Tests if setter actually works by attempting the write
3. **Caching**: Results stored in `readOnlyDetected` Set for O(1) future lookups

This prevents bugs where setter side effects were triggered during bridge setup, while maintaining accurate runtime behavior.

### Error Handling
The bridge gracefully handles edge cases:

- Uninitialized computed properties
- Circular references
- Failed setter operations
- Missing dependencies

### Performance Optimization
- Intelligent change detection prevents unnecessary updates
- Efficient shallow/deep equality checks
- Minimal overhead for large object graphs

## 🧪 Testing

```bash
npm test                 # Run tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © [Visar Uruqi](https://github.com/visaruruqi)

## 🔗 Links

- [GitHub Repository](https://github.com/visaruruqi/mobx-vue-bridge)
- [NPM Package](https://www.npmjs.com/package/mobx-vue-bridge)
- [Issues](https://github.com/visaruruqi/mobx-vue-bridge/issues)