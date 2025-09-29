# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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