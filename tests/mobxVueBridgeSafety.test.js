import { describe, it, expect, vi } from 'vitest'
import { makeAutoObservable } from 'mobx'

/**
 * Tests demonstrating the safety concerns and solutions for MobX-Vue Bridge
 * 
 * This shows the risks of direct mutation and how to implement safety measures
 */

describe('MobX-Vue Bridge - Safety and Architecture', () => {
  it('should demonstrate the risks of direct mutation', () => {
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
        
        if (userData.email) this.userEmail = userData.email
        if (userData.age !== undefined) this.userAge = userData.age
        if (userData.role) this.userRole = userData.role
      }
    })

    // Simulate direct mutation (what happens with two-way binding)
    const state = {}
    Object.defineProperty(state, 'userEmail', {
      get() { return presenter.userEmail },
      set(value) { presenter.userEmail = value },
      enumerable: true,
      configurable: true
    })

    Object.defineProperty(state, 'userAge', {
      get() { return presenter.userAge },
      set(value) { presenter.userAge = value },
      enumerable: true,
      configurable: true
    })

    Object.defineProperty(state, 'userRole', {
      get() { return presenter.userRole },
      set(value) { presenter.userRole = value },
      enumerable: true,
      configurable: true
    })

    // ❌ DANGEROUS: Direct mutation bypasses validation
    state.userEmail = 'invalid-email'  // No @ symbol - should be rejected!
    expect(presenter.userEmail).toBe('invalid-email')  // But it's accepted!

    state.userAge = -5  // Negative age - should be rejected!
    expect(presenter.userAge).toBe(-5)  // But it's accepted!

    state.userRole = 'hacker'  // Invalid role - should be rejected!
    expect(presenter.userRole).toBe('hacker')  // But it's accepted!

    // ✅ SAFE: Action-based mutation with validation
    expect(() => {
      presenter.updateUser({ email: 'invalid-email' })
    }).toThrow('Invalid email format')

    expect(() => {
      presenter.updateUser({ age: -5 })
    }).toThrow('Age cannot be negative')

    expect(() => {
      presenter.updateUser({ role: 'hacker' })
    }).toThrow('Invalid role')
  })

  it('should demonstrate safe two-way binding with validation', () => {
    const presenter = makeAutoObservable({
      search: '',
      userEmail: '',
      userAge: 0,
      
      setSearch(value) {
        // Simple validation for search
        if (value.length > 100) {
          throw new Error('Search term too long')
        }
        this.search = value
      },
      
      updateUser(userData) {
        // Complex validation for user
        if (userData.email && !userData.email.includes('@')) {
          throw new Error('Invalid email format')
        }
        if (userData.age && userData.age < 0) {
          throw new Error('Age cannot be negative')
        }
        if (userData.email) this.userEmail = userData.email
        if (userData.age !== undefined) this.userAge = userData.age
      }
    })

    const onDirectMutation = vi.fn()

    // Create safe binding - allow direct mutation for simple properties, block for complex ones
    const state = {}
    
    // Safe property - allow direct mutation
    Object.defineProperty(state, 'search', {
      get() { return presenter.search },
      set(value) { 
        // Simple validation for direct mutation
        if (value.length > 100) {
          console.warn('Search term too long, truncating')
          value = value.substring(0, 100)
        }
        presenter.search = value 
      },
      enumerable: true,
      configurable: true
    })

    // Complex property - block direct mutation
    Object.defineProperty(state, 'userEmail', {
      get() { return presenter.userEmail },
      set(value) {
        console.warn(`Direct mutation of 'userEmail' is disabled. Use updateUser() action instead.`)
        onDirectMutation('userEmail', value, 'blocked')
        return
      },
      enumerable: true,
      configurable: true
    })

    // Bind actions to state
    state.setSearch = presenter.setSearch.bind(presenter)
    state.updateUser = presenter.updateUser.bind(presenter)

    // Test: Safe property allows direct mutation with validation
    state.search = 'a'.repeat(150)  // Too long
    expect(presenter.search).toBe('a'.repeat(100))  // Truncated

    state.search = 'normal search'
    expect(presenter.search).toBe('normal search')

    // Test: Complex property blocks direct mutation
    state.userEmail = 'invalid-email'
    expect(presenter.userEmail).toBe('')  // Unchanged
    expect(onDirectMutation).toHaveBeenCalledWith('userEmail', 'invalid-email', 'blocked')

    // Test: Complex property uses action with validation
    state.updateUser({ email: 'valid@example.com', age: 25 })
    expect(presenter.userEmail).toBe('valid@example.com')
    expect(presenter.userAge).toBe(25)

    expect(() => {
      state.updateUser({ email: 'invalid-email' })
    }).toThrow('Invalid email format')
  })

  it('should demonstrate the benefits of action-only mode for sensitive data', () => {
    const presenter = makeAutoObservable({
      // Sensitive data that should never be mutated directly
      userId: 1,
      userEmail: 'user@example.com',
      userRole: 'user',
      userPermissions: ['read'],
      
      // Safe data that can be mutated directly
      uiTheme: 'light',
      sidebarOpen: false,
      
      // Actions for sensitive data
      updateUser(userData) {
        // Audit log
        console.log(`User ${this.userId} updated by admin`)
        
        // Validation
        if (userData.role && !['user', 'admin', 'moderator'].includes(userData.role)) {
          throw new Error('Invalid role')
        }
        
        // Business logic
        if (userData.role === 'admin') {
          this.userPermissions = ['read', 'write', 'delete']
        } else if (userData.role === 'user') {
          this.userPermissions = ['read']
        }
        
        if (userData.email) this.userEmail = userData.email
        if (userData.role) this.userRole = userData.role
      },
      
      promoteUser() {
        if (this.userRole === 'user') {
          this.userRole = 'moderator'
          this.userPermissions = ['read', 'write']
          console.log(`User ${this.userId} promoted to moderator`)
        }
      }
    })

    const onDirectMutation = vi.fn()

    // Create action-only binding for sensitive data
    const state = {}
    
    // Sensitive data - block direct mutation
    Object.defineProperty(state, 'userRole', {
      get() { return presenter.userRole },
      set(value) {
        console.warn(`Direct mutation of 'userRole' is disabled. Use actions instead.`)
        onDirectMutation('userRole', value, 'action-only')
        return
      },
      enumerable: true,
      configurable: true
    })

    // Safe data - allow direct mutation
    Object.defineProperty(state, 'uiTheme', {
      get() { return presenter.uiTheme },
      set(value) { presenter.uiTheme = value },
      enumerable: true,
      configurable: true
    })

    // Bind actions to state
    state.updateUser = presenter.updateUser.bind(presenter)
    state.promoteUser = presenter.promoteUser.bind(presenter)

    // Test: Sensitive data blocks direct mutation
    state.userRole = 'admin'  // Try to escalate privileges
    expect(presenter.userRole).toBe('user')  // Unchanged
    expect(onDirectMutation).toHaveBeenCalledWith('userRole', 'admin', 'action-only')

    // Test: Safe data allows direct mutation
    state.uiTheme = 'dark'
    expect(presenter.uiTheme).toBe('dark')

    // Test: Sensitive data uses actions with business logic
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    
    state.updateUser({ role: 'admin' })
    expect(presenter.userRole).toBe('admin')
    expect(presenter.userPermissions).toEqual(['read', 'write', 'delete'])
    expect(consoleSpy).toHaveBeenCalledWith('User 1 updated by admin')

    // Reset to user role first
    state.updateUser({ role: 'user' })
    expect(presenter.userRole).toBe('user')
    expect(presenter.userPermissions).toEqual(['read'])

    // Clear previous calls before testing promoteUser
    consoleSpy.mockClear()
    
    state.promoteUser()
    expect(presenter.userRole).toBe('moderator')
    expect(presenter.userPermissions).toEqual(['read', 'write'])
    expect(consoleSpy).toHaveBeenCalledWith('User 1 promoted to moderator')

    consoleSpy.mockRestore()
  })

  it('should demonstrate configuration options for different environments', () => {
    const presenter = makeAutoObservable({
      search: '',
      userEmail: '',
      userRole: 'user',
      
      setSearch(value) {
        if (value.length > 100) throw new Error('Search too long')
        this.search = value
      },
      
      updateUser(userData) {
        if (userData.role && !['user', 'admin'].includes(userData.role)) {
          throw new Error('Invalid role')
        }
        if (userData.email) this.userEmail = userData.email
        if (userData.role) this.userRole = userData.role
      }
    })

    // Development mode - allow direct mutation for rapid prototyping
    const devState = {}
    Object.defineProperty(devState, 'search', {
      get() { return presenter.search },
      set(value) { presenter.search = value },  // No validation
      enumerable: true,
      configurable: true
    })
    devState.setSearch = presenter.setSearch.bind(presenter)

    // Production mode - block direct mutation for safety
    const prodState = {}
    Object.defineProperty(prodState, 'search', {
      get() { return presenter.search },
      set(value) {
        console.warn('Direct mutation disabled in production. Use actions.')
        return
      },
      enumerable: true,
      configurable: true
    })
    prodState.setSearch = presenter.setSearch.bind(presenter)

    // Test: Development mode allows direct mutation
    devState.search = 'a'.repeat(150)  // Too long, but allowed in dev
    expect(presenter.search).toBe('a'.repeat(150))

    // Test: Production mode blocks direct mutation
    prodState.search = 'test'
    expect(presenter.search).toBe('a'.repeat(150))  // Unchanged

    // Test: Both modes allow actions
    devState.setSearch('valid search')
    expect(presenter.search).toBe('valid search')

    prodState.setSearch('another search')
    expect(presenter.search).toBe('another search')
  })
})
