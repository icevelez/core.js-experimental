/** @typedef {{ id:number, args:any[], fn:string, fn_id:number }} Payload */

const worker_code = `
    const fn_register = new Map();

    self.onmessage = async (event) => {
        const { id, args, fn, fn_id } = event.data;

        try {
            if (!fn_register.has(fn_id)) fn_register.set(fn_id, new Function(\`return \${fn}\`)());
            const func = fn_register.get(fn_id);
            const result = await func(...args);
            self.postMessage({ id, result });
        } catch (error) {
            self.postMessage({ id, error: error.message });
        }
    };
`

const worker_blob = new Blob([worker_code], { type: 'text/javascript' });
const worker_url = URL.createObjectURL(worker_blob);

const MAX_WORKERS = navigator.hardwareConcurrency || 1;
const MAX_WORKER_LIFE = 1000 * 60 * 5; // 5 minutes;

/** @type {WorkerInstance[]} */
const workers = [];

/** @type {{ resolve:Function, reject:Function, payload: Payload }[]} */
const task_queue = [];

/** @type {Map<number, { resolve:Function, reject:Function }>} */
const pending = new Map();

let task_id = 0;
let func_id = 0;

class WorkerInstance {

    worker = new Worker(worker_url);
    busy = false;
    last_used = Date.now();
    timer = -1;

    constructor(){
        this.worker.onmessage = e => {
            const { id, result, error } = e.data;

            const task = pending.get(id);
            if (!task) return console.warn("[worker-pool]: task is undefined. skipping...");

            pending.delete(id);

            this.busy = false;
            this.last_used = Date.now();
            clearInterval(this.timer);

            if (error) {
                task.reject(new Error(error));
            } else {
                task.resolve(result);
            }

            run_scheduler();
        };

        this.worker.onerror = (err) => {
            console.error("[worker-pool]: Worker crashed", err);
            this.destroy();
        };
    }

    /**
     * @param {Payload} payload
     */
    run(payload) {
        this.busy = true;
        this.worker.postMessage(payload);
        this.timer = setTimeout(() => {
            console.error("[worker-pool]: terminating rogue worker");

            this.worker.terminate();

            const task = pending.get(payload.id);
            if (task) {
                pending.delete(payload.id);
                task.reject(new Error("Worker timeout"));
            }

            this.destroy();
            new_worker_instance(); // replace dead worker
            run_scheduler();
        }, MAX_WORKER_LIFE)
    }

    destroy() {
        clearInterval(this.timer);
        this.worker.terminate();
        const index = workers.indexOf(this);
        if(index !== -1) workers.splice(index, 1);
    }
}

function new_worker_instance() {
    const instance = new WorkerInstance();
    workers.push(instance);
    return instance;
}

function get_worker(){
    let available = workers.find(w => !w.busy);
    if(available) return available;
    if(workers.length <= MAX_WORKERS) return new_worker_instance();
    return null;
}

function run_scheduler(){
    while(task_queue.length > 0) {
        const worker = get_worker();
        if (!worker) break;

        const task = task_queue.shift();
        if (!task) break;

        worker.run(task.payload);

        pending.set(task.payload.id, {
            resolve:task.resolve,
            reject:task.reject
        });
    }
}

/**
 * @param {string} fn
 * @returns {(...args:any[]) => Promise<any>}
 */
function new_worker_func(fn) {
    const fn_id = func_id++;
    return function (...args) {
        return new Promise((resolve,reject) => {
            const id = task_id++;
            task_queue.push({
                resolve,
                reject,
                payload: {
                    id,
                    args,
                    fn,
                    fn_id,
                }
            });
            run_scheduler();
        });
    };
}

/**
 * @template {any} T
 */
class WorkerPool {

    /** @typedef {Map<string, Function>} */
    #func_registry = new Map();
    /** @typedef {WeakMap<Function, Function>} */
    #func_registry_weakmap = new WeakMap();

    constructor() {}

    /**
     * Register a named worker function.
     *
     * @template {string} K
     * @template {(...args:any[]) => any} F
     *
     * @param {K} fn_name
     * @param {F} fn
     *
     * @returns {WorkerPool<T & { [P in K]: (...args: Parameters<F>) => Promise<Awaited<ReturnType<F>>> } >}
     */
    register = (fn_name, fn) => {
        this.#func_registry.set(fn_name, new_worker_func(fn.toString()));
        return /** @type {any} type cast to trick typescript */ (this);
    }

    /**
     * Named worker functions.
     * @type {T}
     */
    run = (() => {
        const self = this;
        return new Proxy(Object.create(null), {
            get(_, key) {
                return self.#func_registry.get(key);
            },
        })
    })();

    /**
     * @template {(...args:any[]) => any} F
     * @param {F} fn
     * @returns {(...args: Parameters<F>) => Promise<Awaited<ReturnType<F>>>}
     */
    execute = (fn) => {
        let cached = this.#func_registry_weakmap.get(fn);
        if(cached) return cached;
        const worker_func = new_worker_func(fn.toString());
        this.#func_registry_weakmap.set(fn, worker_func);
        return worker_func;
    }
}

/** @type {WorkerPool<any>} */
export const worker = new WorkerPool();
/** @type {() => WorkerPool<any>} */
export const create_worker = () => new WorkerPool();
