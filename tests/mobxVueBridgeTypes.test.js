import { describe, it, expect, beforeEach } from 'vitest'
import { makeAutoObservable } from 'mobx'

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

describe('MobX-Vue Bridge - Type Safety & Data Conversion', () => {
  it('should handle all JavaScript primitive types correctly', () => {
    class PrimitivesStore {
      stringProp = 'hello'
      numberProp = 42
      booleanProp = true
      nullProp = null
      undefinedProp = undefined
      bigintProp = BigInt(123)
      symbolProp = Symbol('test')
      
      constructor() {
        makeAutoObservable(this)
      }
      
      updateTypes() {
        this.stringProp = 'world'
        this.numberProp = 24
        this.booleanProp = false
        this.nullProp = 'not null anymore'
        this.undefinedProp = 'defined now'
      }
    }
    
    const presenter = new PrimitivesStore()

    const state = useMobxBridge(presenter)
    
    // Test initial values
    expect(state.stringProp).toBe('hello')
    expect(state.numberProp).toBe(42)
    expect(state.booleanProp).toBe(true)
    expect(state.nullProp).toBeNull()
    expect(state.undefinedProp).toBeUndefined()
    expect(state.bigintProp).toBe(BigInt(123))
    
    // Test type changes
    presenter.updateTypes()
    
    expect(state.stringProp).toBe('world')
    expect(state.numberProp).toBe(24)
    expect(state.booleanProp).toBe(false)
    expect(state.nullProp).toBe('not null anymore')
    expect(state.undefinedProp).toBe('defined now')
  })

  it('should handle Date objects correctly', () => {
    const now = new Date()
    
    class DateStore {
      dateProperty = now
      
      constructor() {
        makeAutoObservable(this)
      }
    }
    
    const presenter = new DateStore()

    const state = useMobxBridge(presenter)
    
    // Test that Date objects are preserved correctly and not wrapped in proxies
    expect(state.dateProperty).toBeDefined()
    expect(state.dateProperty instanceof Date).toBe(true)
    expect(state.dateProperty.getTime()).toBe(now.getTime())
    
    // Test that Date objects maintain their prototype and methods
    expect(typeof state.dateProperty.getFullYear).toBe('function')
    expect(state.dateProperty.getFullYear()).toBe(now.getFullYear()) // Dynamic year check
  })

  it('should handle RegExp objects correctly', () => {
    const regex = /test\d+/gi
    
    class RegExpStore {
      regexProp = regex
      
      constructor() {
        makeAutoObservable(this)
      }
      
      updateRegex() {
        this.regexProp = /new\w+/i
      }
    }
    
    const presenter = new RegExpStore()

    const state = useMobxBridge(presenter)
    
    // Note: toJS() may affect RegExp object representation
    expect(state.regexProp).toBeDefined()
    expect(state.regexProp instanceof RegExp).toBe(true)
    
    presenter.updateRegex()
    
    expect(state.regexProp instanceof RegExp).toBe(true)
  })

  it('should handle Map and Set objects correctly', () => {
    const map = new Map([['key1', 'value1'], ['key2', 'value2']])
    const set = new Set([1, 2, 3])
    
    class MapSetStore {
      mapProp = map
      setProp = set
      
      constructor() {
        makeAutoObservable(this)
      }
      
      updateCollections() {
        this.mapProp = new Map([['newKey', 'newValue']])
        this.setProp = new Set(['a', 'b', 'c'])
      }
    }
    
    const presenter = new MapSetStore()

    const state = useMobxBridge(presenter)
    
    // Note: toJS() may affect Map/Set object functionality  
    expect(state.mapProp).toBeDefined()
    expect(state.mapProp instanceof Map).toBe(true)
    expect(state.setProp).toBeDefined()
    expect(state.setProp instanceof Set).toBe(true)
    
    presenter.updateCollections()
    
    expect(state.mapProp instanceof Map).toBe(true)
    expect(state.setProp instanceof Set).toBe(true)
  })

  it('should handle arrays with mixed types correctly', () => {
    const mixedArray = [
      1, 
      'string', 
      { obj: true }, 
      [1, 2, 3], 
      null, 
      undefined, 
      new Date()
    ]
    
    class MixedArrayStore {
      mixedArray = mixedArray
      
      constructor() {
        makeAutoObservable(this)
      }
      
      updateArray() {
        this.mixedArray = [...this.mixedArray, 'new item']
      }
    }
    
    const presenter = new MixedArrayStore()

    const state = useMobxBridge(presenter)
    
    expect(state.mixedArray).toEqual(mixedArray)
    expect(Array.isArray(state.mixedArray)).toBe(true)
    
    presenter.updateArray()
    
    expect(state.mixedArray).toHaveLength(8)
    expect(state.mixedArray[7]).toBe('new item')
  })

  it('should handle deeply nested type conversions', () => {
    const complexData = {
      user: {
        id: 1,
        profile: {
          name: 'John',
          metadata: {
            createdAt: new Date(),
            tags: ['admin', 'user'],
            settings: new Map([['theme', 'dark']]),
            permissions: new Set(['read', 'write'])
          }
        }
      }
    }
    
    class ComplexDataStore {
      complexData = complexData
      
      constructor() {
        makeAutoObservable(this)
      }
    }
    
    const presenter = new ComplexDataStore()

    const state = useMobxBridge(presenter)
    
    // Deep equality check
    expect(state.complexData.user.id).toBe(1)
    expect(state.complexData.user.profile.name).toBe('John')
    expect(state.complexData.user.profile.metadata.createdAt instanceof Date).toBe(true)
    expect(Array.isArray(state.complexData.user.profile.metadata.tags)).toBe(true)
    expect(state.complexData.user.profile.metadata.settings instanceof Map).toBe(true)
    expect(state.complexData.user.profile.metadata.permissions instanceof Set).toBe(true)
  })

  it('should handle type coercion correctly with isEqual', () => {
    class CoercionStore {
      numericString = '42'
      actualNumber = 42
      zeroString = '0'
      actualZero = 0
      emptyString = ''
      actualFalse = false
      
      constructor() {
        makeAutoObservable(this)
      }
      
      testCoercion() {
        // These should be treated as different values
        this.numericString = 42 // string -> number
        this.actualNumber = '42' // number -> string
      }
    }
    
    const presenter = new CoercionStore()

    const state = useMobxBridge(presenter, { allowDirectMutation: true })
    
    // Initial values should be strictly typed
    expect(state.numericString).toBe('42')
    expect(typeof state.numericString).toBe('string')
    expect(state.actualNumber).toBe(42)
    expect(typeof state.actualNumber).toBe('number')
    
    // Test direct mutation with type changes
    state.numericString = 42
    state.actualNumber = '42'
    
    expect(state.numericString).toBe(42)
    expect(typeof state.numericString).toBe('number')
    expect(state.actualNumber).toBe('42')
    expect(typeof state.actualNumber).toBe('string')
  })

  it('should handle function properties correctly', () => {
    class FunctionStore {
      name = 'test'
      callback = null
      
      constructor() {
        makeAutoObservable(this)
      }
      
      setCallback(fn) {
        this.callback = fn
      }
      
      executeCallback() {
        if (this.callback) {
          return this.callback(this.name)
        }
      }
    }
    
    const presenter = new FunctionStore()

    const state = useMobxBridge(presenter)
    
    // Test function assignment
    const testFn = (name) => `Hello ${name}`
    presenter.setCallback(testFn)
    
    // Note: MobX may wrap functions, so identity comparison might not work
    expect(typeof state.callback).toBe('function')
    expect(state.executeCallback()).toBe('Hello test')
  })

  it('should preserve object prototypes and class instances', () => {
    class CustomClass {
      constructor(value) {
        this.value = value
      }
      
      getValue() {
        return this.value
      }
    }
    
    const instance = new CustomClass('test')
    
    class PrototypeStore {
      customInstance = instance
      
      constructor() {
        makeAutoObservable(this)
      }
      
      updateInstance() {
        this.customInstance = new CustomClass('updated')
      }
    }
    
    const presenter = new PrototypeStore()

    const state = useMobxBridge(presenter)
    
    expect(state.customInstance instanceof CustomClass).toBe(true)
    expect(state.customInstance.getValue()).toBe('test')
    
    presenter.updateInstance()
    
    expect(state.customInstance instanceof CustomClass).toBe(true)
    expect(state.customInstance.getValue()).toBe('updated')
  })
})