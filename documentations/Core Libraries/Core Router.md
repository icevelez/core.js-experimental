# Core Router (`core-router.js`)

## Introduction

The core router library is a lightweight hash-based client-side router.

It supports:

- route matching
- dynamic parameters
- wildcard routes
- query/search parameters
- programmatic navigation
- cached route patterns

The router uses URL hash fragments:

```txt
#/users/123
```

---

## Installation

```js
import { Router } from 'https://cdn.jsdelivr.net/gh/icevelez/Core@master/lib/core-router.js';
```

or with importmaps

```html
<script type="importmap">
    {
        "imports": {
            "router": "https://cdn.jsdelivr.net/gh/icevelez/Core@master/lib/core-router.js"
        }
    }
</script>
```
```js
import { Router } from 'core-router';
```

> [!NOTE]
> The import map is not restricted to the CDN version. you can easily configure it to reference a local copy or a self-hosted build

---

# Core Concepts

## Current Pathname

```js
Router.path_name
```

Example:

```txt
#/users/15
```

Result:

```js
'/users/15'
```

---

## Route Matching

### Static Routes

```js
Router.match('/about')
```

Returns:

```js
{
    is_match: true,
    params: {}
}
```

---

## Dynamic Route Parameters

You can define route parameters using `:paramName`.

```js
Router.match('/users/:id')
```

If current route is:

```txt
#/users/42
```

Result:

```js
{
    is_match: true,
    params: {
        id: '42'
    }
}
```

---

## Wildcard Routes

Wildcard routes capture everything after the route.

```js
Router.match('/docs/*')
```

Example:

```txt
#/docs/javascript/routing
```

Result:

```js
{
    is_match: true,
    params: {
        wildcard: 'javascript/routing'
    }
}
```

---

# Navigation

## `Router.goto(path, queryParams?)`

Programmatically navigate to another route.

```js
Router.goto('/dashboard');
```

---

## Navigation with Query Parameters

```js
Router.goto('/search', {
    toString() {
        return 'q=router&page=1';
    },
    size: 2
});
```

Resulting URL:

```txt
#/search?q=router&page=1
```

---

# Search Parameters

## Getting Search Parameters

```js
Router.search_parameter.get('page')
```

Example URL:

```txt
#/products?page=3
```

Result:

```js
'3'
```

---

## Setting Search Parameters

```js
Router.set_search_parameter('page', '5');
```

Result:

```txt
#/currentRoute?page=5
```

---

## Removing Search Parameters

```js
Router.remove_search_parameter('page');
```

---

# Path Parameters

The router also stores matched path parameters in:

```js
Router.path_parameter
```

Example:

```js
Router.match('/users/:id');

console.log(Router.path_parameter.get('id'));
```

---

# Internal Optimization

The router caches generated regular expressions.

```js
#cachePatterns = new Map();
```

This avoids rebuilding regex patterns every time `match()` is called.

---

# Example Router Usage

```js
if (Router.match('/').is_match) {
    console.log('Home page');
}

if (Router.match('/users/:id').is_match) {
    console.log('User ID:', Router.pathParams.get('id'));
}

if (Router.match('/docs/*').is_match) {
    console.log('Wildcard route');
}
```
