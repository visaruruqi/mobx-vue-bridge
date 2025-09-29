import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeAutoObservable, makeObservable, observable, computed, action } from 'mobx'

// Mock Vue's onMounted and onUnmounted
const mockDisposers = []
const mockOnMounted = (fn) => fn()
const mockOnUnmounted = (fn) => {
  // Store the cleanup function to call later
  mockDisposers.push(fn)
}

// Mock Vue reactive
const mockReactive = (obj) => obj

// Mock Vue ref
const mockRef = (value) => ({ value })

// Mock the Vue imports
vi.mock('vue', () => ({
  reactive: (obj) => obj,
  ref: (value) => ({ value }),
  onMounted: (fn) => fn(),
  onUnmounted: (fn) => {
    mockDisposers.push(fn)
  },
  markRaw: (obj) => obj,
  watch: vi.fn((source, callback, options) => {
    // Store the callback for manual triggering
    if (typeof source === 'object' && source.value !== undefined) {
      // For refs, store the callback
      source._watcher = callback
    }
    return () => {} // cleanup function
  })
}))

import { useMobxBridge } from '../mobxVueBridge.js'

describe('MobX-Vue Bridge with Computed Properties', () => {
  let testPresenter

  beforeEach(() => {
    // Create a test presenter with both regular and computed properties
    class TestPresenter {
      constructor() {
        this.count = 0
        this.name = 'Test'
        this.items = []
        
        makeAutoObservable(this, {}, { autoBind: true })
      }

      // Regular observable property
      get displayName() {
        return `${this.name} (${this.count})`
      }

      // Computed property that depends on multiple observables
      get itemCount() {
        return this.items.length
      }

      // Computed property with complex logic
      get summary() {
        return `${this.name} has ${this.itemCount} items and count is ${this.count}`
      }

      // Method to modify observables
      increment() {
        this.count++
      }

      addItem(item) {
        this.items.push(item)
      }

      setName(name) {
        this.name = name
      }
    }

    testPresenter = new TestPresenter()
  })

  it('should sync regular observable properties', () => {
    const state = useMobxBridge(testPresenter)
    
    expect(state.count).toBe(0)
    expect(state.name).toBe('Test')
  })

  it('should sync computed properties (getters)', () => {
    const state = useMobxBridge(testPresenter)
    
    expect(state.displayName).toBe('Test (0)')
    expect(state.itemCount).toBe(0)
    expect(state.summary).toBe('Test has 0 items and count is 0')
  })

  it('should update computed properties when dependencies change', () => {
    const state = useMobxBridge(testPresenter)
    
    // Initial state
    expect(state.displayName).toBe('Test (0)')
    expect(state.summary).toBe('Test has 0 items and count is 0')
    
    // Change dependency
    testPresenter.increment()
    
    // Computed properties should update
    expect(state.displayName).toBe('Test (1)')
    expect(state.summary).toBe('Test has 0 items and count is 1')
  })

  it('should update computed properties when multiple dependencies change', () => {
    const state = useMobxBridge(testPresenter)
    
    // Initial state
    expect(state.itemCount).toBe(0)
    expect(state.summary).toBe('Test has 0 items and count is 0')
    
    // Change multiple dependencies
    testPresenter.addItem('item1')
    testPresenter.addItem('item2')
    testPresenter.setName('Updated')
    
    // Computed properties should update
    expect(state.itemCount).toBe(2)
    expect(state.summary).toBe('Updated has 2 items and count is 0')
  })

  it('should auto-detect computed properties', () => {
    const state = useMobxBridge(testPresenter) // Auto-detect all properties
    
    // Should include both regular and computed properties
    expect(state.count).toBe(0)
    expect(state.name).toBe('Test')
    expect(state.displayName).toBe('Test (0)')
    expect(state.itemCount).toBe(0)
    expect(state.summary).toBe('Test has 0 items and count is 0')
  })

  it('should handle complex computed property dependencies', () => {
    const state = useMobxBridge(testPresenter)
    
    // Make multiple changes that affect the computed property
    testPresenter.increment()
    testPresenter.increment()
    testPresenter.addItem('item1')
    testPresenter.setName('Complex')
    
    // The summary should reflect all changes
    expect(state.summary).toBe('Complex has 1 items and count is 2')
  })

  it('should expose actions and allow calling them', () => {
    const state = useMobxBridge(testPresenter)
    
    // Actions should be available and callable
    expect(typeof state.increment).toBe('function')
    expect(typeof state.addItem).toBe('function')
    expect(typeof state.setName).toBe('function')
    
    // Call actions through the bridge
    state.increment()
    expect(state.count).toBe(1)
    
    state.addItem('test item')
    expect(state.count).toBe(1) // count should still be 1
    expect(testPresenter.items).toContain('test item')
    
    state.setName('New Name')
    expect(testPresenter.name).toBe('New Name')
  })

  it('should expose setters when available', () => {
    // Create a presenter with setters
    class PresenterWithSetters {
      constructor() {
        this._value = 0
        makeAutoObservable(this, {}, { autoBind: true })
      }
      
      get value() {
        return this._value
      }
      
      setValue(newValue) {
        this._value = newValue
      }
      
      get doubled() {
        return this._value * 2
      }
    }
    
    const presenterWithSetters = new PresenterWithSetters()
    const state = useMobxBridge(presenterWithSetters)
    
    // Setter should be available as a method
    expect(typeof state.setValue).toBe('function') // Setter is exposed as a method
    
    // Test the setter
    state.setValue(42)
    expect(presenterWithSetters.value).toBe(42)
    expect(state.doubled).toBe(84)
  })

  it('should auto-detect all member types', () => {
    const state = useMobxBridge(testPresenter) // Auto-detect all members
    
    // Should include properties
    expect(state.count).toBe(0)
    expect(state.name).toBe('Test')
    
    // Should include computed properties (getters)
    expect(state.displayName).toBe('Test (0)')
    expect(state.itemCount).toBe(0)
    expect(state.summary).toBe('Test has 0 items and count is 0')
    
    // Should include actions
    expect(typeof state.increment).toBe('function')
    expect(typeof state.addItem).toBe('function')
    expect(typeof state.setName).toBe('function')
  })

  it('should bind actions to maintain correct context', () => {
    const state = useMobxBridge(testPresenter)
    
    // Call action through bridge
    state.increment()
    
    // Should update the original presenter
    expect(testPresenter.count).toBe(1)
    expect(state.count).toBe(1)
    
    // Call action again
    state.increment()
    expect(testPresenter.count).toBe(2)
    expect(state.count).toBe(2)
  })

  it('should handle makeObservable with explicit configuration', () => {
    // Create a presenter using makeObservable with explicit configuration
    class ExplicitObservablePresenter {
      constructor() {
        this.viewModel = { data: 'initial' }
        this.rate = 1.0  // Use simple property instead of nested object
        this._privateData = 'secret' // Should be ignored
        
        makeObservable(this, {
          viewModel: observable,
          rate: observable,
          _privateData: observable, // Even if marked observable, should be ignored due to underscore
          
          filteredRates: computed,
          sortedRates: computed,
          bookingSessionData: computed,
          
          updateViewModel: action,
          calculateRates: action,
          resetData: action
        })
      }
      
      get filteredRates() {
        return this.rate * 2
      }
      
      get sortedRates() {
        return [this.rate, this.filteredRates].sort()
      }
      
      get bookingSessionData() {
        return {
          viewModel: this.viewModel,
          rates: this.sortedRates
        }
      }
      
      updateViewModel(newData) {
        this.viewModel.data = newData
      }
      
      calculateRates(multiplier) {
        this.rate *= multiplier
      }
      
      resetData() {
        this.viewModel = { data: 'reset' }
        this.rate = 1.0
      }
    }
    
    const explicitPresenter = new ExplicitObservablePresenter()
    const state = useMobxBridge(explicitPresenter)
    
    // Should detect observable properties
    expect(state.viewModel).toEqual({ data: 'initial' })
    expect(state.rate).toBe(1.0)
    
    // Should detect computed properties
    expect(state.filteredRates).toBe(2.0)
    expect(state.sortedRates).toEqual([1.0, 2.0])
    expect(state.bookingSessionData).toEqual({
      viewModel: { data: 'initial' },
      rates: [1.0, 2.0]
    })
    
    // Should detect actions
    expect(typeof state.updateViewModel).toBe('function')
    expect(typeof state.calculateRates).toBe('function')
    expect(typeof state.resetData).toBe('function')
    
    // Should not include private properties
    expect(state._privateData).toBeUndefined()
    
    // Test reactivity
    state.updateViewModel('updated')
    expect(state.viewModel.data).toBe('updated')
    expect(state.bookingSessionData.viewModel.data).toBe('updated')
    
    // Test computed updates
    state.calculateRates(3)
    expect(state.rate).toBe(3.0)
    expect(state.filteredRates).toBe(6.0)
    expect(state.sortedRates).toEqual([3.0, 6.0])
  })

  it('should handle makeObservable with nested objects using observable.ref', () => {
    // Test the original case with nested objects using observable.ref
    class NestedObjectPresenter {
      constructor() {
        this.derivedRates = { rate: 1.0 }
        
        makeObservable(this, {
          derivedRates: observable.ref,  // This makes the entire object observable
          
          filteredRates: computed,
          sortedRates: computed
        })
      }
      
      get filteredRates() {
        return this.derivedRates.rate * 2
      }
      
      get sortedRates() {
        return [this.derivedRates.rate, this.filteredRates].sort()
      }
      
      calculateRates(multiplier) {
        // Replace the entire object to trigger reactivity
        this.derivedRates = { rate: this.derivedRates.rate * multiplier }
      }
    }
    
    const nestedPresenter = new NestedObjectPresenter()
    const state = useMobxBridge(nestedPresenter)
    
    // Initial values
    expect(state.derivedRates).toEqual({ rate: 1.0 })
    expect(state.filteredRates).toBe(2.0)
    expect(state.sortedRates).toEqual([1.0, 2.0])
    
    // Test computed updates with object replacement
    state.calculateRates(3)
    expect(state.derivedRates).toEqual({ rate: 3.0 })
    expect(state.filteredRates).toBe(6.0)
    expect(state.sortedRates).toEqual([3.0, 6.0])
  })
})
