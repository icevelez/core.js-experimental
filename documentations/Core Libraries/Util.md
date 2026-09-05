# Utility Library (`util.js`)

## Introduction

`util.js` is a collection of lightweight browser-side utility helpers.

The library includes:

* async timing helpers
* function debouncing
* image compression
* Base64 image conversion
* HTML printing
* deduplicated fetch requests

The utilities are framework-agnostic and designed for small frontend applications.

---

# Installation

```html
<script type="importmap">
    {
        "imports": {
            "util": "https://cdn.jsdelivr.net/gh/icevelez/Core@master/lib/util.js"
        }
    }
</script>
```
```js
import {
    delay,
    debounce,
    compress_image,
    base64_image_to_blob,
    print,
    query
} from 'util';
```

> [!NOTE]
> The import map is not restricted to the CDN version. you can easily configure it to reference a local copy or a self-hosted build

---

# `delay(ms)`

An async version of `setTimeout`.

## Example

```js
console.log('start');

await delay(1000);

console.log('1 second later');
```

---

# `debounce(fn, debounce_ms)`

Creates a debounced version of a function.

The wrapped function only executes after no calls have occurred for the specified duration.

Useful for:

* search inputs
* resize events
* scroll handlers
* API requests

---

## Example

```js
const search = debounce((value) => {
    console.log('Searching:', value);
}, 300);

input.addEventListener('input', (e) => {
    search(e.target.value);
});
```

---

# `compress_image(blobImage, options)`

Compresses an image into a smaller image format.

Default output type:

```txt
image/webp
```

---

## Options

```js
{
    quality: 0.4,
    max_size: 500,
    image_type: 'image/webp'
}
```

### `quality`

Compression quality from:

```txt
0.0 → 1.0
```

Default:

```txt
0.4
```

---

### `max_size`

Maximum image width/height.

The image automatically scales proportionally.

Default:

```txt
500px
```

---

### `image_type`

Output image MIME type.

Examples:

```js
'image/webp'
'image/jpeg'
'image/png'
```

---

## Example

```js
const compressed = await compress_image(file, {
    quality: 0.6,
    max_size: 800,
    image_type: 'image/webp'
});

const blob = await compressed.blob();
const base64 = compressed.string();
```

---

## Returned Object

```js
{
    blob: () => Promise<Blob>,
    string: () => string
}
```

---

## Notes

The function internally uses:

* `createImageBitmap()`
* `<canvas>` rendering
* `canvas.toBlob()`

This utility only works in browser environments.

---

# `base64_image_to_blob(base64_image)`

Converts a Base64 image string into a `Blob`.

---

## Example

```js
const blob = base64_image_to_blob(base64String);
```

Useful when:

* uploading Base64 images
* converting canvas output
* preparing files for `FormData`

---

# `print(element, transform_fn)`

Prints an HTML element using an isolated iframe.

The utility automatically copies:

* `<style>` tags
* `<link rel="stylesheet">`

from the current document head.

This helps preserve styling during printing.

---

## Basic Example

```js
print(document.querySelector('#invoice'));
```

---

## Advanced Example

```js
print(document.querySelector('#invoice'), async (iframe) => {
    const doc = iframe.contentDocument;

    const style = doc.createElement('style');
    style.textContent = `
        body {
            padding: 20px;
        }
    `;

    doc.head.append(style);
});
```

---

## Notes

The print utility:

* creates a hidden iframe
* injects HTML into `srcdoc`
* waits for iframe load
* calls `window.print()`
* removes the iframe afterward

---

# `query(url, options, response_transform)`

A deduplicated fetch helper.

If multiple requests are made simultaneously with the same:

* URL
* fetch options

only one network request is executed.

All callers receive the same Promise.

---

## Example

```js
const users = await query('/api/users', {}, (res) => res.json());
```

---

## Parallel Request Deduplication

```js
const a = query('/api/data');
const b = query('/api/data');

console.log(a === b);
// true
```

---

## Internal Behavior

The utility stores in-flight requests in:

```js
const fetch_inflight = new Map();
```

Once the request resolves or rejects, the cache entry is removed.
