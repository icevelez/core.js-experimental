const worker_code = `
    self.onmessage = async (event) => {
        const { id, args, fn } = event.data;

        try {
            const func = new Function(\`return \${fn}\`);
            const result = await func()(...args);
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

const workers = [];
const task_queue = [];

const pending = new Map();
const function_cache = new Map();

let task_id = 0;

class WorkerInstance {

    constructor(){
        this.worker = new Worker(worker_url);
        this.busy = false;
        this.last_used = Date.now();
        this.worker.onmessage = e => {
            const { id, result, error } = e.data;

            const task = pending.get(id);
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

    run(payload) {
        this.busy = true;
        this.worker.postMessage(payload);

        this.timer = setTimeout(() => {
            console.error("[worker-pool]: terminating rogue worker");

            this.worker.terminate();

            const task = pending.get(payload.id);
            if (task) {
                pending.delete(this.current_task);
                task.reject(new Error("Worker timeout"));
            }

            this.destroy();
            create_worker(); // replace dead worker
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


function create_worker() {
    const instance = new WorkerInstance();
    workers.push(instance);
    return instance;
}

function get_worker(){
    let available = workers.find(w => !w.busy);
    if(available) return available;
    if(workers.length <= MAX_WORKERS) return create_worker();
    return null;
}

function run_scheduler(){
    while(task_queue.length > 0) {
        const worker = get_worker();
        if (!worker) break;

        const task = task_queue.shift();
        worker.run(task.payload);

        pending.set(task.payload.id, {
            resolve:task.resolve,
            reject:task.reject
        });
    }
}

/**
 * @param {string} fn
 * @returns {Function}
 */
function new_func(fn) {
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
                }
            });
            run_scheduler();
        });
    };
}

export const worker_pool = Object.freeze({
    /**
     * @param {string} func_name
     * @param {Function} fn
     */
    register : function (func_name, fn) {
        function_cache.set(func_name, new_func(fn.toString()));
        return this;
    },
    /**
     * @template {any} T
     * @param  {(...params:any[]) => T} func
     * @returns {Promise<T>}
     */
    run: function (func) {
        const fn = func.toString();

        let cached = function_cache.get(fn);
        if(cached) return cached;

        const worker_func = new_func(fn);
        function_cache.set(fn, worker_func);
        return worker_func;
    }
})

/** @type {Record<string, (...params:any[]) => Promise<any>>} */
export const worker = new Proxy(Object.create(null), {
    get(_, key) {
        return function_cache.get(key);
    }
})
