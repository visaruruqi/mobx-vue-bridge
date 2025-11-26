import { isComputedProp, isObservableProp } from 'mobx';

/**
 * Categorizes members of a MobX object into getters, setters, properties, and methods.
 * 
 * This is the core classification logic that determines how each member should be
 * bridged to Vue. The categorization affects:
 * - Getters: Read-only computed properties
 * - Setters: Writable computed properties (getter/setter pairs)
 * - Properties: Two-way bindable observable properties
 * - Methods: Bound functions
 * 
 * @param {object} mobxObject - The MobX observable object to analyze
 * @returns {object} Object with arrays: { getters, setters, properties, methods }
 */
export function categorizeMobxMembers(mobxObject) {
  // Discover all properties and methods (own + prototype)
  const props = Object.getOwnPropertyNames(mobxObject)
    .concat(Object.getOwnPropertyNames(Object.getPrototypeOf(mobxObject)))
    .filter(p => p !== 'constructor' && !p.startsWith('_'));

  return {
    getters: detectGetters(mobxObject, props),
    setters: detectSetters(mobxObject, props),
    properties: detectProperties(mobxObject, props),
    methods: detectMethods(mobxObject, props),
  };
}

/**
 * Detects computed properties (getters) in a MobX object.
 * 
 * A property is considered a getter if:
 * - MobX identifies it as a computed property via isComputedProp, OR
 * - It has a getter descriptor but is not an observable property
 * 
 * @param {object} mobxObject - The MobX object
 * @param {string[]} props - Array of property names to check
 * @returns {string[]} Array of getter property names
 */
function detectGetters(mobxObject, props) {
  return props.filter(p => {
    try {
      // First try MobX introspection
      try {
        return isComputedProp(mobxObject, p);
      } catch (computedError) {
        // If isComputedProp fails (e.g., uninitialized nested objects),
        // fall back to descriptor checking
        const descriptor = getDescriptor(mobxObject, p);
        
        // Has getter but not an observable property = computed getter
        return descriptor && 
               typeof descriptor.get === 'function' && 
               !isObservableProp(mobxObject, p);
      }
    } catch (error) {
      return false;
    }
  });
}

/**
 * Detects writable computed properties (getter/setter pairs) in a MobX object.
 * 
 * A property is considered a setter if:
 * - It has a setter descriptor, AND
 * - It's either a computed property with a working setter OR a setter-only property
 * 
 * Key Challenge: Testing if a setter "works" can have side effects.
 * Current approach: Try to set the property to its current value.
 * TODO: Consider safer detection methods or document limitations.
 * 
 * @param {object} mobxObject - The MobX object
 * @param {string[]} props - Array of property names to check
 * @returns {string[]} Array of setter property names
 */
function detectSetters(mobxObject, props) {
  return props.filter(p => {
    try {
      const descriptor = getDescriptor(mobxObject, p);
      
      // Must have a setter
      if (!descriptor || typeof descriptor.set !== 'function') return false;
      
      // Exclude methods (shouldn't happen, but defensive)
      if (typeof mobxObject[p] === 'function') return false;
      
      // For computed properties, include if it has both getter AND setter descriptors
      // Don't call the setter during initialization - we'll handle errors during actual sync
      try {
        if (isComputedProp(mobxObject, p)) {
          // If both getter and setter exist, assume it's potentially writable
          // The actual setter behavior will be tested lazily during first sync attempt
          return descriptor.get && descriptor.set;
        }
      } catch (error) {
        // If isComputedProp fails, check if both descriptors exist
        if (descriptor.get && descriptor.set) {
          return true;
        }
      }
      
      // Include setter-only properties (not observable)
      if (!isObservableProp(mobxObject, p)) return true;
      
      // Exclude regular observable properties (handled separately)
      return false;
    } catch (error) {
      return false;
    }
  });
}

/**
 * Tests if a setter can be called without throwing.
 * 
 * CAUTION: This has side effects if the setter triggers actions or state changes.
 * The test tries to set the property to its current value to minimize impact.
 * 
 * @param {object} mobxObject - The MobX object
 * @param {PropertyDescriptor} descriptor - The property descriptor
 * @param {string} prop - Property name (for error context)
 * @returns {boolean} True if setter works without throwing
 */
function testSetter(mobxObject, descriptor, prop) {
  try {
    const originalValue = mobxObject[prop];
    descriptor.set.call(mobxObject, originalValue);
    return true; // Setter works
  } catch (setterError) {
    // Setter throws - treat as read-only computed
    return false;
  }
}

/**
 * Detects regular observable properties in a MobX object.
 * 
 * A property is considered a regular observable if:
 * - MobX identifies it as observable via isObservableProp, AND
 * - It's not a function (method), AND
 * - It's not a computed property
 * 
 * @param {object} mobxObject - The MobX object
 * @param {string[]} props - Array of property names to check
 * @returns {string[]} Array of observable property names
 */
function detectProperties(mobxObject, props) {
  return props.filter(p => {
    try {
      // Must be observable
      if (!isObservableProp(mobxObject, p)) return false;
      
      // Exclude methods
      if (typeof mobxObject[p] === 'function') return false;
      
      // Exclude computed properties (they're getters)
      if (isComputedProp(mobxObject, p)) return false;
      
      return true; // Regular observable property
    } catch (error) {
      return false;
    }
  });
}

/**
 * Detects methods in a MobX object.
 * 
 * @param {object} mobxObject - The MobX object
 * @param {string[]} props - Array of property names to check
 * @returns {string[]} Array of method names
 */
function detectMethods(mobxObject, props) {
  return props.filter(p => {
    try {
      return typeof mobxObject[p] === 'function';
    } catch (error) {
      return false;
    }
  });
}

/**
 * Gets the property descriptor from either the object or its prototype.
 * 
 * @param {object} obj - The object to inspect
 * @param {string} prop - Property name
 * @returns {PropertyDescriptor|undefined} The descriptor or undefined
 */
function getDescriptor(obj, prop) {
  return Object.getOwnPropertyDescriptor(obj, prop) || 
         Object.getOwnPropertyDescriptor(Object.getPrototypeOf(obj), prop);
}
