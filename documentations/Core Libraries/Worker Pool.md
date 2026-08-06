# Worker Pool

A lightweight worker pool for executing CPU-intensive JavaScript functions on background threads using the Web Worker API.

Unlike traditional Web Worker libraries that require dedicated worker files, Worker Pool accepts ordinary JavaScript functions and automatically executes them inside pooled workers.

## Features

- Worker pool with automatic scheduling
- Worker reuse
- Automatic worker creation up to `navigator.hardwareConcurrency`
- Worker timeout protection
- Automatic worker replacement after crashes or timeouts
- Promise-based API
- Named worker functions
- Anonymous worker functions
- TypeScript/JSDoc autocomplete support
- Automatic function compilation cache inside every worker

---

# Why?

JavaScript is single-threaded.

Heavy computations such as:

- CSV parsing
- Image processing
- Video processing
- Compression
- Encryption
- Large JSON parsing
- Data aggregation
- AI inference

block the UI thread, causing:

- frozen interfaces
- dropped frames
- delayed user input

Worker Pool moves these computations onto background workers while exposing an API that feels like calling ordinary async functions.

---

# Installation

Simply add the library in your importmap then import the library using its designated name.

```html
<script type="importmap">
{
    "imports" : { 
        "worker-pool" : "https://cdn.jsdelivr.net/gh/icevelez/Core@master/documentations/Core%20Libraries/Worker%20Pool.md"   
    }
}
</script>
```

```js
import { worker } from "worker-pool";
```

or create an isolated worker pool.

```js
import { create_worker } from "worker-pool";

const pool = create_worker();
```

---

# Basic Usage

## Anonymous Worker Function

```js
const expensive = worker.execute(function (n) {
    let total = 0;

    for (let i = 0; i < n; i++) {
        total += Math.sqrt(i);
    }

    return total;
});

const result = await expensive(50_000_000);
```

Equivalent shorthand:

```js
const result = await worker.execute(function (n) {
    ...
})(50_000_000);
```

---

## Named Worker Functions

Named functions can be registered once and reused throughout the application.

```js
worker.register("parseCSV", function (text) {
    ...
});
```

Later:

```js
const rows = await worker.run.parseCSV(csvText);
```

---

# Chaining Registrations

`register()` returns the same WorkerPool instance allowing fluent chaining.

```js
worker
    .register("csv", parseCSV)
    .register("thumbnail", generateThumbnail)
    .register("hash", sha256);
```

---

# TypeScript / JSDoc Autocomplete

The generic types automatically infer registered functions.

```js
worker
    .register("csv", parseCSV)
    .register("resize", resizeImage);
```

VS Code will autocomplete:

```text
worker.run.
        csv(...)
        resize(...)
```

Parameter types and return types are inferred automatically.

---

# Executing Multiple Tasks

Worker Pool automatically distributes work across available workers.

```js
await Promise.all([
    worker.run.csv(file1),
    worker.run.csv(file2),
    worker.run.csv(file3),
    worker.run.csv(file4),
    worker.run.csv(file5)
]);
```

---

# Worker Scheduling

Worker Pool maintains an internal task queue.

```text
Tasks

CSV #1
CSV #2
Resize
Hash
↓
Scheduler
↓
Worker 1
Worker 2
Worker 3
...
```

Whenever a worker becomes available, the scheduler assigns the next task.

---

# Worker Pool Size

Maximum workers default to:

```js
navigator.hardwareConcurrency
```

or

```js
1
```

if unavailable.

Example:

```text
8 CPU threads
↓
8 workers maximum
```

Workers are created lazily.

No workers are created until work is scheduled.

---

# Worker Lifetime

Each running task has a maximum execution time.

```js
const MAX_WORKER_LIFE =
    1000 * 60 * 5;
```

Default:

```
5 minutes
```

If a worker exceeds this time:

- it is terminated
- the task rejects
- a replacement worker is automatically created

Example error:

```text
Worker timeout
```

---

# Function Compilation Cache

One of the largest overheads of dynamically executing functions inside a worker is repeatedly compiling the function source.

Worker Pool avoids this.

Each worker keeps an internal cache.

```text
Worker

Map

fn_id

↓

Compiled Function
```

When a task arrives:

```text
Task
↓
fn_id
↓
Already compiled?
↓
YES
↓
Execute immediately
```

Otherwise:

```text
Compile once
↓
Store in Map
↓
Reuse forever
```

Each worker compiles every function only once during its lifetime.

---

# Function IDs

Every function registered with Worker Pool receives a unique identifier.

```text
parseCSV
↓
fn_id = 0

thumbnail
↓
fn_id = 1

hash
↓
fn_id = 2
```

Instead of recompiling function source every task, workers first check:

```js
fn_register.has(fn_id)
```

If the function already exists, the cached version is reused.

---

# Execution Flow

```text
Main Thread
↓
worker.run.csv(file)
↓
Task Queue
↓
Scheduler
↓
Available Worker
↓
Worker receives payload
↓
Function cache
↓
Compile (first run only)
↓
Execute
↓
Return result
↓
Promise resolved
```

---

# Anonymous Function Caching

Anonymous functions executed via `execute()` are cached using a `WeakMap`.

```js
const parse = worker.execute(parseCSV);

await parse(file1);
await parse(file2);
await parse(file3);
```

The worker wrapper is created only once.

Subsequent calls reuse the cached wrapper.

---

# Error Handling

Worker exceptions reject the returned Promise.

```js
try {
    await worker.run.csv(file);
} catch(err){
    console.error(err);
}
```

---

# Worker Crashes

If a worker crashes unexpectedly:

- it is terminated
- removed from the worker pool
- a replacement worker is created when necessary

---

# Architecture

```text
                   Worker Pool

               Task Queue
                    │
                    ▼
             Scheduler
      ┌─────────┬─────────┬─────────┐
      ▼         ▼         ▼
   Worker 1  Worker 2  Worker 3
      │         │         │
      ▼         ▼         ▼
 Function   Function   Function
   Cache      Cache      Cache
```

Each worker owns its own function cache.

Caches are **not shared** between workers.

This avoids recompiling the same function on every execution while remaining compatible with the browser's isolated worker memory model.

---

# Limitations

Functions should be self-contained.

Good:

```js
function add(a, b) {
    return a + b;
}
```

Bad:

```js
const multiplier = 5;

function multiply(x) {
    return x * multiplier;
}
```

The worker cannot access variables from the main thread's lexical scope.

---

# Suitable Workloads

Worker Pool is best suited for CPU-intensive operations.

Examples include:

- CSV parsing
- Spreadsheet import
- Image decoding
- Thumbnail generation
- Compression
- Encryption
- Hashing
- Large JSON processing
- Data aggregation
- Mathematical simulations
- Physics calculations
- AI inference
- Audio processing
- Video frame processing

---

# Not Suitable For

Worker Pool should generally not be used for:

- DOM manipulation
- Browser APIs tied to the main thread
- Small computations
- Event handlers
- Simple array filtering
- Frequent tiny tasks

The cost of sending data to workers may outweigh any performance gain for lightweight work.

---

# API Reference

## `worker.register(name, fn)`

Registers a reusable named worker function.

```js
worker.register("csv", parseCSV);
```

Returns:

```ts
WorkerPool
```

---

## `worker.run`

Invokes registered worker functions.

```js
await worker.run.csv(file);
```

---

## `worker.execute(fn)`

Creates a worker-backed wrapper around an anonymous function.

```js
const parse = worker.execute(parseCSV);

await parse(file);
```

Returns:

```ts
(...args) => Promise<Result>
```

---

## `create_worker()`

Creates an independent WorkerPool instance.

```js
const pool = create_worker();
```

Useful for creating isolated registries between modules or applications.
