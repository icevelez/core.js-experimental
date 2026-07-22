# ValidType Library (`validtype.js`)

## Introduction

`ValidType` is a runtime validation library for JavaScript.

It provides:

- primitive validators
- object schema validation
- array validation
- record validation
- union types
- optional fields
- proxied asserted objects
- composable validation pipelines

The library is inspired by schema validators such as:

- Zod
- Yup
- Joi

while remaining extremely lightweight.

---

# Installation

```js
import {
    number,
    string,
    boolean,
    date,
    func,
    array,
    record,
    object,
    union,
    asserted_object
} from 'https://github.com/icevelez/Core/blob/master/lib/validtype.js';
```

or with importmaps

```html
<script type="importmap">
    {
        "imports": {
            "validtype": "https://github.com/icevelez/Core/blob/master/lib/validtype.js"
        }
    }
</script>
```
```js
import {
    number,
    string,
    boolean,
    date,
    func,
    array,
    record,
    object,
    union,
    asserted_object
} from 'validtype';
```

> [!NOTE]
> The import map is not restricted to the CDN version. you can easily configure it to reference a local copy or a self-hosted build

---

# Primitive Validators

## Number

```js
const age = number();

console.log(age.validate(15));
// undefined

console.log(age.validate('15'));
// TypeError: not a number
```

---

## String

```js
const username = string();
```

---

## Boolean

```js
const enabled = boolean();
```

---

## Function

```js
const callback = func();
```

---

## Date

```js
const birthday = date();

birthday.validate(new Date());
birthday.validate('2026-01-01');
```

---

# Optional Values

Use `.optional()` to allow `null` or `undefined`.

```js
const nickname = string().optional();
```

---

# Validation Pipelines

Use `.pipe()` to add custom validation.

```js
const password = string().pipe((value) => {
    if (value.length < 8) {
        throw new Error('password too short');
    }
});
```

---

# Arrays

## `array(type)`

```js
const stringArray = array(string());

stringArray.validate(['a', 'b', 'c']);
```

---

# Records

## `record(type)`

Validates object values.

```js
const scores = record(number());

scores.validate({
    math: 90,
    science: 85
});
```

---

# Objects

## `object(schema)`

Creates structured object validation.

```js
const UserSchema = object({
    name: string(),
    age: number(),
    email: string().optional()
});
```

---

## Object Validation Example

```js
const result = UserSchema.validate({
    name: 'John',
    age: 20
});

console.log(result);
```

---

# Union Types

## `union(types)`

Allows multiple valid types.

```js
const id = union([
    string(),
    number()
]);

id.validate(15);
id.validate('abc');
```

---

# Asserted Objects

## `asserted_object(object, schema)`

Creates a proxied object that enforces runtime validation.

```js
const schema = object({
    name: string(),
    age: number()
});

const user = asserted_object({
    name: 'John',
    age: 25
}, schema);
```

---

## Runtime Property Enforcement

```js
user.age = 30;

user.age = 'hello';
// throws error
```

---

## Unknown Property Protection

```js
user.address = 'Earth';
// throws error
```

---

Yes. I would add it as a new major section after **Asserted Objects**, since conceptually it belongs to the same family of "runtime enforcement" APIs.

---

# Asserted Functions

## `asserted_function(schema, func)`

Creates a wrapper function that validates the input before executing the target function.

This is useful when you want to validate function arguments without manually calling `.validate()` each time.

```js
import {
    string,
    asserted_function
} from 'validtype';
```

---

## Basic Example

```js
const greet = asserted_function(
    string(),
    (name, error) => {
        if (error) {
            console.error(error);
            return;
        }

        console.log(`Hello ${name}`);
    }
);

greet('John');
// Hello John
```

---

## Validation Failure

```js
greet(123);
// TypeError: not a string
```

---

## Object Schema Example

```js
const UserSchema = object({
    name: string(),
    age: number()
});

const saveUser = asserted_function(
    UserSchema,
    (user, error) => {
        if (error) {
            console.error(error);
            return;
        }

        console.log('Saving user:', user.name);
    }
);

saveUser({
    name: 'John',
    age: 25
});
```

---

# Validation Return Behavior

The validator methods follow this convention:

- `undefined` → validation passed
- `string` → validation error

Example:

```js
const error = number().validate('hello');

if (error) {
    console.error(error);
}
```

---

# Internal Architecture

Each `ValidType` instance stores validation callbacks.

```js
#callbacks = new Set();
```

Validation is performed sequentially.

---

# Advanced Example

```js
const TodoSchema = object({
    title: string(),
    completed: boolean(),
    tags: array(string()).optional()
});

const todo = asserted_object({
    title: 'Learn ValidType',
    completed: false,
    tags: ['validation', 'javascript']
}, TodoSchema);


todo.completed = true;
```
