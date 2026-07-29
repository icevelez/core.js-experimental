/**
* @template {any} T
*/
class ValidType {

    /**
    * array of callbacks to validate custom type
    * @type {Set<(_:T) => void>}
    */
    #callbacks = new Set();
    #is_optional = false;

    /**
    * @param {((_:T) => void)[]} args
    */
    #addCallbacks = (...args) => {
        for (let i = 0; i < args.length; i++) {
            if (typeof args[i] !== "function") throw new TypeError(`args[${i}] is not a function`);
            this.#callbacks.add(args[i])
        }
    };

    /**
    * @param  {((_:T) => void)[]} args
    */
    constructor(...args) {
        this.#addCallbacks(...args);
    }

    /**
    * return void if passed, throw an error if not
    * @param {(input:T) => void} callback
    */
    pipe(callback) {
        if (typeof callback !== "function") throw new TypeError("callback is not a function");
        this.#callbacks.add(callback);
        return this;
    }

    optional() {
        this.#is_optional = true;
        return this;
    }

    /**
    * @param {T} input
    */
    validate(input) {
        if (this.#is_optional && (input === null || input === undefined)) return;

        try {
            for (const callback of this.#callbacks) callback(input);
        } catch (error) {
            return `${error.toString()}`;
        }
    }

    /**
    * Access internal function for whatever purpose you see fit.
    * I used it to make it easier to implement `union()`
    */
    raw() {
        return {
            addCallbacks: this.#addCallbacks,
            callbacks: this.#callbacks,
            is_optional: this.#is_optional,
        }
    }
}

/**
* @type {() => ValidType<number>}
*/
export const number = () => new ValidType((i) => {
    if (!isNaN(i) && (i >= 0 || i <= 0) && typeof i === "number") return;
    throw new TypeError("not a number");
});

/**
* @type {() => ValidType<string>}
*/
export const string = () => new ValidType((i) => {
    if ((i || i === "") && typeof i === "string") return;
    throw new TypeError("not a string");
});

/**
* @type {() => ValidType<Boolean>}
*/
export const boolean = () => new ValidType((i) => {
    if (i && typeof i === "boolean") return;
    throw new TypeError("not a boolean");
});

/**
* @type {() => ValidType<Function>}
*/
export const func = () => new ValidType((i) => {
    if (i && typeof i === "function") return;
    throw new TypeError("not a function");
});

/**
* @type {() => ValidType<Date>}
*/
export const date = () => new ValidType((i) => {
    if (typeof i === "string") i = new Date(i);
    if (i.toDateString() !== "Invalid Date" && i instanceof Date) return;
    throw new TypeError("not an instance of \"Date\"");
});

/**
* @template {any} T
* @param {ValidType<T>} type
* @returns {ValidType<T[]>}
*/
export const array = (type) => {
    if (!(type instanceof ValidType)) throw new Error("input parameter is not an instance of \"ValidType\"");
    return new ValidType((a) => {
        if (a && Array.isArray(a) && a.every((a1) => typeof type.validate(a1) !== "string")) return;
        throw new TypeError("input is an invalid array")
    });
}

/**
* @template {any} K
* @template {any} T
* @param {ValidType<T>} type
* @returns {ValidType<Record<K, T>>}
*/
export const record = (type) => {
    if (!(type instanceof ValidType)) throw new Error("input parameter is not an instance of \"ValidType\"");
    return new ValidType((r) => {
        if (!r) throw new TypeError("input is an invalid record type")
        for (const key in r) {
            const error = type.validate(r[key])
            if (error) throw new TypeError(error);
        }
    });
}

const VALID_TYPE_OBJECT = Symbol("valid_type_object");

/**
* @template {any} T
* @param {{ [K in keyof T]: ValidType<T[K]> }} schema
* @returns {ValidType<{ [K in keyof T]: T[K] }>}
*/
export function object(schema) {
    const validType = new ValidType((data) => {
        const schema_keys = new Set(Object.keys(schema));
        for (let key in data) {
            if (schema_keys.has(key)) schema_keys.delete(key);
            if (!(schema[key] instanceof ValidType)) throw new Error(`schema at property "${key}" is not an instance of \"ValidType\"`);
            if (!schema[key]) throw new TypeError(`object property "${key}" is not in part of the schema defintion`);
            const has_error = schema[key].validate(data[key]);
            if (has_error) throw new TypeError(`"${key}" ${has_error}`);
        }
        if (schema_keys.size > 0) throw new TypeError(`object has missing property. ${JSON.stringify(Array.from(schema_keys))}`);
        return null;
    })
    validType[VALID_TYPE_OBJECT] = schema;
    return validType;
};

/**
 * @template {any} T
 * @param {Array<T>} array
 * @returns {ValidType<T extends ValidType<infer U> ? U : never>}
 */
export function union(array) {
    if (!Array.isArray(array)) throw new TypeError("input is not an array");
    if (!array.some((i) => i instanceof ValidType)) throw new TypeError("some type are not valid ValidType");
    const union = new ValidType();
    for (const type of array) union.raw().addCallbacks(type.raw().callbacks);
    return union;
}

/**
 * @template {any} T
 * @param {{ [K in keyof T]: ValidType<T[K]> }} schema
 * @param {any} object
 * @returns {{ [K in keyof T]: T[K] }}
 */
export function asserted_object(schema, object) {
    if (!schema[VALID_TYPE_OBJECT]) throw new TypeError("schema is not an ValidType<object>");
    const target_schema = schema[VALID_TYPE_OBJECT];

    const error = schema.validate(object);
    if (error) throw new Error(error);

    return new Proxy(object, {
        get(target, key) {
            if (!target_schema[key]) throw new Error(`property "${key}" is not defined in the schema`);
            return target[key];
        },
        set(target, key, new_value) {
            if (!target_schema[key]) throw new Error(`property "${key}" is not defined in the schema`);

            const error = target_schema[key].validate(new_value);
            if (error) throw error;

            target[key] = new_value;

            return true;
        }
    })
}

/**
 * @template {any} T
 * @template {any} K
 * @param {ValidType<T>} schema
 * @param {(input:T, error?:string) => K} func
 */
export function asserted_function(schema, func) {
    return function (/** @type {T} */ input) {
        const error = schema.validate(input);
        if (error) return func(null, error);
        return func(input, null);
    }
}
