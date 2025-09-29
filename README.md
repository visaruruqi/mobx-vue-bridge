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

### Deep Reactivity
The bridge automatically handles deep changes in objects and arrays:

```javascript
// These mutations are automatically synced
state.user.profile.name = 'New Name'  // Object mutation
state.todos.push(newTodo)             // Array mutation
state.settings.colors[0] = '#FF0000'  // Nested array mutation
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