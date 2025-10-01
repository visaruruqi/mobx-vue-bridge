import { describe, it, expect, vi } from 'vitest'
import { makeAutoObservable } from 'mobx'

// Mock Vue imports
const mockDisposers = []
vi.mock('vue', () => ({
  reactive: (obj) => obj,
  ref: (value) => ({ value }),
  onMounted: (fn) => fn(),
  onUnmounted: (fn) => {
    mockDisposers.push(fn)
  },
  markRaw: (obj) => obj,
  watch: vi.fn()
}))

import { useMobxBridge } from '../src/mobxVueBridge.js'

describe('MobX-Vue Bridge - Circular Reference Handling in isEqual', () => {
  it('should handle comparison of structures that reference same object multiple times', () => {
    const shared = { id: 1, name: 'Shared' }
    
    class MultiRefPresenter {
      constructor() {
        this.ref1 = shared
        this.ref2 = shared  // Same object referenced twice
        this.count = 0
        makeAutoObservable(this)
      }
    }
    
    const presenter = new MultiRefPresenter()
    
    // Should not throw when creating bridge
    expect(() => {
      const state = useMobxBridge(presenter)
    }).not.toThrow()
  })

  it('should handle deeply nested object comparisons without stack overflow', () => {
    // Create a deeply nested but non-circular structure
    let deep = { value: 'end' }
    for (let i = 0; i < 100; i++) {
      deep = { nested: deep, level: i }
    }
    
    class DeepPresenter {
      constructor() {
        this.data = deep
        makeAutoObservable(this)
      }
    }
    
    const presenter = new DeepPresenter()
    
    expect(() => {
      const state = useMobxBridge(presenter)
    }).not.toThrow()
  })

  it('should handle updates to objects that share references', () => {
    const config = { theme: 'dark', language: 'en' }
    
    class SharedRefPresenter {
      constructor() {
        this.userConfig = config
        this.systemConfig = config  // Same object
        this.count = 0
        makeAutoObservable(this)
      }
      
      increment() {
        this.count++
      }
    }
    
    const presenter = new SharedRefPresenter()
    const state = useMobxBridge(presenter)
    
    expect(state.count).toBe(0)
    
    // Update should work fine
    presenter.increment()
    
    expect(presenter.count).toBe(1)
  })

  it('should handle array with repeated object references', () => {
    const item = { id: 1, name: 'Item' }
    
    class RepeatedRefPresenter {
      constructor() {
        // Array with same object referenced multiple times
        this.items = [item, item, item]
        makeAutoObservable(this)
      }
    }
    
    const presenter = new RepeatedRefPresenter()
    
    expect(() => {
      const state = useMobxBridge(presenter)
    }).not.toThrow()
  })

  it('should handle tree structure with shared leaf nodes', () => {
    const leaf1 = { value: 'A' }
    const leaf2 = { value: 'B' }
    
    const tree = {
      left: {
        left: leaf1,
        right: leaf2
      },
      right: {
        left: leaf1,  // Shared reference
        right: leaf2   // Shared reference
      }
    }
    
    class TreePresenter {
      constructor() {
        this.tree = tree
        makeAutoObservable(this)
      }
    }
    
    const presenter = new TreePresenter()
    
    expect(() => {
      const state = useMobxBridge(presenter)
    }).not.toThrow()
  })

  it('should handle graph-like structures with shared nodes', () => {
    const nodeA = { id: 'A', data: 'Node A' }
    const nodeB = { id: 'B', data: 'Node B' }
    const nodeC = { id: 'C', data: 'Node C' }
    
    class GraphPresenter {
      constructor() {
        // Graph where multiple paths can reach same nodes
        this.graph = {
          start: nodeA,
          paths: [
            [nodeA, nodeB, nodeC],
            [nodeA, nodeC],  // Different path, same nodes
            [nodeB, nodeC]
          ]
        }
        makeAutoObservable(this)
      }
    }
    
    const presenter = new GraphPresenter()
    
    expect(() => {
      const state = useMobxBridge(presenter)
    }).not.toThrow()
  })

  it('should efficiently compare objects with many shared references', () => {
    const base = { type: 'base', value: 42 }
    
    // Create object with 50 references to the same base object
    const manyRefs = {}
    for (let i = 0; i < 50; i++) {
      manyRefs[`ref${i}`] = base
    }
    
    class ManyRefsPresenter {
      constructor() {
        this.data = manyRefs
        this.counter = 0
        makeAutoObservable(this)
      }
      
      increment() {
        this.counter++
      }
    }
    
    const presenter = new ManyRefsPresenter()
    const state = useMobxBridge(presenter)
    
    // Should handle initial bridge without issues
    expect(state.counter).toBe(0)
    
    // Should handle updates efficiently
    presenter.increment()
    expect(presenter.counter).toBe(1)
  })
})
