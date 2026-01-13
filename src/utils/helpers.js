import { ref } from 'vue';
import { toJS, observe, reaction } from 'mobx';
import { deepObserve } from 'mobx-utils';
import clone from 'clone';
import { isEqual } from './equality.js';

/**
 * Declarative helper functions for the MobX-Vue bridge.
 * These functions use human-oriented language to make the code self-documenting.
 */

// ============================================================================
// VALUE READING & INITIALIZATION
// ============================================================================

/**
 * Safely reads the initial value of a property, returning undefined if it throws.
 */
export const safelyReadInitialValue = (object, propertyName) => {
  try {
    return toJS(object[propertyName]);
  } catch {
    return undefined;
  }
};

/**
 * Creates a Vue reactive reference with an initial value.
 */
export const createReactiveRef = (initialValue) => ref(initialValue);

// ============================================================================
// PROPERTY TYPE CATEGORIZATION
// ============================================================================

/**
 * Separates properties that have both getters and setters.
 */
export const separateGetterSetterPairs = (getters, setters) => 
  getters.filter(prop => setters.includes(prop));

/**
 * Finds getters that don't have corresponding setters (read-only computed).
 */
export const findGettersOnly = (getters, setters) => 
  getters.filter(prop => !setters.includes(prop));

/**
 * Finds setters that don't have corresponding getters (write-only).
 */
export const findSettersOnly = (setters, getters) => 
  setters.filter(prop => !getters.includes(prop));

// ============================================================================
// ECHO LOOP PREVENTION
// ============================================================================

/**
 * Executes an operation while preventing echo loops between Vue and MobX.
 * Uses a guard set to track when Vue is updating MobX.
 */
export const guardAgainstEchoLoop = (propertyName, guardSet, operation) => {
  guardSet.add(propertyName);
  try {
    operation();
  } finally {
    guardSet.delete(propertyName);
  }
};

/**
 * Checks if a property is currently being updated (to prevent echo loops).
 */
export const isCurrentlyUpdating = (propertyName, guardSet) => 
  guardSet.has(propertyName);

// ============================================================================
// READ-ONLY DETECTION
// ============================================================================

/**
 * Checks if a property has been detected as read-only.
 */
export const isKnownReadOnly = (propertyName, readOnlySet) => 
  readOnlySet.has(propertyName);

/**
 * Marks a property as read-only (adds to set).
 */
export const markAsReadOnly = (propertyName, readOnlySet) => {
  readOnlySet.add(propertyName);
};

/**
 * Throws an error for read-only computed property assignment.
 */
export const throwReadOnlyError = (propertyName) => {
  throw new Error(`Cannot assign to computed property '${propertyName}'`);
};

/**
 * Checks if an error is a MobX read-only computed property error.
 */
export const isMobxReadOnlyError = (error) => 
  error.message?.includes('not possible to assign');

// ============================================================================
// PROPERTY DEFINITION
// ============================================================================

/**
 * Defines a reactive property on the Vue state object.
 */
export const defineReactiveProperty = (vueState, propertyName, descriptor) => {
  Object.defineProperty(vueState, propertyName, {
    get: descriptor.get,
    set: descriptor.set,
    enumerable: true,
    configurable: true,
  });
};

// ============================================================================
// MUTATION WARNINGS
// ============================================================================

/**
 * Warns that direct mutation is disabled for a property.
 */
export const warnDirectMutation = (propertyName) => {
  console.warn(`Direct mutation of '${propertyName}' is disabled. Use actions instead.`);
};

/**
 * Logs a warning when a property fails to set.
 */
export const logSetterWarning = (propertyName, error) => {
  console.warn(`Failed to set property '${propertyName}':`, error);
};

// ============================================================================
// SETTER CREATION
// ============================================================================

/**
 * Creates a validated setter that lazily detects read-only properties.
 * This prevents calling setters during initialization (avoiding side effects).
 */
export const createLazyValidatedSetter = ({
  propertyName,
  target,
  allowDirectMutation,
  readOnlySet,
  guardSet,
}) => {
  if (!allowDirectMutation) {
    return () => warnDirectMutation(propertyName);
  }
  
  return (value) => {
    // Fast-fail if already detected as read-only
    if (isKnownReadOnly(propertyName, readOnlySet)) {
      throwReadOnlyError(propertyName);
    }
    
    // Attempt write with guard against echo loops
    guardAgainstEchoLoop(propertyName, guardSet, () => {
      try {
        target[propertyName] = value;
      } catch (error) {
        if (isMobxReadOnlyError(error)) {
          markAsReadOnly(propertyName, readOnlySet);
          throwReadOnlyError(propertyName);
        } else {
          logSetterWarning(propertyName, error);
        }
      }
    });
  };
};

/**
 * Creates a simple setter that always throws an error (for computed properties).
 */
export const createReadOnlySetter = (propertyName) => {
  return () => {
    throw new Error(`Cannot assign to computed property '${propertyName}'`);
  };
};

/**
 * Creates a setter for write-only properties (no corresponding getter).
 */
export const createWriteOnlySetter = ({
  propertyName,
  target,
  allowDirectMutation,
  guardSet,
  setterRef,
}) => {
  if (!allowDirectMutation) {
    return () => warnDirectMutation(propertyName);
  }
  
  return (value) => {
    setterRef.value = value;
    guardAgainstEchoLoop(propertyName, guardSet, () => {
      target[propertyName] = value;
    });
  };
};

// ============================================================================
// OBSERVABLE PROPERTY SETTERS
// ============================================================================

/**
 * Creates a two-way binding setter for observable properties.
 */
export const createTwoWayBindingSetter = ({
  propertyName,
  target,
  allowDirectMutation,
  guardSet,
  propertyRef,
}) => {
  if (!allowDirectMutation) {
    return () => warnDirectMutation(propertyName);
  }

  return (value) => {
    if (!isEqual(propertyRef.value, value)) {
      const cloned = clone(value);
      propertyRef.value = cloned;
      
      guardAgainstEchoLoop(propertyName, guardSet, () => {
        target[propertyName] = cloned;
      });
    }
  };
};

// ============================================================================
// MOBX OBSERVATION HELPERS
// ============================================================================

/**
 * Creates a MobX → Vue update handler that respects echo guards.
 */
export const createMobxToVueUpdater = ({
  propertyName,
  target,
  refToUpdate,
  echoGuard,
  updateGuard,
}) => {
  return () => {
    if (!refToUpdate) return;
    if (echoGuard.has(propertyName)) return; // Prevent echo loops
    
    updateGuard.add(propertyName);
    try {
      const nextValue = toJS(target[propertyName]);
      if (!isEqual(refToUpdate.value, nextValue)) {
        refToUpdate.value = nextValue;
      }
    } finally {
      updateGuard.delete(propertyName);
    }
  };
};

/**
 * Observes a single MobX property and syncs changes to Vue.
 * When the property value changes, it also re-subscribes deepObserve to the new value.
 */
export const observeProperty = ({
  target,
  propertyName,
  refToUpdate,
  echoGuard,
  updateGuard,
  onValueChanged, // Optional callback when value changes (for re-subscribing deepObserve)
}) => {
  try {
    const updater = createMobxToVueUpdater({
      propertyName,
      target,
      refToUpdate,
      echoGuard,
      updateGuard,
    });

    return observe(target, propertyName, (change) => {
      updater();
      // Notify that the value changed so deepObserve can be re-subscribed
      if (onValueChanged && change.type === 'update') {
        onValueChanged(change.newValue);
      }
    });
  } catch (error) {
    // Only silently ignore expected MobX errors for non-observable properties
    // These errors indicate the property isn't observable, which is expected for some properties
    const isExpectedError = error.message?.includes('not observable') || 
                            error.message?.includes('no observable') ||
                            error.message?.includes('[MobX]');
    if (!isExpectedError) {
      console.warn(`[mobx-vue-bridge] Unexpected error observing '${propertyName}':`, error);
    }
    return null;
  }
};

/**
 * Deep observes nested objects/arrays and syncs changes to Vue.
 */
export const deepObserveProperty = ({
  target,
  propertyName,
  refToUpdate,
  echoGuard,
  updateGuard,
}) => {
  const value = target[propertyName];
  
  // Only deep observe objects and arrays
  if (!value || typeof value !== 'object') {
    return null;
  }

  try {
    const updater = createMobxToVueUpdater({
      propertyName,
      target,
      refToUpdate,
      echoGuard,
      updateGuard,
    });

    return deepObserve(value, (change, path) => {
      updater();
    });
  } catch (error) {
    // Only silently ignore expected errors (circular references, non-observable objects)
    const isExpectedError = error.message?.includes('circular') || 
                            error.message?.includes('not observable') ||
                            error.message?.includes('[MobX]');
    if (!isExpectedError) {
      console.warn(`[mobx-vue-bridge] Unexpected error deep-observing '${propertyName}':`, error);
    }
    return null;
  }
};

/**
 * Creates a reactive subscription to a MobX computed property (getter).
 */
export const observeGetter = ({
  target,
  propertyName,
  refToUpdate,
}) => {
  const safelyReadGetter = () => {
    try {
      return toJS(target[propertyName]);
    } catch (error) {
      // If computed property throws (e.g., accessing null.property), return undefined
      return undefined;
    }
  };

  const updateRefWhenChanged = (nextValue) => {
    if (!refToUpdate) return;
    if (!isEqual(refToUpdate.value, nextValue)) {
      refToUpdate.value = nextValue;
    }
  };

  return reaction(safelyReadGetter, updateRefWhenChanged);
};

/**
 * Safely disposes a subscription (handles both function and object with dispose).
 */
export const safelyDisposeSubscription = (subscription) => {
  try {
    if (typeof subscription === 'function') {
      subscription();
    } else if (typeof subscription?.dispose === 'function') {
      subscription.dispose();
    }
  } catch (error) {
    // Silently handle cleanup errors
  }
};
