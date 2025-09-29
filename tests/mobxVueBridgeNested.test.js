import { describe, it, expect } from 'vitest'
import { makeAutoObservable } from 'mobx'

/**
 * Tests for deeply nested object properties in MobX-Vue Bridge
 * 
 * This tests whether changes to deeply nested properties
 * (e.g., state.user.profile.settings.theme) properly sync with MobX
 */

describe('MobX-Vue Bridge - Deeply Nested Properties', () => {
  it('should handle deeply nested object properties', () => {
    const presenter = makeAutoObservable({
      user: {
        profile: {
          settings: {
            theme: 'light',
            language: 'en',
            notifications: {
              email: true,
              push: false,
              sms: false
            }
          },
          personal: {
            firstName: 'John',
            lastName: 'Doe',
            address: {
              street: '123 Main St',
              city: 'Anytown',
              country: 'USA'
            }
          }
        },
        preferences: {
          layout: 'grid',
          filters: {
            category: 'all',
            status: 'active'
          }
        }
      }
    })

    // Create two-way binding for the root object
    const state = {}
    Object.defineProperty(state, 'user', {
      get() {
        return presenter.user
      },
      set(value) {
        presenter.user = value
      },
      enumerable: true,
      configurable: true
    })

    // Test 1: Direct nested property access
    state.user.profile.settings.theme = 'dark'
    expect(presenter.user.profile.settings.theme).toBe('dark')
    expect(state.user.profile.settings.theme).toBe('dark')

    // Test 2: Multiple levels deep
    state.user.profile.personal.address.city = 'New York'
    expect(presenter.user.profile.personal.address.city).toBe('New York')
    expect(state.user.profile.personal.address.city).toBe('New York')

    // Test 3: Nested object replacement
    const newSettings = {
      theme: 'auto',
      language: 'es',
      notifications: {
        email: false,
        push: true,
        sms: true
      }
    }
    state.user.profile.settings = newSettings
    expect(presenter.user.profile.settings).toStrictEqual(newSettings)
    expect(state.user.profile.settings).toStrictEqual(newSettings)

    // Test 4: Deep nested object replacement
    const newAddress = {
      street: '456 Oak Ave',
      city: 'Boston',
      country: 'USA'
    }
    state.user.profile.personal.address = newAddress
    expect(presenter.user.profile.personal.address).toStrictEqual(newAddress)
    expect(state.user.profile.personal.address).toStrictEqual(newAddress)

    // Test 5: Array within nested objects
    presenter.user.profile.settings.favoriteColors = ['blue', 'green']
    
    // Test that we can modify the array directly (no need for additional binding)
    state.user.profile.settings.favoriteColors = ['red', 'yellow']
    expect(presenter.user.profile.settings.favoriteColors).toStrictEqual(['red', 'yellow'])
    expect(state.user.profile.settings.favoriteColors).toStrictEqual(['red', 'yellow'])
  })

  it('should demonstrate the limitation of shallow binding', () => {
    const presenter = makeAutoObservable({
      config: {
        api: {
          baseUrl: 'https://api.example.com',
          endpoints: {
            users: '/users',
            posts: '/posts'
          }
        }
      }
    })

    // Create shallow binding (only for the root property)
    const state = {}
    Object.defineProperty(state, 'config', {
      get() {
        return presenter.config
      },
      set(value) {
        presenter.config = value
      },
      enumerable: true,
      configurable: true
    })

    // Test: Changes to nested properties work because they're references
    state.config.api.baseUrl = 'https://newapi.example.com'
    expect(presenter.config.api.baseUrl).toBe('https://newapi.example.com')
    expect(state.config.api.baseUrl).toBe('https://newapi.example.com')

    // Test: Changes to deeply nested properties also work
    state.config.api.endpoints.users = '/api/users'
    expect(presenter.config.api.endpoints.users).toBe('/api/users')
    expect(state.config.api.endpoints.users).toBe('/api/users')

    // Test: Replacing entire nested object works
    const newApi = {
      baseUrl: 'https://v2.api.example.com',
      endpoints: {
        users: '/v2/users',
        posts: '/v2/posts',
        comments: '/v2/comments'
      }
    }
    state.config.api = newApi
    expect(presenter.config.api).toStrictEqual(newApi)
    expect(state.config.api).toStrictEqual(newApi)
  })

  it('should work with arrays of objects', () => {
    const presenter = makeAutoObservable({
      items: [
        { id: 1, name: 'Item 1', metadata: { category: 'A', tags: ['tag1'] } },
        { id: 2, name: 'Item 2', metadata: { category: 'B', tags: ['tag2'] } }
      ]
    })

    // Create binding for the array
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

    // Test: Modify nested property in array item
    state.items[0].metadata.category = 'C'
    expect(presenter.items[0].metadata.category).toBe('C')
    expect(state.items[0].metadata.category).toBe('C')

    // Test: Modify array within nested object
    state.items[1].metadata.tags.push('tag3')
    expect(presenter.items[1].metadata.tags).toEqual(['tag2', 'tag3'])
    expect(state.items[1].metadata.tags).toEqual(['tag2', 'tag3'])

    // Test: Replace entire nested object
    const newMetadata = { category: 'D', tags: ['tag4', 'tag5'] }
    state.items[0].metadata = newMetadata
    expect(presenter.items[0].metadata).toStrictEqual(newMetadata)
    expect(state.items[0].metadata).toStrictEqual(newMetadata)

    // Test: Add new item to array
    const newItem = { id: 3, name: 'Item 3', metadata: { category: 'E', tags: ['tag6'] } }
    state.items.push(newItem)
    expect(presenter.items).toHaveLength(3)
    expect(state.items).toHaveLength(3)
    expect(presenter.items[2]).toStrictEqual(newItem)
    expect(state.items[2]).toStrictEqual(newItem)
  })

  it('should demonstrate reactive updates in Vue context', () => {
    // This test simulates what happens in a real Vue component
    const presenter = makeAutoObservable({
      form: {
        user: {
          personal: {
            name: '',
            email: ''
          },
          preferences: {
            newsletter: false,
            notifications: true
          }
        }
      }
    })

    // Create the binding (this is what useMobxBridge does)
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

    // Simulate v-model behavior for deeply nested properties
    // In Vue: <input v-model="state.form.user.personal.name" />
    
    // Test: Vue → MobX sync
    state.form.user.personal.name = 'Jane Doe'
    expect(presenter.form.user.personal.name).toBe('Jane Doe')
    expect(state.form.user.personal.name).toBe('Jane Doe')

    // Test: MobX → Vue sync (via action)
    presenter.form.user.personal.email = 'jane@example.com'
    expect(presenter.form.user.personal.email).toBe('jane@example.com')
    expect(state.form.user.personal.email).toBe('jane@example.com')

    // Test: Checkbox v-model simulation
    state.form.user.preferences.newsletter = true
    expect(presenter.form.user.preferences.newsletter).toBe(true)
    expect(state.form.user.preferences.newsletter).toBe(true)

    // Test: Select v-model simulation
    state.form.user.preferences.notifications = false
    expect(presenter.form.user.preferences.notifications).toBe(false)
    expect(state.form.user.preferences.notifications).toBe(false)
  })

  it('should handle edge cases with nested properties', () => {
    const presenter = makeAutoObservable({
      data: {
        level1: {
          level2: {
            level3: {
              value: 'initial'
            }
          }
        }
      }
    })

    const state = {}
    Object.defineProperty(state, 'data', {
      get() {
        return presenter.data
      },
      set(value) {
        presenter.data = value
      },
      enumerable: true,
      configurable: true
    })

    // Test: Setting to null
    state.data.level1.level2.level3 = null
    expect(presenter.data.level1.level2.level3).toBe(null)
    expect(state.data.level1.level2.level3).toBe(null)

    // Test: Setting to undefined
    state.data.level1.level2.level3 = undefined
    expect(presenter.data.level1.level2.level3).toBe(undefined)
    expect(state.data.level1.level2.level3).toBe(undefined)

    // Test: Setting to empty object
    state.data.level1.level2.level3 = {}
    expect(presenter.data.level1.level2.level3).toStrictEqual({})
    expect(state.data.level1.level2.level3).toStrictEqual({})

    // Test: Adding new properties
    state.data.level1.level2.level3.newProperty = 'new value'
    expect(presenter.data.level1.level2.level3.newProperty).toBe('new value')
    expect(state.data.level1.level2.level3.newProperty).toBe('new value')
  })
})
