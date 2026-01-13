/**
 * Deep equality comparison with circular reference protection.
 * 
 * Uses a Map to track visited object pairs and prevent infinite recursion.
 * This is used to prevent unnecessary updates when values haven't actually changed.
 * 
 * @param {any} a - First value to compare
 * @param {any} b - Second value to compare  
 * @param {Map} visited - Map of visited object pairs to prevent circular references
 * @returns {boolean} True if values are deeply equal
 */
export function isEqual(a, b, visited = new Map()) {
  // Handle null/undefined cases first
  if (a == null || b == null) return a === b;
  
  // Handle -0 vs +0 edge case (Object.is treats them as different)
  if (typeof a === 'number' && typeof b === 'number') {
    // Both are numbers - use === which treats -0 and +0 as equal
    // Special case for NaN: NaN === NaN is false, but we want true
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    return a === b;
  }
  
  // Same reference or primitive equality
  if (Object.is(a, b)) return true;
  
  // Different types are not equal
  if (typeof a !== typeof b) return false;
  
  // For primitives, Object.is should have caught them
  if (typeof a !== 'object') return false;
  
  // Check for circular references - we need to track PAIRS of (a, b)
  // Using a Map where keys are objects from 'a' and values are objects from 'b'
  if (visited.has(a)) {
    // We've seen 'a' before - check if it was paired with the same 'b'
    return visited.get(a) === b;
  }
  visited.set(a, b);
  
  // Fast array comparison
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => isEqual(val, b[i], visited));
  }
  
  // One is array, one is not
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  // Fast object comparison - check keys first
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  
  // Check if all keys match
  if (!aKeys.every(key => bKeys.includes(key))) return false;
  
  // Check values (recursive)
  return aKeys.every(key => isEqual(a[key], b[key], visited));
}

