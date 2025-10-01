import { describe, it, expect, vi } from 'vitest'

// Mock Vue imports
vi.mock('vue', () => ({
  reactive: (obj) => obj,
  ref: (value) => ({ value }),
  onMounted: (fn) => fn(),
  onUnmounted: (fn) => {},
  markRaw: (obj) => obj,
  watch: vi.fn()
}))

import { useMobxBridge } from '../src/mobxVueBridge.js'

describe('MobX-Vue Bridge - Parameter Validation', () => {
  it('should throw error when mobxObject is null', () => {
    expect(() => {
      useMobxBridge(null)
    }).toThrow('useMobxBridge requires a valid MobX observable object as the first parameter')
  })

  it('should throw error when mobxObject is undefined', () => {
    expect(() => {
      useMobxBridge(undefined)
    }).toThrow('useMobxBridge requires a valid MobX observable object as the first parameter')
  })

  it('should throw error when mobxObject is a string', () => {
    expect(() => {
      useMobxBridge('not an object')
    }).toThrow('useMobxBridge requires a valid MobX observable object as the first parameter')
  })

  it('should throw error when mobxObject is a number', () => {
    expect(() => {
      useMobxBridge(123)
    }).toThrow('useMobxBridge requires a valid MobX observable object as the first parameter')
  })

  it('should throw error when mobxObject is a boolean', () => {
    expect(() => {
      useMobxBridge(true)
    }).toThrow('useMobxBridge requires a valid MobX observable object as the first parameter')
  })

  it('should NOT throw error when mobxObject is a valid object', () => {
    expect(() => {
      useMobxBridge({ count: 0 })
    }).not.toThrow()
  })

  it('should NOT throw error when mobxObject is an empty object', () => {
    expect(() => {
      useMobxBridge({})
    }).not.toThrow()
  })
})
