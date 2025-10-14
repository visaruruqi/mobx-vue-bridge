# MobX-Vue Bridge - AI Coding Instructions

## Project Overview
A lightweight bridge library that enables seamless two-way data binding between MobX observables and Vue 3's reactivity system. The core implementation is a single 523-line file (`src/mobxVueBridge.js`) that introspects MobX objects and creates Vue reactive proxies.

## Architecture & Core Concepts

### The Bridge Mechanism (`useMobxBridge`)
The bridge uses **property introspection** to categorize MobX object members into:
- **Properties**: Observable data (`isObservableProp`) - bidirectional sync
- **Getters**: Computed properties (`isComputedProp`) - MobX → Vue via `reaction()`
- **Setters**: Writable computed or setter-only properties - Vue → MobX
- **Methods**: Bound functions - cached and bound to MobX context

### Bidirectional Synchronization
**Two guard sets prevent infinite loops:**
- `updatingFromVue` - Set when Vue changes propagate to MobX
- `updatingFromMobx` - Set when MobX changes propagate to Vue

**Critical pattern:** Always wrap cross-boundary updates in try/finally:
```javascript
updatingFromVue.add(prop);
try {
  mobxObject[prop] = value;
} finally {
  updatingFromVue.delete(prop);
}
```

### Deep Nested Reactivity
`createDeepProxy()` enables mutations like `state.items.push(item)` to sync correctly:
- **Batching via `queueMicrotask()`**: Array operations (`shift()`, `splice()`) modify multiple indices synchronously. Batching prevents mid-operation cloning that corrupts data.
- **Trade-off**: Nested mutations are async (microtask delay). Tests use `await nextTick()` when reading immediately after nested mutations.
- **Best practice**: Keep logic in MobX Presenter methods where updates are always synchronous.

### Configuration Mode
`allowDirectMutation: false` enforces action-only pattern:
- Properties become read-only with console warnings
- Setter-only properties still work (they're explicit actions)
- Methods always work (they're actions)
- **Must respect at all nesting levels** (checked in `createDeepProxy`)

## Development Workflows

### Testing with Vitest
```bash
npm test              # Watch mode (default for development)
npm run test:run      # Single run (used in CI/validation)
npm run test:coverage # Generate coverage report
```

**Test structure:**
- 24 test files in `tests/` - each focuses on one aspect (reactivity, getters, nested, configuration, etc.)
- Tests use real Vue/MobX imports (not mocked except in configuration tests)
- Pattern: Create MobX object with `makeAutoObservable()`, bridge it, assert synchronization

**Testing nested mutations:**
```javascript
state.items.push('new')
await nextTick()  // Required! Nested mutations are async
expect(state.items).toContain('new')
```

### Pre-publish Validation
```bash
npm run prepublishOnly  # Runs validate + pre-publish.js script
npm run publish:dry     # Test package without publishing
```

The `scripts/pre-publish.js` performs final validation before publishing.

## Code Conventions

### Property Detection Pattern
Never rely on raw property descriptors alone. Always use MobX introspection first:
```javascript
// CORRECT: Use MobX introspection
isComputedProp(mobxObject, prop)
isObservableProp(mobxObject, prop)

// WRONG: Only checking descriptors misses MobX semantics
descriptor.get && descriptor.set
```

### Error Handling for Uninitialized Computed Properties
Getters may throw on first access (e.g., `null.property`). Wrap in try/catch with `undefined` fallback:
```javascript
let initialValue;
try {
  initialValue = toJS(mobxObject[prop]);
} catch (error) {
  initialValue = undefined; // Let reaction update later
}
```

### Equality Checking with Circular Protection
`isEqual()` uses `WeakSet` to track visited objects and prevent infinite recursion:
```javascript
const isEqual = (a, b, visited = new WeakSet()) => {
  if (visited.has(a)) return true;
  visited.add(a);
  // ... comparison logic
};
```

### Clone Before Sync
Always clone before syncing to prevent reference sharing:
```javascript
const cloned = clone(value);
propertyRefs[prop].value = cloned;
mobxObject[prop] = cloned;
```

## Key Files

### `src/mobxVueBridge.js` (523 lines)
Single-file implementation. Key sections:
- Lines 1-40: Function signature, validation, options parsing
- Lines 50-155: Member categorization (getters/setters/properties/methods)
- Lines 160-200: Guard utils and `isEqual()` with circular protection
- Lines 205-275: `createDeepProxy()` for nested reactivity with batching
- Lines 280-340: Property definitions (two-way binding)
- Lines 345-420: Getter/setter definitions (computed properties)
- Lines 425-460: Method binding
- Lines 465-520: MobX → Vue observation setup (`observe()`, `deepObserve()`, `reaction()`)

### `src/mobxVueBridge.d.ts`
TypeScript definitions - update when adding options or changing signatures.

### `vitest.config.js`
Configures Vitest with aliases for test imports. Keep `environment: 'node'` since we're testing library code, not browser rendering.

## Common Patterns

### Adding New Configuration Options
1. Add to `MobxBridgeOptions` interface in `.d.ts`
2. Parse and validate at function start (lines 40-50)
3. Pass to relevant functions (e.g., `createDeepProxy`)
4. Add tests in `tests/mobxVueBridgeConfiguration.test.js`

### Adding Property Type Support
1. Update member categorization logic (lines 50-155)
2. Add property definition (lines 280-420)
3. Set up MobX → Vue observation (lines 465-520)
4. Create focused test file (e.g., `mobxVueBridgeNewType.test.js`)

### Debugging Synchronization Issues
1. Check if guards are set correctly (search for `updatingFromVue`, `updatingFromMobx`)
2. Verify `isEqual()` logic isn't incorrectly blocking updates
3. For nested mutations, confirm `queueMicrotask()` batching is working
4. Add console logs in observation handlers to trace update flow

## Version History Notes
- **v1.2.0**: Added microtask batching for array correctness (breaking: nested mutations now async)
- **v1.1.0**: Fixed `allowDirectMutation` for nested proxies, added circular reference handling in `isEqual()`
- **v1.0.0**: Initial release

## External Dependencies
- **mobx** (^6.0.0): Core observable system - use `isComputedProp`, `isObservableProp`, `observe`, `reaction`
- **mobx-utils** (^6.0.0): Provides `deepObserve` for nested object/array observation
- **clone** (^2.1.2): Deep cloning utility - prevents reference sharing between Vue/MobX
- **vue** (^3.0.0): Peer dependency - use `reactive`, `ref`, `onUnmounted`, `nextTick`

## What NOT to Do
- Don't mock Vue/MobX in tests (except configuration tests) - use real implementations
- Don't skip `clone()` when syncing complex objects - causes reference bugs
- Don't add synchronous nested mutation support - it corrupts arrays (learned in v1.2.0)
- Don't rely on property descriptors alone - always use MobX introspection first
- Don't forget try/finally around guard sets - cleanup must happen even on errors
