## Components as Runtime Resources

Core treats components not as files that must be compiled before deployment, but as **runtime resources** that can be loaded, executed, and composed directly in the browser.

Unlike traditional frontend frameworks, where components are transformed into static JavaScript bundles during build time, Core preserves the original component structure as a deployable unit.

This means a component is not something that is compiled away — it is something that remains **addressable, retrievable, and executable at runtime**.

```
Component Source (.html / Core SFC)
        ↓
Deployed as-is
        ↓
Loaded by the browser
        ↓
Compiled at runtime
        ↓
Executed as UI
```

In this model, components behave more like web-native resources rather than precompiled application code.

---

## Core Idea: Components Are Addressable

A Core component is referenced by a URL:

```js
await component("/components/UserCard.html");
```

This makes components:

* Fetchable
* Cacheable
* Shareable
* Replaceable
* Dynamically loadable

In essence, a component behaves like a **runtime module exposed over HTTP** rather than a static compile-time application code.

---

## Without Core Assist: Runtime Resource Model

Even without Core Assist, Core already enables this model:

```text
Request Component
      ↓
Fetch Source
      ↓
Compile in Browser
      ↓
Execute
```

This allows applications to:

* Load components dynamically
* Compose UI at runtime
* Introduce new UI behavior without rebuilding the application

However, each load may involve repeated compilation work.

---

## With Core Assist: Persistent Resource Optimization

Core Assist extends this model by introducing a persistent compilation layer.

Instead of treating compilation as a repeated runtime cost, Core Assist treats it as a **one-time transformation per component per client**.

```
First Load
==========
Component Source
      ↓
Compile
      ↓
Store Compiled Module

Subsequent Loads
=================
Fetch Compiled Module
      ↓
Execute Immediately
```

This transforms components into **self-optimizing runtime resources**.

The more a component is used, the more efficient it becomes.

---

## Key Insight: Distribution vs Optimization

The core distinction is:

### Traditional frameworks

Components are **precompiled application code**

```
Source → Build → JavaScript Bundle → Deploy
```

Once deployed, the original component no longer exists in a usable form.

---

### Core (without Assist)

Components are **distributed as runtime resources**

```
Source → Deploy → Browser Compiles → Execute
```

The browser always retains the ability to interpret components.

---

### Core + Core Assist

Components become **adaptive runtime resources**

```text
Source → Deploy → Compile → Cache → Reuse → Optimize Over Time
```

This introduces an additional property:

> Component performance improves with usage.

---

## Why This Matters

This model enables a different class of applications:

### 1. Runtime-extensible systems

Applications can accept new components after deployment:

* CMS-driven UI systems
* Plugin architectures
* User-generated interfaces

---

### 2. Distributed UI ecosystems

Components can be shared like resources:

* Hosted on URLs
* Loaded on demand
* Cached per client
* Reused across sessions

---

### 3. Progressive optimization

Unlike build-time frameworks where optimization happens once at build time, Core shifts optimization into runtime:

* First use: compilation cost
* Future use: zero compilation cost
* Repeated use: fully cached execution

---

## Philosophical Shift

Core introduces a shift from:

> “UI is something you build and ship”

to:

> “UI is something you distribute and execute”

Core Assist extends this further:

> “UI is something that improves in performance the more it is used”

---

## A Major Challenge: Implicit Dependencies

Treating components as runtime resources introduces a problem that traditional build systems often solve automatically:

> Components rarely exist in isolation.

A component may appear self-contained:

```js
await component("/components/UserCard.html");
```

but it may depend on resources that are not immediately obvious.

For example:

```html
<div class="bg-blue-500 text-white p-4">
    User Card
</div>
```

The component renders successfully, but the styling assumes Tailwind CSS is already available.

Without Tailwind:

```html
<div class="bg-blue-500 text-white p-4">
    User Card
</div>
```

becomes an unstyled element.

The component technically loads, but it no longer behaves as intended.

---

### Examples of Implicit Dependencies

A component may depend on:

* Tailwind CSS
* External stylesheets
* Icon libraries
* Fonts
* Utility libraries
* Shared components
* Context providers
* Global application state
* Browser APIs
* Custom elements

These dependencies are often not visible from the component URL alone.

```text
UserCard.html
      ↓
Looks self-contained
      ↓
Actually depends on:
  - Tailwind
  - Heroicons
  - UserContext
  - ThemeProvider
```

---

### How Traditional Bundlers Solve This Problem

Build systems typically construct a dependency graph during compilation:

```text
Component
    ↓
Imports
    ↓
Dependency Graph
    ↓
Bundle
```

By the time the application is deployed, many dependencies have already been resolved.

As a result, developers rarely think about whether a component can truly exist independently.

---

### Runtime Resources Expose Dependency Boundaries

When components become distributable resources, dependency boundaries become more visible.

A component loaded from:

```js
await component(
    "https://example.com/UserCard.html"
);
```

cannot assume the host application provides:

* Tailwind
* Reactivity libraries
* CSS resets
* Fonts
* Context providers

unless those requirements are explicitly communicated.

The component becomes similar to a package or plugin:

```text
Resource
      ↓
Requires Environment
```

---

### Possible Solutions

Several approaches can help reduce dependency ambiguity:

#### Documentation

The simplest approach is explicitly documenting requirements.

```text
UserCard.html

Requires:
- Tailwind CSS v4
- Heroicons
```

#### Resource Manifests

Components could declare required resources:

```js
export const dependencies = {
    css: [
        "https://cdn.example.com/tailwind.css"
    ]
};
```

#### Self-Contained Components

Components may choose to bundle or embed their own styling.

#### Runtime Dependency Resolution

Future systems could automatically discover and load required resources before executing the component.

---

### The Tradeoff

Component resources provide:

* Dynamic loading
* Runtime composition
* Independent deployment
* Plugin-like architectures

However, they also shift responsibility for dependency management from build tools to runtime systems.

In other words:

> The more independently deployable a component becomes, the more important explicit dependency management becomes.

This is one of the primary challenges of treating components as runtime resources.
