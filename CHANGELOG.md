# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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