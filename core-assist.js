const resolve_map = new Map();

const CORE = window.__core__;
if (!CORE) throw new Error("[Core Assist]: Error! Core not found");

const CORE_ASSIST = {
    version: "v0.1.0",
    /** @type {ServiceWorkerRegistration | null} */
    service_worker: null,
    broadcast_channel: new BroadcastChannel("CORE_ASSIST"),
    set_cache: function (url, code) {
        CORE_ASSIST.broadcast_channel.postMessage({ type: "CACHE_MODULE", code, url });
    },
    has_cache: async function (url, text) {
        const id = Math.random().toString(16).substring(4);
        CORE_ASSIST.broadcast_channel.postMessage({ type: "HAS_MODULE", id, url, text });
        return new Promise((resolve) => { resolve_map.set(id, resolve) });
    },
    use_cache: async function (url) {
        const { $COMPONENT_ID, default: render_function } = await import(url);
        await CORE.resolve_components($COMPONENT_ID);
        return render_function;
    },
}

export async function start_core_assist() {
    if (!navigator.serviceWorker) throw new Error("[Core Assist]: Error! Service Worker not found");

    await navigator.serviceWorker.register("./core-worker.js", { type: "module", scope : "/" });
    window.__core_assist__ = CORE_ASSIST;

    CORE_ASSIST.broadcast_channel.addEventListener("message", (event) => {
        const data = event.data;
        const type = data.type;

        if (type === "RESOLVE_HAS_MODULE") {
            const resolve = resolve_map.get(data.id);
            if (!resolve) return console.warn(`[Core Assist] Broadcast message "RESOLVE_HAS_MODULE" was triggered but is missing a promise resolver`);
            resolve(data.has_cache);
            resolve_map.delete(data.id);
            return;
        }
    })
}
