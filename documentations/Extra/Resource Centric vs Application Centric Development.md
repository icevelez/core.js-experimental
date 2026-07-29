# Resource-Centric vs Application-Centric Development

## Introduction

When building web applications, there are two very different ways to think about a frontend.

One treats the frontend as **an application**.

The other treats the frontend as **a collection of web resources**.

Neither approach is objectively better.

They simply optimize for different workflows and different scales.

Understanding this distinction explains many of Core's design decisions.

---

# Application-Centric Development

Modern frontend development has largely become application-centric.

Instead of the browser loading HTML pages that progressively gain behavior, the frontend itself becomes an application with its own lifecycle.

A typical workflow looks like this:

```
frontend/
    package.json
    vite.config.js
    src/
    node_modules/

backend/
    api/
```

The frontend has:

* its own dependency graph
* its own development server
* its own build pipeline
* its own deployment artifact

Development usually begins by creating an application.

```
npm create vite
npm install
npm run dev
```

The development server owns the frontend.

The backend communicates with it through HTTP.

```
Frontend
        │
        │ HTTP
        ▼
Backend API
```

This architecture has many advantages.

* Fast development experience
* Hot Module Replacement
* Rich plugin ecosystem
* Independent deployment
* Separate teams can work independently

This model has become the standard for React, Vue, Angular, Svelte, Solid, and many other frameworks.

---

# Resource-Centric Development

Core starts from a different assumption.

Instead of asking:

> "How do we create a frontend application?"

Core asks:

> "How do we serve web resources?"

Every component is simply another resource.

```
App.html

Dashboard.html

UserCard.html

Navbar.html
```

The browser already understands how to request resources.

Core simply extends that capability.

```
index.html
        │
        ▼
App.html
        │
        ├── Navbar.html
        ├── Sidebar.html
        └── Dashboard.html
```

There is no requirement that these resources belong to a separate frontend project.

They can live anywhere a web server can serve files.

---

# Existing Web Servers Become Frontend Servers

Because Core components are HTML resources, they fit naturally into existing web servers.

For example:

```
Apache

public/
    index.html
    App.html
    Dashboard.html
```

or

```
NGINX

html/
    index.html
    App.html
```

or

```
Laravel

public/
    index.html
    src/
        App.html
```

No frontend build output needs to be copied into these servers.

The resources themselves are what gets deployed.

---

# A Different Development Workflow

Instead of maintaining two independent projects:

```
frontend/
backend/
```

a Core application can live inside the same project as the backend.

```
project/

controllers/

routes/

views/

public/
    index.html
    src/
        App.html
```

The frontend becomes another part of the web application instead of another application that happens to communicate with it.

---

# Why Core Was Designed This Way

Core originally started as an experiment.

Could a modern frontend framework work directly inside the browser without requiring a build pipeline?

As the project evolved, another observation appeared.

Modern browsers already know how to download resources.

HTML. CSS. JavaScript. Images. Fonts.

Core components simply become another kind of resource.

Once viewed this way, many framework features become possible without introducing a mandatory application build process.

---

# Core Server 

[Core Server](https://github.com/icevelez/js-project#core-server) extends this resource-centric philosophy.

Instead of transforming an entire application into a production bundle, it optimizes each requested component independently.

For example:

```
GET /src/App.html
```

can become

```
Compile component

↓

Remove unused code

↓

Minify

↓

Inject server data

↓

Return optimized component
```

Notice what did **not** happen.

The application itself was never bundled.

The requested resource was simply optimized before being sent to the browser.

---

# Application-Centric Optimizations

Application-centric tooling usually operates on an entire dependency graph.

```
App

↓

Analyze imports

↓

Bundle

↓

Chunk

↓

Tree shaking

↓

Output
```

The optimization unit is the application.

---

# Resource-Centric Optimizations

Core Server operates differently.

```
Request

↓

Component

↓

Compile

↓

Optimize

↓

Return
```

The optimization unit is the resource.

Each component can be optimized independently.

---

# Choosing the Right Trade-offs

Neither model replaces the other.

Application-centric workflows excel when:

* building very large SPAs
* extensive npm ecosystems
* sophisticated build optimizations
* large frontend teams

Resource-centric workflows excel when:

* integrating into existing web servers
* embedding frontend into backend projects
* incremental adoption
* browser-native development
* deploying without a mandatory frontend build

Core intentionally explores the second design space.
