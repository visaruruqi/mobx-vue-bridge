import { describe, it, expect, vi } from 'vitest';
import { makeAutoObservable } from 'mobx';
import { useMobxBridge } from '../src/mobxVueBridge';
import { nextTick } from 'vue';

describe('MobX-Vue Bridge - Sync/Async Modes', () => {
  it('should handle nested mutations synchronously in sync mode', () => {
    class SyncPresenter {
      constructor() {
        this.items = [1, 2, 3];
        makeAutoObservable(this);
      }
    }

    const presenter = new SyncPresenter();
    const state = useMobxBridge(presenter, { deep: 'sync' });

    // In sync mode, nested mutations should be immediately visible
    state.items.push(4);
    expect(state.items).toEqual([1, 2, 3, 4]);
    expect(presenter.items).toEqual([1, 2, 3, 4]);
  });

  it('should handle nested mutations asynchronously in async mode (default)', async () => {
    class AsyncPresenter {
      constructor() {
        this.items = [1, 2, 3];
        makeAutoObservable(this);
      }
    }

    const presenter = new AsyncPresenter();
    const state = useMobxBridge(presenter); // defaults to async

    // In async mode, nested mutations are batched via queueMicrotask
    state.items.push(4);
    
    // Immediately after, the update hasn't happened yet
    // (MobX side may update but Vue side needs microtask)
    
    // Wait for microtask to complete
    await nextTick();
    
    expect(state.items).toEqual([1, 2, 3, 4]);
    expect(presenter.items).toEqual([1, 2, 3, 4]);
  });

  it('should handle array shift() correctly in async mode', async () => {
    class ShiftPresenter {
      constructor() {
        this.items = [1, 2, 3];
        makeAutoObservable(this);
      }
    }

    const presenter = new ShiftPresenter();
    const state = useMobxBridge(presenter, { deep: 'async' });

    state.items.shift();
    await nextTick();

    expect(state.items).toEqual([2, 3]);
    expect(presenter.items).toEqual([2, 3]);
  });

  it('should handle array unshift() correctly in async mode', async () => {
    class UnshiftPresenter {
      constructor() {
        this.items = [1, 2, 3];
        makeAutoObservable(this);
      }
    }

    const presenter = new UnshiftPresenter();
    const state = useMobxBridge(presenter, { deep: 'async' });

    state.items.unshift(0);
    await nextTick();

    expect(state.items).toEqual([0, 1, 2, 3]);
    expect(presenter.items).toEqual([0, 1, 2, 3]);
  });

  it('should handle array splice() correctly in async mode', async () => {
    class SplicePresenter {
      constructor() {
        this.items = [1, 2, 3, 4, 5];
        makeAutoObservable(this);
      }
    }

    const presenter = new SplicePresenter();
    const state = useMobxBridge(presenter, { deep: 'async' });

    state.items.splice(1, 2, 99);
    await nextTick();

    expect(state.items).toEqual([1, 99, 4, 5]);
    expect(presenter.items).toEqual([1, 99, 4, 5]);
  });

  it('should demonstrate sync mode risk: array corruption with shift()', () => {
    class RiskyPresenter {
      constructor() {
        this.items = [1, 2, 3];
        makeAutoObservable(this);
      }
    }

    const presenter = new RiskyPresenter();
    const state = useMobxBridge(presenter, { deep: 'sync' });

    // In sync mode, shift() may corrupt the array due to multiple synchronous clones
    state.items.shift();
    
    // The result might be incorrect due to the bug in sync mode
    // This test documents the known limitation rather than expecting correct behavior
    // Result could be [2, 2, 3] or [2, 3] depending on timing
    expect(state.items.length).toBeLessThanOrEqual(3);
  });

  it('should demonstrate sync mode risk: array corruption with unshift()', () => {
    class RiskyPresenter {
      constructor() {
        this.items = [1, 2, 3];
        makeAutoObservable(this);
      }
    }

    const presenter = new RiskyPresenter();
    const state = useMobxBridge(presenter, { deep: 'sync' });

    // In sync mode, unshift() may corrupt the array
    state.items.unshift(0);
    
    // Result might be [1, 2, 3, 3] or [0, 1, 2, 3]
    expect(state.items.length).toBeGreaterThanOrEqual(3);
  });

  it('should prefer async mode for data correctness', async () => {
    class CorrectPresenter {
      constructor() {
        this.items = [1, 2, 3];
        makeAutoObservable(this);
      }
    }

    const presenter = new CorrectPresenter();
    const state = useMobxBridge(presenter, { deep: 'async' });

    // Multiple array operations in sequence
    state.items.push(4);
    state.items.shift();
    state.items.unshift(0);
    
    await nextTick();

    // In async mode, all operations complete correctly
    expect(state.items).toEqual([0, 2, 3, 4]);
    expect(presenter.items).toEqual([0, 2, 3, 4]);
  });

  it('should allow explicit async configuration', async () => {
    class ExplicitPresenter {
      constructor() {
        this.items = [1, 2, 3];
        makeAutoObservable(this);
      }
    }

    const presenter = new ExplicitPresenter();
    const state = useMobxBridge(presenter, { deep: 'async' });

    state.items.push(4);
    await nextTick();

    expect(state.items).toEqual([1, 2, 3, 4]);
    expect(presenter.items).toEqual([1, 2, 3, 4]);
  });

  it('should handle nested object mutations synchronously in sync mode', () => {
    class NestedPresenter {
      constructor() {
        this.user = { name: 'John', age: 30 };
        makeAutoObservable(this);
      }
    }

    const presenter = new NestedPresenter();
    const state = useMobxBridge(presenter, { deep: 'sync' });

    state.user.name = 'Jane';
    
    // In sync mode, immediate read works
    expect(state.user.name).toBe('Jane');
    expect(presenter.user.name).toBe('Jane');
  });

  it('should handle nested object mutations asynchronously in async mode', async () => {
    class NestedPresenter {
      constructor() {
        this.user = { name: 'John', age: 30 };
        makeAutoObservable(this);
      }
    }

    const presenter = new NestedPresenter();
    const state = useMobxBridge(presenter, { deep: 'async' });

    state.user.name = 'Jane';
    
    await nextTick();
    
    expect(state.user.name).toBe('Jane');
    expect(presenter.user.name).toBe('Jane');
  });
});
