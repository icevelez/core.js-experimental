# Worklet

A lightweight JavaScript Worklet library that allows CPU-intensive functions to be executed inside Web Workers without manually managing worker lifecycle, task queues, serialization, or worker replacement.

Worklet provides a simple function wrapping API:

```js
const expensiveTask = wrap(function () {
    // Heavy computation
});

await expensiveTask();
```

The wrapped function keeps the same calling style as the original function but executes in a background worker thread.

---

# Features

- Automatic Web Worker creation
- Worker pooling based on CPU cores
- Task scheduling and queuing
- Function serialization and caching
- Promise-based API
- Named worker registration
- Automatic worker timeout protection
- Rogue worker termination
- Automatic worker replacement
- TypeScript-friendly JSDoc typings
- Zero dependencies

---

# Installation

## Browser Import Map

Add the Worklet module using an HTML import map:

```html
<script type="importmap">
{
    "imports": {
        "worker-pool": "https://cdn.jsdelivr.net/gh/icevelez/Core@master/lib/worklet.js"
    }
}
</script>
```

Then import:

```js
import { wrap, create_worker } from "worker-pool";
```

---

# Basic Usage

## Wrap a Function

```js
import { wrap } from "worker-pool";

const calculate = wrap(function (number) {

    let result = 0;

    for (let i = 0; i < number; i++) {
        result += Math.sqrt(i);
    }

    return result;

});


const result = await calculate(100000000);

console.log(result);
```

The original function:

```js
function calculate(number) {

}
```

becomes:

```js
(...args) => Promise<Result>
```

The computation executes inside a Web Worker.

---

# How It Works

The Worklet architecture:

```
Main Thread
    |
    |  Task
    |
    v
Worklet Scheduler
    |
    +------------+
    |            |
    v            v
Worker       Worker
Thread       Thread
    |
    v
Result
    |
    v
Promise Resolve
```

---

# Worklet Lifecycle

Workers are created dynamically.

The pool:

1. Checks for available workers.
2. Creates workers when required.
3. Queues tasks when all workers are busy.
4. Assigns queued tasks when workers become available.
5. Terminates workers that exceed their maximum task/idle time.

---

# Automatic Worker Pooling

Worklet creates workers based on available CPU cores.

```js
const MAX_WORKERS =
    Math.max(1, (navigator.hardwareConcurrency || 2) - 1);
```

The main thread keeps one CPU core available for:

- rendering
- user interaction
- browser tasks

---

# Function Wrapping

## Anonymous Functions

```js
const hash = wrap(function (data) {
    return cryptoHash(data);
});

await hash(input);
```

---

## Existing Functions

```js
function processImage(image){
    // expensive operation
}

const workerProcess = wrap(processImage);

await workerProcess(image);
```

---

# Named Functions

Worklet supports registering reusable worker functions.

```js
import { create_worker } from "worker-pool";

const worker = create_worker();

worker.register("fibonacci", function fibonacci(n){
    if(n <= 1) return n;
    return fibonacci(n-1) + fibonacci(n-2);
});

const result = await worker.run.fibonacci(40);
```

The registered function becomes available through:

```js
worker.run.<functionName>
```

---

# Multiple Worker

You can create isolated Worklets which manages its own function registry but shares the same underlying scheduler and workers:

```js
const image_workers = create_worker();
const data_workers = create_worker();
```

---

# Task Execution Flow

When calling:

```js
await workerTask(value);
```

The flow is:

```
Function Call
      |
      v
Create Task ID
      |
      v
Add to Queue
      |
      v
Scheduler Finds Worker
      |
      v
postMessage()
      |
      v
Worker Executes Function
      |
      v
postMessage(Result)
      |
      v
Resolve Promise
```

---

# Function Serialization

Functions are transferred using:

```js
Function.prototype.toString()
```

Example:

```js
function add(a,b){
    return a+b;
}
```

becomes:

```js
"function add(a,b){ return a+b; }"
```

The worker reconstructs it:

```js
new Function(`return ${fn}`)();
```

The worker caches reconstructed functions:

```js
const fn_register = new Map();
```

so repeated execution does not require recompilation.

---

# Function Cache

Example:

```js
const calculate = wrap(expensiveCalculation);

await calculate(100);
await calculate(200);
await calculate(300);
```

The worker only compiles:

```
expensiveCalculation
```

once.

Future calls reuse the cached version.

---

# Timeout Protection

Workers have a maximum execution lifetime:

```js
const MAX_WORKER_TASK_TIME = 1000 * 60 * 5;
```

Protects against:

- infinite loops
- accidental expensive computations
- frozen workers

Example:

```
Worker

Task starts
    |
    |
    +--------------------+
                         |
                    5 minutes
                         |
                         v
                  Worker terminated
```

The pending Promise is rejected:

```js
Error("Worker timeout")
```

---

# Maximum Idle Lifetime

```js
MAX_WORKER_IDLE_TIME = 5000;
```

Idle workers are automatically destroyed.

Example:

```
CSV Import

Worker 1  BUSY
Worker 2  BUSY
Worker 3  BUSY

Import finished

Worker 1  IDLE
Worker 2  IDLE
Worker 3  IDLE

5 seconds later

Worker 1  destroyed
Worker 2  destroyed
Worker 3  destroyed
```

Benefits:

- releases worker memory
- prevents unused workers consuming resources
- adapts to device limitations

---

# Scheduler

Tasks are placed into a queue:

```js
task_queue.push(task);
```

The scheduler searches for available workers:

```
Task Queue

Task A
Task B
Task C
Task D
        |
        v
Worker 1 -> Task A
Worker 2 -> Task B
Worker 3 -> Task C
Worker 4 -> Task D
```

If all workers are busy:

```
Worker 1 BUSY
Worker 2 BUSY
Worker 3 BUSY
        |
        v
Task Queue

Task E
Task F
Task G
```

When a worker finishes:

```
Worker 1 COMPLETE
        |
        v
Scheduler assigns next task
```

---

# Error Handling

Workers handle:

## Runtime errors

Example:

```js
throw new Error("Invalid CSV");
```

Returned:

```js
Promise.reject(
    Error("Invalid CSV")
)
```

---

## Worker crashes

If a worker unexpectedly crashes:

```js
worker.onerror
```

Worklet:

1. Rejects the active Promise
2. Removes the worker
3. Creates replacement workers when required

---

# Recommended Use Cases

Worklet is designed for CPU-heavy operations.

Good examples:

## Data Processing

```js
await parseLargeJSON(data);
```

## CSV Processing

```js
await parseCSV(file);
```

## Image Processing

```js
await resizeImage(bitmap);
```

## Cryptography

```js
await calculateHash(buffer);
```

## Compression

```js
await compress(data);
```

## Physics Simulation

```js
await simulate(world);
```

---

# Example

## Heavy Computation

```js
const fibonacci = wrap(
    function fib(n){
        if(n <= 1)
            return n;

        return fib(n-1)+fib(n-2);
    }
);

const result = await fibonacci(45);
```

The main thread remains responsive.

---

# Parallel Execution Example

Without Worklet:

```js
await Promise.all([
    expensiveTask(a),
    expensiveTask(b),
    expensiveTask(c)
]);
```

All tasks execute on the main thread.

```
Main Thread

Task A █████
Task B      █████
Task C           █████
```

The UI may freeze.

---

With Worklet:

```js
await Promise.all([
    workerTask(a),
    workerTask(b),
    workerTask(c)
]);
```

Execution:

```
Main Thread

Scheduler


Worker 1
Task A █████


Worker 2
Task B █████


Worker 3
Task C █████
```

The browser remains responsive.

---

# Not Recommended

Do not use Worklet for small operations:

```js
await wrap(x => x + 1)(1);
```

The overhead of:

- creating messages
- switching threads
- resolving promises

may exceed the computation time.

---

# Data Transfer

Worker communication uses the browser structured clone algorithm.

Supported:

- Objects
- Arrays
- Strings
- Numbers
- Blobs
- ArrayBuffers
- TypedArrays

Example:

```js
await process(blob);
```

---

# API Reference

## `wrap(fn)`

Wraps a function for execution in a Worklet.

```ts
wrap<T extends Function>(fn:T) : (...args:Parameters<T>) => Promise<ReturnType<T>>
```

Example:

```js
const workerFn = wrap(compute);

await workerFn(data);
```

---

## `create_worker()`

Creates a new isolated Worklet.

```js
const pool = create_worker();
```

---

## `pool.register(name, fn)`

Registers a named worker function.

Example:

```js
pool.register("compress", compress);
```

---

## `pool.run.name`

Executes a registered function.

Example:

```js
await pool.run.compress(data);
```

---

# Limitations

Because functions are serialized:

## Closures are not preserved

This will not work:

```js
const value = 10;

wrap(() => {
    return value;
});
```

The worker does not have access to:

```js
value
```

Pass values as parameters instead:

```js
wrap((value)=>{
    return value;
})(10);
```

---

## DOM Access

Workers cannot access:

```js
document
window
HTMLElement
```

Worker functions must be pure computation.

---

# Design Philosophy

Worklet follows the principle:

> Keep the main thread responsible for UI and coordination. Move expensive computation to background workers.

Instead of manually managing:

- Worker creation
- Message IDs
- Promise resolution
- Worker replacement
- Scheduling

developers interact with normal JavaScript functions.

The library transforms:

```js
function(data){
    return heavyComputation(data);
}
```

into:

```js
async function(data){
    return WorkerExecution(data);
}
```

without changing the developer experience.
