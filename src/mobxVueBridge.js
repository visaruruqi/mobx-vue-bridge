import { reactive, onUnmounted, ref } from 'vue';
import { toJS, reaction, observe } from 'mobx';
import { deepObserve } from 'mobx-utils';
import clone from 'clone';
import { categorizeMobxMembers } from './utils/memberDetection.js';
import { isEqual } from './utils/equality.js';
import { createDeepProxy } from './utils/deepProxy.js';
import {
  safelyReadInitialValue,
  createReactiveRef,
  separateGetterSetterPairs,
  findGettersOnly,
  findSettersOnly,
  defineReactiveProperty,
  createLazyValidatedSetter,
  createReadOnlySetter,
  createWriteOnlySetter,
  createTwoWayBindingSetter,
  isCurrentlyUpdating,
  observeProperty,
  deepObserveProperty,
  observeGetter,
  safelyDisposeSubscription,
} from './utils/helpers.js';

/**
 * 🌉 MobX-Vue Bridge
 * 
 * Creates a bidirectional bridge between MobX observables and Vue 3 reactivity.
 * Automatically synchronizes changes in both directions while preventing infinite loops.
 * 
 * @param {object} mobxObject - The MobX observable object to bridge (created with makeAutoObservable)
 * @param {object} options - Configuration options
 * @param {boolean} options.allowDirectMutation - Whether to allow direct mutation of properties (default: true)
 * @returns {object} Vue reactive state object with synchronized properties, getters, setters, and methods
 * 
 * @example
 * ```javascript
 * import { useMobxBridge } from 'mobx-vue-bridge'
 * import { makeAutoObservable } from 'mobx'
 * 
 * class UserStore {
 *   constructor() {
 *     this.name = 'John'
 *     this.age = 30
 *     makeAutoObservable(this)
 *   }
 *   
 *   get displayName() {
 *     return `${this.name} (${this.age})`
 *   }
 * }
 * 
 * const store = new UserStore()
 * const state = useMobxBridge(store)
 * ```
 */
export function useMobxBridge(mobxObject, options = {}) {
  // Validate mobxObject parameter
  if (!mobxObject || typeof mobxObject !== 'object') {
    throw new Error('useMobxBridge requires a valid MobX observable object as the first parameter');
  }
  
  const safeOptions = options || {};
  // Use explicit boolean conversion to handle truthy/falsy values properly
  const allowDirectMutation = safeOptions.allowDirectMutation !== undefined 
    ? Boolean(safeOptions.allowDirectMutation) 
    : true; // Keep the original default of true
  
  const vueState = reactive({});

  // Use the imported categorization function
  const members = categorizeMobxMembers(mobxObject);

  // ---- utils: guards -------------------------------------------------------
  const updatingFromMobx = new Set();
  const updatingFromVue = new Set();

  // Warning helpers to reduce duplication
  const warnMethodAssignment = (prop) => console.warn(`Cannot assign to method '${prop}'`);

  // ---- Bridge observable properties (two-way binding) ----
  const propertyRefs = {};
  
  const bridgeObservableProperty = (propertyName) => {
    propertyRefs[propertyName] = createReactiveRef(toJS(mobxObject[propertyName]));

    const createDeepProxyForValue = (value) => {
      if (value && typeof value === 'object') {
        return createDeepProxy(
          value, 
          propertyName, 
          () => propertyRefs[propertyName].value,
          allowDirectMutation,
          updatingFromVue,
          mobxObject,
          propertyRefs
        );
      }
      return value;
    };

    defineReactiveProperty(vueState, propertyName, {
      get: () => createDeepProxyForValue(propertyRefs[propertyName].value),
      set: createTwoWayBindingSetter({
        propertyName,
        target: mobxObject,
        allowDirectMutation,
        guardSet: updatingFromVue,
        propertyRef: propertyRefs[propertyName],
        // No deepProxyCreator needed - createTwoWayBindingSetter already clones the value
      }),
    });
  };

  members.properties.forEach(bridgeObservableProperty);

  // ---- getters and setters (handle both computed and two-way binding) ------
  const getterRefs = {};
  const setterRefs = {};
  const readOnlyDetected = new Set(); // Track properties detected as read-only on first write

  // Categorize properties by their getter/setter combinations
  const getterSetterPairs = separateGetterSetterPairs(members.getters, members.setters);
  const gettersOnly = findGettersOnly(members.getters, members.setters);
  const settersOnly = findSettersOnly(members.setters, members.getters);

  // ---- Bridge getter/setter pairs (potentially writable computed properties) ----
  // Note: Some may have MobX synthetic setters that throw - we detect this lazily on first write
  const bridgeGetterSetterPair = (propertyName) => {
    const initialValue = safelyReadInitialValue(mobxObject, propertyName);
    getterRefs[propertyName] = createReactiveRef(initialValue);

    defineReactiveProperty(vueState, propertyName, {
      get: () => getterRefs[propertyName].value,
      set: createLazyValidatedSetter({
        propertyName,
        target: mobxObject,
        allowDirectMutation,
        readOnlySet: readOnlyDetected,
        guardSet: updatingFromVue,
      }),
    });
  };

  getterSetterPairs.forEach(bridgeGetterSetterPair);

  // ---- Bridge getter-only properties (read-only computed) ----
  const bridgeGetterOnly = (propertyName) => {
    const initialValue = safelyReadInitialValue(mobxObject, propertyName);
    getterRefs[propertyName] = createReactiveRef(initialValue);

    defineReactiveProperty(vueState, propertyName, {
      get: () => getterRefs[propertyName].value,
      set: createReadOnlySetter(propertyName),
    });
  };

  gettersOnly.forEach(bridgeGetterOnly);

  // ---- Bridge setter-only properties (write-only) ----
  const bridgeSetterOnly = (propertyName) => {
    setterRefs[propertyName] = createReactiveRef(undefined);

    defineReactiveProperty(vueState, propertyName, {
      get: () => setterRefs[propertyName].value,
      set: createWriteOnlySetter({
        propertyName,
        target: mobxObject,
        allowDirectMutation,
        guardSet: updatingFromVue,
        setterRef: setterRefs[propertyName],
      }),
    });
  };

  settersOnly.forEach(bridgeSetterOnly);

  // ---- Bridge methods (bound to MobX context) ----
  const bridgeMethod = (methodName) => {
    // Cache the bound method to avoid creating new functions on every access
    const boundMethod = mobxObject[methodName].bind(mobxObject);
    
    defineReactiveProperty(vueState, methodName, {
      get: () => boundMethod,
      set: () => warnMethodAssignment(methodName),
    });
  };

  members.methods.forEach(bridgeMethod);

  // ---- MobX → Vue: property observation ----------------------------------------
  const subscriptions = [];
  const deepObserveSubscriptions = {}; // Track deep observe subs per property for re-subscription

  setupPropertyObservation();
  setupGetterObservation();

  // Observe observable properties for MobX → Vue sync
  function setupPropertyObservation() {
    members.properties.forEach(propertyName => {
      // Helper to setup/re-setup deep observation for a value
      const setupDeepObserve = (value) => {
        // Dispose existing deep observe subscription if any
        if (deepObserveSubscriptions[propertyName]) {
          safelyDisposeSubscription(deepObserveSubscriptions[propertyName]);
          deepObserveSubscriptions[propertyName] = null;
        }
        
        // Only deep observe objects and arrays
        if (!value || typeof value !== 'object') {
          return;
        }

        const deepObserveSub = deepObserveProperty({
          target: mobxObject,
          propertyName,
          refToUpdate: propertyRefs[propertyName],
          echoGuard: updatingFromVue,
          updateGuard: updatingFromMobx,
        });
        if (deepObserveSub) {
          deepObserveSubscriptions[propertyName] = deepObserveSub;
          subscriptions.push(deepObserveSub);
        }
      };

      // Observe direct property changes
      const observeSub = observeProperty({
        target: mobxObject,
        propertyName,
        refToUpdate: propertyRefs[propertyName],
        echoGuard: updatingFromVue,
        updateGuard: updatingFromMobx,
        onValueChanged: setupDeepObserve, // Re-subscribe deepObserve when value changes
      });
      if (observeSub) subscriptions.push(observeSub);

      // Initial deep observe setup
      setupDeepObserve(mobxObject[propertyName]);
    });
  }

  // Observe computed properties (getters) for MobX → Vue sync
  function setupGetterObservation() {
    [...gettersOnly, ...getterSetterPairs].forEach(propertyName => {
      const reactionSub = observeGetter({
        target: mobxObject,
        propertyName,
        refToUpdate: getterRefs[propertyName],
      });
      subscriptions.push(reactionSub);
    });
  }

  // Cleanup subscriptions when component unmounts
  onUnmounted(() => {
    subscriptions.forEach(safelyDisposeSubscription);
  });

  return vueState;
}

/**
 * Alias for useMobxBridge - for users who prefer "presenter" terminology
 * @alias useMobxBridge
 */
export const usePresenterState = useMobxBridge;
