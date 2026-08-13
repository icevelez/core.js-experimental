/** @typedef {(props:Record<string, any>) => (() => void)} CoreComponent the function that wraps both the data and render function */

/** @typedef {{ fns : string[], exprs : string[] }} IfBlock */
/** @typedef {{ fn : string, empty_fn : string, expr : string, key : string, keys?: string[], index_key?:string }} EachBlock */
/** @typedef {{ pending_fn:string, then_fn?: string, then_key?:string, catch_fn?: string, catch_key?:string, expr : string }} AwaitBlock */
/** @typedef {{ props : Record<string, string>, dynamic_props : { key:string, expr : string }[] }} PropsBlock */
/** @typedef {Record<string, CoreComponent>} ComponentBlock */

/** @typedef {IfBlock | EachBlock | AwaitBlock | PropsBlock | CoreComponent} BlockCache */

/** @type {any | null} */
let arg_global = null;

export const CORE = Object.freeze({
    version: "0.5.0",
    show_anchor_blocks : true, // flag to use comment node instead of text node as anchor, good for debugging
    PRP_STATE: Symbol(),
    MOUNT_FNS: Symbol(),
    IS_MOUNTED: Symbol(),
    DESTROY_FNS: Symbol(),
    defer_mounting,
    on_mount,
    run_mount_fns,
    run_destroy_fns,
    effect,
    set_new_context,
    create_new_context,
    /** @type {DocumentFragment[]} */
    fragment_cache: [],
    /** @type {Map<string, BlockCache[]>} */
    block_cache: new Map(),
    /** @type {{ [key:string] : Boolean }} */
    delegated_events: Object.create(null),
    /**
     * Converts string to Document Fragment
     * @param {string} html_string
     */
    html: function (html_string) {
        const template = document.createElement("template");
        template.innerHTML = html_string;
        return template.content;
    },
    /**
     * @param {Node} node
     * @param {string} text
     */
    set_text: function (node, text) {
        if (node.__cacheText === text) return;
        node.__cacheText = node.textContent = text;
    },
    get_param_args: function () {
        const args = arg_global;
        arg_global = null;
        return args;
    },
    set_param_args: function (...args) {
        arg_global = args;
    },
    /**
     * @param {Node} node
     * @param {any} value
     * @param {string} property
     */
    set_attr: function (node, value, property) {
        if (!node.__cacheAttr) node.__cacheAttr = Object.create(null);
        if (node.__cacheAttr[property] === value) return;
        node.__cacheAttr[property] = value;

        if (property === "value") {
            node.value = value;
        } else if (property === "checked") {
            node.checked = value === "true" || value === true;
            node.setAttribute(property, node.checked ? "" : value);
        } else if (value === "false" || !value) {
            node.removeAttribute(property);
        } else {
            node.setAttribute(property, value === "true" ? "" : value);
        }
    },
    /**
     * @param {string} event_name
     * @param {Node} node
     * @param {Function} func
     * @returns {() => void} remove event
     */
    delegate: function (event_name, node, func) {
        if (typeof func !== "function") throw new Error("[Core runtime]: Event delegation error! function is not a function");

        if (!CORE.delegated_events[event_name]) {
            window.addEventListener(event_name, (e) => match_delegated_node(e, e.target, event_name));
            CORE.delegated_events[event_name] = true;
        }

        if (!node.__events) node.__events = { [event_name] : [] };
        if (!node.__events[event_name]) node.__events[event_name] = [];
        node.__events[event_name].push(func);
    },
    /**
     * @param {Node} parentNode
     * @param {Node} startNode
     * @param {Node} endNode
     */
    remove_nodes: function (parentNode, startNode, endNode) {
        if (!parentNode) throw new Error("[Core runtime]: Clean up error! Parent node not found");

        if (startNode === endNode) {
            parentNode.removeChild(startNode);
            return;
        }

        let node = startNode;
        while (node && node !== endNode) {
            const next = node.nextSibling;
            parentNode.removeChild(node);
            node = next;
        }

        parentNode.removeChild(endNode);
    },
    /**
     * Returns a function to dispose DOM nodes and reactive bindings
     * @param {Node} anchor
     * @param {(() => Boolean)[]} condition_fns
     * @param {(() => (() => void))[]} fns
     */
    if: function (anchor, condition_fns, fns) {
        const fragment = document.createDocumentFragment();

        let prev_fn, dispose;

        const effect_dispose = CORE.effect(() => {
            let curr_fn;

            for (let i = 0; i < condition_fns.length; i++) {
                if (!condition_fns[i]()) continue;
                curr_fn = fns[i];
                break;
            }

            if (prev_fn === curr_fn) return;
            prev_fn = curr_fn;

            if (dispose) dispose();
            if (!curr_fn) return;

            try {
                CORE.set_param_args(fragment);
                dispose = curr_fn();
                anchor.before(fragment);
                run_deferred_mount_fns();
            } catch (error) {
                console.error("[Core runtime]: {{#if}} block render error\n", error);
            }
        }, { track_inner_effect: false })

        return () => {
            dispose();
            effect_dispose();
        }
    },
    /**
     * Returns a function to dispose DOM nodes and reactive bindings
     * @param {Node} anchor
     * @param {() => any[]} arr_fn
     * @param {() => (() => void)} then_fn
     * @param {() => (() => void)} else_fn
     */
    each: function (anchor, arr_fn, then_fn, else_fn) {
        let else_block_dispose_fn = null;
        let existing_dispose_blocks = [];

        const fragment = document.createDocumentFragment();
        const start_node = CORE.show_anchor_blocks ? new Comment("each-block-start") : new Text(" ");
        anchor.before(start_node);

        const effect_dispose = CORE.effect(() => {
            try {
                const arr = arr_fn();

                if (!arr || arr?.length <= 0) {
                    if (existing_dispose_blocks.length > 0) {
                        const parent_node = anchor.parentNode;
                        CORE.remove_nodes(parent_node, start_node.nextSibling, anchor.previousSibling);
                    }

                    for (const dispose of existing_dispose_blocks) dispose();
                    existing_dispose_blocks.length = 0;

                    if (!else_fn || else_block_dispose_fn) return;
                    CORE.set_param_args(fragment);
                    else_block_dispose_fn = each_block.else_fn();
                    anchor.before(fragment);
                    run_deferred_mount_fns();
                    return;
                }

                if (else_block_dispose_fn) {
                    else_block_dispose_fn()
                    else_block_dispose_fn = null;
                }

                const new_each_dispose_blocks = [];

                const is_array = Array.isArray(arr);
                const is_map = arr instanceof Map;

                let i = -1;
                for (const ar of arr) {
                    i++;

                    if (existing_dispose_blocks[i]) {
                        new_each_dispose_blocks.push(existing_dispose_blocks[i]);
                        continue;
                    }

                    CORE.set_param_args(fragment);
                    const index = i; // snapshot of i
                    const dispose = then_fn(is_array ? (() => arr[index]) : is_map ? (() => arr.get(ar)) : () => ar, index);
                    new_each_dispose_blocks.push(dispose);
                }

                // TEAR DOWN BLOCKS THAT ARE BEYOND THE NEW ARRAY LENGTH
                for (let i = new_each_dispose_blocks.length; i < existing_dispose_blocks.length; i++) {
                    existing_dispose_blocks[i]();
                }

                if (new_each_dispose_blocks.length > 0) {
                    anchor.before(fragment);
                    run_deferred_mount_fns();
                }

                existing_dispose_blocks = new_each_dispose_blocks;
            } catch (error) {
                console.error("[Core runtime]: {{#each}} block render error\n", error);
            }
        }, { track_inner_effect: false })

        return () => {
            if (else_block_dispose_fn) else_block_dispose_fn();
            else_block_dispose_fn = null;
            for (const dispose of existing_dispose_blocks) dispose();
            existing_dispose_blocks.length = 0;
            effect_dispose();
        }
    },
    /**
     * Returns a function to dispose DOM nodes and reactive bindings
     * @param {Node} anchor
     * @param {() => Promise<any>} await_fn
     * @param {() => (() => void)} pending_fn
     * @param {() => ((value:any) => void)} then_fn
     * @param {() => (() => void)} catch_fn
     */
    await: function (anchor, await_fn, pending_fn, then_fn, catch_fn) {
        let pending_dispose_fn;
        let dispose_fn;
        let last_id;

        const dispose = () => {
            if (pending_dispose_fn) {
                pending_dispose_fn();
                pending_dispose_fn = null;
            }

            if (dispose_fn) {
                dispose_fn();
                dispose_fn = null;
            }
        }

        const fragment = document.createDocumentFragment();
        const context = create_new_context();

        const effect_dispose = CORE.effect(() => {
            const promise = new Promise(async (resolve) => { try { resolve([await await_fn(), null]) } catch (error) { resolve([null, error]); } });
            const curr_id = Math.random();
            last_id = curr_id;

            if (!(promise instanceof Promise)) {
                CORE.set_param_args(fragment);
                dispose_fn = then_fn(promise);
                anchor.before(fragment);
                run_deferred_mount_fns();
                return dispose_fn;
            }

            CORE.set_param_args(fragment);
            pending_dispose_fn = pending_fn();
            anchor.before(fragment);
            run_deferred_mount_fns();

            promise.then(([value, error]) => {
                if (last_id !== curr_id) return;

                const old_context = set_new_context(context);
                CORE.set_param_args(fragment);

                if (error && catch_fn) dispose_fn = catch_fn(error);
                else if (error) console.error("[Core runtime]: {{#await}} block render error\n", error);
                else dispose_fn = then_fn(value);

                set_new_context(old_context);

                pending_dispose_fn();
                pending_dispose_fn = null;
                anchor.before(fragment);
                run_deferred_mount_fns();
            })

            return dispose;
        }, { track_inner_effect: false });

        return () => {
            dispose_fn();
            effect_dispose();
            set_new_context(context);
        }
    },
    /**
     * Returns a function to dispose DOM nodes and reactive bindings
     * @param {Node} anchor
     * @param {Function | { default : Function }} fn
     * @param {any} props
     * @param {Function} slot_fn
     */
    core_component: function (anchor, fn, props, slot_fn) {
        const fragment = document.createDocumentFragment();
        CORE.set_param_args(fragment, slot_fn);
        const dispose = (fn.default ? fn.default : fn)(props);
        anchor.before(fragment);
        return dispose;
    },
    resolve_components: async function (id) {
        const component_promises = current_component_promises;
        current_component_promises = null;
        const keys = Object.keys(component_promises || Object.create(null));
        const components = Object.create(component_promises || null);
        await Promise.all(keys.map(async (k) => { components[k] = await component_promises[k]; }));
        if (keys.length > 0) CORE.add_block_to_cache(id, components);
    },
    /** @type {(key:string, block:BlockCache) => void} */
    add_block_to_cache: function (key, block) {
        CORE.block_cache.set(key, block)
    },
})

/**
 * @param {Event} event
 * @param {Node} target
 * @param {string} event_name,
 */
function match_delegated_node(event, target, event_name) {
    const fns = target.__events ? target.__events[event_name] : null;
    if (!fns) return target.parentNode ? match_delegated_node(event, target.parentNode, event_name) : undefined;
    for (const fn of fns) fn(event);
}

/** @type {Map<string, (Promise<Function> | Function)>} */
const component_cache = new Map();

/**
 * @param {string} url
 * @returns {Promise<Function> | Function}
 */
export function component(url) {
    const full_url = (new URL(url.startsWith("http") ? url : `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`)).toString();
    if (component_cache.has(full_url)) return component_cache.get(full_url);

    const promise = new Promise(async (resolve, reject) => {
        const response = await fetch(url, { headers : { "x-core" : "core-component" }}); // the header is a tag for Core Server to look to indicate this resource can be compiled
        if (!response.ok) return reject(await response.text());

        const content_type = response.headers.get("content-type") || "";

        if (content_type === "application/javascript") {
            const text = await response.text();
            const script_blob = new Blob([text], { type: 'text/javascript' });
            const script_url = URL.createObjectURL(script_blob);
            const { $COMPONENT_ID, default: render_function } = await import(script_url);

            await CORE.resolve_components($COMPONENT_ID);

            resolve(render_function);
            return;
        }

        const [text, core_compiler] = await Promise.all([response.text(), import("core-compiler")]);
        const render_function = await core_compiler.component(text, full_url);

        component_cache.set(full_url, render_function);

        resolve(render_function);
    });

    component_cache.set(full_url, promise);

    return promise;
}

let current_component_promises;

export const define_components = (component_promises) => current_component_promises = component_promises;

window.__core__ = CORE;

// CONTEXT API

const root_context = Object.create(null);
let current_context = root_context;

function create_new_context() {
    return Object.create(current_context);
}

function set_new_context(context) {
    const old_context = current_context;
    current_context = context;
    return old_context;
}

export function set_context(key, value) {
    current_context[key] = value;
}

export function get_context(key) {
    return current_context[key];
}

// LIFECYCLE API

export async function init() {
    /** @type {Map<string, Function>} */
    const core_components = new Map();

    await Promise.all(Array.from(document.querySelectorAll("template[core-src]")).map(async (template, i) => {
        const src = template.getAttribute("core-src") || "";
        const id = template.id || "";
        if (!src) return;
        const component_instance = await component(src);
        core_components.set(id || i, mount(component_instance, template, true));
    }))

    return {
        components: core_components,
        dispose: () => {
            core_components.forEach((dispose) => dispose());
            core_components.clear();
        }
    };
}

/**
 * @param {CoreComponent} app
 * @param {HTMLElement} target
 * @param {Boolean} should_replace
 * @returns {() => void} dispose function
 */
export function mount(app, target, should_replace) {
    const fragment = document.createDocumentFragment();
    const context = create_new_context();
    context[CORE.MOUNT_FNS] = [];
    context[CORE.DESTROY_FNS] = [];

    set_new_context(context);
    CORE.set_param_args(should_replace ? fragment : typeof target === "string" ? document.querySelector(target) : target);

    const dispose = app();

    if (should_replace) {
        target.before(fragment);
        target.parentElement.removeChild(target);
    }

    context[CORE.IS_MOUNTED] = true;

    run_deferred_mount_fns();
    run_mount_fns(context);

    return () => {
        run_destroy_fns(context);
        dispose()
    };
}

const deferred_mount_fns = [];

function run_deferred_mount_fns() {
    if (!current_context[CORE.IS_MOUNTED]) return;
    for (const context of deferred_mount_fns) run_mount_fns(context);
    deferred_mount_fns.length = 0;
}

function defer_mounting(context) {
    deferred_mount_fns.push(context);
}

function run_mount_fns(context) {
    for (const fn of context[CORE.MOUNT_FNS]) {
        try {
            const destroy_fn = fn();
            if (typeof destroy_fn === "function") context[CORE.DESTROY_FNS].push(destroy_fn);
        } catch (error) {
            console.error("[Core lifecycle hooks]: mounting error\n", error);
        }
    }

    context[CORE.MOUNT_FNS].length = 0;
}

function run_destroy_fns(context) {
    for (const fn of context[CORE.DESTROY_FNS]) {
        try {
            fn();
        } catch (error) {
            console.error("[Core lifecycle hooks]: destroying error\n", error);
        }
    }

    context[CORE.DESTROY_FNS].length = 0;
}

export function on_mount(fn) {
    current_context[CORE.MOUNT_FNS].push(fn);
}

export function on_destroy(fn) {
    current_context[CORE.DESTROY_FNS].push(fn);
}


// REACTIVITY

/** @type {Function[]} */
let effect_stack = [];
/** @type {Function | null} */
let current_effect = null;

let dep_map = new WeakSet();
/** @type {Function[]} */
const prio_effect_queue = [];
/** @type {Function[]} */
const effect_queue = [];
/** @type {Function[]} */
const ticks = [];

let is_flushing = false;

export function next_tick() {
    return new Promise((resolve) => ticks.push(resolve));
}

/**
 * @param {Set<Function>} dep
 */
function track(dep) {
    if (!current_effect || dep.has(current_effect)) return;
    dep.add(current_effect);
    current_effect.deps.push(dep);
}

/**
 * @param {Set<Function>} dep
 */
function trigger(dep) {
    if (dep_map.has(dep)) return;
    for (const effect_fn of dep) (effect_fn.is_priority ? prio_effect_queue : effect_queue).push(effect_fn);
    dep_map.add(dep);

    if (is_flushing) return;
    is_flushing = true;

    queueMicrotask(() => {
        try {
            for (const fn of prio_effect_queue) fn();
            for (const fn of effect_queue) fn();
            for (const fn of ticks) fn();
        } catch (error) {
            console.error("[Core reactivity]: effect microtask execution error\n", effect_queue, error)
        } finally {
            prio_effect_queue.length = effect_queue.length = ticks.length = 0;
            is_flushing = false;
            dep_map = new WeakSet();
        }
    });
}

/**
 * @param {{ deps : Set<Function>, children : Set<Function> }[]} effect_fn
 */
function dispose_deps(effect_fn) {
    for (const dep of effect_fn.deps) dep.delete(effect_fn);
    effect_fn.deps.length = 0;

    for (const fn of effect_fn.children) fn();
    effect_fn.children.length = 0;
}

/**
 * Returns a dispose function for manually disposal of effect
 * @param {Function} fn
 * @param {{ track_inner_effect : boolean, is_priority : boolean }} options
 */
export function effect(fn, options = { track_inner_effect : true, is_priority : false }) {
    if (typeof fn !== "function") throw new Error("[Core reactivity]: effect callback is not a function");

    let dispose_fn = null;
    let active = true;      // flag to prevent effect re-run if already dispose

    const dispose = () => {
        if (typeof dispose_fn !== "function") return
        try {
            dispose_fn();
        } catch (error) {
            console.error("[Core reactivity]: effect cleanup error\n", fn, error);
        } finally {
            dispose_fn = null;
        }
    }

    const wrapped = () => {
        if (!active) return;

        dispose();
        dispose_deps(wrapped);

        effect_stack.push(wrapped);
        current_effect = wrapped;

        try {
            dispose_fn = fn();
        } catch (error) {
            console.error("[Core reactivity]: effect execution error\n", fn, error);
        } finally {
            effect_stack.pop();
            current_effect = effect_stack[effect_stack.length - 1] || null;
            if (current_effect?.track_inner_effect) current_effect.children.push(wrapped.dispose);
        }
    };

    wrapped.is_priority = options.is_priority;
    wrapped.track_inner_effect = options.track_inner_effect;

    /** @type {Set<Function>[]} */
    wrapped.deps = [];
    /** @type {Function[]} */
    wrapped.children = [];

    wrapped.dispose = () => {
        if (!active) return;
        active = false;
        dispose();
        dispose_deps(wrapped);
    };

    wrapped();

    return wrapped.dispose;
}

/**
 * @template {any} T
 * @param {T} initial_value
 */
export function signal(initial_value) {
    let value = initial_value;
    let container = null;
    let proxy = null;

    const dep = new Set();

    if (is_plain_object(initial_value)) {
        const is_proxy = initial_value[IS_PROXY];
        if (is_proxy) value = initial_value[CONTAINER].value;
        container = create_container(value, dep);
        proxy = create_proxy(container);
    }

    const read = () => {
        track(dep);
        return container ? proxy : value;
    }

    /**
     * @param {T} new_value
     */
    const set = (new_value) => {
        if (typeof new_value === "function") new_value = new_value(value);

        if (is_plain_object(new_value)) {
            const is_proxy = new_value[IS_PROXY];
            const real_value = is_proxy ? new_value[CONTAINER].value : new_value;

            value = null;

            if (!container) {
                container = create_container(real_value, dep);
            } else {
                container.value = real_value;
            }
            proxy = create_proxy(container);

            trigger(dep);
            if (container) for (const key in container.deps) trigger(container.deps[key]);

            return;
        }

        if (value === new_value) return;

        value = new_value;
        if (container) container.parent_dep = null;
        container = proxy = null;

        trigger(dep);
    }

    return [read, set];
}

export function memo(fn) {
    const [value, setValue] = signal();
    effect(() => setValue(fn()), { is_priority : true });
    return value;
}

/**
 * @template {any} T
 * @template {Record<string, (state:T, ...args:any[]) => (T | Promise<T>)> | (value:T) => (T | Promise<T>)} A
 *
 * @param {T} initial_value Initial state value.
 * @param {A} actions_or_refine_fn Object containing action functions or refine function that either or both validate and transform the data
 *
 * @returns {[
 *     () => T,
 *     () => any,
 *     () => boolean,
 *     (A instanceof Function ? (value:T) => void : {
 *         [K in keyof A]: (...args:Parameters<A[K]> extends [any, ...infer R] ? R : never) => (ReturnType<A[K]> extends Promise<any> ? Promise<void> : void)
 *     }),
 * ]}
 *
 * Returns:
 * 1. State getter
 * 2. Pending getter
 * 3. Error getter
 * 4. Bound actions or State setter
 */
export function managed_signal(initial_value, actions_or_refine_fn) {
    const [value, set_value] = signal(initial_value);
    const [error, set_error] = signal(null);
    const [pending, set_pending] = signal(false);

    if (typeof actions_or_refine_fn === "function") {
        const refine_fn = actions_or_refine_fn;
        const set_refine_value = (new_value) => {
            try {
                set_error(null);
                const result = refine_fn(typeof new_value === "function" ? new_value(value()) : new_value);
                if (result instanceof Promise) return result.then(v => set_value(v)).catch(e => set_error(e));
                set_value(result);
            } catch (error) {
                set_error(error);
            }
        }

        return [value, error, pending, set_refine_value];
    }

    const actions = actions_or_refine_fn;
    const action_keys = Object.keys(actions);
    const defined_actions = Object.create(actions);

    for (const key of action_keys) defined_actions[key] = function (...args) {
        try {
            const result = actions[key](value(), ...args);
            if (!(result instanceof Promise)) return set_value(result);
            set_pending(true);
            result.then((value) => {
                set_value(value);
                set_error(null);
                set_pending(false);
            }).catch(error => {
                set_error(error);
                set_pending(false);
            });
        } catch (error) {
            set_error(error);
        }
    }

    return [value, error, pending, defined_actions];
}

const array_mutation_keys = new Set(["push","pop","shift","unshift","splice","sort","reverse","fill","copyWithin"]);

const IS_PROXY = Symbol("proxy");
const CONTAINER = Symbol("container");

const is_plain_object = (v) => v && typeof v === 'object' && ((Object.getPrototypeOf(v) === null || Object.getPrototypeOf(v) === Object.prototype) || Array.isArray(v));

/** @typedef {ReturnType<typeof create_container>} Container */

function create_container(object, parent_dep) {
    return {
        value: object,
        parent_dep,
        deps: Object.create(null),
        child_containers: Object.create(null),
    };
}

/** @type {WeakMap<Object, Container>} */
const object_to_container = new WeakMap();
const handler = {
    get(target, key) {
        const container = object_to_container.get(target);

        if (key === IS_PROXY) return true;
        if (key === CONTAINER) return container;

        const value = container.value[key];
        const dep = container.deps[key] || (container.deps[key] = new Set());

        if (!is_plain_object(value)) {
            if (typeof value !== "function") {
                track(dep);
                return value;
            }

            if (!Array.isArray(target)) return value;

            // Trigger update when target is an array and is being mutated
            return (...args) => {
                const result = target[key](...args);

                if (!array_mutation_keys.has(key)) return result;

                trigger(dep);
                if (container.parent_dep) trigger(container.parent_dep);

                return result;
            }
        }

        track(dep);

        let child_container = container.child_containers[key];
        if (child_container) {
            if (child_container.value !== value) {
                child_container.value = value;
                child_container.proxy = create_proxy(child_container);
            }
            return child_container.proxy;
        }

        child_container = create_container(value);
        child_container.proxy = create_proxy(child_container);

        container.child_containers[key] = child_container;

        return child_container.proxy;
    },
    set(target, key, value) {
        const container = object_to_container.get(target);
        const dep = container.deps[key] || (container.deps[key] = new Set());

        if (target[key] === value) return true;

        target[key] = value;

        trigger(dep);

        return true;
    },
    deleteProperty(target, key) {
        const container = object_to_container.get(target);
        delete target[key];

        const dep = container.deps[key] || (container.deps[key] = new Set());
        trigger(dep);

        return true;
    }
}

/**
 * @param {Container} container
 */
function create_proxy(container) {
    object_to_container.set(container.value, container);
    return new Proxy(container.value, handler);
}

// DIRECTIVES

export function bind(node, [value, get, set]) {
    const event_name_dictionary = { "checked": node.type === "date" ? "change" : "click", "value": node.tagName === "select" ? "change" : "input" };
    CORE.delegate(event_name_dictionary[value], node, (e) => set(e.target[value]))
    return CORE.effect(() => node[value] = get());
}

export function html(node, arg) {
    return effect(() => { node.innerHTML = arg; })
}
