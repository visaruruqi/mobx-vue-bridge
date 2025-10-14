# Converting makeAutoObservable to Class-Based Stores

## Conversion Pattern

### Before (Object Literal with makeAutoObservable)
```javascript
const presenter = makeAutoObservable({
  count: 0,
  name: 'test',
  
  get doubled() {
    return this.count * 2
  },
  
  increment() {
    this.count++
  }
})
```

### After (Class-Based Store)
```javascript
class TestStore {
  count = 0
  name = 'test'
  
  constructor() {
    makeAutoObservable(this)
  }
  
  get doubled() {
    return this.count * 2
  }
  
  increment() {
    this.count++
  }
}

const presenter = new TestStore()
```

## Conversion with makeObservable (Explicit Annotations)

### Before
```javascript
const presenter = makeAutoObservable({
  _count: 0,
  
  get count() {
    return this._count
  },
  
  set count(value) {
    this._count = value
  }
})
```

### After  
```javascript
class TestStore {
  _count = 0
  
  constructor() {
    makeObservable(this, {
      _count: observable,
      count: computed
    })
  }
  
  get count() {
    return this._count
  }
  
  set count(value) {
    this._count = value
  }
}

const presenter = new TestStore()
```

## Files to Convert

All test files currently use object literals with makeAutoObservable. They should be converted to class-based stores for consistency and better maintainability.

### Priority Files
1. mobxVueBridgeTwoWayBinding.test.js
2. mobxVueBridgeReactivity.test.js
3. mobxVueBridgeNested.test.js
4. mobxVueBridgeErrorHandling.test.js
5. All remaining test files
