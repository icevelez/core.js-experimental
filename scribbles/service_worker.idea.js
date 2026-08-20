// server-worker.js
import { assist, main_thread } from "web-assist";

function compile_html_to_js() {
    // no closure function
}

assist.extend_import(".html", async (response) => {
    // response.body - string / json / blob
    // response.headers
    // response.status

    // IPC to the main thread to execute a function that requires DOM operation
    const compiled_js = await main_thread(response.body, compile_html_to_js);

    return new Response(compiled_js, { headers : { "content-type" : "application/javascript"} })
})

assist.extend_import(".css", async (response) => {
    if (response.status !== 200) return response;

    const module = `
        const style = document.createElement("style");
        style.innerHTML = ${response.body};
        return style.outerHTML;
        export default style;
    `

    return new Response(module, { headers : { "content-type" : "application/javascript"} })
})
