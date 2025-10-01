import { describe, it, expect, vi } from 'vitest';
import { makeAutoObservable } from 'mobx';
import { useMobxBridge } from '../src/mobxVueBridge';
import { nextTick } from 'vue';

describe('MobX-Vue Bridge - Array Correctness', () => {
  it('should handle array shift() correctly without corruption', async () => {
    class ShiftPresenter {
      constructor() {
        this.items = [1, 2, 3];
        makeAutoObservable(this);
      }
    }

    const presenter = new ShiftPresenter();
    const state = useMobxBridge(presenter);

    state.items.shift();
    await nextTick();

    // Should be [2, 3], NOT [2, 2, 3] (corruption)
    expect(state.items).toEqual([2, 3]);
    expect(presenter.items).toEqual([2, 3]);
  });

  it('should handle array unshift() correctly without corruption', async () => {
    class UnshiftPresenter {
      constructor() {
        this.items = [1, 2, 3];
        makeAutoObservable(this);
      }
    }

    const presenter = new UnshiftPresenter();
    const state = useMobxBridge(presenter);

    state.items.unshift(0);
    await nextTick();

    // Should be [0, 1, 2, 3], NOT [1, 2, 3, 3] (corruption)
    expect(state.items).toEqual([0, 1, 2, 3]);
    expect(presenter.items).toEqual([0, 1, 2, 3]);
  });

  it('should handle array splice() correctly without corruption', async () => {
    class SplicePresenter {
      constructor() {
        this.items = [1, 2, 3, 4, 5];
        makeAutoObservable(this);
      }
    }

    const presenter = new SplicePresenter();
    const state = useMobxBridge(presenter);

    state.items.splice(1, 2, 99);
    await nextTick();

    expect(state.items).toEqual([1, 99, 4, 5]);
    expect(presenter.items).toEqual([1, 99, 4, 5]);
  });

  it('should handle multiple array operations in sequence', async () => {
    class MultiOpPresenter {
      constructor() {
        this.items = [1, 2, 3];
        makeAutoObservable(this);
      }
    }

    const presenter = new MultiOpPresenter();
    const state = useMobxBridge(presenter);

    // Multiple operations
    state.items.push(4);
    state.items.shift();
    state.items.unshift(0);
    
    await nextTick();

    // All operations should complete correctly
    expect(state.items).toEqual([0, 2, 3, 4]);
    expect(presenter.items).toEqual([0, 2, 3, 4]);
  });

  it('should handle nested mutations asynchronously (requires nextTick)', async () => {
    class AsyncPresenter {
      constructor() {
        this.items = [1, 2, 3];
        makeAutoObservable(this);
      }
    }

    const presenter = new AsyncPresenter();
    const state = useMobxBridge(presenter);

    // Nested mutations are batched via queueMicrotask
    state.items.push(4);
    
    // Wait for microtask to complete
    await nextTick();
    
    expect(state.items).toEqual([1, 2, 3, 4]);
    expect(presenter.items).toEqual([1, 2, 3, 4]);
  });

  it('should handle nested object mutations correctly', async () => {
    class NestedPresenter {
      constructor() {
        this.user = { name: 'John', age: 30 };
        makeAutoObservable(this);
      }
    }

    const presenter = new NestedPresenter();
    const state = useMobxBridge(presenter);

    state.user.name = 'Jane';
    
    await nextTick();
    
    expect(state.user.name).toBe('Jane');
    expect(presenter.user.name).toBe('Jane');
  });

  it('should maintain data integrity across complex mutations', async () => {
    class ComplexPresenter {
      constructor() {
        this.data = {
          items: [1, 2, 3],
          nested: { values: [10, 20, 30] }
        };
        makeAutoObservable(this);
      }
    }

    const presenter = new ComplexPresenter();
    const state = useMobxBridge(presenter);

    // Complex nested mutations
    state.data.items.push(4);
    state.data.nested.values.shift();
    
    await nextTick();

    expect(state.data.items).toEqual([1, 2, 3, 4]);
    expect(state.data.nested.values).toEqual([20, 30]);
    expect(presenter.data.items).toEqual([1, 2, 3, 4]);
    expect(presenter.data.nested.values).toEqual([20, 30]);
  });
});
