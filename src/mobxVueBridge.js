import { reactive, onUnmounted, ref } from 'vue';
import { toJS, reaction, observe, isComputedProp, isObservableProp } from 'mobx';
import { deepObserve } from 'mobx-utils';
import clone from 'clone';

/**
 * 🌉 MobX-Vue Bridge
 * 
 * @param {object} mobxObject - The MobX observable object to bridge
 * @param {object} options - Configuration options
 * @param {boolean} options.allowDirectMutation - Whether to allow direct mutation of properties
 * @returns {object} Vue reactive state object
 */
export function useMobxBridge(mobxObject, options = {}) {
  const safeOptions = options || {};
  // Use explicit boolean conversion to handle truthy/falsy values properly
  const allowDirectMutation = safeOptions.allowDirectMutation !== undefined 
    ? Boolean(safeOptions.allowDirectMutation) 
    : true; // Keep the original default of true
  const vueState = reactive({});

  // Discover props/methods via MobX introspection (don’t rely on raw descriptors)
  const props = Object.getOwnPropertyNames(mobxObject)
    .concat(Object.getOwnPropertyNames(Object.getPrototypeOf(mobxObject)))
    .filter(p => p !== 'constructor' && !p.startsWith('_'));

  const members = {
    getters: props.filter(p => {
      try {
        // First try to check if it's a computed property via MobX introspection
        try {
          return isComputedProp(mobxObject, p);
        } catch (computedError) {
          // If isComputedProp fails (e.g., due to uninitialized nested objects),
          // fall back to checking if it has a getter descriptor
          const descriptor = Object.getOwnPropertyDescriptor(mobxObject, p) || 
                            Object.getOwnPropertyDescriptor(Object.getPrototypeOf(mobxObject), p);
          
          // If it has a getter but no corresponding property, it's likely a computed getter
          return descriptor && typeof descriptor.get === 'function' && 
                 !isObservableProp(mobxObject, p);
        }
      } catch (error) {
        return false;
      }
    }),
    setters: props.filter(p => {
      try {
        // Check if it has a setter descriptor
        const descriptor = Object.getOwnPropertyDescriptor(mobxObject, p) || 
                          Object.getOwnPropertyDescriptor(Object.getPrototypeOf(mobxObject), p);
        
        // Must have a setter
        if (!descriptor || typeof descriptor.set !== 'function') return false;
        
        // Exclude methods
        if (typeof mobxObject[p] === 'function') return false;
        
        // For MobX objects with makeAutoObservable, we need to distinguish:
        // 1. Regular observable properties (handled separately) 
        // 2. Computed properties with setters (getter/setter pairs)
        // 3. Setter-only properties
        
        // Include if it's a computed property with a WORKING setter (getter/setter pair)
        try {
          if (isComputedProp(mobxObject, p)) {
            // For computed properties, test if the setter actually works
            try {
              const originalValue = mobxObject[p];
              descriptor.set.call(mobxObject, originalValue); // Try to set to same value
              return true; // Setter works, it's a getter/setter pair
            } catch (setterError) {
              return false; // Setter throws error, it's a computed-only property
            }
          }
        } catch (error) {
          // If isComputedProp fails, check if it has a getter and test the setter
          if (descriptor.get) {
            try {
              // Try to get the current value and set it back
              const currentValue = mobxObject[p];
              descriptor.set.call(mobxObject, currentValue);
              return true; // Setter works
            } catch (setterError) {
              return false; // Setter throws error
            }
          }
        }
        
        // Include if it's NOT an observable property (setter-only or other cases)
        if (!isObservableProp(mobxObject, p)) return true;
        
        // Exclude regular observable properties (they're handled separately)
        return false;
      } catch (error) {
        return false;
      }
    }),
    properties: props.filter(p => {
      try {
        // Check if it's an observable property
        if (!isObservableProp(mobxObject, p)) return false;
        
        // Check if it's a function (method)
        if (typeof mobxObject[p] === 'function') return false;
        
        // Check if it's a computed property - if so, it's a getter, not a property
        const isComputed = isComputedProp(mobxObject, p);
        if (isComputed) return false;
        
        return true; // Regular observable property
      } catch (error) {
        return false;
      }
    }),
    methods: props.filter(p => {
      try {
        return typeof mobxObject[p] === 'function';
      } catch (error) {
        return false;
      }
    }),
  };
  

  // ---- utils: guards + equality --------------------------------------------
  const updatingFromMobx = new Set();
  const updatingFromVue = new Set();

  const isEqual = (a, b) => {
    if (Object.is(a, b)) return true;
    
    // Handle null/undefined cases
    if (a == null || b == null) return a === b;
    
    // Different types are not equal
    if (typeof a !== typeof b) return false;
    
    // For primitives, Object.is should have caught them
    if (typeof a !== 'object') return false;
    
    // Fast array comparison
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, i) => isEqual(val, b[i]));
    }
    
    // Fast object comparison - check keys first
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    
    // Check if all keys match
    if (!aKeys.every(key => bKeys.includes(key))) return false;
    
    // Check values (recursive)
    return aKeys.every(key => isEqual(a[key], b[key]));
  };

  // Warning helpers to reduce duplication
  const warnDirectMutation = (prop) => console.warn(`Direct mutation of '${prop}' is disabled`);
  const warnSetterMutation = (prop) => console.warn(`Direct mutation of setter '${prop}' is disabled`);
  const warnMethodAssignment = (prop) => console.warn(`Cannot assign to method '${prop}'`);

  // Helper to create deep proxies for nested objects and arrays
  const createDeepProxy = (value, prop) => {
    // Don't proxy built-in objects that should remain unchanged
    if (value instanceof Date || value instanceof RegExp || value instanceof Map || 
        value instanceof Set || value instanceof WeakMap || value instanceof WeakSet) {
      return value;
    }
    
    return new Proxy(value, {
      get: (target, key) => {
        const result = target[key];
        // If the result is an object/array, wrap it in a proxy too (but not built-ins)
        if (result && typeof result === 'object' && 
            !(result instanceof Date || result instanceof RegExp || result instanceof Map || 
              result instanceof Set || result instanceof WeakMap || result instanceof WeakSet)) {
          return createDeepProxy(result, prop);
        }
        return result;
      },
      set: (target, key, val) => {
        // Check if direct mutation is allowed
        if (!allowDirectMutation) {
          warnDirectMutation(`${prop}.${String(key)}`);
          return false;
        }
        
        target[key] = val;
        // Update the Vue ref to trigger reactivity
        propertyRefs[prop].value = clone(propertyRefs[prop].value);
        // Update MobX immediately
        updatingFromVue.add(prop);
        try {
          mobxObject[prop] = clone(propertyRefs[prop].value);
        } finally {
          updatingFromVue.delete(prop);
        }
        return true;
      }
    });
  };

  // ---- properties (two-way) -------------------------------------------------
  const propertyRefs = {};
  
  members.properties.forEach(prop => {
    propertyRefs[prop] = ref(toJS(mobxObject[prop]));

    Object.defineProperty(vueState, prop, {
      get: () => {
        const value = propertyRefs[prop].value;
        // For objects/arrays, return a deep proxy that syncs mutations back
        if (value && typeof value === 'object') {
          return createDeepProxy(value, prop);
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

  // First, handle properties that have BOTH getters and setters (getter/setter pairs)
  const getterSetterPairs = members.getters.filter(prop => members.setters.includes(prop));
  const gettersOnly = members.getters.filter(prop => !members.setters.includes(prop));
  const settersOnly = members.setters.filter(prop => !members.getters.includes(prop));

  // Getter/setter pairs: writable with reactive updates
  getterSetterPairs.forEach(prop => {
    // Get initial value from getter
    let initialValue;
    try {
      initialValue = toJS(mobxObject[prop]);
    } catch (error) {
      initialValue = undefined;
    }
    getterRefs[prop] = ref(initialValue);
    setterRefs[prop] = ref(initialValue);

    Object.defineProperty(vueState, prop, {
      get: () => getterRefs[prop].value,
      set: allowDirectMutation
        ? (value) => {
            // Update both refs
            setterRefs[prop].value = value;
            // Call the MobX setter immediately
            updatingFromVue.add(prop);
            try {
              mobxObject[prop] = value;
              // The getter ref will be updated by the reaction
            } catch (error) {
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
        }
      } catch {
        // Silently ignore cleanup errors
      }
    });
  });

  return vueState;
}

/**
 * Helper alias for useMobxBridge - commonly used with presenter objects
 * 
 * @param {object} presenter - The MobX presenter object to bridge
 * @param {object} options - Configuration options
 * @returns {object} Vue reactive state object
 */
export function usePresenterState(presenter, options = {}) {
  return useMobxBridge(presenter, options);
}
