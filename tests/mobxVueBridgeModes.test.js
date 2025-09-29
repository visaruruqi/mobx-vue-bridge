import { describe, it, expect, vi } from 'vitest'
import { makeAutoObservable } from 'mobx'

/**
 * Tests demonstrating the different binding modes in MobX-Vue Bridge
 * 
 * This tests the different modes: 'two-way', 'read-only', 'action-only'
 * and demonstrates how to control direct state mutation
 */

describe('MobX-Vue Bridge - Binding Modes', () => {
  it('should work in two-way mode (default)', () => {
    const presenter = makeAutoObservable({
      search: '',
      count: 0,
      
      setSearch(value) {
        this.search = value
      },
      
      increment() {
        this.count++
      }
    })

    // Simulate two-way binding (what we want to achieve)
    const state = {}
    Object.defineProperty(state, 'search', {
      get() { return presenter.search },
      set(value) { 
        // In two-way mode: allow direct mutation
        presenter.search = value 
      },
      enumerable: true,
      configurable: true
    })

    // Test: Direct mutation should work
    state.search = 'test'
    expect(presenter.search).toBe('test')
    expect(state.search).toBe('test')

    // Test: Actions should still work
    state.setSearch = presenter.setSearch.bind(presenter)
    state.setSearch('from action')
    expect(presenter.search).toBe('from action')
    expect(state.search).toBe('from action')
  })

  it('should work in read-only mode', () => {
    const presenter = makeAutoObservable({
      search: '',
      count: 0,
      
      setSearch(value) {
        this.search = value
      }
    })

    const onDirectMutation = vi.fn()

    // Simulate read-only binding
    const state = {}
    Object.defineProperty(state, 'search', {
      get() { return presenter.search },
      set(value) {
        // In read-only mode: block direct mutation
        console.warn(`Direct mutation of 'search' is disabled. Use actions instead.`)
        onDirectMutation('search', value, 'read-only')
        return // Don't update
      },
      enumerable: true,
      configurable: true
    })

    // Test: Direct mutation should be blocked
    state.search = 'test'
    expect(presenter.search).toBe('')  // Unchanged
    expect(state.search).toBe('')      // Unchanged
    expect(onDirectMutation).toHaveBeenCalledWith('search', 'test', 'read-only')

    // Test: Actions should still work
    state.setSearch = presenter.setSearch.bind(presenter)
    state.setSearch('from action')
    expect(presenter.search).toBe('from action')
    expect(state.search).toBe('from action')
  })

  it('should work in action-only mode', () => {
    const presenter = makeAutoObservable({
      search: '',
      
      setSearch(value) {
        // Add validation in action
        if (value.length < 3) {
          throw new Error('Search term must be at least 3 characters')
        }
        this.search = value
      }
    })

    const onDirectMutation = vi.fn()

    // Simulate action-only binding
    const state = {}
    Object.defineProperty(state, 'search', {
      get() { return presenter.search },
      set(value) {
        // In action-only mode: block direct mutation
        console.warn(`Direct mutation of 'search' is disabled. Use actions instead.`)
        onDirectMutation('search', value, 'action-only')
        return // Don't update
      },
      enumerable: true,
      configurable: true
    })

    // Test: Direct mutation should be blocked
    state.search = 'test'
    expect(presenter.search).toBe('')  // Unchanged
    expect(state.search).toBe('')      // Unchanged
    expect(onDirectMutation).toHaveBeenCalledWith('search', 'test', 'action-only')

    // Test: Actions with validation should work
    state.setSearch = presenter.setSearch.bind(presenter)
    state.setSearch('valid search')
    expect(presenter.search).toBe('valid search')
    expect(state.search).toBe('valid search')

    // Test: Actions with validation should reject invalid data
    expect(() => {
      state.setSearch('ab')  // Too short
    }).toThrow('Search term must be at least 3 characters')
  })

  it('should demonstrate the benefits of action-only mode', () => {
    const presenter = makeAutoObservable({
      userEmail: '',
      userAge: 0,
      userRole: 'user',
      
      updateUser(userData) {
        // Validation in action
        if (userData.email && !userData.email.includes('@')) {
          throw new Error('Invalid email format')
        }
        if (userData.age && userData.age < 0) {
          throw new Error('Age cannot be negative')
        }
        if (userData.role && !['user', 'admin', 'moderator'].includes(userData.role)) {
          throw new Error('Invalid role')
        }
        
        // Business logic
        if (userData.status === 'suspended') {
          console.log('User suspended - sending notification')
        }
        
        // Update state
        if (userData.email) this.userEmail = userData.email
        if (userData.age !== undefined) this.userAge = userData.age
        if (userData.role) this.userRole = userData.role
      }
    })

    const onDirectMutation = vi.fn()

    // Simulate action-only binding for sensitive data
    const state = {}
    Object.defineProperty(state, 'userEmail', {
      get() { return presenter.userEmail },
      set(value) {
        console.warn(`Direct mutation of 'userEmail' is disabled. Use actions instead.`)
        onDirectMutation('userEmail', value, 'action-only')
        return
      },
      enumerable: true,
      configurable: true
    })

    // Bind actions to state
    state.updateUser = presenter.updateUser.bind(presenter)

    // Test: Direct mutation should be blocked
    state.userEmail = 'invalid-email'  // No @ symbol
    expect(presenter.userEmail).toBe('')  // Unchanged
    expect(onDirectMutation).toHaveBeenCalledWith('userEmail', 'invalid-email', 'action-only')

    // Test: Action with validation should work
    state.updateUser({ email: 'valid@example.com', age: 25 })
    expect(presenter.userEmail).toBe('valid@example.com')
    expect(presenter.userAge).toBe(25)

    // Test: Action should reject invalid data
    expect(() => {
      state.updateUser({ email: 'invalid-email' })
    }).toThrow('Invalid email format')

    expect(() => {
      state.updateUser({ age: -5 })
    }).toThrow('Age cannot be negative')

    expect(() => {
      state.updateUser({ role: 'hacker' })
    }).toThrow('Invalid role')

    // Test: Action should handle business logic
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    state.updateUser({ status: 'suspended' })
    expect(consoleSpy).toHaveBeenCalledWith('User suspended - sending notification')
    consoleSpy.mockRestore()
  })

  it('should demonstrate mixed mode usage', () => {
    const presenter = makeAutoObservable({
      // Safe properties (can be mutated directly)
      search: '',
      modalOpen: false,
      
      // Sensitive properties (should use actions)
      userEmail: '',
      userRole: 'user',
      
      // Actions for sensitive properties
      updateUser(userData) {
        if (userData.role && !['user', 'admin', 'moderator'].includes(userData.role)) {
          throw new Error('Invalid role')
        }
        if (userData.email) this.userEmail = userData.email
        if (userData.role) this.userRole = userData.role
      }
    })

    const onDirectMutation = vi.fn()

    // Simulate mixed binding - safe properties allow direct mutation
    const state = {}
    
    // Safe properties - allow direct mutation
    Object.defineProperty(state, 'search', {
      get() { return presenter.search },
      set(value) { presenter.search = value },
      enumerable: true,
      configurable: true
    })
    
    Object.defineProperty(state, 'modalOpen', {
      get() { return presenter.modalOpen },
      set(value) { presenter.modalOpen = value },
      enumerable: true,
      configurable: true
    })

    // Sensitive properties - block direct mutation
    Object.defineProperty(state, 'userEmail', {
      get() { return presenter.userEmail },
      set(value) {
        console.warn(`Direct mutation of 'userEmail' is disabled. Use actions instead.`)
        onDirectMutation('userEmail', value, 'action-only')
        return
      },
      enumerable: true,
      configurable: true
    })

    // Bind actions to state
    state.updateUser = presenter.updateUser.bind(presenter)

    // Test: Safe properties should allow direct mutation
    state.search = 'test search'
    expect(presenter.search).toBe('test search')

    state.modalOpen = true
    expect(presenter.modalOpen).toBe(true)

    // Test: Sensitive properties should block direct mutation
    state.userEmail = 'admin@example.com'
    expect(presenter.userEmail).toBe('')  // Unchanged
    expect(onDirectMutation).toHaveBeenCalledWith('userEmail', 'admin@example.com', 'action-only')

    // Test: Sensitive properties should use actions
    state.updateUser({ email: 'admin@example.com', role: 'admin' })
    expect(presenter.userEmail).toBe('admin@example.com')
    expect(presenter.userRole).toBe('admin')

    // Test: Actions should validate sensitive data
    expect(() => {
      state.updateUser({ role: 'hacker' })
    }).toThrow('Invalid role')
  })
})
