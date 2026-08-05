const resolve_map = new Map();
const broadcast_channel_id = Math.random().toString(16).slice(2);
const broadcast_channel = `CORE_ASSIST_${broadcast_channel_id}`;

const CORE = window.__core__;
if (!CORE) throw new Error("[Core Assist]: Error! Core not found");

const CORE_ASSIST = {
    version: "v0.1.0",
    /** @type {ServiceWorkerRegistration | null} */
    service_worker: null,
    broadcast_channel: new BroadcastChannel(broadcast_channel),
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

const worker_code = `
    const localcache = new Map();
    const broadcast_channel = new BroadcastChannel("${broadcast_channel}");

    broadcast_channel.addEventListener("message", async (event) => {
        const data = event.data;
        const type = data.type;

        if (type === "CACHE_MODULE") {
            const cache = localcache.get(data.url);
            localcache.set(data.url, { ...cache, code: data.code });
            return;
        }

        if (type === "HAS_MODULE") {
            const cache = localcache.get(data.url);
            if (!cache) localcache.set(data.url, { text: data.text });
            broadcast_channel.postMessage({ type: "RESOLVE_HAS_MODULE", id: data.id, code : cache?.code || null, has_cache: (data.text === cache?.text) });
        }
    });
`;

export async function start_core_assist() {
    if (!navigator.serviceWorker) throw new Error("[Core Assist]: Error! Service Worker not found");

    const worker_url = URL.createObjectURL([worker_code], { type: 'text/javascript' });
    await navigator.serviceWorker.register(worker_url, { type: "module" });

    window.__core_assist__ = CORE_ASSIST;

    CORE_ASSIST.broadcast_channel.addEventListener("message", (event) => {
        const data = event.data;
        const type = data.type;

        if (type === "RESOLVE_HAS_MODULE") {
            const resolve = resolve_map.get(data.id);
            if (!resolve) return console.warn(`[Core Assist] Broadcast message "RESOLVE_HAS_MODULE" was triggered but is missing a promise resolver`);
            resolve({ has_cache : data.has_cache, code : data.code });
            resolve_map.delete(data.id);
            return;
        }
    })
}
