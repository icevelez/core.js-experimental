
/**
 * @template {any} T
 * @param {HTMLFormElement} node
 * @param {[(...args:any) => Promise<T>, (result:T, error:any | null) => void]}
 */
function submit_form(node, [rpc_function, callback]) {
    let current_event_id;

    const event = async (e) => {
        e.preventDefault();

        const event_id = Math.random();
        current_event_id = event_id;

        if (!node.checkValidity()) return callback(null, "form invalid");

        try {
            const form = new FormData(form);
            const result = await rpc_function(form);

            if (current_event_id !== event_id) return;
            callback(result, null);
        } catch (error) {
            callback(null, error);
        }
    };

    node.addEventListener('submit', event);

    return () => {
        node.removeEventListener('submit', event);
    }
}
