import { describe, it, expect } from 'vitest'
import { makeAutoObservable, runInAction } from 'mobx'
import { useMobxBridge } from '../src/mobxVueBridge'
import { nextTick } from 'vue'

describe('MobX-Vue Bridge Cross-Class Computed Dependencies', () => {
  it('should detect changes when one class computed depends on another class computed (only bridging dependent class)', async () => {
    // Class A has a base value and a computed that doubles it
    class ClassA {
      value = 10

      constructor() {
        makeAutoObservable(this)
      }

      get doubled() {
        return this.value * 2
      }

      setValue(newValue) {
        this.value = newValue
      }
    }

    // Class B depends on Class A's computed property
    class ClassB {
      constructor(classA) {
        this.classA = classA
        makeAutoObservable(this)
      }

      // This computed depends on ClassA's computed (doubled)
      get tripleOfDoubled() {
        return this.classA.doubled * 3
      }

      // This computed depends on ClassA's observable directly
      get plusTen() {
        return this.classA.value + 10
      }
    }

    const instanceA = new ClassA()
    const instanceB = new ClassB(instanceA)

    // Only bridge instanceB, NOT instanceA
    const stateB = useMobxBridge(instanceB)

    // Initial values
    // ClassA (not bridged): value = 10, doubled = 20
    // ClassB (bridged): tripleOfDoubled = 60, plusTen = 20
    expect(instanceA.value).toBe(10)
    expect(instanceA.doubled).toBe(20)
    expect(stateB.tripleOfDoubled).toBe(60)
    expect(stateB.plusTen).toBe(20)

    // Change the base value in ClassA (which is NOT bridged)
    runInAction(() => {
      instanceA.setValue(5)
    })

    // Wait for Vue reactivity to propagate
    await nextTick()

    // ClassA (not bridged): value = 5, doubled = 10
    // ClassB (bridged): should detect the change - tripleOfDoubled = 30, plusTen = 15
    expect(instanceA.value).toBe(5)
    expect(instanceA.doubled).toBe(10)
    expect(stateB.tripleOfDoubled).toBe(30)
    expect(stateB.plusTen).toBe(15)
  })

  it('should detect changes through direct property mutation (only bridging dependent class)', async () => {
    class ClassA {
      value = 100

      constructor() {
        makeAutoObservable(this)
      }

      get computed() {
        return this.value + 1
      }
    }

    class ClassB {
      constructor(classA) {
        this.classA = classA
        makeAutoObservable(this)
      }

      get dependentComputed() {
        return this.classA.computed * 2
      }
    }

    const instanceA = new ClassA()
    const instanceB = new ClassB(instanceA)

    // Only bridge instanceB, NOT instanceA
    const stateB = useMobxBridge(instanceB)

    // Initial: A.value=100, A.computed=101, B.dependentComputed=202
    expect(instanceA.value).toBe(100)
    expect(instanceA.computed).toBe(101)
    expect(stateB.dependentComputed).toBe(202)

    // Mutate instanceA directly (not through bridge since it's not bridged)
    runInAction(() => {
      instanceA.value = 50
    })

    await nextTick()

    // After: A.value=50, A.computed=51, B.dependentComputed=102
    expect(instanceA.value).toBe(50)
    expect(instanceA.computed).toBe(51)
    expect(stateB.dependentComputed).toBe(102)
  })

  it('should handle chain of three classes with computed dependencies (only bridging last class)', async () => {
    class ClassA {
      base = 2

      constructor() {
        makeAutoObservable(this)
      }

      get squared() {
        return this.base * this.base
      }
    }

    class ClassB {
      constructor(classA) {
        this.classA = classA
        makeAutoObservable(this)
      }

      get addTen() {
        return this.classA.squared + 10
      }
    }

    class ClassC {
      constructor(classB) {
        this.classB = classB
        makeAutoObservable(this)
      }

      get doubled() {
        return this.classB.addTen * 2
      }
    }

    const a = new ClassA()
    const b = new ClassB(a)
    const c = new ClassC(b)

    // Only bridge ClassC - the end of the chain
    const stateC = useMobxBridge(c)

    // Initial: A.base=2, A.squared=4, B.addTen=14, C.doubled=28
    expect(a.base).toBe(2)
    expect(a.squared).toBe(4)
    expect(b.addTen).toBe(14)
    expect(stateC.doubled).toBe(28)

    // Change the root value in ClassA (which is NOT bridged)
    runInAction(() => {
      a.base = 3
    })

    await nextTick()

    // After: A.base=3, A.squared=9, B.addTen=19, C.doubled=38
    expect(a.base).toBe(3)
    expect(a.squared).toBe(9)
    expect(b.addTen).toBe(19)
    expect(stateC.doubled).toBe(38)
  })
})
