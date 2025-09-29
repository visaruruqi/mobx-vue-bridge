import { Ref, UnwrapRef } from 'vue'

export interface MobxBridgeOptions {
  /**
   * Whether to allow direct mutation of properties
   * @default true
   */
  allowDirectMutation?: boolean
}

/**
 * Bridge between MobX observables and Vue 3 reactivity system
 * 
 * @param mobxObject - The MobX observable object to bridge
 * @param options - Configuration options
 * @returns Vue reactive state object
 */
export function useMobxBridge<T extends object>(
  mobxObject: T,
  options?: MobxBridgeOptions
): UnwrapRef<T>

/**
 * Helper alias for useMobxBridge - commonly used with presenter objects
 * 
 * @param presenter - The MobX presenter object to bridge
 * @param options - Configuration options
 * @returns Vue reactive state object
 */
export function usePresenterState<T extends object>(
  presenter: T,
  options?: MobxBridgeOptions
): UnwrapRef<T>