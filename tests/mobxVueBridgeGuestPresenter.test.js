import { describe, it, expect, beforeEach } from 'vitest'
import { makeObservable, observable, computed, action, runInAction } from 'mobx'
import { useMobxBridge } from '../mobxVueBridge.js'
import { nextTick } from 'vue'

/**
 * Simplified GuestDataPresenter to test nested object reactivity issues
 * Tests the real-world scenario where nested object properties (vm.primary_guest.first_name)
 * and dynamic object properties (vm.validationErrors) don't trigger Vue reactivity
 */
class GuestDataPresenter {
  vm = {
    zip_loading: false,
    copyGuestDetails: false,
    primary_guest: {
      first_name: "",
      last_name: "",
      middle_name: "",
      email: "",
      phone: "",
      street: "",
      city: "",
      state: "",
      zip_code: "",
      country: ""
    },
    validationErrors: {}
  }

  addressRules = {
    required_guest_fields: ['first_name', 'last_name', 'email'],
    display_fields: ['first_name', 'last_name', 'email', 'phone', 'city', 'state'],
    country_code: 'US'
  }

  constructor() {
    makeObservable(this, {
      // Deep observation for nested objects
      vm: observable.deep,
      addressRules: observable,

      // Computed properties
      defaultCountry: computed,
      
      // Actions
      init: action,
      updateGuestName: action,
      validateGuestData: action,
      updateNestedField: action,
      clearValidationErrors: action,
      setMultipleErrors: action,
      updateCountry: action
    })
  }

  init() {
    this.vm.primary_guest.first_name = "John"
    this.vm.primary_guest.last_name = "Doe"
    this.vm.primary_guest.email = "john@example.com"
  }

  get defaultCountry() {
    return this.addressRules?.country_code || 'US'
  }

  // Action that updates nested property
  updateGuestName(firstName, lastName) {
    this.vm.primary_guest.first_name = firstName
    this.vm.primary_guest.last_name = lastName
  }

  // Action that validates and populates validationErrors dynamically
  validateGuestData() {
    const errors = {}
    
    // Simulate validation
    if (!this.vm.primary_guest.first_name) {
      errors.first_name = ['First name is required']
    }
    if (!this.vm.primary_guest.last_name) {
      errors.last_name = ['Last name is required']
    }
    if (!this.vm.primary_guest.email || !this.vm.primary_guest.email.includes('@')) {
      errors.email = ['Valid email is required']
    }

    this.vm.validationErrors = errors;



    return Object.keys(errors).length === 0
  }

  // Direct nested field update (common user interaction pattern)
  updateNestedField(field, value) {
    this.vm.primary_guest[field] = value
  }

  // Clear all validation errors
  clearValidationErrors() {
    runInAction(() => {
      for (const key in this.vm.validationErrors) {
        delete this.vm.validationErrors[key]
      }
    })
  }

  // Set multiple errors at once (stress test)
  setMultipleErrors(errorMap) {
    runInAction(() => {
      // Clear first
      for (const key in this.vm.validationErrors) {
        delete this.vm.validationErrors[key]
      }
      // Set new
      Object.assign(this.vm.validationErrors, errorMap)
    })
  }

  // Update nested object with address rules change
  updateCountry(countryCode) {
    this.addressRules.country_code = countryCode
    this.vm.primary_guest.country = countryCode
  }
}

describe('MobX-Vue Bridge - GuestDataPresenter Nested Reactivity', () => {
  let presenter
  let state

  beforeEach(() => {
    presenter = new GuestDataPresenter()
    state = useMobxBridge(presenter)
    presenter.init()
  })

  describe('Nested Object Properties (vm.primary_guest)', () => {
    it('should sync nested property changes from MobX to Vue', () => {
      // Initial state
      expect(state.vm.primary_guest.first_name).toBe('John')
      
      // Update via MobX action
      presenter.updateGuestName('Jane', 'Smith')
      
      // Vue state should reflect changes
      expect(state.vm.primary_guest.first_name).toBe('Jane')
      expect(state.vm.primary_guest.last_name).toBe('Smith')
    })

    it('should sync nested property changes from Vue to MobX', async () => {
      // Update via Vue state
      state.vm.primary_guest.first_name = 'Alice'
      state.vm.primary_guest.last_name = 'Johnson'
      
      // Nested mutations are async (microtask delay)
      await nextTick()
      
      // MobX should reflect changes
      expect(presenter.vm.primary_guest.first_name).toBe('Alice')
      expect(presenter.vm.primary_guest.last_name).toBe('Johnson')
    })

    it('should handle multiple nested property updates in sequence', async () => {
      // Sequence of updates
      state.vm.primary_guest.first_name = 'Bob'
      await nextTick()
      expect(presenter.vm.primary_guest.first_name).toBe('Bob')
      
      state.vm.primary_guest.email = 'bob@example.com'
      await nextTick()
      expect(presenter.vm.primary_guest.email).toBe('bob@example.com')
      
      state.vm.primary_guest.phone = '555-1234'
      await nextTick()
      expect(presenter.vm.primary_guest.phone).toBe('555-1234')
      
      // All changes should be synced
      expect(presenter.vm.primary_guest.first_name).toBe('Bob')
      expect(presenter.vm.primary_guest.email).toBe('bob@example.com')
      expect(presenter.vm.primary_guest.phone).toBe('555-1234')
    })

    it('should handle nested mutations via direct field updates', async () => {
      // This simulates v-model binding in Vue component
      state.vm.primary_guest.city = 'New York'
      
      // Nested mutations are async (microtask delay)
      await nextTick()
      
      expect(presenter.vm.primary_guest.city).toBe('New York')
      expect(state.vm.primary_guest.city).toBe('New York')
    })

    it('should maintain reactivity when updating multiple nested fields', () => {
      // Update multiple fields
      presenter.updateNestedField('street', '123 Main St')
      presenter.updateNestedField('city', 'Boston')
      presenter.updateNestedField('state', 'MA')
      presenter.updateNestedField('zip_code', '02101')
      
      // All updates should be reflected in Vue state
      expect(state.vm.primary_guest.street).toBe('123 Main St')
      expect(state.vm.primary_guest.city).toBe('Boston')
      expect(state.vm.primary_guest.state).toBe('MA')
      expect(state.vm.primary_guest.zip_code).toBe('02101')
    })
  })

  describe('Dynamic Object Properties (vm.validationErrors)', () => {
    it('should sync dynamically added validation errors from MobX to Vue', () => {
      // Initially no errors
      expect(Object.keys(state.vm.validationErrors).length).toBe(0)
      
      // Trigger validation that adds errors
      presenter.vm.primary_guest.first_name = ''
      presenter.vm.primary_guest.email = 'invalid'
      presenter.validateGuestData()
      
      // Vue state should reflect new error properties
      expect(state.vm.validationErrors.first_name).toEqual(['First name is required'])
      expect(state.vm.validationErrors.email).toEqual(['Valid email is required'])
      expect(Object.keys(state.vm.validationErrors).length).toBeGreaterThan(0)
    })

    it('should clear validation errors when deleted', () => {
      // Add errors first
      presenter.setMultipleErrors({
        first_name: ['Error 1'],
        last_name: ['Error 2'],
        email: ['Error 3']
      })
      
      expect(Object.keys(state.vm.validationErrors).length).toBe(3)
      
      // Clear errors
      presenter.clearValidationErrors()
      
      // Vue state should reflect cleared errors
      expect(Object.keys(state.vm.validationErrors).length).toBe(0)
      expect(state.vm.validationErrors.first_name).toBeUndefined()
    })

    it('should handle rapid error updates (add, clear, add pattern)', () => {
      // Add errors
      presenter.setMultipleErrors({
        first_name: ['Required'],
        email: ['Invalid']
      })
      expect(Object.keys(state.vm.validationErrors).length).toBe(2)
      
      // Clear errors
      presenter.clearValidationErrors()
      expect(Object.keys(state.vm.validationErrors).length).toBe(0)
      
      // Add different errors
      presenter.setMultipleErrors({
        phone: ['Invalid format'],
        city: ['Required']
      })
      expect(Object.keys(state.vm.validationErrors).length).toBe(2)
      expect(state.vm.validationErrors.phone).toEqual(['Invalid format'])
      expect(state.vm.validationErrors.first_name).toBeUndefined()
    })

    it('should handle complex error objects with arrays', () => {
      const complexErrors = {
        first_name: ['Required', 'Too short', 'Invalid characters'],
        email: ['Required', 'Invalid format'],
        phone: ['Invalid format']
      }
      
      presenter.setMultipleErrors(complexErrors)
      
      // Check array values are preserved
      expect(state.vm.validationErrors.first_name).toHaveLength(3)
      expect(state.vm.validationErrors.first_name[0]).toBe('Required')
      expect(state.vm.validationErrors.first_name[2]).toBe('Invalid characters')
    })

    it('should sync when errors are set directly via runInAction', () => {
      runInAction(() => {
        presenter.vm.validationErrors.custom_field = ['Custom error']
        presenter.vm.validationErrors.another_field = ['Another error']
      })
      
      expect(state.vm.validationErrors.custom_field).toEqual(['Custom error'])
      expect(state.vm.validationErrors.another_field).toEqual(['Another error'])
    })
  })

  describe('Combined Nested Updates (Real-world Scenario)', () => {
    it('should handle form submission workflow with validation', () => {
      // 1. User fills out form (Vue → MobX)
      state.vm.primary_guest.first_name = 'Test'
      state.vm.primary_guest.last_name = 'User'
      state.vm.primary_guest.email = 'test@example.com'
      
      // 2. Validation passes
      const isValid = presenter.validateGuestData()
      
      expect(isValid).toBe(true)
      expect(Object.keys(state.vm.validationErrors).length).toBe(0)
    })

    it('should handle form submission with validation errors', async () => {
      // 1. User submits incomplete form
      state.vm.primary_guest.first_name = ''
      state.vm.primary_guest.email = 'invalid'
      
      // Wait for nested mutations to propagate
      await nextTick()
      
      // 2. Validation fails and sets errors
      const isValid = presenter.validateGuestData()
      
      // Wait for validation errors to sync to Vue state
      await nextTick()
      
      expect(isValid).toBe(false)
      // Check on MobX side directly (validationErrors sync is tested separately)
      expect(Object.keys(presenter.vm.validationErrors).length).toBeGreaterThan(0)
      
      // 3. User corrects the form
      state.vm.primary_guest.first_name = 'John'
      state.vm.primary_guest.email = 'john@example.com'
      
      // Wait for nested mutations
      await nextTick()
      
      // 4. Validation passes and clears errors
      const isValidNow = presenter.validateGuestData()
      
      // Wait for errors to clear
      await nextTick()
      
      expect(isValidNow).toBe(true)
      expect(Object.keys(presenter.vm.validationErrors).length).toBe(0)
    })

    it('should handle user typing scenario with real-time updates', async () => {
      // Simulate user typing character by character
      const name = 'Jennifer'
      for (let i = 1; i <= name.length; i++) {
        state.vm.primary_guest.first_name = name.substring(0, i)
        await nextTick()
      }
      
      expect(presenter.vm.primary_guest.first_name).toBe('Jennifer')
      expect(state.vm.primary_guest.first_name).toBe('Jennifer')
    })

    it('should maintain reactivity when updating country and related fields', () => {
      // Update country (affects address rules and nested guest data)
      presenter.updateCountry('CA')
      
      expect(state.defaultCountry).toBe('CA')
      expect(state.vm.primary_guest.country).toBe('CA')
      expect(presenter.addressRules.country_code).toBe('CA')
    })
  })

  describe('Edge Cases and Stress Tests', () => {
    it('should handle empty string to non-empty string transitions', async () => {
      // Start empty
      state.vm.primary_guest.middle_name = ''
      await nextTick()
      expect(presenter.vm.primary_guest.middle_name).toBe('')
      
      // Set value
      state.vm.primary_guest.middle_name = 'Alexander'
      await nextTick()
      expect(presenter.vm.primary_guest.middle_name).toBe('Alexander')
      
      // Clear again
      state.vm.primary_guest.middle_name = ''
      await nextTick()
      expect(presenter.vm.primary_guest.middle_name).toBe('')
    })

    it('should handle rapid consecutive updates to same nested field', async () => {
      // Rapid updates
      state.vm.primary_guest.first_name = 'A'
      state.vm.primary_guest.first_name = 'AB'
      state.vm.primary_guest.first_name = 'ABC'
      state.vm.primary_guest.first_name = 'ABCD'
      state.vm.primary_guest.first_name = 'ABCDE'
      
      // Wait for batched update
      await nextTick()
      
      // Final value should be synced
      expect(presenter.vm.primary_guest.first_name).toBe('ABCDE')
    })

    it('should handle boolean flag updates alongside nested objects', async () => {
      // Update boolean flag
      state.vm.copyGuestDetails = true
      await nextTick()
      expect(presenter.vm.copyGuestDetails).toBe(true)
      
      // Update nested object
      state.vm.primary_guest.first_name = 'Test'
      await nextTick()
      expect(presenter.vm.primary_guest.first_name).toBe('Test')
      
      // Both should maintain state
      expect(state.vm.copyGuestDetails).toBe(true)
      expect(state.vm.primary_guest.first_name).toBe('Test')
    })

    it('should handle updates to all nested fields simultaneously', async () => {
      const guestData = {
        first_name: 'Michael',
        last_name: 'Scott',
        middle_name: 'Gary',
        email: 'michael@dundermifflin.com',
        phone: '555-0100',
        street: '1725 Slough Avenue',
        city: 'Scranton',
        state: 'PA',
        zip_code: '18503',
        country: 'US'
      }
      
      // Update all fields via Vue state
      Object.keys(guestData).forEach(key => {
        state.vm.primary_guest[key] = guestData[key]
      })
      
      // Wait for batched update
      await nextTick()
      
      // All should be synced to MobX
      Object.keys(guestData).forEach(key => {
        expect(presenter.vm.primary_guest[key]).toBe(guestData[key])
      })
    })
  })

  describe('allowDirectMutation: false Mode', () => {
    it('should prevent direct nested mutations when disabled', () => {
      // Create bridge with mutations disabled
      const restrictedState = useMobxBridge(presenter, { allowDirectMutation: false })
      
      // Direct mutation should be blocked
      const originalName = restrictedState.vm.primary_guest.first_name
      restrictedState.vm.primary_guest.first_name = 'Blocked'
      
      // Value should remain unchanged
      expect(restrictedState.vm.primary_guest.first_name).toBe(originalName)
      expect(presenter.vm.primary_guest.first_name).toBe(originalName)
    })

    it('should still allow action-based updates when direct mutation disabled', () => {
      const restrictedState = useMobxBridge(presenter, { allowDirectMutation: false })
      
      // Action should work
      presenter.updateGuestName('Action', 'Works')
      
      expect(restrictedState.vm.primary_guest.first_name).toBe('Action')
      expect(restrictedState.vm.primary_guest.last_name).toBe('Works')
    })
  })
})
