/**
 * Deep equality comparison with circular reference protection.
 * 
 * Uses WeakSet to track visited objects and prevent infinite recursion.
 * This is used to prevent unnecessary updates when values haven't actually changed.
 * 
 * @param {any} a - First value to compare
 * @param {any} b - Second value to compare  
 * @param {WeakSet} visited - Set of visited objects to prevent circular references
 * @returns {boolean} True if values are deeply equal
 */
export function isEqual(a, b, visited = new WeakSet()) {
  // Same reference or primitive equality
  if (Object.is(a, b)) return true;
  
  // Handle null/undefined cases
  if (a == null || b == null) return a === b;
  
  // Different types are not equal
  if (typeof a !== typeof b) return false;
  
  // For primitives, Object.is should have caught them
  if (typeof a !== 'object') return false;
  
  // Check for circular references
  if (visited.has(a)) return true;
  visited.add(a);
  
  // Fast array comparison
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => isEqual(val, b[i], visited));
  }
  
  // Fast object comparison - check keys first
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  
  // Check if all keys match
  if (!aKeys.every(key => bKeys.includes(key))) return false;
  
  // Check values (recursive)
  return aKeys.every(key => isEqual(a[key], b[key], visited));
}
