import { describe, it, expect } from 'vitest'
import { makeAutoObservable } from 'mobx'

/**
 * Integration tests for MobX-Vue Bridge Two-Way Binding
 * 
 * These tests verify the core two-way binding mechanism works
 * by testing the Object.defineProperty approach directly,
 * without requiring Vue component context.
 */

describe('MobX-Vue Bridge Integration Tests', () => {
  it('should create working two-way binding using Object.defineProperty', () => {
    // Create a MobX presenter
    const presenter = makeAutoObservable({
      search: 'initial',
      modalOpen: false,
      count: 0,
      
      get hasSearch() {
        return this.search.length > 0
      },
      
      setSearch(value) {
        this.search = value
      },
      
      increment() {
        this.count++
      }
    })

    // Create the two-way binding manually (simulating what useMobxBridge does)
    const state = {}
    
    // Create getter/setter for observable properties
    Object.defineProperty(state, 'search', {
      get() {
        return presenter.search
      },
      set(value) {
        presenter.search = value
      },
      enumerable: true,
      configurable: true
    })
    
    Object.defineProperty(state, 'modalOpen', {
      get() {
        return presenter.modalOpen
      },
      set(value) {
        presenter.modalOpen = value
      },
      enumerable: true,
      configurable: true
    })
    
    Object.defineProperty(state, 'count', {
      get() {
        return presenter.count
      },
      set(value) {
        presenter.count = value
      },
      enumerable: true,
      configurable: true
    })

    // Create read-only access for computed properties
    Object.defineProperty(state, 'hasSearch', {
      get() {
        return presenter.hasSearch
      },
      enumerable: true,
      configurable: true
      // No setter - makes it read-only
    })

    // Test initial state
    expect(presenter.search).toBe('initial')
    expect(state.search).toBe('initial')
    expect(presenter.modalOpen).toBe(false)
    expect(state.modalOpen).toBe(false)
    expect(presenter.count).toBe(0)
    expect(state.count).toBe(0)

    // Test Vue → MobX sync (simulating v-model)
    state.search = 'test query'
    expect(presenter.search).toBe('test query')
    expect(state.search).toBe('test query')

    state.modalOpen = true
    expect(presenter.modalOpen).toBe(true)
    expect(state.modalOpen).toBe(true)

    state.count = 42
    expect(presenter.count).toBe(42)
    expect(state.count).toBe(42)

    // Test MobX → Vue sync (simulating action calls)
    presenter.setSearch('from action')
    expect(presenter.search).toBe('from action')
    expect(state.search).toBe('from action')

    presenter.increment()
    expect(presenter.count).toBe(43)
    expect(state.count).toBe(43)

    // Test computed properties (read-only)
    expect(presenter.hasSearch).toBe(true)
    expect(state.hasSearch).toBe(true)

    // Try to set computed property (should not work)
    try {
      state.hasSearch = false
      expect.fail('Should not be able to set computed property')
    } catch (error) {
      // Expected - no setter defined
      expect(presenter.hasSearch).toBe(true)
      expect(state.hasSearch).toBe(true)
    }
  })

  it('should work with nested object properties', () => {
    const presenter = makeAutoObservable({
      form: {
        name: '',
        email: '',
        age: 0
      }
    })

    // Create two-way binding for nested object
    const state = {}
    Object.defineProperty(state, 'form', {
      get() {
        return presenter.form
      },
      set(value) {
        presenter.form = value
      },
      enumerable: true,
      configurable: true
    })

    // Test nested property access
    state.form.name = 'John Doe'
    expect(presenter.form.name).toBe('John Doe')
    expect(state.form.name).toBe('John Doe')

    state.form.email = 'john@example.com'
    expect(presenter.form.email).toBe('john@example.com')
    expect(state.form.email).toBe('john@example.com')

    state.form.age = 30
    expect(presenter.form.age).toBe(30)
    expect(state.form.age).toBe(30)

    // Test replacing entire object
    const newForm = { name: 'Jane Doe', email: 'jane@example.com', age: 25 }
    state.form = newForm
    expect(presenter.form).toStrictEqual(newForm)
    expect(state.form).toStrictEqual(newForm)
  })

  it('should work with array properties', () => {
    const presenter = makeAutoObservable({
      items: [],
      tags: ['vue', 'mobx']
    })

    // Create two-way binding for arrays
    const state = {}
    Object.defineProperty(state, 'items', {
      get() {
        return presenter.items
      },
      set(value) {
        presenter.items = value
      },
      enumerable: true,
      configurable: true
    })

    Object.defineProperty(state, 'tags', {
      get() {
        return presenter.tags
      },
      set(value) {
        presenter.tags = value
      },
      enumerable: true,
      configurable: true
    })

    // Test array replacement
    const newItems = ['item1', 'item2', 'item3']
    state.items = newItems
    expect(presenter.items).toStrictEqual(newItems)
    expect(state.items).toStrictEqual(newItems)

    // Test array modification (this works because arrays are references)
    state.tags.push('javascript')
    expect(presenter.tags).toEqual(['vue', 'mobx', 'javascript'])
    expect(state.tags).toEqual(['vue', 'mobx', 'javascript'])

    // Test array replacement
    const newTags = ['react', 'typescript']
    state.tags = newTags
    expect(presenter.tags).toStrictEqual(newTags)
    expect(state.tags).toStrictEqual(newTags)
  })

  it('should handle different data types correctly', () => {
    const presenter = makeAutoObservable({
      stringValue: 'hello',
      numberValue: 42,
      booleanValue: false,
      nullValue: null,
      undefinedValue: undefined,
      objectValue: { key: 'value' },
      arrayValue: [1, 2, 3]
    })

    // Create two-way binding for all properties
    const state = {}
    const properties = ['stringValue', 'numberValue', 'booleanValue', 'nullValue', 'undefinedValue', 'objectValue', 'arrayValue']
    
    properties.forEach(prop => {
      Object.defineProperty(state, prop, {
        get() {
          return presenter[prop]
        },
        set(value) {
          presenter[prop] = value
        },
        enumerable: true,
        configurable: true
      })
    })

    // Test string
    state.stringValue = 'world'
    expect(presenter.stringValue).toBe('world')
    expect(state.stringValue).toBe('world')

    // Test number
    state.numberValue = 100
    expect(presenter.numberValue).toBe(100)
    expect(state.numberValue).toBe(100)

    // Test boolean
    state.booleanValue = true
    expect(presenter.booleanValue).toBe(true)
    expect(state.booleanValue).toBe(true)

    // Test null
    state.nullValue = 'not null'
    expect(presenter.nullValue).toBe('not null')
    expect(state.nullValue).toBe('not null')

    // Test undefined
    state.undefinedValue = 'defined'
    expect(presenter.undefinedValue).toBe('defined')
    expect(state.undefinedValue).toBe('defined')

    // Test object
    const newObject = { newKey: 'newValue' }
    state.objectValue = newObject
    expect(presenter.objectValue).toStrictEqual(newObject)
    expect(state.objectValue).toStrictEqual(newObject)

    // Test array
    const newArray = [4, 5, 6]
    state.arrayValue = newArray
    expect(presenter.arrayValue).toStrictEqual(newArray)
    expect(state.arrayValue).toStrictEqual(newArray)
  })
})
