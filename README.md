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
  allowDirectMutation: true,  // default: true
  deep: 'async'               // default: 'async', can be 'sync'
})
```

#### `allowDirectMutation` (boolean)
Controls whether direct mutations are allowed on the Vue state:
- `true` (default): Allows `state.name = 'New Name'`
- `false`: Mutations must go through MobX actions

#### `deep` ('async' | 'sync')
Controls how nested mutations (e.g., `state.items.push()`) are synchronized:

**'async' (default, recommended):**
- ✅ **Safe**: Prevents array corruption during operations like `shift()`, `unshift()`, `splice()`
- ✅ **Correct**: All array methods work as expected
- ⚠️ **Async**: Need `await nextTick()` for immediate reads after nested mutations
- 🎯 **Best Practice**: Keep logic in MobX Presenter = always synchronous, no `nextTick()` needed

```javascript
// Async mode (default) - safe and correct
const state = useMobxBridge(presenter, { deep: 'async' })

state.items.push(4)
await nextTick()  // Only needed if reading immediately in same function
console.log(state.items)  // [1, 2, 3, 4]

// But Vue templates/computed/watchers work automatically - no nextTick needed!
```

**'sync' (legacy, not recommended):**
- ✅ **Synchronous**: No `nextTick()` needed for immediate reads
- ❌ **Risky**: Array methods may corrupt data due to multiple synchronous clones
- ⚠️ **Bug Prone**: `shift()`, `unshift()`, `splice()` may produce incorrect results
- 🚫 **Use Only**: If you understand the risks and need immediate synchronous access

```javascript
// Sync mode - immediate but risky
const state = useMobxBridge(presenter, { deep: 'sync' })

state.items.shift()  // May produce [2, 2, 3] instead of [2, 3]
console.log(state.items)  // Might be corrupted!
```

**When to use async mode (recommended):**
- ✅ You want data correctness (arrays always work correctly)
- ✅ You follow the Presenter pattern (logic in MobX = always sync)
- ✅ You can use `await nextTick()` when needed for immediate reads

**When you might consider sync mode:**
- ⚠️ You need immediate synchronous access to nested mutations
- ⚠️ You don't use array methods like `shift()`, `unshift()`, `splice()`
- ⚠️ You understand and accept the data corruption risks

### Deep Reactivity
The bridge automatically handles deep changes in objects and arrays:

```javascript
// These mutations are automatically synced
state.user.profile.name = 'New Name'  // Object mutation
state.todos.push(newTodo)             // Array mutation
state.settings.colors[0] = '#FF0000'  // Nested array mutation
```

**Note on Async Behavior:** Nested mutations (via the deep proxy) are batched using `queueMicrotask()` to prevent corruption during array operations like `shift()`, `unshift()`, and `splice()`. This means changes are applied in the next microtask. If you need immediate access to updated values after nested mutations, use Vue's `nextTick()`:

```javascript
import { nextTick } from 'vue'

state.items.push(newItem)
await nextTick()  // Wait for batched update to complete
console.log(state.items)  // Now updated
```

Top-level property assignments are still synchronous:
```javascript
state.count = 42           // Immediate (sync)
state.items = [1, 2, 3]    // Immediate (sync)
state.items.push(4)        // Batched (async - requires nextTick)
```

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