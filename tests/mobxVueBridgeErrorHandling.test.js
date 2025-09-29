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

import { useMobxBridge } from '../mobxVueBridge.js'

describe('MobX-Vue Bridge - Error Handling & Edge Cases', () => {
  let consoleWarnSpy, consoleErrorSpy

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('should handle computed properties that throw during initialization', () => {
    const presenter = makeAutoObservable({
      userData: null,
      
      get fullName() {
        // This will throw when userData is null
        return this.userData.firstName + ' ' + this.userData.lastName
      }
    })

    // Should not throw during bridge creation
    expect(() => {
      const state = useMobxBridge(presenter)
      // Should return undefined for computed that throws
      expect(state.fullName).toBeUndefined()
    }).not.toThrow()
  })

  it('should handle computed properties that throw during updates', () => {
    const presenter = makeAutoObservable({
      userData: { firstName: 'John', lastName: 'Doe' },
      
      get fullName() {
        return this.userData.firstName + ' ' + this.userData.lastName
      }
    })

    const state = useMobxBridge(presenter)
    
    // Initially should work
    expect(state.fullName).toBe('John Doe')
    
    // Set userData to null - computed should handle gracefully
    presenter.userData = null
    
    // Should not throw and should update to undefined
    expect(state.fullName).toBeUndefined()
  })

  it('should handle setters that throw errors', () => {
    const presenter = makeAutoObservable({
      _value: 0,
      
      get value() {
        return this._value
      },
      
      set value(val) {
        if (val < 0) {
          throw new Error('Value cannot be negative')
        }
        this._value = val
      }
    })

    const state = useMobxBridge(presenter, { allowDirectMutation: true })
    
    // Should handle setter errors gracefully
    expect(() => {
      state.value = -1
    }).not.toThrow()
    
    // Should log warning about failed setter
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to set property 'value'"),
      expect.any(Error)
    )
    
    // Original value should remain unchanged
    expect(state.value).toBe(0)
  })

  it('should handle non-observable objects gracefully', () => {
    const regularObject = {
      name: 'test',
      getValue() {
        return this.name
      }
    }
    
    // Should not throw with non-MobX objects, but may not provide full functionality
    expect(() => {
      const state = useMobxBridge(regularObject)
      // Regular objects may not have all properties available since they're not observable
      // This tests that the bridge doesn't crash
      expect(typeof state.getValue).toBe('function')
    }).not.toThrow()
  })

  it('should handle objects with symbol properties', () => {
    const symbolProp = Symbol('test')
    const presenter = makeAutoObservable({
      normalProp: 'test',
      [symbolProp]: 'symbol value'
    })

    // Should handle symbol properties gracefully
    expect(() => {
      const state = useMobxBridge(presenter)
      expect(state.normalProp).toBe('test')
      // Symbol properties should not be exposed
      expect(state[symbolProp]).toBeUndefined()
    }).not.toThrow()
  })

  it('should handle frozen/sealed objects', () => {
    const frozenObj = Object.freeze({ value: 'frozen' })
    const presenter = makeAutoObservable({
      frozenProp: frozenObj
    })

    expect(() => {
      const state = useMobxBridge(presenter)
      expect(state.frozenProp).toEqual(frozenObj)
    }).not.toThrow()
  })

  it('should handle getters/setters with inconsistent behavior', () => {
    let getterCallCount = 0
    let setterCallCount = 0
    
    const presenter = makeObservable({
      _internalValue: 'initial',
      
      get inconsistentProp() {
        getterCallCount++
        // Return different values on different calls
        return getterCallCount % 2 === 0 ? 'even' : 'odd'
      },
      
      set inconsistentProp(val) {
        setterCallCount++
        // Sometimes throw, sometimes don't
        if (setterCallCount % 3 === 0) {
          throw new Error('Setter randomly fails')
        }
        this._internalValue = val
      }
    }, {
      inconsistentProp: computed,
      _internalValue: observable
    })

    const state = useMobxBridge(presenter, { allowDirectMutation: true })
    
    // Should handle inconsistent getter
    const value1 = state.inconsistentProp
    const value2 = state.inconsistentProp
    // Note: MobX computed properties are cached, so consecutive calls may return same value
    // This tests the behavior, which may be cached depending on MobX implementation
    expect(typeof value1).toBe('string')
    expect(typeof value2).toBe('string')
    
    // Should handle failing setter gracefully
    state.inconsistentProp = 'test1' // Should work
    state.inconsistentProp = 'test2' // Should work
    state.inconsistentProp = 'test3' // Should fail but not throw
    
    expect(consoleWarnSpy).toHaveBeenCalled()
  })

  it('should handle extremely deep nested objects', () => {
    // Create deeply nested object
    let deep = { value: 'deep' }
    for (let i = 0; i < 100; i++) {
      deep = { level: i, nested: deep }
    }
    
    const presenter = makeAutoObservable({
      deepObject: deep
    })

    expect(() => {
      const state = useMobxBridge(presenter)
      expect(state.deepObject).toBeDefined()
      expect(state.deepObject.level).toBe(99)
    }).not.toThrow()
  })

  it('should handle null and undefined property values', () => {
    const presenter = makeAutoObservable({
      nullProp: null,
      undefinedProp: undefined,
      emptyStringProp: '',
      zeroProp: 0,
      falseProp: false
    })

    expect(() => {
      const state = useMobxBridge(presenter)
      expect(state.nullProp).toBeNull()
      expect(state.undefinedProp).toBeUndefined()
      expect(state.emptyStringProp).toBe('')
      expect(state.zeroProp).toBe(0)
      expect(state.falseProp).toBe(false)
    }).not.toThrow()
  })
})