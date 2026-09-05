/**
 * an async/await version of setTimeout
 *
 * @param {number} miliseconds
 * @returns {Promise<void>}
 */
export async function delay(miliseconds = 0) {
    return new Promise((resolve) => setTimeout(resolve, miliseconds));
}

/**
 * @template {any} T
 * @param {(input:T) => void} fn
 * @param {number} debounce_ms
 */
export function debounce(fn, debounce_ms) {
    let timeoutid;
    /**
     * @param {T} input
     */
    const dfn = (input) => {
        if (timeoutid) clearTimeout(timeoutid);
        timeoutid = setTimeout(() => fn(input), debounce_ms);
    };
    return dfn;
}
/**
 * Compress an input iamge to `.webp`
 * @param {Blob} blobImage
 * @param {number} qualityPercent default at 40% quality
 * @param {number} max_size max height/width resolution. default max size of 500px
 */
export async function compress_image(blobImage, options = { quality: 0.4, max_size: 500, image_type: "image/webp" }) {
    if (!options || typeof options !== "object") throw "options is not an object";

    const { quality, max_size, image_type } = options;

    if (isNaN(quality)) throw "quality is not a number";
    if (isNaN(max_size)) throw "max_size is not a number";
    if (typeof image_type !== "string") throw "string is not a string";

    try {
        const bitmap = await createImageBitmap(blobImage);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const ratio = bitmap.width / bitmap.height;
        const isLarge = bitmap.height > max_size || bitmap.width > max_size;

        const height = isLarge ? max_size : bitmap.height;
        const width = isLarge ? max_size * ratio : bitmap.width;

        quality = (quality > 1) ? 1 : (quality <= 0) ? 0.4 : quality;

        canvas.width = width;
        canvas.height = height;

        ctx?.drawImage(bitmap, 0, 0, width, height);

        return {
            /** @type {() => Promise<Blob>} */
            blob : () => new Promise((resolve) => canvas.toBlob(resolve, image_type, quality)),
            string: () => canvas.toDataURL(image_type, quality),
        };
    } catch (error) {
        throw new Error(error);
    }
}

/**
 * @param {string} base64_image
 * @returns {Blob}
 */
export function base64_image_to_blob(base64_image) {
    const [header, base64] = base64_image.split(",");
    const mime = header.match(/:(.*?);/)[1];

    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);

    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

    return new Blob([bytes], { type: mime });
}

/**
 * print an HTML Element using iframes
 *
 * By default printing an HTML element will not have any styles; to combat this,
 * this function copies the `<styles>` and `<link rel="stylesheet">` from the header
 *
 * BUT I cannot guarantee that it will work for all cases
 *
 * @param {HTMLElement} elemment
 * @param {(iframe:HTMLIFrameElement) => (Promise<void> | void)} transform_fn intercept iframe before printing, usually to fix any missing stylesheet
 */
export function print(elemment, transform_fn) {
    if (!(elemment instanceof HTMLElement))
        throw new Error("input is not an HTML element");

    let html_src = `<html><head>`;

    Array.from(document.head.children).forEach((child) => {
        if (child instanceof HTMLLinkElement && child.rel === "stylesheet") html_src += child.outerHTML;
        if (child instanceof HTMLStyleElement) html_src += child.outerHTML;
    });

    html_src += `</head><body>${elemment.outerHTML}</body></html>`;

    const iframContainer = document.createElement("div");
    iframContainer.style.display = "none";

    const iframe = document.createElement("iframe");
    iframe.srcdoc = html_src;

    iframe.onload = async function () {
        if (!iframe.contentWindow) throw new Error("iframe.contentWindow does not exists, could not print HTML",);

        if (typeof transform_fn === "function") {
            const value = transform_fn(iframe);
            if (value instanceof Promise) await value;
        }

        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframContainer));
    };

    iframContainer.append(iframe);
    document.body.append(iframContainer);
}

const fetch_inflight = new Map();

/**
 * Deduplicated fetch
 * @template {any} T
 * @param {string} url
 * @param {HeadersInit} options
 */
export function query(url, options = {}) {
    const key = JSON.stringify([url, options]);

    // Reuse in-flight request
    if (fetch_inflight.has(key)) return fetch_inflight.get(key);

    const promise = fetch(url, options).finally(() => {
        fetch_inflight.delete(key);
    });

    fetch_inflight.set(key, promise);
    return promise;
}
