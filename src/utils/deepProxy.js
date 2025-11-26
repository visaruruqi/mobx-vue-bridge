import clone from 'clone';

/**
 * Creates a deep proxy for nested objects/arrays to handle mutations at any level.
 * 
 * This enables mutations like `state.items.push(item)` to work correctly by:
 * 1. Intercepting nested property access and wrapping in proxies
 * 2. Batching mutations via queueMicrotask to prevent array corruption
 * 3. Syncing changes back to MobX and triggering Vue reactivity
 * 
 * Key Design Decisions:
 * - Mutations are batched via queueMicrotask to prevent corruption during
 *   array operations like shift(), unshift(), splice() which modify multiple
 *   indices synchronously.
 * - The proxy wraps a CLONE stored in propertyRefs[prop].value
 * - When nested mutations occur, we update the clone in-place, then sync back
 * 
 * @param {object|array} value - The nested value to wrap in a proxy
 * @param {string} prop - The parent property name for error messages and sync
 * @param {function} getRoot - Function that returns the current root value from propertyRef
 * @param {boolean} allowDirectMutation - Whether mutations are allowed
 * @param {Set} updatingFromVue - Guard set to prevent infinite loops
 * @param {object} mobxObject - The MobX object to sync changes back to
 * @param {object} propertyRefs - Vue refs storage for syncing
 * @returns {Proxy} Proxied object/array with reactive mutation handling
 */
export function createDeepProxy(
  value, 
  prop, 
  getRoot,
  allowDirectMutation,
  updatingFromVue,
  mobxObject,
  propertyRefs
) {
  // Don't proxy built-in objects that should remain unchanged
  if (value instanceof Date || value instanceof RegExp || value instanceof Map || 
      value instanceof Set || value instanceof WeakMap || value instanceof WeakSet) {
    return value;
  }

  // If no getRoot provided, use the default which gets from propertyRefs
  if (!getRoot) {
    getRoot = () => propertyRefs[prop].value;
  }

  // Track pending updates to batch array mutations
  let updatePending = false;
  
  return new Proxy(value, {
    get: (target, key) => {
      const result = target[key];
      // If the result is an object/array, wrap it in a proxy too (but not built-ins)
      if (result && typeof result === 'object' && 
          !(result instanceof Date || result instanceof RegExp || result instanceof Map || 
            result instanceof Set || result instanceof WeakMap || result instanceof WeakSet)) {
        return createDeepProxy(
          result, 
          prop, 
          getRoot,
          allowDirectMutation,
          updatingFromVue,
          mobxObject,
          propertyRefs
        );
      }
      return result;
    },
    set: (target, key, val) => {
      // Check if direct mutation is allowed
      if (!allowDirectMutation) {
        console.warn(`Direct mutation of '${prop}.${String(key)}' is disabled`);
        return true; // Must return true to avoid TypeError in strict mode
      }
      
      // Update the target in-place (this modifies the clone in propertyRefs[prop].value)
      target[key] = val;
      
      // Batch updates to avoid corrupting in-progress array operations
      // like shift(), unshift(), splice() which modify multiple indices synchronously
      if (!updatePending) {
        updatePending = true;
        queueMicrotask(() => {
          updatePending = false;
          // The root value has already been modified in-place above (target[key] = val)
          // Now we need to trigger Vue reactivity and sync to MobX
          
          // Clone the root to create a new reference for Vue reactivity
          // This ensures Vue detects the change
          const rootValue = getRoot();
          const cloned = clone(rootValue);
          
          // Update the Vue ref to trigger reactivity
          propertyRefs[prop].value = cloned;
          
          // Update MobX immediately with the cloned value
          updatingFromVue.add(prop);
          try {
            mobxObject[prop] = cloned;
          } finally {
            updatingFromVue.delete(prop);
          }
        });
      }
      
      return true;
    }
  });
}
