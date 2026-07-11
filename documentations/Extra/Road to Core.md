# The Road to Core

## 2021 — HTML.js

Core did not begin as a framework.

It started with a simple helper library called **HTML.js** (later renamed **ezHTML**).

At the time, I wanted a more convenient way to build DOM structures without repeatedly writing `document.createElement()` and manually appending children.

The API looked something like:

```js
html.create("div", {}, [
    html.create("h1", "Hello World"),
    html.create("p", "Paragraph")
]);
```

The goal was simple:

> Make creating DOM trees easier.

And for that purpose, it worked.

I eventually used HTML.js to build several internal projects, including the Franchising System and OneAuth.

What I didn't realize at the time was that HTML generation was only a small part of the problem.

Building the UI was easy.

Keeping the UI synchronized with state was the real challenge.

---

## 2022 — Angular and New Questions

Around this time, I showed HTML.js and the SPA approach I used in the Franchising System to our team leader

Eventually our development team began discussing frontend frameworks. the team was torn between React and Angular but decided to standardize on Angular due to its background with enterprise web applications.

Suddenly we were introduced to concepts I had never encountered before:

* RxJS
* Observables
* Dependency Injection
* TypeScript
* Bundlers
* Compilers

The technology was impressive.

The problem was that I had no idea how any of it actually worked.

Angular felt like magic.

I kept asking questions:

> How does Angular know to update an `<h1>` when I change a variable?

> How does Angular know that a property in a `.ts` file belongs to an expression in an `.html` file?

> Why do we need dependency injection?

> Why do we need modules?

But the biggest question was:

> Why do we need to compile our project?

Because before Angular, we had already built multiple systems without any build step.

The Veterinary System was written with jQuery.

The IT Ticketing System and HRMIS were built without a modern frontend toolchain.

The Franchising System itself was built without a CLI.

So Angular solved many problems, but it introduced questions I couldn't answer.

---

## OneAuth and My First Attempt at Reactivity

During discussions about RxJS and Observables, I began understanding that Angular wasn't updating the DOM randomly.

It was reacting to state changes.

That idea inspired me to build my own solution.

I started experimenting with getter/setter patterns.

Conceptually:

```js
get()
set()
```

Every update triggered rendering.

This became part of OneAuth.

The result worked, but it was crude.

It caused memory leaks.

It rerendered entire sections of the DOM.

Performance was poor.

Still, it was the first time I understood that frameworks were really solving a state synchronization problem.

---

## Discovering Svelte

Eventually I wanted something simpler, something that felt natural as if I was writing normal HTML that's when I encountered Svelte.

For the first time, a framework felt intuitive.

Everything lived together:

```html
<script>
    let name = "John";
</script>

<h1>Hello {name}</h1>
```

The relationship between state and template finally made sense.

Unlike Angular, where the component and template were separate files, Svelte placed them together.

That answered one of my biggest Angular questions:

> How does a variable know which template expression it belongs to?

The compiler could see both.

The explanation was simple.

The compiler did the work.

Even Svelte's assignment-based reactivity:

```js
name = "Mary";
```

felt magical at first.

But the explanation was satisfying:

The compiler inserts the necessary update logic automatically.

This was essentially the same idea I had manually implemented in OneAuth.

The difference was that Svelte automated it.

I became fascinated by its simplicity, small bundle size, and fast compilation.

---

## Anchor.js

While using Svelte, another question appeared:

> How does Svelte know where to render?

Specifically:

```html
<h1>Start</h1>

{{#if show}}
<p>Shown</p>
{{:else}}
<p>Hidden</p>
{{/if}}

<h1>End</h1>
```

How does the framework know where that conditional block belongs?

How does it know where to insert and remove content?

Trying to answer that question led to Anchor.js.

The solution I discovered was surprisingly simple:

Invisible text nodes. Anchors. Render points.

The framework could insert content relative to these anchor nodes.

That realization solved a problem that had been bothering me for months.

Anchor.js eventually supported:

* Conditional rendering
* Loop rendering
* Todo examples

But it was still rough.

Performance depended heavily on how developers wrote code.

The authoring experience wasn't particularly pleasant.

I considered it an educational experiment rather than a real framework.

---

## 2023 — Prepro.js

In 2023 I started over again.

This time I focused on templating.

The question became:

> How do I preprocess template expressions before rendering?

Hence the name *Prepro*.js.

It attempted to process Handlebars-style syntax:

```html
{{ name }}
```

and integrate observables into the rendering process.

Angular heavily influenced its design.

RxJS heavily influenced its reactivity.

And for the first time, Angular's architecture started making sense.

I was downloading the html template via fetch and modifiying it at runtime. 

Just like what Angular does, only it does it at build time

I was beginning to understand why Angular's design existed.

---

## The Missing Years

Between 2023 and 2025, much of my learning happened through studying existing frameworks.

I spent time understanding:

* Vue 2 reactivity
* Angular Change Detection
* Angular Ivy
* React Reconciliation
* Virtual DOM systems
* Solid Signals

I repeatedly rewrote my reactive system.

What started as getter/setter patterns evolved into observables.

Then eventually into signals.

Each rewrite answered a question and revealed another.

---

## 2025 — The Beginning of Core

When I thought my written reactivity system was satisfying I thought why not integrate this reactivity with a renderer like Prepro?

I could use:

```js
effect(() => {
    // DOM set value (updates) 
});
// DOM insert
```

and allow dependency tracking to manage updates.

At that point, I had enough pieces to build a framework 

So I started building one.

---

## Core v0.1

I wanted a Svelte-like authoring experience.

I liked template expressions.

I liked block syntax.

But constructs such as:

```html
{{#if}}
{{#each}}
```

aren't valid HTML.

The browser cannot parse them.

That question led to:

* Template injection
* HTML graph processing
* Anchor-based rendering

Lessons from HTML.js, OneAuth, Anchor.js, and Prepro.js finally converged.

The result became Core v0.1.

---

## Optimization and Discovery

What followed was months of optimization.

Core v0.1 focused on proving concepts.

Core v0.1.5 introduced expression caching inspired from Petite Vue.

Core v0.1.6 introduced instruction collection via callbacks.

Core v0.1.8 replaced callback-based instructions with object-based instructions to reduce garbage collection pressure.

Core v0.2.0 introduced signal getters.

Core v0.2.1 introduced context hooks.

Core v0.2.X Many many fixes later 

Then came the biggest realization.

The runtime instructions Core collected looked remarkably similar to the compiled output generated by frameworks like Svelte.

That observation led directly to Core v0.3.0

Instead of replaying instructions, Core could generate static render functions from them.

For the first time, runtime analysis and compile-time optimization started converging.

Still, v0.3.0 had a weakness. It proved the idea, but it carrying more overhead than I wanted. it still used a cached version of `new Function(...keys, expression)(...values)` 

I took a break for a while, came back and rewrote Core from scratch again and named it `core-experimental` but it was really Core v0.4.0 

This was the version where I introduced the `$.` prefix as part of the authoring model. It made scope handling explicit, render function simpler, remove the need for `new Function()` shenanigans, but it also made templates feel unnatural and clunky

I also adopting a Single-File Component experience in v0.4.0 which was an experiment back in v0.3.0 

The `$.` prefix led to the next question:

> How do I make the authoring experience feel natural again?

The answer was to remove the `$.` prefix and make variable scope work properly.

I tried many things and most of them were failed ideas, I tried to make it work but either it was more work or had a DX degradation cost

then I realization came from using the SFC model

> *Why not just inject the render instruction under the user code when processing the SFC file?*

which means the template expression would be in the same lexical scope as the variables therefore there is no need for `$.` nor `new Function()` 

It worked and made the authoring experience feel natural again - at that point Core was a different beast which deserve a new updated version - Core v0.5.0

---

## Core Assist

Eventually I remembered what Evan You said "Runtime template compilation has a cost" it has slower initial load because the browser has to process the template, collect instruction, inject the render instruction in the JS module, then import said JS module

> Is there a way to mitigate the cost of runtime compilation in the browser? 

That led to Core Assist.

Core Assist was never intended to replace Core.

It was simply a cache layer 

A way to preserve generated modules and reuse them when source files had not changed.

if Core detects that Core Assist is active, Core would call Core Assis function to cache the compiled JS module and Core Assist would communicate to Core-Worker a Service Worker that would cache the JS module 

Upon page reload Core would check if Core Assist is active, if it is, it would call Core Assist to check if the requested Core component source file has not changed - if not, Core Assist would take over and import the file directly at which the service worker would intercept and return the cached Module like 

```js
import("Dashboard.html")
```

Service Worker intercepts and returns the cached JS module instead of HTML

---

## Beyond Components

That realization raised an even larger question.

If a Service Worker can transform HTML into JavaScript modules, why stop at components?

Why not:

```js
import data from "./users.xml";
```

or:

```js
import users from "./users.csv";
```

or:

```js
import article from "./post.md";
```

The Service Worker could transform these resources into modules before they ever reached JavaScript.

At that point the question led to a new rabbit hole
