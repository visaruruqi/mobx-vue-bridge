import { describe, it, expect, beforeEach, vi } from 'vitest'
import { makeAutoObservable, makeObservable, observable, computed } from 'mobx'

// Mock Vue imports  
vi.mock('vue', () => ({
  reactive: (obj) => obj,
  ref: (value) => ({ value }),
  onMounted: (fn) => fn(),
  onUnmounted: (fn) => {},
  markRaw: (obj) => obj,
  watch: vi.fn()
}))

import { useMobxBridge, usePresenterState } from '../mobxVueBridge.js'

describe('MobX-Vue Bridge - Configuration & Options', () => {
  let consoleWarnSpy

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  it('should respect allowDirectMutation: false when explicitly set', () => {
    class ConfigStore1 {
      name = 'initial'
      count = 0
      
      constructor() {
        makeAutoObservable(this)
      }
    }
    
    const presenter = new ConfigStore1()

    // Explicitly set allowDirectMutation to false
    const state = useMobxBridge(presenter, { allowDirectMutation: false })
    
    // Direct mutation should be blocked
    state.name = 'blocked'
    state.count = 10
    
    // Should warn about blocked mutations
    expect(consoleWarnSpy).toHaveBeenCalledWith("Direct mutation of 'name' is disabled. Use actions instead.")
    expect(consoleWarnSpy).toHaveBeenCalledWith("Direct mutation of 'count' is disabled. Use actions instead.")
    
    // Values should remain unchanged
    expect(state.name).toBe('initial')
    expect(state.count).toBe(0)
    expect(presenter.name).toBe('initial')
    expect(presenter.count).toBe(0)
  })

  it('should respect allowDirectMutation: true', () => {
    class ConfigStore2 {
      name = 'initial'
      count = 0
      
      constructor() {
        makeAutoObservable(this)
      }
    }
    
    const presenter = new ConfigStore2()

    const state = useMobxBridge(presenter, { allowDirectMutation: true })
    
    // Direct mutation should work
    state.name = 'allowed'
    state.count = 10
    
    // Should not warn
    expect(consoleWarnSpy).not.toHaveBeenCalled()
    
    // Values should be updated in both Vue state and MobX
    expect(state.name).toBe('allowed')
    expect(state.count).toBe(10)
    expect(presenter.name).toBe('allowed')
    expect(presenter.count).toBe(10)
  })

  it('should handle mixed property types with allowDirectMutation: true', () => {
    class MixedStore {
      regularProp = 'value'
      _internalValue = 0
      
      constructor() {
        makeAutoObservable(this)
      }
      
      get computedProp() {
        return this._internalValue * 2
      }
      
      set writableProp(val) {
        this._internalValue = val
      }
      
      get writableProp() {
        return this._internalValue
      }
      
      actionMethod() {
        this._internalValue++
      }
    }
    
    const presenter = new MixedStore()

    const state = useMobxBridge(presenter, { allowDirectMutation: true })
    
    // Regular property - should allow mutation
    state.regularProp = 'new value'
    expect(state.regularProp).toBe('new value')
    
    // Computed property - should throw on mutation
    expect(() => {
      state.computedProp = 20
    }).toThrow("Cannot assign to computed property 'computedProp'")
    
    // Getter/setter pair - should allow mutation
    state.writableProp = 15
    expect(state.writableProp).toBe(15)
    expect(state.computedProp).toBe(30) // 15 * 2
    
    // Method - should warn on assignment
    state.actionMethod = 'invalid'
    expect(consoleWarnSpy).toHaveBeenCalledWith("Cannot assign to method 'actionMethod'")
  })

  it('should handle usePresenterState alias correctly', () => {
    class AliasStore {
      value = 'test'
      
      constructor() {
        makeAutoObservable(this)
      }
    }
    
    const presenter = new AliasStore()

    // usePresenterState should work identically to useMobxBridge
    const state1 = useMobxBridge(presenter)
    const state2 = usePresenterState(presenter)
    
    expect(state1.value).toBe(state2.value)
    
    // Both should respect options
    const state3 = usePresenterState(presenter, { allowDirectMutation: true })
    
    state3.value = 'changed'
    expect(state3.value).toBe('changed')
    expect(presenter.value).toBe('changed')
  })

  it('should handle empty options object', () => {
    class EmptyOptionsStore {
      prop = 'value'
      
      constructor() {
        makeAutoObservable(this)
      }
    }
    
    const presenter = new EmptyOptionsStore()

    expect(() => {
      const state = useMobxBridge(presenter, {})
      expect(state.prop).toBe('value')
    }).not.toThrow()
  })

  it('should handle null/undefined options', () => {
    class NullOptionsStore {
      prop = 'value'
      
      constructor() {
        makeAutoObservable(this)
      }
    }
    
    const presenter = new NullOptionsStore()

    expect(() => {
      const state1 = useMobxBridge(presenter, null)
      const state2 = useMobxBridge(presenter, undefined)
      expect(state1.prop).toBe('value')
      expect(state2.prop).toBe('value')
    }).not.toThrow()
  })

  it('should handle unknown options gracefully', () => {
    class UnknownOptionsStore {
      prop = 'value'
      
      constructor() {
        makeAutoObservable(this)
      }
    }
    
    const presenter = new UnknownOptionsStore()

    expect(() => {
      const state = useMobxBridge(presenter, {
        allowDirectMutation: true,
        unknownOption: 'should be ignored',
        anotherUnknown: 123
      })
      expect(state.prop).toBe('value')
      
      // Should still respect known options
      state.prop = 'changed'
      expect(state.prop).toBe('changed')
    }).not.toThrow()
  })

  it('should handle boolean coercion in options', () => {
    class BooleanCoercionStore {
      prop = 'value'
      
      constructor() {
        makeAutoObservable(this)
      }
    }
    
    const presenter = new BooleanCoercionStore()

    // Test truthy values
    const state1 = useMobxBridge(presenter, { allowDirectMutation: 'true' })
    const state2 = useMobxBridge(presenter, { allowDirectMutation: 1 })
    const state3 = useMobxBridge(presenter, { allowDirectMutation: {} })
    
    // Should all be treated as truthy
    state1.prop = 'test1'
    state2.prop = 'test2' 
    state3.prop = 'test3'
    
    expect(consoleWarnSpy).not.toHaveBeenCalled()
    
    // Test falsy values
    const state4 = useMobxBridge(presenter, { allowDirectMutation: 0 })
    const state5 = useMobxBridge(presenter, { allowDirectMutation: '' })
    const state6 = useMobxBridge(presenter, { allowDirectMutation: null })
    
    state4.prop = 'blocked4'
    state5.prop = 'blocked5'
    state6.prop = 'blocked6'
    
    expect(consoleWarnSpy).toHaveBeenCalledTimes(3)
  })

  it('should handle configuration changes after creation', () => {
    class ConfigChangeStore {
      prop = 'initial'
      
      constructor() {
        makeAutoObservable(this)
      }
    }
    
    const presenter = new ConfigChangeStore()

    // Start with readonly
    const state = useMobxBridge(presenter, { allowDirectMutation: false })
    
    state.prop = 'blocked'
    expect(consoleWarnSpy).toHaveBeenCalled()
    expect(state.prop).toBe('initial')
    
    // Configuration is fixed at creation time, cannot be changed
    // This documents current behavior
    const newState = useMobxBridge(presenter, { allowDirectMutation: true })
    newState.prop = 'allowed'
    expect(newState.prop).toBe('allowed')
  })

  it('should provide appropriate defaults for different MobX patterns', () => {
    // Test with makeAutoObservable
    class AutoObservableStore {
      prop = 'auto'
      
      constructor() {
        makeAutoObservable(this)
      }
    }
    
    const autoObservable = new AutoObservableStore()
    
    const state1 = useMobxBridge(autoObservable)
    expect(state1.prop).toBe('auto')
    
    // Test with makeObservable
    const observableObj = makeObservable({
      prop: 'manual',
      get computed() { return this.prop.toUpperCase() }
    }, {
      prop: observable,
      computed: computed
    })
    
    const state2 = useMobxBridge(observableObj)
    expect(state2.prop).toBe('manual')
    expect(state2.computed).toBe('MANUAL')
    
    // Test with plain object - bridge is designed for MobX objects 
    // but should handle plain objects gracefully (no reactivity expected)
    const plain = { prop: 'plain' }
    expect(() => {
      const state3 = useMobxBridge(plain)
      // Plain objects may not work as expected since bridge is designed for MobX
      // This tests that it doesn't crash
    }).not.toThrow()
  })

  it('should handle option validation edge cases', () => {
    class EdgeCaseStore {
      prop = 'value'
      
      constructor() {
        makeAutoObservable(this)
      }
    }
    
    const presenter = new EdgeCaseStore()

    // Test with complex option objects
    const complexOptions = {
      allowDirectMutation: true,
      nested: {
        deep: {
          value: 'should be ignored'
        }
      },
      array: [1, 2, 3],
      func: () => 'should be ignored'
    }
    
    expect(() => {
      const state = useMobxBridge(presenter, complexOptions)
      state.prop = 'works'
      expect(state.prop).toBe('works')
    }).not.toThrow()
  })
})