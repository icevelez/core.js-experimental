import { signal } from "core";

class RouterInstance {

    #path = signal("");
    #search_param = signal({});
    #path_param = signal({});

    /**
     * Used to cache RegEx and ParamNames of a Route to skip doing ".replace" and ".push" inside `matchRoute()`
     * @type {Map<string, { regex : RegExp, paramNames : string[] }>}
     */
    #cachePatterns = new Map();

    #updateHashFragment = () => {
        let route = window.location.hash.replace("#", ""), search_paramtring = "";
        if (route.substring(0, 1) !== "/") route = `/${route}`;

        [route, search_paramtring] = route.split("?");

        this.#path[1](route);
        const searchparam = new URLSearchParams(search_paramtring);
        searchparam.forEach((value, key) => {
            if (key === '[object Object]') return;
            this.#search_param[0]()[key] = value;
        });
    }

    /**
     * Accessor for URL search/query parameters.
     *
     * Example:
     *   Router.search_parameter.get("page")
     *   Router.search_parameter.set("page", "2")
     *   Router.search_parameter.delete("page")
     */
    get search_parameter() {
        return {
            /**
             * Returns the value of a query parameter.
             * @type {(key:string) => string | undefined}
             */
            get: (key) => this.#search_param[0]()[key],
            /**
             * Serializes all query parameters into a URL query string.
             *
             * Example:
             *   { page: "1", sort: "name" }
             *
             * Becomes:
             *   "page=1&sort=name"
             *
             * @type {() => string}
             */
            toString: () => Object.entries(this.#search_param[0]()).map(([key, value]) => `${key}=${value}`).join("&"),
        }
    };

    /**
     * Accessor for parameters extracted from the currently
     * matched route pattern.
     *
     * Example:
     *   Route pattern: "/users/:id"
     *   Current URL:   "#/users/123"
     *
     *   Router.path_parameter.get("id")
     *   // "123"
     */
    get path_parameter() {
        return {
            /**
             * Returns the value of a path parameter.
             * @type {(key:string) => string | undefined}
             */
            get: (key) => this.#path_param[0]()[key],
        }
    };

    /**
     * Current normalized path name.
     *
     * Example:
     *   #/users/123?page=1
     *
     * Returns:
     *   "/users/123"
     *
     * @type {string}
     */
    get path_name() {
        return this.#path[0]();
    }

    /**
     * Creates or updates a query parameter and immediately
     * updates the browser URL.
     *
     * Example:
     *   Router.set_search_parameter("page", "2")
     *
     * Result:
     *   #/current-route?page=2
     *
     * @param {string} key
     * @param {string} value
     */
    set_search_parameter = (key, value) => {
        this.#search_param[0]()[key] = value;
        window.location.hash = `${this.path_name}?${this.search_param.toString()}`;
    }

    /**
     * Removes a query parameter and updates the browser URL.
     *
     * Example:
     *   #/users?page=2&sort=name
     *
     * Router.remove_search_parameter("page")
     *
     * Result:
     *   #/users?sort=name
     *
     * @param {string} key
     */
    remove_search_parameter = (key) => {
        delete this.#search_param[0]()[key];
        window.location.hash = `${this.path_name}${this.search_param.size > 0 ? `?${this.search_param.toString()}` : ''}`;
    }

    /**
     * Navigates to a new route by updating the URL hash.
     *
     * Examples:
     *   Router.goto("/users")
     *   Router.goto("/users", new URLSearchParams("page=2"))
     *
     * @param {string} path
     * @param {URLSearchParams} queryParams
     */
    goto = (path, queryParams = this.search_param) => {
        window.location.hash = `${path}${queryParams.size > 0 ? `?${queryParams.toString()}` : ''}`;
    }

    constructor() {
        this.#updateHashFragment();
        window.addEventListener('hashchange', this.#updateHashFragment);
    }


    /**
     * Tests whether the current path_name matches a route pattern.
     *
     * Supported syntax:
     *
     * Static routes:
     *   "/about"
     *
     * Named parameters:
     *   "/users/:id"
     *   "/posts/:postId/comments/:commentId"
     *
     * Wildcard routes:
     *   "/docs/*"
     *
     * Returns:
     *   {
     *      is_match: boolean,
     *      params: Record<string, string>
     *   }
     *
     * Examples:
     *
     * Pattern:
     *   "/users/:id"
     *
     * URL:
     *   "/users/123"
     *
     * Result:
     *   {
     *      is_match: true,
     *      params: {
     *          id: "123"
     *      }
     *   }
     *
     * When a match succeeds, route parameters are also stored
     * in `Router.path_param` for reactive access elsewhere in
     * the application.
     *
     * @param {string} route_pattern
     */
    match = (route_pattern) => {
        let route = { regex: new RegExp(""), paramNames: [] };

        if (this.#cachePatterns.has(route_pattern)) {
            route = this.#cachePatterns.get(route_pattern);
        } else {
            route.regex = new RegExp("^" + route_pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
                .replace(/:([^\/]+)/g, (_, key) => {
                    route.paramNames.push(key);
                    return "([^/]+)";
                })
                .replace(/\/\*$/, () => {
                    route.paramNames.push("wildcard");
                    return "(?:/(.*))?";
                }) + "$");

            this.#cachePatterns.set(route_pattern, route);
        }

        const match = this.path_name.match(route.regex);
        const result = { is_match: false, params: {} };
        if (!match) return result;

        const pathParam = {};
        for (let i = 0; i < route.paramNames.length; i++) pathParam[route.paramNames[i]] = match[i + 1];

        this.#path_param[1](pathParam);
        result.params = pathParam;
        result.is_match = true;
        return result;
    }
}

export const Router = new RouterInstance();
