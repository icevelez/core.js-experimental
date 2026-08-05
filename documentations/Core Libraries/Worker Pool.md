# Worker Pool Documentation

## Overview

Worker Pool is a lightweight JavaScript concurrency library that allows CPU-intensive tasks to run inside browser Web Workers through a simple Promise-based function API.

Instead of manually managing:

* `Worker` creation
* `postMessage`
* `onmessage`
* worker scheduling
* task queues
* worker termination
* error handling

Worker Pool provides a function-based execution model:

```javascript
const result = await worker_pool.run(
    (a, b) => a + b
)(10, 20);
```

The library automatically:

* Serializes the function.
* Sends it to a background Worker.
* Executes it in an isolated JavaScript runtime.
* Returns the result through a Promise.

---

# Design Goals

Worker Pool is designed to provide:

* Simple asynchronous CPU execution.
* Automatic worker management.
* Parallel task execution.
* Function-based API.
* Worker reuse.
* Rogue worker protection.
* Automatic recovery.

The goal is to make browser Web Workers feel similar to:

* Go goroutines.
* Node.js worker pools.
* Serverless function execution.

---

# Architecture

Worker Pool consists of three major components:

```
                 Worker Pool API

                      |
                      v

              Task Scheduler

                      |
        +-------------+-------------+
        |             |             |

    Worker #1     Worker #2     Worker #3

        |
        |
  Execute Function
```

The main thread handles:

* Scheduling.
* Queue management.
* Promise resolution.
* Worker lifecycle.

Workers handle:

* Function execution.
* Heavy computation.

---

# Basic Usage

## Execute a Function

```javascript
const add = worker_pool.run(
    (a, b) => a + b
);


const result = await add(10,20);

console.log(result);
```

Output:

```
30
```

---

# Direct Execution

A function can be created and immediately executed:

```javascript
const result =
    await worker_pool.run(
        x => x * x
    )(10);


console.log(result);
```

Output:

```
100
```

---

# How It Works

When a function is registered:

```javascript
const calculate =
    worker_pool.run(
        data => process(data)
    );
```

The library converts:

```javascript
(data) => process(data)
```

into:

```javascript
"(data)=>process(data)"
```

The function is sent to a Web Worker:

```
Main Thread

Function
   |
   |
serialize
   |
   v

Worker Thread

new Function()
   |
   |
execute
```

---

# Worker Pool Management

Worker Pool automatically manages multiple Workers.

The maximum worker count is determined by:

```javascript
navigator.hardwareConcurrency
```

Example:

```
CPU cores: 8

Worker Pool:

Worker 1
Worker 2
Worker 3
Worker 4
Worker 5
Worker 6
Worker 7
Worker 8
```

---

# Task Scheduling

When executing tasks:

```javascript
await calculate(data);
```

the scheduler performs:

```
Task Submitted

       |
       v

Is Worker Available?

       |
   +---+---+
   |       |
 Yes       No
   |       |
Execute   Queue
```

Queued tasks automatically execute when a worker becomes available.

---

# Worker Reuse

Workers are persistent.

Instead of:

```
Task A

Create Worker
Execute
Destroy


Task B

Create Worker
Execute
Destroy
```

Worker Pool maintains:

```
Worker 1
Worker 2
Worker 3
```

and reuses them.

This reduces:

* Worker startup overhead.
* Memory allocation.
* Script parsing cost.

---

# Function Caching

Worker Pool caches functions automatically.

Example:

```javascript
const add =
    worker_pool.run(
        (a,b)=>a+b
    );
```

Calling:

```javascript
worker_pool.run(
    (a,b)=>a+b
);
```

again returns the cached worker function.

The cache key is based on:

```javascript
func.toString()
```

---

# Named Workers

Functions can be registered with a name.

Example:

```javascript
worker_pool.register(
    "add",
    (a,b)=>a+b
);
```

Execute:

```javascript
const result =
    await worker.add(10,20);
```

---

# Worker Proxy API

Registered workers are accessible through:

```javascript
worker.name
```

Example:

```javascript
await worker.compress(data);

await worker.resize(image);
```

---

# Async Functions

Worker functions may return Promises.

Example:

```javascript
const fetchData =
    worker_pool.run(
        async url => {

            const response =
                await fetch(url);

            return response.json();

        }
    );


const data =
    await fetchData(
        "/api/data"
    );
```

---

# Blob Support

Worker Pool supports structured-cloneable browser objects.

Supported:

* Blob
* File
* ArrayBuffer
* TypedArray
* Object
* Array

Example:

```javascript
const readFile =
    worker_pool.run(
        async file => {

            return {
                size:file.size,
                type:file.type
            };

        }
    );


const result =
    await readFile(
        myFile
    );
```

---

# Image Processing Example

```javascript
const processImage =
    worker_pool.run(
        async blob => {

            const bitmap =
                await createImageBitmap(blob);


            return {
                width: bitmap.width,
                height: bitmap.height
            };

        }
    );


const result =
    await processImage(
        imageBlob
    );
```

---

# Rogue Worker Protection

A worker executing:

```javascript
while(true){}
```

cannot respond to messages.

Worker Pool protects against this by enforcing a worker lifetime limit.

Example:

```
Worker

while(true)

      |
      |
Maximum Lifetime Reached

      |
      v

terminate()

      |
      v

Replace Worker
```

---

# Worker Lifecycle

Workers transition through:

```
Created

   |
   v

Idle

   |
   v

Running

   |
   v

Idle
```

Workers may be destroyed when:

* Maximum execution time is exceeded.
* Worker crashes.
* Pool cleanup occurs.

---

# Error Handling

Worker errors automatically reject Promises.

Example:

```javascript
const task =
    worker_pool.run(
        ()=>{
            throw new Error("Failed");
        }
    );


try {

    await task();

}
catch(error){

    console.log(error.message);

}
```

Output:

```
Failed
```

---

# Security Considerations

Worker Pool executes serialized JavaScript:

```javascript
new Function()
```

This means:

Do not execute untrusted user code.

Unsafe:

```javascript
worker_pool.run(
    userProvidedFunction
);
```

Safe:

```javascript
worker_pool.run(
    internalApplicationFunction
);
```

---

# Limitations

## No DOM Access

Workers cannot access:

```javascript
document
window
HTMLElement
```

DOM changes must happen in the main thread.

---

## No Shared Variables

This does not work:

```javascript
let count = 0;


worker_pool.run(
    ()=>{
        count++;
    }
);
```

Workers run in isolated environments.

---

## Function Serialization Limitations

Because functions are converted using:

```javascript
Function.toString()
```

closures are not preserved.

Example:

```javascript
const value = 10;


worker_pool.run(
    ()=>value
);
```

will fail because the worker does not know:

```javascript
value
```

Pass values as arguments instead:

```javascript
worker_pool.run(
    value=>value
)(10);
```

---

# Recommended Use Cases

Good:

```
Image Processing

Video Processing

Compression

Hashing

Large Data Processing

Parsing

Scientific Computation

Machine Learning Tasks
```

Avoid:

```
DOM Manipulation

UI Logic

Small Calculations

Simple Event Handlers
```

---

# API Reference

## worker_pool.run()

Creates a worker function.

Signature:

```javascript
worker_pool.run(Function)
```

Example:

```javascript
const task =
    worker_pool.run(
        x=>x*x
    );
```

Returns:

```javascript
(...args)=>Promise<Result>
```

---

## worker_pool.register()

Registers a named worker.

Signature:

```javascript
worker_pool.register(
    name,
    Function
)
```

Example:

```javascript
worker_pool.register(
    "multiply",
    (a,b)=>a*b
);
```

---

## worker Proxy

Access registered workers.

Example:

```javascript
await worker.multiply(
    5,
    10
);
```

---

# Summary

Worker Pool provides a simple concurrency model for browser JavaScript:

```javascript
const result =
    await worker_pool.run(
        data =>
            expensiveCalculation(data)
    )(largeData);
```

while managing:

* Web Worker creation.
* Worker reuse.
* Task scheduling.
* Parallel execution.
* Error handling.
* Worker replacement.

It transforms Web Workers from a low-level messaging API into a high-level asynchronous computation runtime.
