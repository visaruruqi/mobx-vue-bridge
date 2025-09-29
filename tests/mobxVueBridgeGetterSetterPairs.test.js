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
  markRaw: vi.fn((value) => value)
}))

import { useMobxBridge } from '../mobxVueBridge'

describe('MobX-Vue Bridge Getters and Setters', () => {
  it('should treat getter/setter pairs as writable and getter-only as computed', () => {
    class TestPresenter {
      constructor() {
        this.vm = {
          show_datepicker: false,
          booking_details_popup: false,
          loading: false,
          property_details: false
        }
        makeAutoObservable(this)
      }

      // Getter/setter pairs - should be treated as regular properties (two-way binding)
      get showDatepicker() {
        return this.vm.show_datepicker
      }

      set showDatepicker(val) {
        this.vm.show_datepicker = val
      }

      get bookingDetailsPopup() {
        return this.vm.booking_details_popup
      }

      set bookingDetailsPopup(val) {
        this.vm.booking_details_popup = val
      }

      get loading() {
        return this.vm.loading
      }

      set loading(val) {
        this.vm.loading = val
      }

      get showPropertyDetails() {
        return this.vm.property_details
      }

      set showPropertyDetails(val) {
        this.vm.property_details = val
      }

      // Computed-only getter - should be treated as computed property (read-only)
      get computedValue() {
        return this.vm.loading ? 'Loading...' : 'Ready'
      }

      // Regular method
      toggleShowDatepicker() {
        this.vm.show_datepicker = !this.vm.show_datepicker
      }
    }

    const presenter = new TestPresenter()
    const state = useMobxBridge(presenter)


    // Test that all getters are available as computed properties (read-only)
    expect(state.showDatepicker).toBeDefined()
    expect(state.bookingDetailsPopup).toBeDefined()
    expect(state.loading).toBeDefined()
    expect(state.showPropertyDetails).toBeDefined()

    // Test initial values
    expect(state.showDatepicker).toBe(false)
    expect(state.bookingDetailsPopup).toBe(false)
    expect(state.loading).toBe(false)
    expect(state.showPropertyDetails).toBe(false)

    // Test that getter/setter pairs are writable
    state.showDatepicker = true
    expect(presenter.showDatepicker).toBe(true)
    expect(state.showDatepicker).toBe(true)
    expect(presenter.vm.show_datepicker).toBe(true)

    state.bookingDetailsPopup = true
    expect(presenter.bookingDetailsPopup).toBe(true)
    expect(state.bookingDetailsPopup).toBe(true)
    expect(presenter.vm.booking_details_popup).toBe(true)

    state.loading = true
    expect(presenter.loading).toBe(true)
    expect(state.loading).toBe(true)
    expect(presenter.vm.loading).toBe(true)

    state.showPropertyDetails = true
    expect(presenter.showPropertyDetails).toBe(true)
    expect(state.showPropertyDetails).toBe(true)
    expect(presenter.vm.property_details).toBe(true)

    // Test that MobX -> Vue sync works (change via presenter)
    presenter.showPropertyDetails = true
    expect(state.showPropertyDetails).toBe(true)

    // Test that computed properties are read-only
    expect(state.computedValue).toBe('Loading...') // loading is true, so it should be 'Loading...'
    expect(() => {
      state.computedValue = 'Should not work'
    }).toThrow(/Cannot assign to computed property/)

    // Test that methods are available
    expect(typeof state.toggleShowDatepicker).toBe('function')
    
    // Test method execution
    const beforeToggle = state.showDatepicker
    state.toggleShowDatepicker()
    expect(state.showDatepicker).toBe(!beforeToggle) // Should toggle
    expect(presenter.vm.show_datepicker).toBe(!beforeToggle)
  })

  it('should handle getter/setter pairs and computed-only getters correctly', () => {
    class SecondHeaderPresenter {
      constructor() {
        this.vm = {
          dates: ['', ''],
          updatedDates: ['', ''],
          occupants: '',
          children: '',
          booking_details_popup: false,
          show_datepicker: false,
          property_details: false,
          loading: false,
          showBookingSummary: false,
        }
        makeAutoObservable(this)
      }

      get bookingDetailsPopup() {
        return this.vm.booking_details_popup
      }

      set bookingDetailsPopup(val) {
        this.vm.booking_details_popup = val
      }

      get showDatepicker() {
        return this.vm.show_datepicker
      }

      set showDatepicker(val) {
        this.vm.show_datepicker = val
      }

      get showPropertyDetails() {
        return this.vm.property_details
      }

      set showPropertyDetails(val) {
        this.vm.property_details = val
      }

      get loading() {
        return this.vm.loading
      }

      set loading(val) {
        this.vm.loading = val
      }

      // Computed properties (read-only)
      get disableChangeDate() {
        return this.vm.updatedDates.every((date) => date !== '' && date !== null)
      }

      get headerFormattedDates() {
        const [start, end] = this.vm.updatedDates;
        return start && end ? `${start} - ${end}` : 'No dates selected';
      }

      // Methods
      toggleShowPropertyDetails() {
        this.vm.property_details = !this.vm.property_details
      }

      toggleShowDatepicker() {
        this.vm.show_datepicker = !this.vm.show_datepicker
      }
    }

    const presenter = new SecondHeaderPresenter()
    const state = useMobxBridge(presenter)


    // Test that all getters are available as computed properties
    expect(state.bookingDetailsPopup).toBeDefined()
    expect(state.showDatepicker).toBeDefined()
    expect(state.showPropertyDetails).toBeDefined()
    expect(state.loading).toBeDefined()
    expect(state.disableChangeDate).toBeDefined()
    expect(state.headerFormattedDates).toBeDefined()

    // Test initial values
    expect(state.showDatepicker).toBe(false)
    expect(state.bookingDetailsPopup).toBe(false)
    expect(state.loading).toBe(false)
    expect(state.showPropertyDetails).toBe(false)
    expect(state.disableChangeDate).toBe(false) // Both dates are empty
    expect(state.headerFormattedDates).toBe('No dates selected')

    // Test that getter/setter pairs are writable
    state.showDatepicker = true
    expect(presenter.showDatepicker).toBe(true)
    expect(presenter.vm.show_datepicker).toBe(true)
    expect(state.showDatepicker).toBe(true)

    state.bookingDetailsPopup = true
    expect(presenter.bookingDetailsPopup).toBe(true)
    expect(presenter.vm.booking_details_popup).toBe(true)
    expect(state.bookingDetailsPopup).toBe(true)

    state.loading = true
    expect(presenter.loading).toBe(true)
    expect(presenter.vm.loading).toBe(true)
    expect(state.loading).toBe(true)

    state.showPropertyDetails = true
    expect(presenter.showPropertyDetails).toBe(true)
    expect(presenter.vm.property_details).toBe(true)
    expect(state.showPropertyDetails).toBe(true)

    expect(() => {
      state.disableChangeDate = true
    }).toThrow(/Cannot assign to computed property/)

    expect(() => {
      state.headerFormattedDates = 'test'
    }).toThrow(/Cannot assign to computed property/)

    // Test methods
    expect(typeof state.toggleShowDatepicker).toBe('function')
    expect(typeof state.toggleShowPropertyDetails).toBe('function')

    // Test method execution - methods can modify the underlying vm properties
    // which will be reflected in the getter/setter pairs
    const initialShowDatepicker = state.showDatepicker
    state.toggleShowDatepicker()
    expect(state.showDatepicker).toBe(!initialShowDatepicker) // Should toggle

    const initialShowPropertyDetails = state.showPropertyDetails
    state.toggleShowPropertyDetails()
    expect(state.showPropertyDetails).toBe(!initialShowPropertyDetails) // Should toggle
    
    // Test that changes via presenter vm are reflected in getter/setter pairs
    presenter.vm.show_datepicker = false
    expect(state.showDatepicker).toBe(false) // Should reflect the change
  })
})
