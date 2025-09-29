import { describe, it, expect, vi } from 'vitest'
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
  watch: vi.fn((source, callback, options) => {
    if (typeof source === 'object' && source.value !== undefined) {
      source._watcher = callback
    }
    return () => {}
  })
}))

import { useMobxBridge } from '../mobxVueBridge'

describe('MobX-Vue Bridge Uninitialized Getters', () => {
  it('should include getters that throw during evaluation due to uninitialized nested objects', () => {
    class UserPresenter {
      constructor() {
        this.user = null
        this.profile = null
        this.settings = null
        makeAutoObservable(this)
      }

      // These getters will throw initially because nested objects are null
      get userName() {
        return this.user.name // Will throw: Cannot read property 'name' of null
      }

      get userEmail() {
        return this.user.email // Will throw: Cannot read property 'email' of null
      }

      get profileBio() {
        return this.profile.bio // Will throw: Cannot read property 'bio' of null
      }

      get deepNestedValue() {
        return this.settings.ui.theme.colors.primary // Will throw: Cannot read property 'ui' of null
      }

      // This getter should work fine
      get isUserLoaded() {
        return this.user !== null
      }

      // Method to initialize data
      async initialize() {
        this.user = {
          name: 'John Doe',
          email: 'john.doe@example.com'
        }
        this.profile = {
          bio: 'Software Engineer'
        }
        this.settings = {
          ui: {
            theme: {
              colors: {
                primary: '#007bff'
              }
            }
          }
        }
      }
    }

    const presenter = new UserPresenter()
    const state = useMobxBridge(presenter)


    // Test that ALL getters are included as properties, even those that throw during evaluation
    expect('userName' in state).toBe(true)
    expect('userEmail' in state).toBe(true)
    expect('profileBio' in state).toBe(true)
    expect('deepNestedValue' in state).toBe(true)
    expect('isUserLoaded' in state).toBe(true)

    // Test initial values - getters that throw should return undefined
    expect(state.userName).toBeUndefined()
    expect(state.userEmail).toBeUndefined()
    expect(state.profileBio).toBeUndefined()
    expect(state.deepNestedValue).toBeUndefined()
    
    // This getter should work fine
    expect(state.isUserLoaded).toBe(false)

    // Test that all getters are read-only
    expect(() => {
      state.userName = 'Should not work'
    }).toThrow(/Cannot assign to computed property/)

    expect(() => {
      state.deepNestedValue = 'Should not work'
    }).toThrow(/Cannot assign to computed property/)

    // Test that methods are available
    expect(typeof state.initialize).toBe('function')
  })

  it('should update getters correctly after nested objects are initialized', async () => {
    class DataPresenter {
      constructor() {
        this.data = null
        makeAutoObservable(this)
      }

      // Getters that will initially throw
      get itemCount() {
        return this.data.items.length
      }

      get firstItemName() {
        return this.data.items[0].name
      }

      get totalPrice() {
        return this.data.items.reduce((sum, item) => sum + item.price, 0)
      }

      get metadata() {
        return this.data.meta.version
      }

      // Initialize data
      loadData() {
        this.data = {
          items: [
            { name: 'Item 1', price: 10 },
            { name: 'Item 2', price: 20 },
            { name: 'Item 3', price: 15 }
          ],
          meta: {
            version: '1.0.0'
          }
        }
      }
    }

    const presenter = new DataPresenter()
    const state = useMobxBridge(presenter)


    // Test that all getters are included as properties
    expect('itemCount' in state).toBe(true)
    expect('firstItemName' in state).toBe(true)
    expect('totalPrice' in state).toBe(true)
    expect('metadata' in state).toBe(true)

    // Test initial values (should be undefined due to errors)
    expect(state.itemCount).toBeUndefined()
    expect(state.firstItemName).toBeUndefined()
    expect(state.totalPrice).toBeUndefined()
    expect(state.metadata).toBeUndefined()

    // Initialize the data
    presenter.loadData()

    // Test that getters now return correct values
    expect(state.itemCount).toBe(3)
    expect(state.firstItemName).toBe('Item 1')
    expect(state.totalPrice).toBe(45)
    expect(state.metadata).toBe('1.0.0')

    // Test that getters are still read-only
    expect(() => {
      state.itemCount = 5
    }).toThrow(/Cannot assign to computed property/)

    // Test reactivity - modify the data and check if getters update
    presenter.data.items.push({ name: 'Item 4', price: 25 })
    expect(state.itemCount).toBe(4)
    expect(state.totalPrice).toBe(70)
  })

  it('should handle partial initialization gracefully', () => {
    class PartialPresenter {
      constructor() {
        this.user = null
        this.config = null
        makeAutoObservable(this)
      }

      get userName() {
        return this.user.name
      }

      get userAge() {
        return this.user.age
      }

      get configTheme() {
        return this.config.theme
      }

      get configLanguage() {
        return this.config.language
      }

      initializeUser() {
        this.user = { name: 'Alice', age: 30 }
      }

      initializeConfig() {
        this.config = { theme: 'dark', language: 'en' }
      }
    }

    const presenter = new PartialPresenter()
    const state = useMobxBridge(presenter)

    // All getters should be included as properties
    expect('userName' in state).toBe(true)
    expect('userAge' in state).toBe(true)
    expect('configTheme' in state).toBe(true)
    expect('configLanguage' in state).toBe(true)

    // Initially all should be undefined
    expect(state.userName).toBeUndefined()
    expect(state.userAge).toBeUndefined()
    expect(state.configTheme).toBeUndefined()
    expect(state.configLanguage).toBeUndefined()

    // Initialize user only
    presenter.initializeUser()
    expect(state.userName).toBe('Alice')
    expect(state.userAge).toBe(30)
    expect(state.configTheme).toBeUndefined() // Still undefined
    expect(state.configLanguage).toBeUndefined() // Still undefined

    // Initialize config
    presenter.initializeConfig()
    expect(state.userName).toBe('Alice')
    expect(state.userAge).toBe(30)
    expect(state.configTheme).toBe('dark')
    expect(state.configLanguage).toBe('en')
  })

  it('should handle getters that access deeply nested arrays', () => {
    class ArrayPresenter {
      constructor() {
        this.data = null
        makeAutoObservable(this)
      }

      get firstCategory() {
        return this.data.categories[0].name
      }

      get categoryCount() {
        return this.data.categories.length
      }

      get allProductNames() {
        return this.data.categories.flatMap(cat => cat.products.map(p => p.name))
      }

      get totalProducts() {
        return this.data.categories.reduce((sum, cat) => sum + cat.products.length, 0)
      }

      loadData() {
        this.data = {
          categories: [
            {
              name: 'Electronics',
              products: [
                { name: 'Laptop', price: 1000 },
                { name: 'Phone', price: 500 }
              ]
            },
            {
              name: 'Books',
              products: [
                { name: 'JavaScript Guide', price: 30 },
                { name: 'Vue.js Handbook', price: 25 }
              ]
            }
          ]
        }
      }
    }

    const presenter = new ArrayPresenter()
    const state = useMobxBridge(presenter)

    // All getters should be included as properties
    expect('firstCategory' in state).toBe(true)
    expect('categoryCount' in state).toBe(true)
    expect('allProductNames' in state).toBe(true)
    expect('totalProducts' in state).toBe(true)

    // Initially all should be undefined
    expect(state.firstCategory).toBeUndefined()
    expect(state.categoryCount).toBeUndefined()
    expect(state.allProductNames).toBeUndefined()
    expect(state.totalProducts).toBeUndefined()

    // Load data
    presenter.loadData()

    // Test that getters work correctly
    expect(state.firstCategory).toBe('Electronics')
    expect(state.categoryCount).toBe(2)
    expect(state.allProductNames).toEqual(['Laptop', 'Phone', 'JavaScript Guide', 'Vue.js Handbook'])
    expect(state.totalProducts).toBe(4)

    // Test reactivity
    presenter.data.categories[0].products.push({ name: 'Tablet', price: 300 })
    expect(state.allProductNames).toEqual(['Laptop', 'Phone', 'Tablet', 'JavaScript Guide', 'Vue.js Handbook'])
    expect(state.totalProducts).toBe(5)
  })
})
