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

describe('MobX-Vue Bridge Setters Two-Way Binding', () => {
  it('should detect and handle setter-only properties with two-way binding', () => {
    class TestPresenter {
      constructor() {
        this._value = 0
        this._name = ''
        this._isActive = false
        makeAutoObservable(this)
      }

      // Setter-only properties (write-only)
      set value(newValue) {
        this._value = newValue * 2 // Some transformation
      }

      set name(newName) {
        this._name = newName.toUpperCase()
      }

      set isActive(active) {
        this._isActive = active
      }

      // Getter for internal state (to verify setters work)
      get internalValue() {
        return this._value
      }

      get internalName() {
        return this._name
      }

      get internalIsActive() {
        return this._isActive
      }
    }

    const presenter = new TestPresenter()
    const state = useMobxBridge(presenter)


    // Test that setters are available as writable properties
    expect('value' in state).toBe(true)
    expect('name' in state).toBe(true)
    expect('isActive' in state).toBe(true)

    // Test that getters are available as computed (read-only)
    expect('internalValue' in state).toBe(true)
    expect('internalName' in state).toBe(true)
    expect('internalIsActive' in state).toBe(true)

    // Test setter functionality - Vue → MobX
    state.value = 10
    expect(presenter.internalValue).toBe(20) // 10 * 2
    expect(state.internalValue).toBe(20)

    state.name = 'john'
    expect(presenter.internalName).toBe('JOHN')
    expect(state.internalName).toBe('JOHN')

    state.isActive = true
    expect(presenter.internalIsActive).toBe(true)
    expect(state.internalIsActive).toBe(true)

    // Test that getter-only properties are read-only
    expect(() => {
      state.internalValue = 100
    }).toThrow(/Cannot assign to computed property/)

    // Test MobX → Vue sync by calling setters directly
    presenter.value = 15
    expect(state.internalValue).toBe(30) // 15 * 2
  })

  it('should handle getter/setter pairs correctly (getter as computed, setter as writable)', () => {
    class UserPresenter {
      constructor() {
        this.vm = {
          show_datepicker: false,
          user_name: '',
          theme: 'light'
        }
        makeAutoObservable(this)
      }

      // Getter/setter pairs
      get showDatepicker() {
        return this.vm.show_datepicker
      }

      set showDatepicker(value) {
        this.vm.show_datepicker = value
      }

      get userName() {
        return this.vm.user_name
      }

      set userName(name) {
        this.vm.user_name = name.trim()
      }

      get theme() {
        return this.vm.theme
      }

      set theme(newTheme) {
        this.vm.theme = newTheme
      }

      // Computed-only getter (read-only)
      get isDatepickerVisible() {
        return this.vm.show_datepicker && this.vm.user_name.length > 0
      }

      // Methods
      toggleDatepicker() {
        this.vm.show_datepicker = !this.vm.show_datepicker
      }
    }

    const presenter = new UserPresenter()
    const state = useMobxBridge(presenter)


    // Test that all properties are available
    expect('showDatepicker' in state).toBe(true) // Should be both getter (computed) AND setter (writable)
    expect('userName' in state).toBe(true)
    expect('theme' in state).toBe(true)
    expect('isDatepickerVisible' in state).toBe(true) // Computed-only
    expect('vm' in state).toBe(true) // Regular property
    expect('toggleDatepicker' in state).toBe(true) // Method

    // Test initial values
    expect(state.showDatepicker).toBe(false)
    expect(state.userName).toBe('')
    expect(state.theme).toBe('light')
    expect(state.isDatepickerVisible).toBe(false)

    // Test setter functionality - Vue → MobX
    state.showDatepicker = true
    expect(presenter.showDatepicker).toBe(true)
    expect(presenter.vm.show_datepicker).toBe(true)
    expect(state.showDatepicker).toBe(true)

    state.userName = '  John Doe  '
    expect(presenter.userName).toBe('John Doe') // Trimmed
    expect(presenter.vm.user_name).toBe('John Doe')
    expect(state.userName).toBe('John Doe')

    state.theme = 'dark'
    expect(presenter.theme).toBe('dark')
    expect(presenter.vm.theme).toBe('dark')
    expect(state.theme).toBe('dark')

    // Test computed property updates
    expect(state.isDatepickerVisible).toBe(true) // showDatepicker=true && userName='John Doe'

    // Test that computed-only properties are read-only
    expect(() => {
      state.isDatepickerVisible = false
    }).toThrow(/Cannot assign to computed property/)

    // Test MobX → Vue sync
    presenter.vm.show_datepicker = false
    expect(state.showDatepicker).toBe(false)
    expect(state.isDatepickerVisible).toBe(false)

    // Test method execution
    state.toggleDatepicker()
    expect(state.showDatepicker).toBe(true)
  })

  it('should handle complex setter logic with validation', () => {
    class ValidationPresenter {
      constructor() {
        this._email = ''
        this._age = 0
        this._errors = {}
        makeAutoObservable(this)
      }

      // Setter with validation
      set email(value) {
        if (typeof value === 'string' && value.includes('@')) {
          this._email = value.toLowerCase()
          delete this._errors.email
        } else {
          this._errors.email = 'Invalid email format'
        }
      }

      set age(value) {
        const numValue = Number(value)
        if (numValue >= 0 && numValue <= 120) {
          this._age = numValue
          delete this._errors.age
        } else {
          this._errors.age = 'Age must be between 0 and 120'
        }
      }

      // Getters for current values
      get email() {
        return this._email
      }

      get age() {
        return this._age
      }

      get errors() {
        return this._errors
      }

      get isValid() {
        return Object.keys(this._errors).length === 0 && this._email && this._age > 0
      }
    }

    const presenter = new ValidationPresenter()
    const state = useMobxBridge(presenter)


    // Test initial state
    expect(state.email).toBe('')
    expect(state.age).toBe(0)
    expect(state.isValid).toBe(false)

    // Test valid inputs
    state.email = 'JOHN.DOE@EXAMPLE.COM'
    expect(state.email).toBe('john.doe@example.com') // Lowercase
    expect(Object.keys(state.errors)).not.toContain('email')

    state.age = '25'
    expect(state.age).toBe(25) // Converted to number
    expect(Object.keys(state.errors)).not.toContain('age')
    expect(state.isValid).toBe(true)

    // Test invalid inputs
    state.email = 'invalid-email'
    expect(state.email).toBe('john.doe@example.com') // Should not change
    expect(state.errors.email).toBe('Invalid email format')
    expect(state.isValid).toBe(false)

    state.age = 150
    expect(state.age).toBe(25) // Should not change
    expect(state.errors.age).toBe('Age must be between 0 and 120')

    // Test that computed properties are read-only
    expect(() => {
      state.isValid = true
    }).toThrow(/Cannot assign to computed property/)
  })

  it('should handle setter-only properties without corresponding getters', () => {
    class ActionPresenter {
      constructor() {
        this._commands = []
        this._lastAction = null
        makeAutoObservable(this)
      }

      // Write-only setters that trigger actions
      set command(cmd) {
        this._commands.push(cmd)
        this._lastAction = `Executed: ${cmd}`
      }

      set resetCommands(shouldReset) {
        if (shouldReset) {
          this._commands = []
          this._lastAction = 'Commands reset'
        }
      }

      // Getters to observe the effects
      get commands() {
        return this._commands
      }

      get lastAction() {
        return this._lastAction
      }

      get commandCount() {
        return this._commands.length
      }
    }

    const presenter = new ActionPresenter()
    const state = useMobxBridge(presenter)


    // Test that setters are available
    expect('command' in state).toBe(true)
    expect('resetCommands' in state).toBe(true)

    // Test that getters work
    expect(state.commands).toEqual([])
    expect(state.lastAction).toBe(null)
    expect(state.commandCount).toBe(0)

    // Test setter actions
    state.command = 'save'
    expect(state.commands).toEqual(['save'])
    expect(state.lastAction).toBe('Executed: save')
    expect(state.commandCount).toBe(1)

    state.command = 'load'
    expect(state.commands).toEqual(['save', 'load'])
    expect(state.lastAction).toBe('Executed: load')
    expect(state.commandCount).toBe(2)

    // Test reset action
    state.resetCommands = true
    expect(state.commands).toEqual([])
    expect(state.lastAction).toBe('Commands reset')
    expect(state.commandCount).toBe(0)

    // Test that trying to set to false doesn't trigger reset
    state.command = 'test'
    state.resetCommands = false
    expect(state.commands).toEqual(['test']) // Should not be reset
    expect(state.commandCount).toBe(1)
  })

  it('should handle setters with side effects and dependencies', () => {
    class SideEffectsPresenter {
      constructor() {
        this._data = null
        this._isLoading = false
        this._error = null
        makeAutoObservable(this)
      }

      // Setter that triggers async operation
      set loadData(id) {
        if (!id) return

        this._isLoading = true
        this._error = null
        
        // Simulate async operation
        setTimeout(() => {
          try {
            this._data = { id, name: `Item ${id}`, loaded: true }
            this._isLoading = false
          } catch (err) {
            this._error = err.message
            this._isLoading = false
          }
        }, 0)
      }

      // Setter that clears data
      set clearData(shouldClear) {
        if (shouldClear) {
          this._data = null
          this._error = null
        }
      }

      // Getters
      get data() {
        return this._data
      }

      get isLoading() {
        return this._isLoading
      }

      get error() {
        return this._error
      }

      get hasData() {
        return this._data !== null
      }
    }

    const presenter = new SideEffectsPresenter()
    const state = useMobxBridge(presenter)


    // Test initial state
    expect(state.data).toBe(null)
    expect(state.isLoading).toBe(false)
    expect(state.error).toBe(null)
    expect(state.hasData).toBe(false)

    // Test load data setter
    state.loadData = 'user123'
    expect(state.isLoading).toBe(true)
    expect(state.error).toBe(null)

    // Test clear data setter
    state.clearData = true
    expect(state.data).toBe(null)
    expect(state.error).toBe(null)

    // Test that setters are writable
    expect(() => {
      state.loadData = 'another-id'
    }).not.toThrow()

    // Test that getters are read-only
    expect(() => {
      state.hasData = true
    }).toThrow(/Cannot assign to computed property/)
  })
})
