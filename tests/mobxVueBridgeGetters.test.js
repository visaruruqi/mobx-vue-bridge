import { describe, it, expect, vi } from 'vitest'
import { makeAutoObservable, makeObservable, observable, computed } from 'mobx'

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
  markRaw: vi.fn((value) => value)
}))

import { useMobxBridge } from '../mobxVueBridge'

describe('MobX-Vue Bridge Getters as Computed Properties', () => {
  it('should detect and handle MobX getters as computed properties with makeAutoObservable', () => {
    class TestPresenter {
      constructor() {
        this.count = 0
        this.name = 'Test'
        makeAutoObservable(this)
      }

      // This getter should be detected as a computed property
      get displayName() {
        return `${this.name} (${this.count})`
      }

      // This getter should be detected as a computed property
      get doubledCount() {
        return this.count * 2
      }

      // Regular method for comparison
      increment() {
        this.count++
      }
    }

    const presenter = new TestPresenter()
    const state = useMobxBridge(presenter)

    // Test that getters are exposed as computed properties
    expect(state.displayName).toBe('Test (0)')
    expect(state.doubledCount).toBe(0)

    // Test that computed properties are read-only (should throw when trying to assign)
    expect(() => {
      state.displayName = 'Should not work'
    }).toThrow(/Cannot assign to computed property/)

    expect(() => {
      state.doubledCount = 999
    }).toThrow(/Cannot assign to computed property/)

    // Test that computed properties react to changes in their dependencies
    state.count = 5
    expect(state.displayName).toBe('Test (5)')
    expect(state.doubledCount).toBe(10)

    state.name = 'Updated'
    expect(state.displayName).toBe('Updated (5)')
    expect(state.doubledCount).toBe(10) // Should not change since it doesn't depend on name

    // Test that methods still work
    state.increment()
    expect(presenter.count).toBe(6)
    expect(state.displayName).toBe('Updated (6)')
    expect(state.doubledCount).toBe(12)
  })

  it('should detect and handle MobX getters as computed properties with makeObservable', () => {
    class TestPresenter {
      constructor() {
        this.firstName = 'John'
        this.lastName = 'Doe'
        this.age = 25

        makeObservable(this, {
          firstName: observable,
          lastName: observable,
          age: observable,
          fullName: computed,
          isAdult: computed,
          updateAge: false // Don't make it observable
        })
      }

      // Computed getter
      get fullName() {
        return `${this.firstName} ${this.lastName}`
      }

      // Computed getter with logic
      get isAdult() {
        return this.age >= 18
      }

      updateAge(newAge) {
        this.age = newAge
      }
    }

    const presenter = new TestPresenter()
    const state = useMobxBridge(presenter)

    // Test initial computed values
    expect(state.fullName).toBe('John Doe')
    expect(state.isAdult).toBe(true)

    // Test that computed properties are read-only
    expect(() => {
      state.fullName = 'Should not work'
    }).toThrow(/Cannot assign to computed property/)

    expect(() => {
      state.isAdult = false
    }).toThrow(/Cannot assign to computed property/)

    // Test reactivity - changing dependencies should update computed properties
    state.firstName = 'Jane'
    expect(state.fullName).toBe('Jane Doe')
    expect(state.isAdult).toBe(true) // Should not change

    state.lastName = 'Smith'
    expect(state.fullName).toBe('Jane Smith')

    state.updateAge(16)
    expect(state.isAdult).toBe(false)
    expect(state.fullName).toBe('Jane Smith') // Should not change
  })

  it('should handle complex computed properties with multiple dependencies', () => {
    class ShoppingCart {
      constructor() {
        this.items = []
        this.taxRate = 0.1
        this.discountPercent = 0
        makeAutoObservable(this)
      }

      get subtotal() {
        return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      }

      get discount() {
        return this.subtotal * (this.discountPercent / 100)
      }

      get taxAmount() {
        return (this.subtotal - this.discount) * this.taxRate
      }

      get total() {
        return this.subtotal - this.discount + this.taxAmount
      }

      get itemCount() {
        return this.items.reduce((sum, item) => sum + item.quantity, 0)
      }

      addItem(item) {
        this.items.push(item)
      }

      setDiscount(percent) {
        this.discountPercent = percent
      }
    }

    const cart = new ShoppingCart()
    const state = useMobxBridge(cart)

    // Test initial state
    expect(state.subtotal).toBe(0)
    expect(state.discount).toBe(0)
    expect(state.taxAmount).toBe(0)
    expect(state.total).toBe(0)
    expect(state.itemCount).toBe(0)

    // Add items and test computed properties
    state.addItem({ name: 'Item 1', price: 10, quantity: 2 })
    expect(state.subtotal).toBe(20)
    expect(state.discount).toBe(0)
    expect(state.taxAmount).toBe(2) // 20 * 0.1
    expect(state.total).toBe(22) // 20 - 0 + 2
    expect(state.itemCount).toBe(2)

    state.addItem({ name: 'Item 2', price: 15, quantity: 1 })
    expect(state.subtotal).toBe(35)
    expect(state.taxAmount).toBe(3.5) // 35 * 0.1
    expect(state.total).toBe(38.5) // 35 - 0 + 3.5
    expect(state.itemCount).toBe(3)

    // Apply discount
    state.setDiscount(10) // 10% discount
    expect(state.discount).toBe(3.5) // 35 * 0.1
    expect(state.taxAmount).toBeCloseTo(3.15, 2) // (35 - 3.5) * 0.1
    expect(state.total).toBeCloseTo(34.65, 2) // 35 - 3.5 + 3.15

    // Test that all computed properties are read-only
    expect(() => { state.subtotal = 100 }).toThrow(/Cannot assign to computed property/)
    expect(() => { state.discount = 5 }).toThrow(/Cannot assign to computed property/)
    expect(() => { state.taxAmount = 10 }).toThrow(/Cannot assign to computed property/)
    expect(() => { state.total = 50 }).toThrow(/Cannot assign to computed property/)
    expect(() => { state.itemCount = 10 }).toThrow(/Cannot assign to computed property/)
  })

  it('should distinguish between getters with setters and computed-only getters', () => {
    class TestPresenter {
      constructor() {
        this.baseValue = 10
        this.multiplier = 2
        makeAutoObservable(this)
      }

      // Computed-only getter - should be treated as computed property
      get computedValue() {
        return this.baseValue * this.multiplier
      }

      // Another computed-only getter
      get isPositive() {
        return this.baseValue > 0
      }

      // Regular method to update baseValue
      setValue(newValue) {
        this.baseValue = newValue
      }
    }

    const presenter = new TestPresenter()
    const state = useMobxBridge(presenter)

    // Test initial values
    expect(state.baseValue).toBe(10)
    expect(state.computedValue).toBe(20)
    expect(state.isPositive).toBe(true)

    // Test that regular property works
    state.baseValue = 15
    expect(presenter.baseValue).toBe(15)
    expect(state.baseValue).toBe(15)

    // Test that computed properties are read-only
    expect(() => {
      state.computedValue = 100
    }).toThrow(/Cannot assign to computed property/)

    expect(() => {
      state.isPositive = false
    }).toThrow(/Cannot assign to computed property/)

    // Test reactivity of computed properties
    state.baseValue = -5
    expect(state.computedValue).toBe(-10) // -5 * 2
    expect(state.isPositive).toBe(false)

    state.multiplier = 3
    expect(state.computedValue).toBe(-15) // -5 * 3
    expect(state.isPositive).toBe(false) // Should not change
  })

  it('should handle computed properties that depend on other computed properties', () => {
    class Calculator {
      constructor() {
        this.a = 5
        this.b = 3
        makeAutoObservable(this)
      }

      get sum() {
        return this.a + this.b
      }

      get product() {
        return this.a * this.b
      }

      get average() {
        return this.sum / 2
      }

      get ratio() {
        return this.product / this.sum
      }

      get description() {
        return `Sum: ${this.sum}, Product: ${this.product}, Average: ${this.average}, Ratio: ${this.ratio.toFixed(2)}`
      }
    }

    const calc = new Calculator()
    const state = useMobxBridge(calc)

    // Test initial computed values
    expect(state.sum).toBe(8) // 5 + 3
    expect(state.product).toBe(15) // 5 * 3
    expect(state.average).toBe(4) // 8 / 2
    expect(state.ratio).toBe(1.875) // 15 / 8
    expect(state.description).toBe('Sum: 8, Product: 15, Average: 4, Ratio: 1.88')

    // Test that all are read-only
    expect(() => { state.sum = 10 }).toThrow(/Cannot assign to computed property/)
    expect(() => { state.product = 20 }).toThrow(/Cannot assign to computed property/)
    expect(() => { state.average = 5 }).toThrow(/Cannot assign to computed property/)
    expect(() => { state.ratio = 2 }).toThrow(/Cannot assign to computed property/)
    expect(() => { state.description = 'test' }).toThrow(/Cannot assign to computed property/)

    // Test cascading reactivity
    state.a = 10
    expect(state.sum).toBe(13) // 10 + 3
    expect(state.product).toBe(30) // 10 * 3
    expect(state.average).toBe(6.5) // 13 / 2
    expect(state.ratio).toBe(2.3076923076923075) // 30 / 13
    expect(state.description).toBe('Sum: 13, Product: 30, Average: 6.5, Ratio: 2.31')

    state.b = 7
    expect(state.sum).toBe(17) // 10 + 7
    expect(state.product).toBe(70) // 10 * 7
    expect(state.average).toBe(8.5) // 17 / 2
    expect(state.ratio).toBe(4.117647058823529) // 70 / 17
    expect(state.description).toBe('Sum: 17, Product: 70, Average: 8.5, Ratio: 4.12')
  })
})
