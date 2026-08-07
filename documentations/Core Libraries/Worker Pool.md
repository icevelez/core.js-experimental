# Worker Pool

A lightweight JavaScript Worker Pool library that allows CPU-intensive functions to be executed inside Web Workers without manually managing worker lifecycle, task queues, serialization, or worker replacement.

Worker Pool provides a simple function wrapping API:

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

Add the Worker Pool module using an HTML import map:

```html
<script type="importmap">
{
    "imports": {
        "worker-pool": "https://cdn.jsdelivr.net/gh/icevelez/Core@master/lib/worker-pool.js"
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

The Worker Pool architecture:

```
Main Thread

    |
    |
    |  Task
    |
    v

Worker Pool Scheduler

    |
    |
    +------------+
    |            |
    v            v

Worker       Worker
Thread       Thread

    |
    |
    v

Result

    |
    |
    v

Promise Resolve
```

---

# Worker Pool Lifecycle

Workers are created dynamically.

The pool:

1. Checks for available workers.
2. Creates workers when required.
3. Queues tasks when all workers are busy.
4. Assigns queued tasks when workers become available.
5. Terminates workers that exceed their maximum lifetime.

---

# Worker Limits

The worker count is automatically determined:

```js
const MAX_WORKERS = navigator.hardwareConcurrency || 1;
```

Example:

A CPU with:

```
8 cores
```

creates up to:

```
8 workers
```

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

Worker Pool supports registering reusable worker functions.

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

# Multiple Worker Pools

You can create isolated worker pools which manages its own function registry but shares the same underlying scheduler and workers:

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
const MAX_WORKER_LIFE = 1000 * 60 * 5;
```

Default:

```
5 minutes
```

If a worker does not respond:

```
Worker
 |
 X
 |
Terminate
```

The pool:

1. Terminates the worker.
2. Rejects the pending Promise.
3. Creates a replacement worker.
4. Continues processing queued tasks.

---

# Handling Infinite Loops

Example:

```js
const badTask = wrap(function(){
    while(true){}
});


await badTask();
```

The Worker Pool detects that the worker exceeded:

```js
MAX_WORKER_LIFE
```

and terminates it.

The main thread remains responsive.

---

# Error Handling

Worker errors automatically reject the Promise.

Example:

```js
const task = wrap(function(){
    throw new Error("Something failed");
});


try {
    await task();
} catch(error){
    console.error(error);
}
```

---

# Recommended Use Cases

Worker Pool is designed for CPU-heavy operations.

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

# Not Recommended

Do not use Worker Pool for small operations:

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

Wraps a function for execution in the worker pool.

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

Creates a new isolated worker pool.

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

Worker Pool follows the principle:

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
