# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-01-13

### 🎯 Major Improvements

#### Declarative helper functions for improved readability
- **Feature**: Extracted bridge logic into self-documenting helper functions in `src/utils/helpers.js`
- **Structure**: 396 lines of declarative helpers organized by concern:
  - Value reading & initialization
  - Property type categorization
  - Echo loop prevention
  - Read-only detection
  - Setter creation (lazy validated, read-only, write-only, two-way binding)
  - MobX observation helpers
- **Benefit**: Code now reads like documentation with function names like `guardAgainstEchoLoop`, `createLazyValidatedSetter`, `safelyDisposeSubscription`

#### Improved circular reference handling in equality checks
- **Feature**: `isEqual()` now uses `Map` instead of `WeakSet` to track visited object pairs
- **Benefit**: Correctly compares objects where one has circular refs and the other doesn't
- **Previous bug**: `isEqual(circularObj, nonCircularObj)` incorrectly returned `true`
- **Fix**: Now tracks `(a, b)` pairs so revisiting `a` checks if it was paired with same `b`

### 🐛 Bug Fixes

#### Fixed deepObserve stale subscription after property reassignment
- **Issue**: When a property was reassigned to a new object/array, `deepObserve` continued watching the old value
- **Example**: After `store.items = newArray`, mutations to `newArray` weren't detected
- **Fix**: Added `onValueChanged` callback to `observeProperty` that re-subscribes `deepObserve` when property value changes
- **Result**: Nested mutations are now correctly detected even after complete property reassignment

#### Fixed -0 vs +0 edge case in equality comparison
- **Issue**: `Object.is(-0, +0)` returns `false`, causing unnecessary updates for equivalent values
- **Fix**: Added explicit number handling that treats `-0` and `+0` as equal while correctly handling `NaN === NaN`

#### Improved warning messages
- **Change**: Direct mutation warnings now include actionable guidance
- **Before**: `"Direct mutation of 'name' is disabled"`
- **After**: `"Direct mutation of 'name' is disabled. Use actions instead."`

### ✅ Testing

- **New test file**: `mobxVueBridgeBugVerification.test.js` - 10 tests verifying bug fixes
  - Circular reference equality edge cases
  - DeepObserve re-subscription after reassignment
  - -0/+0 and NaN handling
  - Single clone correctness
  - Sibling nested array mutations
  - Setter-only properties
- **New test file**: `mobxVueBridgeCrossClassComputed.test.js` - 3 tests for cross-class dependencies
  - Computed properties depending on other class's computed properties
  - Chain of three classes with computed dependencies
  - Changes detected even when only bridging the dependent class

## [1.4.0] - 2025-11-25

### 🎯 Major Improvements

#### Zero-side-effect initialization with lazy detection
- **Feature**: Bridge no longer calls any setters during initialization, eliminating all side effects
- **Benefit**: Fixes production bugs where setter side effects (like `refreshDataOnTabChange()`) were triggered during bridge setup
- **Mechanism**: Lazy detection pattern - properties are optimistically marked as writable during init, tested on first actual write attempt
- **Caching**: `readOnlyDetected` Set caches detection results for O(1) lookups on subsequent writes
- **Impact**: User's `currentRoom` setter with side effects now works correctly - side effects only occur during actual user interactions

#### Modular architecture refactoring
- **Feature**: Core logic separated into focused utility modules
- **Structure**: 
  - `src/utils/memberDetection.js` (210 lines) - MobX member categorization without side effects
  - `src/utils/equality.js` (47 lines) - Deep equality with circular reference protection
  - `src/utils/deepProxy.js` (109 lines) - Nested reactivity with microtask batching
- **Main bridge**: Reduced from 523 lines → 321 lines (39% reduction)
- **Benefit**: Better maintainability, testability, and code organization

### 🐛 Bug Fixes

#### Fixed computed property detection with MobX synthetic setters
- **Issue**: MobX adds synthetic setters to computed-only properties that throw "not possible to assign" errors
- **Previous approach**: Tested setters during initialization (caused side effects)
- **New approach**: Check descriptor existence only (`descriptor.get && descriptor.set`), test lazily on first write
- **Detection**: Catch MobX error message during first write attempt, cache as read-only
- **Result**: Accurate detection without initialization side effects

#### Fixed test equality assertions
- **Issue**: One test expected reference equality for cloned objects
- **Fix**: Changed `.toBe()` to `.toStrictEqual()` for deep equality comparison
- **Context**: Bridge clones objects to prevent reference sharing between Vue and MobX

### ✅ Testing

- **Total tests**: 170 passing (was 168 + 2 skipped)
- **New active tests**: Unskipped and fixed 2 comprehensive two-way binding demo tests
- **Coverage**: All patterns verified including lazy detection, nested mutations, and error handling

### 📚 Documentation

- **Architecture notes**: Added inline documentation explaining lazy detection pattern
- **Comments**: Clear explanation of why setters aren't called during init
- **Examples**: Test files demonstrate proper usage patterns

## [1.2.0] - 2025-10-01

### ✨ New Features

#### Batched nested mutations for array correctness
- **Feature**: Nested mutations are now batched via `queueMicrotask()` to prevent array corruption
- **Benefit**: All array operations (`shift()`, `unshift()`, `splice()`, etc.) now work correctly without data corruption
- **Trade-off**: Nested mutations are async (microtask delay). Use `await nextTick()` for immediate reads in same function
- **Best Practice**: Keep logic in MobX Presenter = always synchronous, no `nextTick()` needed
- **Documentation**: Comprehensive guide in README.md with examples and patterns
- **Tests**: 7 new tests in `mobxVueBridgeArrayCorrectness.test.js` verifying correctness
- **Total Test Count**: 148 tests passing (141 original + 7 new)

### 🐛 Bug Fixes

#### Fixed array mutation corruption
- **Issue**: Array methods like `shift()`, `unshift()`, and `splice()` were corrupting arrays during nested mutations. For example, `shift()` on `[1,2,3]` would produce `[2,2,3]` instead of `[2,3]`
- **Root Cause**: Each index assignment during array operations triggered an immediate `clone()` + sync, interrupting the in-progress array method
- **Impact**: Array mutations through nested proxies produced incorrect results, breaking data integrity
- **Fix**: Implemented `queueMicrotask()` batching in `createDeepProxy` to defer updates until array operations complete. Uses `updatePending` flag to batch multiple mutations into a single update
- **Location**: Line ~230-270 in `createDeepProxy` function
- **Result**: All array methods now work correctly without corruption

## [1.1.0] - 2025-10-01

#### Fixed `updatingFromVue` guard implementation
- **Issue**: The `updatingFromVue` Set was declared but never populated, making it a dead guard that didn't prevent potential echo loops
- **Impact**: Potential for echo loops in edge cases with custom objects or special equality scenarios
- **Fix**: Properly implemented the guard by wrapping all Vue → MobX write operations with `updatingFromVue.add(prop)` and `updatingFromVue.delete(prop)` in try/finally blocks
- **Locations**: Property setters (line ~224), nested proxy setters (line ~195), getter/setter pairs (line ~253), and setter-only properties (line ~310)
- **Result**: Double protection against loops - primary via `isEqual` checks, secondary via `updatingFromVue` guard

#### Fixed nested proxy respecting `allowDirectMutation` flag
- **Issue**: When `allowDirectMutation: false` was set, top-level mutations were correctly blocked, but nested mutations (e.g., `state.user.name = 'Alice'` or `state.todos.push(item)`) bypassed the configuration and succeeded
- **Impact**: Configuration inconsistency - users couldn't enforce action-only mutation patterns for nested data
- **Fix**: Added `allowDirectMutation` check at the top of the `createDeepProxy` set trap, with proper warning messages including the full nested path (e.g., `"Direct mutation of 'user.name' is disabled"`)
- **Location**: Line ~182 in `createDeepProxy` function
- **Result**: The `allowDirectMutation` flag now consistently applies to all nesting levels

#### Added parameter validation for `mobxObject`
- **Issue**: No validation on the first parameter, leading to cryptic errors if users passed `null`, `undefined`, or non-objects
- **Impact**: Poor developer experience with unclear error messages deep in the code
- **Fix**: Added validation at function entry that throws a clear error: `"useMobxBridge requires a valid MobX observable object as the first parameter"`
- **Location**: Line ~15, immediately after function declaration
- **Result**: Fail-fast behavior with actionable error messages

#### Fixed circular reference handling in `isEqual`
- **Issue**: The deep equality function could enter infinite recursion when comparing objects with shared references or circular structures
- **Impact**: Stack overflow errors when working with complex data structures like tree nodes, graphs, or objects with bidirectional relationships
- **Fix**: Added `WeakSet` to track visited objects during comparison, preventing infinite recursion while maintaining proper garbage collection
- **Location**: Line ~135 in `isEqual` function
- **Result**: Can safely compare objects with shared references, deeply nested structures (100+ levels), and graph-like data

### ✅ Testing
- Added 14 new tests (7 for validation, 7 for circular references)
- Updated existing tests to handle async nested mutations with `nextTick()`
- All 141 tests passing (127 original + 14 new)
- No breaking changes to public API
- Backward compatible with existing code

### 📝 Documentation
- Updated README with async behavior notes for nested mutations
- Added example showing `nextTick()` usage for immediate value access
- Updated inline code comments for clarity
- Added JSDoc comments for better IDE integration

---

**Upgrade recommendation**: Recommended for all users. Especially important for:
- Users using `allowDirectMutation: false` with nested data
- Applications with complex object graphs or shared references
- Teams seeking better error messages for debugging

## [1.0.0] - 2025-09-29

### Added
- Initial release of mobx-vue-bridge
- Two-way data binding between MobX observables and Vue 3 reactivity
- Support for properties, getters, setters, and methods
- Deep object/array observation with proper reactivity
- Configurable mutation behavior via `allowDirectMutation` option
- TypeScript definitions for better developer experience
- Comprehensive test suite covering various scenarios
- Error handling for edge cases and circular references
- Performance optimizations with intelligent change detection

### Features
- `useMobxBridge()` - Main bridge function
- `usePresenterState()` - Alias for presenter pattern usage
- Automatic property type detection (observable, computed, methods)
- Intelligent synchronization preventing infinite loops
- Support for nested objects and arrays
- Graceful handling of uninitialized computed properties