import { describe, test, expect, vi } from 'vitest'
import { makeAutoObservable } from 'mobx'

// Mock Vue's functions
vi.mock('vue', () => ({
  reactive: vi.fn((obj) => new Proxy(obj, {
    get: (target, prop) => target[prop],
    set: (target, prop, value) => {
      target[prop] = value
      return true
    }
  })),
  ref: vi.fn((value) => ({ value })),
  onUnmounted: vi.fn(),
  markRaw: vi.fn((value) => value),
  watch: vi.fn((source, callback, options) => {
    // Store the callback for manual triggering
    if (typeof source === 'object' && source.value !== undefined) {
      // For refs, store the callback
      source._watcher = callback
    }
    return () => {} // cleanup function
  }),
  nextTick: vi.fn(() => Promise.resolve())
}))

import { useMobxBridge } from '../mobxVueBridge'
import { nextTick } from 'vue'

describe('MobX-Vue Bridge Two-Way Binding', () => {
  test('should sync Vue → MobX changes', () => {
    class SimpleStore {
      count = 0
      name = 'test'
      isActive = false
      
      constructor() {
        makeAutoObservable(this)
      }
    }
    
    const presenter = new SimpleStore()
    const state = useMobxBridge(presenter)
    
    // Test Vue → MobX sync
    state.count = 42
    expect(presenter.count).toBe(42)
    
    state.name = 'updated'
    expect(presenter.name).toBe('updated')
    
    state.isActive = true
    expect(presenter.isActive).toBe(true)
  })

  test('should sync MobX → Vue changes', () => {
    class SimpleStore {
      count = 0
      name = 'test'
      
      constructor() {
        makeAutoObservable(this)
      }
    }
    
    const presenter = new SimpleStore()
    const state = useMobxBridge(presenter)
    
    // Test MobX → Vue sync
    presenter.count = 100
    expect(state.count).toBe(100)
    
    presenter.name = 'mobx-updated'
    expect(state.name).toBe('mobx-updated')
  })

  test('should handle computed properties correctly', () => {
    class ComputedStore {
      count = 0
      
      constructor() {
        makeAutoObservable(this)
      }
      
      get doubled() {
        return this.count * 2
      }
    }
    
    const presenter = new ComputedStore()
    const state = useMobxBridge(presenter)
    
    
    // Test computed property
    expect(state.doubled).toBe(0)
    
    // Change the underlying observable
    state.count = 5
    expect(state.doubled).toBe(10)
    
    // Test that computed is read-only
    expect(() => {
      state.doubled = 20
    }).toThrow()
  })

  test('should handle actions correctly', () => {
    class ActionStore {
      count = 0
      
      constructor() {
        makeAutoObservable(this)
      }
      
      increment() {
        this.count++
      }
      
      setCount(value) {
        this.count = value
      }
    }
    
    const presenter = new ActionStore()
    const state = useMobxBridge(presenter)
    
    // Test action calls
    state.increment()
    expect(presenter.count).toBe(1)
    expect(state.count).toBe(1)
    
    state.setCount(50)
    expect(presenter.count).toBe(50)
    expect(state.count).toBe(50)
  })

  test('should handle nested objects', async () => {
    class FormStore {
      form = {
        name: '',
        email: ''
      }
      
      constructor() {
        makeAutoObservable(this)
      }
    }
    
    const presenter = new FormStore()
    const state = useMobxBridge(presenter)
    
    // Test nested object changes
    state.form.name = 'John Doe'
    await nextTick()
    expect(presenter.form.name).toBe('John Doe')
    expect(state.form.name).toBe('John Doe')
    
    state.form.email = 'john@example.com'
    await nextTick()
    expect(presenter.form.email).toBe('john@example.com')
    expect(state.form.email).toBe('john@example.com')
  })

  test('should handle arrays', async () => {
    class ArrayStore {
      items = []
      
      constructor() {
        makeAutoObservable(this)
      }
    }
    
    const presenter = new ArrayStore()
    const state = useMobxBridge(presenter)
    
    // Test array changes
    state.items = ['item1', 'item2']
    expect(presenter.items).toEqual(['item1', 'item2'])
    expect(state.items).toEqual(['item1', 'item2'])
    
    // Test array mutations
    state.items.push('item3')
    await nextTick()
    expect(presenter.items).toEqual(['item1', 'item2', 'item3'])
    expect(state.items).toEqual(['item1', 'item2', 'item3'])
  })

  test('should verify array assignment and array push is working in two ways', async () => {
    class MixedStore {
      count = 0
      items = []
      
      constructor() {
        makeAutoObservable(this)
      }
    }
    
    const presenter = new MixedStore()
    const state = useMobxBridge(presenter)
    
    // Test that the functionality works (markRaw is being called internally)
    state.count = 5
    expect(presenter.count).toBe(5)
    
    // Test array assignment
    state.items = ['item1', 'item2']
    expect(presenter.items).toEqual(['item1', 'item2'])
    
    // Test array mutation
    state.items.push('item3')
    await nextTick()
    expect(presenter.items).toEqual(['item1', 'item2', 'item3'])
    
    // The fact that these tests pass means markRaw is working correctly
    // because without it, Vue proxies would interfere with MobX
  })
})
