import { describe, it, expect, vi } from 'vitest';
import { makeAutoObservable } from 'mobx';
import { useMobxBridge } from '../src/mobxVueBridge.js';
import { watchEffect, nextTick } from 'vue';

describe('MobX-Vue Bridge - Nested Mutation Reactivity', () => {
  it('should trigger Vue reactivity on nested object mutations', async () => {
    // Setup
    class Store {
      constructor() {
        this.user = { name: 'John', age: 30 };
        makeAutoObservable(this);
      }
    }

    const store = new Store();
    const state = useMobxBridge(store);

    // Track reactivity with watchEffect
    const spy = vi.fn();
    watchEffect(() => {
      spy(state.user.name);
    });

    await nextTick();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('John');

    // Mutate nested property via Vue state
    state.user.name = 'Alice';

    await nextTick();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith('Alice');
    expect(state.user.name).toBe('Alice');
    expect(store.user.name).toBe('Alice');
  });

  it('should trigger Vue reactivity on nested array mutations', async () => {
    // Setup
    class TodoStore {
      constructor() {
        this.todos = [
          { id: 1, text: 'Buy milk', done: false },
          { id: 2, text: 'Walk dog', done: false }
        ];
        makeAutoObservable(this);
      }
    }

    const store = new TodoStore();
    const state = useMobxBridge(store);

    // Track array length reactivity
    const lengthSpy = vi.fn();
    watchEffect(() => {
      lengthSpy(state.todos.length);
    });

    // Track first todo text reactivity
    const textSpy = vi.fn();
    watchEffect(() => {
      textSpy(state.todos[0]?.text);
    });

    await nextTick();
    expect(lengthSpy).toHaveBeenCalledTimes(1);
    expect(lengthSpy).toHaveBeenCalledWith(2);
    expect(textSpy).toHaveBeenCalledTimes(1);
    expect(textSpy).toHaveBeenCalledWith('Buy milk');

    // Push a new item
    state.todos.push({ id: 3, text: 'Read book', done: false });

    await nextTick();
    expect(lengthSpy).toHaveBeenCalledTimes(2);
    expect(lengthSpy).toHaveBeenCalledWith(3);
    expect(state.todos.length).toBe(3);
    expect(store.todos.length).toBe(3);

    // Mutate nested property in array item
    state.todos[0].text = 'Buy organic milk';

    await nextTick();
    // May be called 3 times due to array push triggering additional reactivity
    expect(textSpy).toHaveBeenCalledWith('Buy organic milk');
    expect(state.todos[0].text).toBe('Buy organic milk');
    expect(store.todos[0].text).toBe('Buy organic milk');
  });

  it('should trigger Vue reactivity on deeply nested mutations', async () => {
    // Setup
    class DeepStore {
      constructor() {
        this.data = {
          level1: {
            level2: {
              level3: {
                value: 'deep'
              }
            }
          }
        };
        makeAutoObservable(this);
      }
    }

    const store = new DeepStore();
    const state = useMobxBridge(store);

    // Track deep value reactivity
    const spy = vi.fn();
    watchEffect(() => {
      spy(state.data.level1.level2.level3.value);
    });

    await nextTick();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('deep');

    // Mutate deeply nested property
    state.data.level1.level2.level3.value = 'very deep';

    await nextTick();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith('very deep');
    expect(state.data.level1.level2.level3.value).toBe('very deep');
    expect(store.data.level1.level2.level3.value).toBe('very deep');
  });

  it('should maintain reactivity after multiple nested mutations', async () => {
    // Setup
    class ConfigStore {
      constructor() {
        this.settings = {
          theme: 'dark',
          notifications: {
            email: true,
            push: false
          }
        };
        makeAutoObservable(this);
      }
    }

    const store = new ConfigStore();
    const state = useMobxBridge(store);

    // Track all changes
    const changes = [];
    watchEffect(() => {
      changes.push({
        theme: state.settings.theme,
        email: state.settings.notifications.email,
        push: state.settings.notifications.push
      });
    });

    await nextTick();
    expect(changes.length).toBe(1);

    // First mutation
    state.settings.theme = 'light';
    await nextTick();
    expect(changes.length).toBe(2);
    expect(changes[1].theme).toBe('light');

    // Second mutation on different nested property
    state.settings.notifications.email = false;
    await nextTick();
    expect(changes.length).toBe(3);
    expect(changes[2].email).toBe(false);

    // Third mutation
    state.settings.notifications.push = true;
    await nextTick();
    expect(changes.length).toBe(4);
    expect(changes[3].push).toBe(true);

    // Verify MobX is in sync
    expect(store.settings.theme).toBe('light');
    expect(store.settings.notifications.email).toBe(false);
    expect(store.settings.notifications.push).toBe(true);
  });

  it('should trigger reactivity on array method mutations', async () => {
    // Setup
    class ListStore {
      constructor() {
        this.items = [1, 2, 3];
        makeAutoObservable(this);
      }
    }

    const store = new ListStore();
    const state = useMobxBridge(store);

    // Track array state
    const snapshots = [];
    watchEffect(() => {
      snapshots.push([...state.items]);
    });

    await nextTick();
    expect(snapshots.length).toBe(1);
    expect(snapshots[0]).toEqual([1, 2, 3]);

    // Test push
    state.items.push(4);
    await nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(snapshots.length).toBe(2);
    expect(snapshots[1]).toEqual([1, 2, 3, 4]);
    expect(store.items).toEqual([1, 2, 3, 4]);

    // Test pop
    state.items.pop();
    await nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(snapshots.length).toBe(3);
    expect(snapshots[2]).toEqual([1, 2, 3]);
    expect(store.items).toEqual([1, 2, 3]);

    // Test index mutation
    state.items[0] = 10;
    await nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(snapshots.length).toBe(4);
    expect(snapshots[3]).toEqual([10, 2, 3]);
    expect(store.items).toEqual([10, 2, 3]);
  });

  it('should handle ref reassignment after nested mutation', async () => {
    // Setup
    class DataStore {
      constructor() {
        this.config = { version: 1 };
        makeAutoObservable(this);
      }
    }

    const store = new DataStore();
    const state = useMobxBridge(store);

    const spy = vi.fn();
    watchEffect(() => {
      spy(state.config.version);
    });

    await nextTick();
    expect(spy).toHaveBeenCalledTimes(1);

    // Nested mutation
    state.config.version = 2;
    await nextTick();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith(2);

    // Full object replacement
    state.config = { version: 3 };
    await nextTick();
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy).toHaveBeenCalledWith(3);

    // Another nested mutation after replacement
    state.config.version = 4;
    await nextTick();
    expect(spy).toHaveBeenCalledTimes(4);
    expect(spy).toHaveBeenCalledWith(4);

    // Verify MobX is in sync
    expect(store.config.version).toBe(4);
  });

  it('should verify clone creates new reference for Vue reactivity', async () => {
    // Setup
    class RefStore {
      constructor() {
        this.data = { value: 'initial' };
        makeAutoObservable(this);
      }
    }

    const store = new RefStore();
    const state = useMobxBridge(store);

    // Capture initial reference
    const initialRef = state.data;
    
    // Track reactivity
    const spy = vi.fn();
    watchEffect(() => {
      spy(state.data.value);
    });

    await nextTick();
    expect(spy).toHaveBeenCalledTimes(1);

    // Mutate nested property
    state.data.value = 'changed';

    await nextTick();
    
    // Verify reactivity triggered
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith('changed');
    
    // Verify new reference was created (this is what the clone does)
    const newRef = state.data;
    expect(newRef).not.toBe(initialRef); // Different reference
    expect(newRef.value).toBe('changed'); // Same data
    
    // Verify MobX is in sync
    expect(store.data.value).toBe('changed');
  });
});
