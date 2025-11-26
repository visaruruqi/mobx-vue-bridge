import { reactive, onUnmounted, ref } from 'vue';
import { toJS, reaction, observe } from 'mobx';
import { deepObserve } from 'mobx-utils';
import clone from 'clone';
import { categorizeMobxMembers } from './utils/memberDetection.js';
import { isEqual } from './utils/equality.js';
import { createDeepProxy } from './utils/deepProxy.js';

/**
 * 🌉 MobX-Vue Bridge
 * 
 * Creates a bidirectional bridge between MobX observables and Vue 3 reactivity.
 * Automatically synchronizes changes in both directions while preventing infinite loops.
 * 
 * @param {object} mobxObject - The MobX observable object to bridge (created with makeAutoObservable)
 * @param {object} options - Configuration options
 * @param {boolean} options.allowDirectMutation - Whether to allow direct mutation of properties (default: true)
 * @returns {object} Vue reactive state object with synchronized properties, getters, setters, and methods
 * 
 * @example
 * ```javascript
 * import { useMobxBridge } from 'mobx-vue-bridge'
 * import { makeAutoObservable } from 'mobx'
 * 
 * class UserStore {
 *   constructor() {
 *     this.name = 'John'
 *     this.age = 30
 *     makeAutoObservable(this)
 *   }
 *   
 *   get displayName() {
 *     return `${this.name} (${this.age})`
 *   }
 * }
 * 
 * const store = new UserStore()
 * const state = useMobxBridge(store)
 * ```
 */
export function useMobxBridge(mobxObject, options = {}) {
  // Validate mobxObject parameter
  if (!mobxObject || typeof mobxObject !== 'object') {
    throw new Error('useMobxBridge requires a valid MobX observable object as the first parameter');
  }
  
  const safeOptions = options || {};
  // Use explicit boolean conversion to handle truthy/falsy values properly
  const allowDirectMutation = safeOptions.allowDirectMutation !== undefined 
    ? Boolean(safeOptions.allowDirectMutation) 
    : true; // Keep the original default of true
  
  const vueState = reactive({});

  // Use the imported categorization function
  const members = categorizeMobxMembers(mobxObject);

  // ---- utils: guards -------------------------------------------------------
  const updatingFromMobx = new Set();
  const updatingFromVue = new Set();

  // Warning helpers to reduce duplication
  const warnDirectMutation = (prop) => console.warn(`Direct mutation of '${prop}' is disabled`);
  const warnSetterMutation = (prop) => console.warn(`Direct mutation of setter '${prop}' is disabled`);
  const warnMethodAssignment = (prop) => console.warn(`Cannot assign to method '${prop}'`);

  // ---- properties (two-way) -------------------------------------------------
  const propertyRefs = {};
  
  members.properties.forEach(prop => {
    propertyRefs[prop] = ref(toJS(mobxObject[prop]));

    Object.defineProperty(vueState, prop, {
      get: () => {
        const value = propertyRefs[prop].value;
        // For objects/arrays, return a deep proxy that syncs mutations back
        if (value && typeof value === 'object') {
          return createDeepProxy(
            value, 
            prop, 
            () => propertyRefs[prop].value,
            allowDirectMutation,
            updatingFromVue,
            mobxObject,
            propertyRefs
          );
        }
        return value;
      },
      set: allowDirectMutation
        ? (value) => {
            // Update Vue ref
            const cloned = clone(value);
            if (!isEqual(propertyRefs[prop].value, cloned)) {
              propertyRefs[prop].value = cloned;
            }
            // ALSO update MobX immediately (synchronous)
            if (!isEqual(mobxObject[prop], cloned)) {
              updatingFromVue.add(prop);
              try {
                mobxObject[prop] = cloned;
              } finally {
                updatingFromVue.delete(prop);
              }
            }
          }
        : () => warnDirectMutation(prop),
      enumerable: true,
      configurable: true,
    });

  });

  // ---- getters and setters (handle both computed and two-way binding) ------
  const getterRefs = {};
  const setterRefs = {};
  const readOnlyDetected = new Set(); // Track properties detected as read-only on first write

  // First, handle properties that have BOTH getters and setters (getter/setter pairs)
  const getterSetterPairs = members.getters.filter(prop => members.setters.includes(prop));
  const gettersOnly = members.getters.filter(prop => !members.setters.includes(prop));
  const settersOnly = members.setters.filter(prop => !members.getters.includes(prop));

  // Getter/setter pairs: potentially writable with reactive updates
  // Note: Some may have MobX synthetic setters that throw - we detect this lazily on first write
  getterSetterPairs.forEach(prop => {
    // Get initial value from getter
    let initialValue;
    try {
      initialValue = toJS(mobxObject[prop]);
    } catch (error) {
      initialValue = undefined;
    }
    getterRefs[prop] = ref(initialValue);

    Object.defineProperty(vueState, prop, {
      // ALWAYS read from MobX so computed properties work correctly
      get: () => getterRefs[prop].value,
      set: allowDirectMutation
        ? (value) => {
            // Check if we've already detected this as read-only
            if (readOnlyDetected.has(prop)) {
              throw new Error(`Cannot assign to computed property '${prop}'`);
            }
            
            // Try to call the MobX setter (first write test)
            updatingFromVue.add(prop);
            try {
              mobxObject[prop] = value;
              // The getter ref will be updated by the reaction
            } catch (error) {
              // Check if it's a MobX "not possible to assign" error (synthetic setter)
              if (error.message && error.message.includes('not possible to assign')) {
                // Mark as read-only so we don't try again
                readOnlyDetected.add(prop);
                // This is actually a read-only computed property
                throw new Error(`Cannot assign to computed property '${prop}'`);
              }
              // For other errors (validation, side effects), just warn
              console.warn(`Failed to set property '${prop}':`, error);
            } finally {
              updatingFromVue.delete(prop);
            }
          }
        : () => warnDirectMutation(prop),
      enumerable: true,
      configurable: true,
    });
  });

  // Getter-only properties: read-only computed
  gettersOnly.forEach(prop => {
    // Safely get initial value of computed property, handle errors gracefully
    let initialValue;
    try {
      initialValue = toJS(mobxObject[prop]);
    } catch (error) {
      // If computed property throws during initialization (e.g., accessing null.property),
      // set initial value to undefined and let the reaction handle updates later
      initialValue = undefined;
    }
    getterRefs[prop] = ref(initialValue);

    Object.defineProperty(vueState, prop, {
      get: () => getterRefs[prop].value,
      set: () => {
        throw new Error(`Cannot assign to computed property '${prop}'`)
      },
      enumerable: true,
      configurable: true,
    });
  });

  // Setter-only properties: write-only
  settersOnly.forEach(prop => {
    // For setter-only properties, track the last set value
    setterRefs[prop] = ref(undefined);

    Object.defineProperty(vueState, prop, {
      get: () => setterRefs[prop].value,
      set: allowDirectMutation
        ? (value) => {
            // Update the setter ref
            setterRefs[prop].value = value;
            
            // Call the MobX setter immediately
            updatingFromVue.add(prop);
            try {
              mobxObject[prop] = value;
            } catch (error) {
              console.warn(`Failed to set property '${prop}':`, error);
            } finally {
              updatingFromVue.delete(prop);
            }
          }
        : () => warnSetterMutation(prop),
      enumerable: true,
      configurable: true,
    });
  });

  // ---- methods (bound) ------------------------------------------------------
  members.methods.forEach(prop => {
    // Cache the bound method to avoid creating new functions on every access
    const boundMethod = mobxObject[prop].bind(mobxObject);
    Object.defineProperty(vueState, prop, {
      get: () => boundMethod,
      set: () => warnMethodAssignment(prop),
      enumerable: true,
      configurable: true,
    });
  });

  // ---- MobX → Vue: property observation ----------------------------------------
  const subscriptions = [];

  setupStandardPropertyObservers();

  // Standard property observation implementation
  function setupStandardPropertyObservers() {
    // Use individual observe for each property to avoid circular reference issues
    members.properties.forEach(prop => {
      try {
        const sub = observe(mobxObject, prop, (change) => {
          if (!propertyRefs[prop]) return;
          if (updatingFromVue.has(prop)) return; // avoid echo
          updatingFromMobx.add(prop);
          try {
            const next = toJS(mobxObject[prop]);
            if (!isEqual(propertyRefs[prop].value, next)) {
              propertyRefs[prop].value = next;
            }
          } finally {
            updatingFromMobx.delete(prop);
          }
        });
        subscriptions.push(sub);
      } catch (error) {
        // Silently ignore non-observable properties
      }
    });

    // For nested objects and arrays, use deepObserve to handle deep changes
    // This handles both object properties and array mutations
    members.properties.forEach(prop => {
      const value = mobxObject[prop];
      if (value && typeof value === 'object') { // Include both objects AND arrays
        try {
          const sub = deepObserve(value, (change, path) => {
            if (!propertyRefs[prop]) return;
            if (updatingFromVue.has(prop)) return; // avoid echo
            updatingFromMobx.add(prop);
            try {
              const next = toJS(mobxObject[prop]);
              if (!isEqual(propertyRefs[prop].value, next)) {
                propertyRefs[prop].value = next;
              }
            } finally {
              updatingFromMobx.delete(prop);
            }
          });
          subscriptions.push(sub);
        } catch (error) {
          // Silently ignore if deepObserve fails (e.g., circular references in nested objects)
        }
      }
    });
  }

  // Getters: keep them in sync via reaction (both getter-only and getter/setter pairs)
  [...gettersOnly, ...getterSetterPairs].forEach(prop => {
    const sub = reaction(
      () => {
        try {
          return toJS(mobxObject[prop]);
        } catch (error) {
          // If computed property throws (e.g., accessing null.property), return undefined
          return undefined;
        }
      },
      (next) => {
        if (!getterRefs[prop]) return;
        if (!isEqual(getterRefs[prop].value, next)) {
          getterRefs[prop].value = next;
        }
      }
    );
    subscriptions.push(sub);
  });

  // Cleanup
  onUnmounted(() => {
    subscriptions.forEach(unsub => {
      try {
        if (typeof unsub === 'function') {
          unsub();
        } else if (typeof unsub?.dispose === 'function') {
          unsub.dispose();
        }
      } catch (error) {
        // Silently handle cleanup errors
      }
    });
  });

  return vueState;
}

/**
 * Alias for useMobxBridge - for users who prefer "presenter" terminology
 * @alias useMobxBridge
 */
export const usePresenterState = useMobxBridge;
