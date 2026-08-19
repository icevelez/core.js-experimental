
# Core v0.6.0 — Changelog

Core v0.6.0 introduces a significant refinement to Core's architecture and authoring model. This release separates the runtime from the compiler, makes component imports feel more native to JavaScript, and expands Core's component, reactivity, and integration capabilities.

## ✨ Highlights

### Native-Looking Component Imports

Core components can now be imported using familiar JavaScript module syntax:

```js
import ComponentName from "./Component.html";
```

Previously, components were declared using:

```js
export const ComponentName = component("src/Component.html");
```

The new syntax provides a more natural developer experience and makes Core components feel more like ordinary JavaScript modules.

> **Note:** Core does not currently rely on native browser support for importing `.html` modules. The syntax is transformed by the Core compiler into the appropriate asynchronous component-loading operations.

---

### Runtime and Compiler Separation

Core's implementation has been reorganized into two primary modules:

```text
core/
├── runtime.js
└── compiler.js
```

This separation allows Core Server to serve precompiled Core components without requiring the browser to download the compiler.

The resulting architecture can operate in two modes:

```text
Core Server available

Core Component
      ↓
Core Server
      ↓
Compile
      ↓
JavaScript Module
      ↓
Browser
      ↓
Core Runtime
```

Or, when Core Server is not available:

```text
Core Component
      ↓
Browser
      ↓
Core Runtime
      ↓
Core Compiler
```

This makes the compiler an optional part of the client-side runtime rather than an inherent requirement.

---

## 🚀 New Features

### Dynamic `<CoreComponent />`

Core now supports dynamically rendering a component based on a reactive value.

This enables patterns such as:

```html
<CoreComponent
    :default="component_object_based_on_role[role] || NotFound"
/>
```

The component can change as the underlying reactive value changes while Core manages the component's lifecycle.

---

### Component-Scoped CSS

Core now supports component-scoped CSS.

Styles defined by a component can be scoped to that component, reducing unintended style leakage between components.

This allows components to encapsulate:

* Template
* Logic
* Styling

while remaining within Core's Single-File Component model.

---

### Managed Signals

Core now supports **managed signals** inside the runtime.

Managed signals allow Core to better integrate signal ownership and lifecycle management with component instances and runtime operations.

This provides a foundation for more controlled reactive resource management.

---

### Template Loader API

Core now provides a Template Loader API for initializing Core applications inside either:

* a new HTML document
* an existing HTML document

This makes Core easier to integrate into existing web applications without requiring the entire page to be authored as a Core application.

For example, a page can contain:

```html
<template core-src="./src/App.html"></template>
```

and the Core runtime can load and mount the component into the existing document.

This is particularly useful for progressively introducing Core into existing applications.

---

### Extended Reactive Data Types

Reactive support has been expanded beyond ordinary objects and signals.

Core now provides reactive implementations for:

* `Map`
* `Set`
* `Date`
* `MediaQuery`
* `URL`

These capabilities are provided through a separate:

```text
reactivity.js
```

module.

Keeping these implementations separate prevents the Core runtime from carrying functionality that an application may not need.

---

## 🐛 Bug Fixes & Refinements

### Fixed Undefined Dispose Functions

Fixed an issue where empty slot render functions could return an undefined `dispose` function. Core now provides a valid disposal function even when a slot does not render content.

This makes component lifecycle handling more predictable and prevents consumers from having to defensively check whether a disposal function exists.

---

### Improved JSDoc Annotations

Added and refined JSDoc annotations for several Core runtime functions.

without requiring Core itself to depend on TypeScript.

---

# 🧩 Extra

## Worklet

A new standalone library, **Worklet**, has been introduced.

Worklet explores additional capabilities for executing work outside the normal application execution path and is maintained separately from the Core runtime.

---

## Core Server

Core Server is introduced as an **experimental middleware for Bun.http**.

It extends Core's resource-centric model into the server environment by allowing Core components to receive server-side data before being delivered to the browser.

Core Server provides two major capabilities:

### Server-Side Data Injection

Server code can inject data into a Core component before the component is initialized by the client.

Conceptually:

```text
Request
   ↓
Core Server
   ↓
Load Core Component
   ↓
Inject Server Data
   ↓
Return Component
   ↓
Browser
   ↓
Core Runtime
```

This is **not traditional SSR**.

The server does not render the final HTML for the browser.

Instead, it prepares the Core component/resource so that the browser can initialize it with data already available from the server.

---

### Request-Time Component Compilation

Core Server can also compile Core components on the server before sending them to the browser.

This allows the client to avoid performing the compilation itself.

```text
Without Core Server

Component
    ↓
Browser
    ↓
Runtime
    ↓
Compiler
```

With Core Server:

```text
Component
    ↓
Core Server
    ↓
Compiler
    ↓
Optimized JavaScript
    ↓
Browser
    ↓
Runtime
```

This can reduce both:

* client-side compilation work
* the amount of Core compiler code that needs to be shipped to the client

while retaining Core's resource-centric development model.

> **Experimental:** Core Server is currently designed for Bun's HTTP server environment and is not yet a general-purpose backend integration layer.

---

# 🏗️ Architectural Direction

Core v0.6.0 represents an important architectural shift.

Core is increasingly separating the concerns of:

```text
Authoring
    ↓
Compilation
    ↓
Runtime
    ↓
Server Integration
```

Rather than making every application carry every capability, functionality can be introduced according to the environment:

```text
Core Runtime
     │
     ├── Core Compiler
     │
     ├── Reactivity
     │
     ├── Template Loader
     │
     └── Optional libraries
            │
            └── Worklet
```

And when a server environment is available:

```text
                 Core Server
                      │
             ┌────────┴────────┐
             │                 │
      Server Data        Component
       Injection          Compilation
             │                 │
             └────────┬────────┘
                      ↓
                Core Runtime
                      ↓
                   Browser
```

The goal is not to make Core require a particular deployment architecture.

Instead, **Core v0.6.0 continues the principle of progressive capability**:

> Start with the browser and Core runtime. Add the compiler, server integration, or supporting libraries when the application benefits from them.
