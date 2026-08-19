import { CORE } from "core";

/** @typedef {{ children : number[][], text_funcs : { child_index : number, expr : string }[], attr_funcs : { child_index : number, expr : string, property : string }[], bindings : { child_index : number, var : string, property : string, event_name : string }[], events : { child_index : number, event_name : string, expr : string }[], blocks : { child_index : number, type : string, id : string }[], core_component_blocks : { child_index : number, component_name : string, props_id : string }, component_blocks : { child_index : number, component_tag : string, props_id : string }, use_directives : { child_index : number, func_name : string, expr : string }[] slot_child_index : number  }} Instruction */

/**
 * @param {string} text
 * @param {string} source_url
 * @returns {Promise<Function>}
 */
export const component = (text, source_url) => compiler(text, source_url, template_parser);

/**
 * @param {string} source
 */
function template_parser(source) {
    const blockPattern = /{{#(await|if|each)(.*?)}}|{{\/(await|if|each)}}/gs, stack = [], blocks = [];
    let match;

    while ((match = blockPattern.exec(source))) {
        const [full, openName, , closeName] = match;
        if (openName) {
            stack.push({ name: openName, start: match.index, end: null, outer: '', placeholder: '' });
        } else if (closeName) {
            const last = stack.pop();
            if (!last || last.name !== closeName) throw new Error(`[Core compiler]: Unbalanced block: expected {{/${last?.name}}} but found {{/${closeName}}}`);
            last.end = match.index + full.length;
            last.outer = source.slice(last.start, last.end);
            blocks.push(last);
        }
    }

    blocks.sort((a, b) => b.start - a.start);

    let html = source;
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i], block_id = `${block.name}-${make_id(6)}`;
        for (let j = 0; j < i; j++) {
            if (!block.outer.includes(blocks[j].outer)) continue;
            block.outer = block.outer.replace(blocks[j].outer, blocks[j].placeholder);
            block.end -= blocks[j].outer.length - blocks[j].placeholder.length; // modify block.end when replacing
        }
        block.placeholder = `<template data-block="${block.name}" data-block-id="${block_id}"></template>`;
        html = html.slice(0, block.start) + block.placeholder + html.slice(block.end);
        CORE.add_block_to_cache(block_id, parse[block.name](block.outer));
    }

    return html;
}

const RE = {
    each: /{{#each\s+(.+?)\s+as\s+((?:\w+|\{[\s\S]*?\}|\([\s\S]*?\)))\s*(?:,\s*(\w+))?}}([\s\S]*?){{\/each}}/g,
    if: /{{#if\s+(.+?)}}([\s\S]*?){{\/if}}/g,
    else: /{{:else\s+if\s+(.+?)}}|{{:else}}/g,
    await: /{{#await\s+(.+?)}}([\s\S]*?){{\/await}}/g,
    then: /\{\{:then(?:\s+(\w+))?\}\}([\s\S]*?)(?={{:|$)/,
    catch: /\{\{:catch(?:\s+(\w+))?\}\}([\s\S]*?)(?={{:|$)/,
    blockSplit: /{{:then[\s\S]*?}}|{{:catch[\s\S]*?}}/,
};

const parse = {
    if: function (block) {
        RE.if.lastIndex = RE.else.lastIndex = 0;
        const match = RE.if.exec(block);
        if (!match) throw new Error("[Core compiler]: No matching \"if\" block");

        const [, firstCond, firstBody] = match, exprs = [], fns = [];
        let lastCond = firstCond, lastIndex = 0, m;

        while ((m = RE.else.exec(firstBody))) {
            if (m.index > lastIndex) {
                exprs.push(lastCond);
                fns.push(create_render_code_string(firstBody.slice(lastIndex, m.index)))
            }
            if (m[0].startsWith("{{:else if")) {
                lastCond = m[1];
                lastIndex = m.index + m[0].length;
            } else {
                exprs.push("true");
                fns.push(create_render_code_string(firstBody.slice(m.index + m[0].length)))
                lastIndex = firstBody.length;
                break;
            }
        }

        if (lastIndex < firstBody.length) {
            exprs.push(lastCond);
            fns.push(create_render_code_string(firstBody.slice(lastIndex)))
        }

        return { fns, exprs : exprs.map((expr) => expr.trim()) };
    },
    each: function (block) {
        RE.each.lastIndex = 0;
        const match = RE.each.exec(block);
        if (!match) throw new Error("[Core compiler]: No matching \"each\" block");

        const [, expr, blockVar, indexVar, content] = match,
            parts = content.split(/{{:empty}}/),
            trimmedVar = blockVar.trim();

        return {
            expr: expr.trim(),
            fn: parts[0] ? create_render_code_string(parts[0]) : undefined,
            else_fn: parts[1] ? create_render_code_string(parts[1]) : undefined,
            key: trimmedVar,
            keys: trimmedVar.startsWith("{") || trimmedVar.startsWith("[") ? trimmedVar.slice(1, -1).split(",").map(v => v.trim()) : [],
            index_key: indexVar?.trim() || "",
        };
    },
    await: function (block) {
        RE.await.lastIndex = RE.then.lastIndex = RE.catch.lastIndex = RE.blockSplit.lastIndex = 0;
        const match = RE.await.exec(block);
        if (!match) throw new Error("[Core compiler] No matching \"await\" block");

        const [, promiseExpr, content] = match,
            thenMatch = RE.then.exec(content),
            catchMatch = RE.catch.exec(content),
            pending = content.split(RE.blockSplit)[0] || "";

        return {
            expr: promiseExpr.trim(),
            pending_fn: pending ? create_render_code_string(pending) : undefined,
            then_fn: thenMatch && thenMatch[2] ? create_render_code_string(thenMatch[2]) : undefined,
            then_key: thenMatch && thenMatch[1] || undefined,
            catch_fn: catchMatch && catchMatch[2] ? create_render_code_string(catchMatch[2]) : undefined,
            catch_key: catchMatch && catchMatch[1] || undefined,
        };
    },
}

// COMPILER

/**
 * @param {Node} node
 * @param {string} text
 */
function replace_node_with_anchor(node, text) {
    const anchor = CORE.show_anchor_blocks ? new Comment(text) : new Text(" ");
    node.parentNode.replaceChild(anchor, node);
}

/**
 * @param {Node} node
 * @param {number[]} node_index
 * @param {Instruction} instruction
 */
function discover_node_instruction(node, node_index = [], instruction = { children: [], events: [], bindings: [], attr_funcs: [], text_funcs: [], blocks: [], core_component_blocks: [], component_blocks: [], use_directives: [], slot_child_index: -1 }) {
    const isStyle = node instanceof HTMLStyleElement;
    if (isStyle) return instruction;

    const handlebar_re = /({{(?:(?!}}).)*}})/g;
    const handlebar_capture_inner_expression_re = /{{\s*(.+?)\s*}}/g;

    const isText = node.nodeType === Node.TEXT_NODE;
    if (isText) {
        const expression = node.textContent;
        const parts = expression.split(handlebar_re);
        const has_handlebars = parts.map(p => p.startsWith("{{")).filter(p => p === true).length > 0;
        if (!has_handlebars) return instruction;

        node.textContent = " "; // DO NOT REMOVE THIS WHITESPACE. IT IS FOR A TEXT NODE
        instruction.children.push(node_index);
        instruction.text_funcs.push({ child_index: instruction.children.length - 1, expr: `\`${expression.replace(handlebar_capture_inner_expression_re, (_, e) => "${" + e + "}")}\`` });
        return instruction;
    }

    if (node.nodeType === Node.COMMENT_NODE) return instruction;

    const isCoreSlotNode = (node) => Boolean(node.dataset && node.dataset.block === "core-slot");
    if (isCoreSlotNode(node)) {
        replace_node_with_anchor(node, "component-slot");
        instruction.children.push(node_index);
        instruction.slot_child_index = instruction.children.length - 1;
        return instruction;
    }

    const isComponentNode = (node) => Boolean(node.dataset && node.dataset.block === "component");
    const isCoreComponentNode = (node) => Boolean(node.dataset && node.dataset.block === "core-component");

    const is_component_node = isComponentNode(node);
    const is_core_component_node = isCoreComponentNode(node);
    if (is_component_node || is_core_component_node) {
        const component = node.dataset.component || null;
        const component_tag = node.dataset.componentTag || null;
        if (is_core_component_node && !component) throw new Error("[Core compiler]: Node processing error! No default component found");
        if (is_component_node && !component_tag) throw new Error("[Core compiler]: Node processing error! component not found");
        replace_node_with_anchor(node, "component-block");
        instruction.children.push(node_index);
        instruction.component_blocks.push({ child_index: instruction.children.length - 1, component, component_tag, props_id: node.dataset.blockPropsId, slot_id: node.dataset.slotId });
        return instruction;
    }

    const isBlockNode = (node) => Boolean(node.dataset && node.dataset.block && node.dataset.blockId)
    if (isBlockNode(node)) {
        replace_node_with_anchor(node, node.dataset.block + "-block");
        instruction.children.push(node_index);
        instruction.blocks.push({ child_index: instruction.children.length - 1, type: node.dataset.block, id: node.dataset.blockId });
        return instruction;
    }

    if (node.attributes) {
        for (const attr of Array.from(node.attributes)) {
            const attrName = attr.name.toLowerCase();
            const attrVal = attr.value.trim();
            if (attrName.startsWith('use:')) {
                const expr = attrVal;
                const func_name = attrName.slice(4);
                if (!instruction.children.includes(node_index)) instruction.children.push(node_index);
                instruction.use_directives.push({ child_index: instruction.children.length - 1, func_name, expr });

                node.removeAttribute(attrName);
            } else if (attrName.startsWith('on:')) {
                const expr = attrVal;
                const event_name = attrName.slice(3);

                if (!instruction.children.includes(node_index)) instruction.children.push(node_index);
                instruction.events.push({ child_index: instruction.children.length - 1, event_name, expr });

                node.removeAttribute(attrName);
            } else if (attrName.startsWith(":")) {
                const expr = attrVal;
                if (!instruction.children.includes(node_index)) instruction.children.push(node_index);
                instruction.attr_funcs.push({ child_index: instruction.children.length - 1, expr, property: attrName.slice(1, attrName.length) });

                node.removeAttribute(attrName);
            }
        };
    }

    const childNodes = Array.from(node.childNodes);
    for (let i = 0; i < childNodes.length; i++) discover_node_instruction(childNodes[i], [...node_index, i], instruction);

    return instruction;
}

/** @type {(nums:number[]) => string} */
const resolve_child_node = (nums = []) => `.childNodes[${nums.shift() || 0}]` + ((nums.length <= 0) ? '' : resolve_child_node(nums));

/**
 * @param {Node} root
 */
function remove_whitespace_nodes(root) {
    let child = root.firstChild;

    while (child) {
        const next = child.nextSibling;

        if (child.nodeName !== "PRE" && child.nodeName !== "TEXTAREA" && (child.nodeType === Node.ELEMENT_NODE || child.nodeType === Node.DOCUMENT_FRAGMENT_NODE))
            remove_whitespace_nodes(child);
        else if (child.nodeType === Node.TEXT_NODE)
            if (child.textContent.trim() === "") child.remove();
            else child.textContent = child.textContent.trim().replaceAll("\n", "").replaceAll("\t", "")

        child = next;
    }
}

/**
* Replaces all custom HTML Tags with a placeholder element to be processed as components
* @param {string} template
* @param {Function} template_processor
*/
function process_components(template, template_processor) {
    return template.replace(/<([A-Z][A-Za-z0-9]*)\s*((?:[^>"']|"[^"]*"|'[^']*')*?)\s*(\/?)>(?:([\s\S]*?)<\/\1>)?/g, (match, tag, attrStr, _, inner_content) => {
        const props = Object.create(null), dynamic_props = [], props_id = `props-${make_id(8)}`, slot_id = `slot-${make_id(8)}`;

        attrStr.replace(/([\w:@-]+)(?:\s*=\s*"([^"]*)")?/g, (_, key, value) => {
            if (key.startsWith(":")) {
                if (value) dynamic_props.push({ key: key.slice(1, key.length), expr: value });
            } else if (value) {
                props[key] = value;
            }
        })

        if (inner_content) CORE.add_block_to_cache(slot_id, create_render_code_string(template_processor(inner_content)));
        CORE.add_block_to_cache(props_id, { props, dynamic_props });

        if (match.startsWith("<CoreSlot")) return `<template data-block="core-slot"></template>`;
        if (match.startsWith("<CoreComponent")) {
            const _default = props.default;
            delete props.default;
            return `<template data-block="core-component" data-block-props-id="${props_id}" data-component="${_default}" ${slot_id ? `data-slot-id="${slot_id}"` : ''}></template>`;
        }

        return `<template data-block="component" data-component-tag="${tag}" data-block-props-id="${props_id}" ${slot_id ? `data-slot-id="${slot_id}"` : ''}></template>`;
    })
}

/**
 * Extracts the contents of "export default function() { .... }"
 * @param {string} source
 */
function extract_default_function(source) {
    const match = /export\s+default\s+function(?:\s+\w+)?\s*\(/.exec(source);
    if (!match) return null;

    let i = source.indexOf("{", match.index);
    if (i === -1) return null;

    let depth = 1;

    while (++i < source.length) {
        const ch = source[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) return source.slice(match.index + 1, i);
        }
    }

    return null;
}

/**
 * @param {string} text
 * @param {string} source_url
 * @param {DocumentFragment} template_processor
 */
async function compiler(text, source_url, template_processor) {
    const base = document.createElement("template");
    base.innerHTML = text;

    const scriptEl = base.content.querySelector("script");
    const script = scriptEl?.innerHTML || "";
    const template = text.replace(scriptEl?.outerHTML, "");
    const href = source_url.substring(0, source_url.lastIndexOf("/") + 1);

    let code = `//# sourceURL=${source_url.split("/").at(-1)}${script.replaceAll(/\/\/.*$/gm, '').replaceAll(/\/\*[\s\S]*?\*\//g, '') || "\n\texport default function() {}"}`.replaceAll(/from\s+["']([^"']+\.js)["']/g, (expr, match) => match.startsWith("http") || match.startsWith("data:") ? expr : expr.replace(match, `${href}${match}`));
    let import_component_anchor = "";

    const imported_components = [];

    code = code.replaceAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+\.html)["']\s*;?\s*$/gm, (expr, component, href) => {
        imported_components.push({ component, href });
        return (!import_component_anchor) ? (import_component_anchor = expr) : "";
    })

    const absolute_url = source_url.split("/").slice(0, -1).join("/");
    if (import_component_anchor) code = code.replace(`${import_component_anchor}\n`, `const [ ${imported_components.map(({ component }) => `${component}`).join(",\n\t")} ] = await Promise.all([${imported_components.map(({ href }) => `window.__core__.component("${href.startsWith("http") || href.startsWith("data") ? href : `${absolute_url}/${href}`}")`).join(",")}])`);

    const css_scope_id = `core-${make_id(6).toLowerCase()}`;
    const render_code_string = create_render_code_string(template_processor(process_components(template, template_processor)), { css_scope_id });
    const user_code = extract_default_function(code);
    code = code.replace(user_code, `${user_code}\n\t\t/* END OF USER CODE - CODE BELOW IS INJECTED BY THE RUNTIME COMPILER - IT REPRESENTS YOUR TEMPLATE */\n\t\t${render_code_string}`);

    const has_styles = render_code_string.includes("$STYLE.innerHTML");
    const template_initialization_code = `
    const $CORE = window.__core__;\n\t${
    CORE.fragment_cache.map((frag, i) => {
        if (has_styles) inject_scope_id_to_children(frag, css_scope_id);
        const template = document.createElement("template");
        template.content.append(frag);
        return `const $FRAGMENT_CACHE_${i} = $CORE.html(${JSON.stringify(template.innerHTML)})`;
    }).join("\n\t")}`;

    code = `${code}${template_initialization_code}`;

    CORE.fragment_cache.length = 0;

    const script_blob = new Blob([code], { type: 'text/javascript' });
    const script_url = URL.createObjectURL(script_blob);
    const { default: render_function } = await import(script_url);
    return render_function
}

/**
 *
 * @param {DocumentFragment} fragment
 * @param {{ css_scope_id?: string }} options
 */
function create_render_code_string(fragment, options) {
    if (typeof fragment === "string") fragment = CORE.html(fragment);

    remove_whitespace_nodes(fragment) // this should be executed before processing any template to prevent empty text nodes that are used as anchor points for rendering to be mistakenly removed

    let dispose_fn_i = -1;

    const style_sheet = options?.css_scope_id ? apply_scope_css(fragment, options?.css_scope_id) : "";
    const instruction = discover_node_instruction(fragment);
    const fragment_cache_index = CORE.fragment_cache.length;
    CORE.fragment_cache.push(fragment);

    const render_code_string = `
        const $CORE = window.__core__;
        const [$ANCHOR, $SLOT_FN] = $CORE.get_param_args();
        const $TEMPLATE = $FRAGMENT_CACHE_${fragment_cache_index}.cloneNode(true);

        const $NODE_START = $TEMPLATE.firstChild;
        const $NODE_END = $TEMPLATE.lastChild;
${
        style_sheet ? `\n\t\tconst $STYLE = document.createElement("style");
        $STYLE.innerHTML = \`${style_sheet}\`;
        document.head.append($STYLE);\n` : ''
}
        const $CONTEXT = $CORE.create_new_context();
        $CONTEXT[$CORE.MOUNT_FNS] = [];
        $CONTEXT[$CORE.DESTROY_FNS] = [];
        const $OLD_CONTEXT = $CORE.set_new_context($CONTEXT);
${
        (instruction.children.length > 0 ? '\t\t// DECLARE NODES WITH BINDINGS\n\t' : '') +
            instruction.children.map((child, i) => {
                return `\tconst $CHILD${i} = $TEMPLATE${resolve_child_node(child)};`;
            }).join("\n\t")
}

        const $DISPOSE_FNS = [];
${
        (instruction.text_funcs.length > 0 || instruction.attr_funcs.length > 0) ? `
        // TEXT & ATTRIBUTES
        $DISPOSE_FNS[${++dispose_fn_i}] = $CORE.effect(() => {
            ${instruction.text_funcs.map((func) => {
                return `$CORE.set_text($CHILD${func.child_index}, ${func.expr});`
            }).join("\n\t\t\t")}${(instruction.attr_funcs.length > 0 ? "\n\t\t\t" : "") +
            instruction.attr_funcs.map((func, i) => {
                return `$CORE.set_attr($CHILD${func.child_index}, ${func.expr}, "${func.property}");`
            }).join("\n\t\t\t")}
        })` : ''
}${
        (instruction.events.length > 0 ? '\n\n\t\t// EVENT DELEGATION\n\t\t' : '') +
        instruction.events.map((event) => {
            return `$CORE.delegate("${event.event_name}", $CHILD${event.child_index}, (${event.expr}));`
        }).join("\n\t\t")
}${
        (instruction.blocks.length > 0 ? '\n\n\t\t// IF/EACH/AWAIT BLOCKS\n\t\t' : '') +
        instruction.blocks.sort((a,b) => a.type.localeCompare(b.type)).map((block) => {
            const block_data = CORE.block_cache.get(block.id);
            const each_fn = (fn) => `(${block_data.key}${block_data.index_key ? `, ${block_data.index_key}` : ''}) => {${fn.replaceAll("\n", "\n\t")}}`;
            const await_fn = (fn, key = "") => fn ? `(${key}) => {${fn.replaceAll("\n", "\n\t")}}` : 'null';
            if (block.type === "if") {
                return `$DISPOSE_FNS[${++dispose_fn_i}] = $CORE.if($CHILD${block.child_index}, [\n\t\t\t${block_data.exprs.map((expr) => `(() => ${expr})`).join(",\n\t\t\t")}\n\t\t], [\n\t\t${block_data.fns.map((fn) => `() => {${fn.replaceAll("\n", "\n\t")}}`).join(",\n\t\t")}\n\t\t]);`
            } else if (block.type === "each") {
                return `$DISPOSE_FNS[${++dispose_fn_i}] = $CORE.each($CHILD${block.child_index}, (() => ${block_data.expr}), ${each_fn(block_data.fn)}${block_data.else_fn ? `, ${each_fn(block_data.else_fn)}` : ''})`;
            } else if (block.type === "await") {
                const block_data = CORE.block_cache.get(block.id);
                return `$DISPOSE_FNS[${++dispose_fn_i}] = $CORE.await($CHILD${block.child_index}, (() => ${block_data.expr}), ${await_fn(block_data.pending_fn)}, ${await_fn(block_data.then_fn, block_data.then_key)}, ${await_fn(block_data.catch_fn, block_data.catch_key)});`
            }
        }).join("\n\n\t\t")
}${
        (instruction.component_blocks.length > 0 ? `\n\n\t\t// IMPORTED COMPONENTS like <Component/> or\n\t\t// CORE COMPONENTS like <CoreComponent default="component_function"/>\n\t\t` : '') +
            instruction.component_blocks.map((block, i) => {
                const component = CORE.block_cache.get(block.props_id);
                const component_slot_fn_code = CORE.block_cache.get(block.slot_id);
                const props = Object.entries(component?.props || []);
                return `const $COMPONENT${i} = ${block.component ? `${block.component}` : `${block.component_tag}`};
        const $COMPONENT${i}_PROPS = {${props.map((p) => `get ${p[0]}() { return (${JSON.stringify(p[1])}) }`).join(",") }${ (props.length > 0 && component.dynamic_props.length > 0) ? ',' : ''} ${component.dynamic_props.map((p) => `get ${p.key}(){ return (${p.expr}) }`).join(", ")}};
        if (!$COMPONENT${i}) throw new Error('[Core runtime]: Loading component error! Component "<${block.component || block.component_tag}>" not found');
        $DISPOSE_FNS[${++dispose_fn_i}] = $CORE.core_component($CHILD${block.child_index}, $COMPONENT${i}, $COMPONENT${i}_PROPS, () => {${component_slot_fn_code?.replaceAll("\n", "\n\t") || ""}});`}).join("\n\n\t")
}${
        (instruction.use_directives.length > 0 ? '\n\n\t\t// USE DIRECTIVE\n\t' : '') +
        instruction.use_directives.map((directive, i) => {
            return `\tif (typeof ${directive.func_name} !== "function") throw new Error('[Core runtime]: Element directive error! \"${directive.func_name}\" is not a function')
        $CORE.on_mount(() => ${directive.func_name}($CHILD${directive.child_index}, (${directive.expr || 'undefined'})))`;
        }).join("\n\t")
}${
        instruction.slot_child_index > -1 ? `\n\n\t\t// COMPONENT SLOT like <CoreSlot/>
        if ($SLOT_FN) {
            const fragment = document.createDocumentFragment();
            $CORE.set_param_args(fragment);
            $DISPOSE_FNS[${++dispose_fn_i}] = $SLOT_FN();
            $CHILD${instruction.slot_child_index}.before(fragment);
        }` : ''
}

        $ANCHOR.append($TEMPLATE);

        $CORE.defer_mounting($CONTEXT);
        $CORE.set_new_context($OLD_CONTEXT);

        // CLEAN UP
        return () => {
            $CORE.run_destroy_fns($CONTEXT);

            for (const fn of $DISPOSE_FNS) fn();
            $DISPOSE_FNS.length = 0;

            const parent_node = $NODE_START.parentNode;
            if (parent_node) $CORE.remove_nodes(parent_node, $NODE_START, $NODE_END);${
            style_sheet ? `\n\t\t\tdocument.head.removeChild($STYLE);` : '' }
        }\n\t`;

    return render_code_string;
}

// SCOPE CSS

function splitSelectors(str) {
    if (!str) return [];

    const out = [];
    let start = 0, depth = 0;

    for (let i = 0; i < str.length; i++) {
        const c = str[i];
        if (c === "(" || c === "[") depth++;
        else if (c === ")" || c === "]") depth--;
        else if (c === "," && depth === 0) {
            out.push(str.slice(start, i).trim());
            start = i + 1;
        }
    }

    out.push(str.slice(start).trim());
    return out;
}

function scopeSelector(selector, scope) {
    let depth = 0;
    let part = "", out = "";

    const flush = () => {
        if (!part) return;
        const i = part.search(/:{1,2}/);
        out += i < 0 ? part + `[${scope}]` : part.slice(0, i) + `[${scope}]` + part.slice(i);
        part = "";
    };

    for (const c of selector) {
        if (c === "(" || c === "[") depth++;
        else if (c === ")" || c === "]") depth--;

        if (depth === 0 && (c === ">" || c === "+" || c === "~" || c === " ")) {
            flush();
            out += c;
        } else {
            part += c;
        }
    }

    flush();

    return out;
}

/**
 * @param {DocumentFragment} fragment
 * @param {string} scope_id
 */
function apply_scope_css(fragment, scope_id) {
    let style_content = '';

    for (const child of Array.from(fragment.children)) {
        if (!(child instanceof HTMLStyleElement && child.hasAttribute("scoped"))) continue;
        style_content += child.innerHTML;
        fragment.removeChild(child);
    }

    if (!style_content) return;

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(style_content);

    return process_css_scoping_rules(sheet.cssRules, scope_id)
}

/**
 * @param {DocumentFragment} fragment
 */
function inject_scope_id_to_children(fragment, scope_id) {
    for (const child of Array.from(fragment.children)) {
        child.setAttribute(scope_id, "")
        if (child.children.length > 0) inject_scope_id_to_children(child, scope_id);
    }
}

/**
 * @param {CSSRuleList} rule
 * @param {string} scope_id
 */
 function process_css_scoping_rules(rules, scope_id) {
     let css = "";

     for (const rule of rules) {
         if (rule instanceof CSSStyleRule) {
             css += `${splitSelectors(rule.selectorText).map(s => scopeSelector(s, scope_id)).join(", ")} { ${rule.style?.cssText || ""} ${(rule.cssRules?.length) ? process_css_scoping_rules(rule.cssRules, scope_id) : ''} } `;
             continue;
         }
         if (rule.cssRules?.length) {
             css += `${rule.cssText.split("{")[0]} { ${process_css_scoping_rules(rule.cssRules, scope_id)} } `;
             continue;
         }
         css += `${rule.cssText} `;
     }

     return css;
 }

 // HELPER FUNCTIONS

  /** @type {(length:number) => string} */
 const make_id = (length) => {
      let result = '';
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
      for (var i = 0; i < length; i++) result += characters.charAt(Math.floor(Math.random() * characters.length));
      return result;
  }
