# Introduction

## What is Core?

Core is a JavaScript framework built from a simple question:

> How much of a modern frontend framework can be implemented directly in the browser?

Modern frameworks provide many capabilities:

* Components
* Reactivity
* Conditional rendering
* List rendering
* Context
* Lifecycle hooks
* Single-File Components
* Runtime and compile-time optimizations

Traditionally these features are delivered through build tools, compilers, and development servers.

Core explores a different approach.

Instead of starting with a build pipeline and generating browser code as the final output, Core starts with the browser itself and builds upward from the capabilities already available on the web platform.

The result is a framework that supports modern application development while remaining directly executable in the browser.

```html
<script>
    import { signal } from "core";

    export default function() {
        const [count, setCount] = signal(0);
    }
</script>

<button on:click="() => setCount(count() + 1)">
    Count is: {{ count() }}
</button>
```

Although the example is small, it demonstrates several ideas that appear throughout Core:

* Components authored as HTML
* Fine-grained reactivity through signals
* Declarative templates
* Runtime compilation
* Browser-native execution

These concepts will be explored throughout the rest of the documentation.

---

## Why Core Exists

Core began as an attempt to answer questions about how frontend frameworks work.

Questions such as:

> How does a framework know what part of the UI to update?

> How does a template become executable code?

> How do conditional blocks know where to render?

> Why do frameworks compile code?

Over time those questions evolved into a framework.

Core is not an attempt to reject modern tooling.

Nor is it an attempt to replace every existing frontend workflow.

Instead, Core explores a different point in the design space while retaining many of the features developers expect from contemporary frameworks.

---

## Core's Design Goals

Core is built around a few core ideas:

### Browser-Native Development

Applications should be able to run directly in the browser using modern web standards.

### Fine-Grained Updates

When state changes, only the parts of the UI that depend on that state should update.

### Familiar Authoring Experience

Components should feel natural to write and resemble the structure of the web platform.

### Runtime Flexibility

Framework features should not be tied exclusively to build-time tooling.

### Progressive Optimization

Core can operate entirely in the browser, but additional optimizations can be layered on when desired.

---

## Not Just "No Build Step"

One of Core's most visible characteristics is that it can run without a mandatory build pipeline.

However, this is a consequence of its design rather than its primary goal.

---

## Who Is Core For?

Core is designed for developers who enjoy understanding how the web works and want a framework that stays close to the browser platform.

You may enjoy Core if you:

* Prefer browser-native development
* Want to learn how modern frameworks work internally
* Build applications without relying heavily on build tooling
* Enjoy experimenting with web platform capabilities
* Need fine-grained reactivity without a virtual DOM
* Want a framework that can scale from small widgets to larger applications

Core is particularly well suited for:

* Internal tools and dashboards
* Single-Page Applications
* Browser-native applications
* Progressive enhancement
* Educational projects
* Framework experimentation and research
* Component libraries

---

### Core May Not Be The Best Fit If

Core intentionally explores a different set of tradeoffs.

You may be better served by frameworks such as React, Vue, Angular, or Svelte if you primarily need:

* Large ecosystem support
* Extensive third-party component libraries
* Mature enterprise tooling
* Deep TypeScript integration
* Established hiring pools and community resources
* Maximum build-time optimization

These are areas where more mature ecosystems currently have an advantage.

--- 

## Single-File Components

Single-File Components (SFCs) are the primary way of authoring user interfaces in Core.

An SFC combines a component's template (HTML), logic (JavaScript), and optional styling (CSS) into a single `.html` file.

```html
<script>
    import { signal } from "core";

    export default function() {
        const [count, setCount] = signal(0);
    }
</script>

<style>
    button {
        padding: 0.5rem 1rem;
    }
</style>

<button on:click="() => setCount(count() + 1)">
    Count is: {{ count() }}
</button>
```

By keeping everything related to a component in one place, SFCs make components easier to develop, understand, and share.

Unlike many frameworks, Core Single-File Components does not require a build step.

---

# Quick Start

## Creating a Core Application

In this section we will introduce how to scaffold a Core Single Page Application on your local machine.

Throughout the rest of the documentation, we will be primarily using ES modules syntax.

```html
<!-- index.html -->
<html>
    <head>
        <title>Quick Start Core Application</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">    
        <script type="importmap">
          {
            "imports": {
                "core": "https://cdn.jsdelivr.net/gh/icevelez/Core@master/core/runtime.js",
                "core-compiler": "https://cdn.jsdelivr.net/gh/icevelez/Core@master/core/compiler.js"
            }
          }
        </script>
        <script type="module">
            import { init } from "core";
            init();
        </script>
    </head>
    <body>
        <div>
            <template core-src="./src/App.html"></template>
        </div>
    </body>
</html>
```

```html
<!-- App.html -->
<script>
    import { signal } from "core";
    
    export default function() {
        const [count, setCount] = signal(0);
        const [name, setName] = signal("New User");
    }
</script>

<h1>Greetings! {{ name() }}</h1>
<input type="text" :value="name()" on:input="(e) => setName(e.target.value)"/>
<button on:click="() => setCount(count()+1)">
    Count is: {{ count() }}
</button>
```

> [!NOTE]
> In our example we are using [**importmap**](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap) to give Core's URL an alias to shorten our import statements
>
> The import map in this example is not restricted to the CDN version of Core. It can just as easily be configured to reference a local copy of Core or a self-hosted server build. This makes Core flexible across different environments, as switching between CDN and local development setups only requires updating the import map, not the application code itself.

> [!IMPORTANT]
> This example must be run through a local or remote web server.
>
> Modern browsers restrict ES modules and import maps when opening files directly via `file://`.
>
> You can use any web server of your choice, such as:
>
> - NGINX / Apache / IIS
> - Node.js (`npx serve`, `npx live-server`)
> - Bun (`bunx serve`, `bunx live-server`)
> - Python (`python -m http.server`)
> - Laravel / Django / Flask / Express / Go / Rust servers
> - VSCode live server extension
>
> Once served over `http://` or `https://`, the example will work normally in the browser.

--- 

### What's Next?

You've now seen what Core is, how a Core application is structured, and how to get your first application running in the browser.

The next step is to work through the **Essentials** guide, where you'll learn the fundamental building blocks used in every Core application:

* Creating and mounting a Core application
* Template syntax and interpolation
* Signals and reactive state
* Derived values
* Event handling
* Form input bindings
* Effects and reactive side effects
* Composable behavior
* Components and component composition
* Component lifecycle hooks
* Context and dependency sharing

The Essentials guide is designed to be read in order, with each chapter building on concepts introduced earlier.

Once you've completed Essentials, you'll have everything needed to build complete applications with Core and will be ready to explore more advanced topics throughout the rest of the documentation.

> **Next:** Continue to the **Essentials** folder and start with **01. Creating An Application**.
