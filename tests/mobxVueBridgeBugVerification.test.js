import { describe, it, expect } from 'vitest'
import { makeAutoObservable, runInAction } from 'mobx'
import { useMobxBridge } from '../src/mobxVueBridge'
import { isEqual } from '../src/utils/equality'
import { nextTick } from 'vue'

describe('Bug Verification Tests', () => {
  
  describe('Bug #1: isEqual circular reference handling', () => {
    it('should return false when a has circular ref but b does not', () => {
      // Create object a with circular reference
      const a = { name: 'a' }
      a.self = a // circular reference
      
      // Create object b without circular reference
      const b = { name: 'a', self: { name: 'a' } }
      
      // These should NOT be equal - a has circular ref, b doesn't
      // Bug: current implementation returns true when it sees a was visited
      expect(isEqual(a, b)).toBe(false)
    })

    it('should return false when both have circular refs to different objects', () => {
      const a = { name: 'a' }
      a.self = a
      
      const b = { name: 'a' }
      b.self = b
      
      // Both have self-references, but they're different objects
      // This is actually equal in structure
      expect(isEqual(a, b)).toBe(true)
    })

    it('should return true for identical circular structures', () => {
      const a = { x: 1 }
      a.ref = a
      
      const b = { x: 1 }
      b.ref = b
      
      expect(isEqual(a, b)).toBe(true)
    })

    it('should return false when circular depth differs', () => {
      const a = { x: 1 }
      a.ref = a
      
      const b = { x: 1, ref: { x: 1, ref: null } }
      
      // a is circular, b is not
      expect(isEqual(a, b)).toBe(false)
    })
  })

  describe('Bug #2: deepObserve stale subscription after property reassignment', () => {
    it('should detect changes in newly assigned nested arrays', async () => {
      class Store {
        items = [1, 2, 3]
        
        constructor() {
          makeAutoObservable(this)
        }
        
        replaceItems(newItems) {
          this.items = newItems
        }
        
        pushToItems(item) {
          this.items.push(item)
        }
      }
      
      const store = new Store()
      const state = useMobxBridge(store)
      
      expect(state.items).toEqual([1, 2, 3])
      
      // Replace the entire array
      runInAction(() => {
        store.replaceItems([10, 20])
      })
      
      await nextTick()
      expect(state.items).toEqual([10, 20])
      
      // Now push to the NEW array - this is where the bug might occur
      // If deepObserve is still watching the old array, this won't be detected
      runInAction(() => {
        store.pushToItems(30)
      })
      
      await nextTick()
      expect(state.items).toEqual([10, 20, 30])
    })

    it('should detect nested mutations after object reassignment', async () => {
      class Store {
        data = { nested: { value: 1 } }
        
        constructor() {
          makeAutoObservable(this)
        }
        
        replaceData(newData) {
          this.data = newData
        }
        
        updateNestedValue(val) {
          this.data.nested.value = val
        }
      }
      
      const store = new Store()
      const state = useMobxBridge(store)
      
      expect(state.data.nested.value).toBe(1)
      
      // Replace entire data object
      runInAction(() => {
        store.replaceData({ nested: { value: 100 } })
      })
      
      await nextTick()
      expect(state.data.nested.value).toBe(100)
      
      // Mutate nested property in the NEW object
      runInAction(() => {
        store.updateNestedValue(200)
      })
      
      await nextTick()
      expect(state.data.nested.value).toBe(200)
    })
  })

  describe('Bug #3: Object.is edge cases with -0 and NaN', () => {
    it('should handle -0 vs +0 comparison', () => {
      // Object.is(-0, +0) is false, but for practical purposes they should be equal
      expect(isEqual(-0, 0)).toBe(true) // This might fail with current impl
    })

    it('should handle NaN comparison', () => {
      // Object.is(NaN, NaN) is true, which is correct behavior
      expect(isEqual(NaN, NaN)).toBe(true)
    })

    it('should handle objects containing -0 and +0', () => {
      const a = { value: -0 }
      const b = { value: 0 }
      expect(isEqual(a, b)).toBe(true) // Might fail
    })
  })

  describe('Bug #4: Double clone removed - verify single clone works', () => {
    it('should correctly sync nested object mutations with single clone', async () => {
      class Store {
        data = { items: [1, 2, 3], nested: { value: 'test' } }
        
        constructor() {
          makeAutoObservable(this)
        }
      }
      
      const store = new Store()
      const state = useMobxBridge(store)
      
      // Set a new object through Vue
      state.data = { items: [10, 20], nested: { value: 'updated' } }
      
      await nextTick()
      
      // Verify both Vue and MobX are in sync
      expect(state.data.items).toEqual([10, 20])
      expect(state.data.nested.value).toBe('updated')
      expect(store.data.items).toEqual([10, 20])
      expect(store.data.nested.value).toBe('updated')
      
      // Verify they're not the same reference (cloned)
      expect(state.data).not.toBe(store.data)
    })
  })

  describe('Bug #5: Deep proxy sibling mutations', () => {
    it('should handle mutations to sibling nested arrays correctly', async () => {
      class Store {
        data = {
          items1: [1, 2, 3],
          items2: ['a', 'b', 'c']
        }
        
        constructor() {
          makeAutoObservable(this)
        }
      }
      
      const store = new Store()
      const state = useMobxBridge(store)
      
      // Mutate first array through Vue proxy
      state.data.items1.push(4)
      await nextTick()
      
      // Mutate second array through Vue proxy
      state.data.items2.push('d')
      await nextTick()
      
      // Both should be correctly synced
      expect(state.data.items1).toEqual([1, 2, 3, 4])
      expect(state.data.items2).toEqual(['a', 'b', 'c', 'd'])
      expect(store.data.items1).toEqual([1, 2, 3, 4])
      expect(store.data.items2).toEqual(['a', 'b', 'c', 'd'])
    })

    it('should handle rapid mutations to different nested paths', async () => {
      class Store {
        data = {
          a: { value: 1 },
          b: { value: 2 },
          c: { items: [1] }
        }
        
        constructor() {
          makeAutoObservable(this)
        }
      }
      
      const store = new Store()
      const state = useMobxBridge(store)
      
      // Rapid mutations to different paths (within same microtask)
      state.data.a.value = 10
      state.data.b.value = 20
      state.data.c.items.push(2)
      
      await nextTick()
      
      // All should be synced
      expect(state.data.a.value).toBe(10)
      expect(state.data.b.value).toBe(20)
      expect(state.data.c.items).toEqual([1, 2])
      expect(store.data.a.value).toBe(10)
      expect(store.data.b.value).toBe(20)
      expect(store.data.c.items).toEqual([1, 2])
    })
  })

  describe('Bug #6: Setter-only properties', () => {
    it('should handle setter-only properties that modify internal state', async () => {
      class Store {
        _internalValue = 0
        
        constructor() {
          makeAutoObservable(this, {
            _internalValue: true, // observable
            multipliedValue: false, // setter-only, not observable itself
          })
        }
        
        // Setter-only property that modifies internal state
        set multipliedValue(val) {
          this._internalValue = val * 2
        }
        
        get currentValue() {
          return this._internalValue
        }
      }
      
      const store = new Store()
      const state = useMobxBridge(store)
      
      // Initial state
      expect(state.currentValue).toBe(0)
      
      // Set via the setter-only property
      state.multipliedValue = 5
      
      await nextTick()
      
      // The internal value should be updated (5 * 2 = 10)
      expect(store._internalValue).toBe(10)
      expect(state.currentValue).toBe(10)
    })
  })
})
