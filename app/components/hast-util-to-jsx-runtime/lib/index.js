/**
 * @import {Identifier, Literal, MemberExpression} from 'estree'
 * @import {Jsx, JsxDev, Options, Props} from 'hast-util-to-jsx-runtime'
 * @import {Element, Nodes, Parents, Root, Text} from 'hast'
 * @import {MdxFlowExpressionHast, MdxTextExpressionHast} from 'mdast-util-mdx-expression'
 * @import {MdxJsxFlowElementHast, MdxJsxTextElementHast} from 'mdast-util-mdx-jsx'
 * @import {MdxjsEsmHast} from 'mdast-util-mdxjs-esm'
 * @import {Position} from 'unist'
 * @import {Child, Create, Field, State, Style} from './types.js'
 */

import {stringify as commas} from 'comma-separated-tokens'
import {ok as assert} from 'devlop'
import {name as isIdentifierName} from 'estree-util-is-identifier-name'
import {whitespace} from 'hast-util-whitespace'
import {find, hastToReact, html, svg} from 'property-information'
import {stringify as spaces} from 'space-separated-tokens'
import styleToObject from 'style-to-object'
import {pointStart} from 'unist-util-position'
import {VFileMessage} from 'vfile-message'
import {LRUMap} from "lru_map";

// To do: next major: `Object.hasOwn`.
const own = {}.hasOwnProperty

/** @type {Map<string, number>} */
const emptyMap = new Map()

const cap = /[A-Z]/g
const dashSomething = /-([a-z])/g

// `react-dom` triggers a warning for *any* white space in tables.
// To follow GFM, `mdast-util-to-hast` injects line endings between elements.
// Other tools might do so too, but they don’t do here, so we remove all of
// that.

// See: <https://github.com/facebook/react/pull/7081>.
// See: <https://github.com/facebook/react/pull/7515>.
// See: <https://github.com/remarkjs/remark-react/issues/64>.
// See: <https://github.com/rehypejs/rehype-react/pull/29>.
// See: <https://github.com/rehypejs/rehype-react/pull/32>.
// See: <https://github.com/rehypejs/rehype-react/pull/45>.
const tableElements = new Set(['table', 'tbody', 'thead', 'tfoot', 'tr'])

const tableCellElement = new Set(['td', 'th'])

const docs = 'https://github.com/syntax-tree/hast-util-to-jsx-runtime'

/**
 * Transform a hast tree to preact, react, solid, svelte, vue, etc.,
 * with an automatic JSX runtime.
 *
 * @param {Nodes} tree
 *   Tree to transform.
 * @param {Options} options
 *   Configuration (required).
 * @returns {JSX.Element}
 *   JSX element.
 */

export function toJsxRuntime(tree, options) {
    if (!options || options.Fragment === undefined) {
        throw new TypeError('Expected `Fragment` in options')
    }

    const filePath = options.filePath || undefined
    /** @type {Create} */
    let create

    if (options.development) {
        if (typeof options.jsxDEV !== 'function') {
            throw new TypeError(
                'Expected `jsxDEV` in options when `development: true`'
            )
        }

        create = developmentCreate(filePath, options.jsxDEV)
    } else {
        if (typeof options.jsx !== 'function') {
            throw new TypeError('Expected `jsx` in production options')
        }

        if (typeof options.jsxs !== 'function') {
            throw new TypeError('Expected `jsxs` in production options')
        }

        create = productionCreate(filePath, options.jsx, options.jsxs)
    }

    /** @type {State} */
    const state = {
        Fragment: options.Fragment,
        ancestors: [],
        components: options.components || {},
        create,
        elementAttributeNameCase: options.elementAttributeNameCase || 'react',
        evaluater: options.createEvaluater ? options.createEvaluater() : undefined,
        filePath,
        ignoreInvalidStyle: options.ignoreInvalidStyle || false,
        passKeys: options.passKeys !== false,
        passNode: options.passNode || false,
        schema: options.space === 'svg' ? svg : html,
        stylePropertyNameCase: options.stylePropertyNameCase || 'dom',
        tableCellAlignToStyle: options.tableCellAlignToStyle !== false,
        nodeCache: options.nodeCache ?? new LRUMap(200),
        parentCache: options.parentCache ?? new LRUMap(200)
    }

    // Start with an empty path
    const result = one(state, tree, undefined, '')

    // JSX element.
    if (result && typeof result !== 'string') {
        return result
    }

    // Text node or something that turned into nothing.
    return state.create(
        tree,
        state.Fragment,
        {children: result || undefined},
        undefined
    )
}

/**
 * Transform a node.
 *
 * @param {State} state
 *   Info passed around.
 * @param {Nodes} node
 *   Current node.
 * @param {string | undefined} key
 *   Key.
 * @returns {Child | undefined}
 *   Child, optional.
 */
function one(state, node, key, path) {
    if (state.parentCache && state.parentCache && state.parentCache.has(path) && state.nodeCache.has(path)) {
        const prevNode = state.parentCache.get(path)
        const cachedResult = state.nodeCache.get(path)
        if (isNodesEqual(prevNode, node)) {
            return cachedResult
        }
    }
    // Proceed with processing the node
    let result

    if (node.type === 'element') {
        result = element(state, node, key, path)
    }

    else if (node.type === 'mdxFlowExpression' || node.type === 'mdxTextExpression') {
        result = mdxExpression(state, node)
    }

    else if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
        result = mdxJsxElement(state, node, key, path)
    }

    else if (node.type === 'mdxjsEsm') {
        result = mdxEsm(state, node)
    }

    else if (node.type === 'root') {
        result = root(state, node, key, path)
    }

    else if (node.type === 'text') {
        result = text(state, node)
    }
    if (state.parentCache && state.parentCache){
        // Store the result in the cache
        state.nodeCache.set(path, result)
        state.parentCache.set(path, node)
    }

    return result
}

// Implement isNodesEqual function
function isNodesEqual(node1, node2) {

    if (!node1 || !node2) return false
    if (node1.type !== node2.type) return false

    if (node1.type === 'text') {
        return node1.value === node2.value
    }

    // if (node1.type === 'element') {
    //     if (node1.tagName !== node2.tagName) return false
    //
    //     // Compare properties
    //     const props1 = node1.properties || {}
    //     const props2 = node2.properties || {}
    //     if (!isObjectEqual(props1, props2)) return false
    //
    //     // Compare child nodes
    //     const children1 = node1.children || []
    //     const children2 = node2.children || []
    //     if (children1.length !== children2.length) return false
    //
    //     return children1.every((child: any, i: number) =>
    //         isNodesEqual(child, children2[i])
    //     )
    // }
    // Implement node comparison logic here
    // For simplicity, use JSON.stringify (not efficient for large nodes)
    return JSON.stringify(node1) === JSON.stringify(node2)
}


/**
 * Handle element.
 *
 * @param {State} state
 *   Info passed around.
 * @param {Element} node
 *   Current node.
 * @param {string | undefined} key
 *   Key.
 * @returns {Child | undefined}
 *   Child, optional.
 */
// Remember to pass the path in other recursive functions as well
function element(state, node, key, path) {
    const parentSchema = state.schema
    let schema = parentSchema

    if (node.tagName.toLowerCase() === 'svg' && parentSchema.space === 'html') {
        schema = svg
        state.schema = schema
    }

    state.ancestors.push(node)

    const type = findComponentFromName(state, node.tagName, false)
    const props = createElementProps(state, node)
    let children = createChildren(state, node, path)

    if (tableElements.has(node.tagName)) {
        children = children.filter(function (child) {
            return typeof child === 'string' ? !whitespace(child) : true
        })
    }

    addNode(state, props, type, node)
    addChildren(props, children)

    // Restore.
    state.ancestors.pop()
    state.schema = parentSchema

    const result = state.create(node, type, props, key)

    return result
}
/**
 * Handle MDX expression.
 *
 * @param {State} state
 *   Info passed around.
 * @param {MdxFlowExpressionHast | MdxTextExpressionHast} node
 *   Current node.
 * @returns {Child | undefined}
 *   Child, optional.
 */
function mdxExpression(state, node) {
    if (node.data && node.data.estree && state.evaluater) {
        const program = node.data.estree
        const expression = program.body[0]
        assert(expression.type === 'ExpressionStatement')

        // Assume result is a child.
        return /** @type {Child | undefined} */ (
            state.evaluater.evaluateExpression(expression.expression)
        )
    }

    crashEstree(state, node.position)
}

/**
 * Handle MDX ESM.
 *
 * @param {State} state
 *   Info passed around.
 * @param {MdxjsEsmHast} node
 *   Current node.
 * @returns {Child | undefined}
 *   Child, optional.
 */
function mdxEsm(state, node) {
    if (node.data && node.data.estree && state.evaluater) {
        // Assume result is a child.
        return /** @type {Child | undefined} */ (
            state.evaluater.evaluateProgram(node.data.estree)
        )
    }

    crashEstree(state, node.position)
}

/**
 * Handle MDX JSX.
 *
 * @param {State} state
 *   Info passed around.
 * @param {MdxJsxFlowElementHast | MdxJsxTextElementHast} node
 *   Current node.
 * @param {string | undefined} key
 *   Key.
 * @returns {Child | undefined}
 *   Child, optional.
 */
function mdxJsxElement(state, node, key,path) {
    const parentSchema = state.schema
    let schema = parentSchema

    if (node.name === 'svg' && parentSchema.space === 'html') {
        schema = svg
        state.schema = schema
    }

    state.ancestors.push(node)

    const type =
        node.name === null
            ? state.Fragment
            : findComponentFromName(state, node.name, true)
    const props = createJsxElementProps(state, node)
    const children = createChildren(state, node, path)

    addNode(state, props, type, node)
    addChildren(props, children)

    // Restore.
    state.ancestors.pop()
    state.schema = parentSchema

    return state.create(node, type, props, key)
}

/**
 * Handle root.
 *
 * @param {State} state
 *   Info passed around.
 * @param {Root} node
 *   Current node.
 * @param {string | undefined} key
 *   Key.
 * @returns {Child | undefined}
 *   Child, optional.
 */
function root(state, node, key, path) {
    /** @type {Props} */
    const props = {}

    const children = createChildren(state, node, path)

    addChildren(props, children)

    return state.create(node, state.Fragment, props, key)
}


/**
 * Handle text.
 *
 * @param {State} _
 *   Info passed around.
 * @param {Text} node
 *   Current node.
 * @returns {Child | undefined}
 *   Child, optional.
 */
function text(_, node) {
    return node.value
}

/**
 * Add `node` to props.
 *
 * @param {State} state
 *   Info passed around.
 * @param {Props} props
 *   Props.
 * @param {unknown} type
 *   Type.
 * @param {Element | MdxJsxFlowElementHast | MdxJsxTextElementHast} node
 *   Node.
 * @returns {undefined}
 *   Nothing.
 */
function addNode(state, props, type, node) {
    // If this is swapped out for a component:
    if (typeof type !== 'string' && type !== state.Fragment && state.passNode) {
        props.node = node
    }
}

/**
 * Add children to props.
 *
 * @param {Props} props
 *   Props.
 * @param {Array<Child>} children
 *   Children.
 * @returns {undefined}
 *   Nothing.
 */
function addChildren(props, children) {
    if (children.length > 0) {
        const value = children.length > 1 ? children : children[0]

        if (value) {
            props.children = value
        }
    }
}

/**
 * @param {string | undefined} _
 *   Path to file.
 * @param {Jsx} jsx
 *   Dynamic.
 * @param {Jsx} jsxs
 *   Static.
 * @returns {Create}
 *   Create a production element.
 */
function productionCreate(_, jsx, jsxs) {
    return create
    /** @type {Create} */
    function create(_, type, props, key) {
        // Only an array when there are 2 or more children.
        const isStaticChildren = Array.isArray(props.children)
        const fn = isStaticChildren ? jsxs : jsx
        return key ? fn(type, props, key) : fn(type, props)
    }
}

/**
 * @param {string | undefined} filePath
 *   Path to file.
 * @param {JsxDev} jsxDEV
 *   Development.
 * @returns {Create}
 *   Create a development element.
 */
function developmentCreate(filePath, jsxDEV) {
    return create
    /** @type {Create} */
    function create(node, type, props, key) {
        // Only an array when there are 2 or more children.
        const isStaticChildren = Array.isArray(props.children)
        const point = pointStart(node)
        return jsxDEV(
            type,
            props,
            key,
            isStaticChildren,
            {
                columnNumber: point ? point.column - 1 : undefined,
                fileName: filePath,
                lineNumber: point ? point.line : undefined
            },
            undefined
        )
    }
}

/**
 * Create props from an element.
 *
 * @param {State} state
 *   Info passed around.
 * @param {Element} node
 *   Current element.
 * @returns {Props}
 *   Props.
 */
function createElementProps(state, node) {
    /** @type {Props} */
    const props = {}
    /** @type {string | undefined} */
    let alignValue
    /** @type {string} */
    let prop

    for (prop in node.properties) {
        if (prop !== 'children' && own.call(node.properties, prop)) {
            const result = createProperty(state, prop, node.properties[prop])

            if (result) {
                const [key, value] = result

                if (
                    state.tableCellAlignToStyle &&
                    key === 'align' &&
                    typeof value === 'string' &&
                    tableCellElement.has(node.tagName)
                ) {
                    alignValue = value
                } else {
                    props[key] = value
                }
            }
        }
    }

    if (alignValue) {
        // Assume style is an object.
        const style = /** @type {Style} */ (props.style || (props.style = {}))
        style[state.stylePropertyNameCase === 'css' ? 'text-align' : 'textAlign'] =
            alignValue
    }

    return props
}

/**
 * Create props from a JSX element.
 *
 * @param {State} state
 *   Info passed around.
 * @param {MdxJsxFlowElementHast | MdxJsxTextElementHast} node
 *   Current JSX element.
 * @returns {Props}
 *   Props.
 */
function createJsxElementProps(state, node) {
    /** @type {Props} */
    const props = {}

    for (const attribute of node.attributes) {
        if (attribute.type === 'mdxJsxExpressionAttribute') {
            if (attribute.data && attribute.data.estree && state.evaluater) {
                const program = attribute.data.estree
                const expression = program.body[0]
                assert(expression.type === 'ExpressionStatement')
                const objectExpression = expression.expression
                assert(objectExpression.type === 'ObjectExpression')
                const property = objectExpression.properties[0]
                assert(property.type === 'SpreadElement')

                Object.assign(
                    props,
                    state.evaluater.evaluateExpression(property.argument)
                )
            } else {
                crashEstree(state, node.position)
            }
        } else {
            // For JSX, the author is responsible of passing in the correct values.
            const name = attribute.name
            /** @type {unknown} */
            let value

            if (attribute.value && typeof attribute.value === 'object') {
                if (
                    attribute.value.data &&
                    attribute.value.data.estree &&
                    state.evaluater
                ) {
                    const program = attribute.value.data.estree
                    const expression = program.body[0]
                    assert(expression.type === 'ExpressionStatement')
                    value = state.evaluater.evaluateExpression(expression.expression)
                } else {
                    crashEstree(state, node.position)
                }
            } else {
                value = attribute.value === null ? true : attribute.value
            }

            // Assume a prop.
            props[name] = /** @type {Props[keyof Props]} */ (value)
        }
    }

    return props
}

/**
 * Create children.
 *
 * @param {State} state
 *   Info passed around.
 * @param {Parents} node
 *   Current element.
 * @returns {Array<Child>}
 *   Children.
 */
function createChildren(state, node, path) {
    /** @type {Array<Child>} */
    const children = []
    let index = -1
    /** @type {Map<string, number>} */
    const countsByName = state.passKeys ? new Map() : emptyMap

    while (++index < node.children.length) {
        const child = node.children[index]
        /** @type {string | undefined} */
        let key

        if (state.passKeys) {
            const name =
                child.type === 'element'
                    ? child.tagName
                    : child.type === 'mdxJsxFlowElement' ||
                    child.type === 'mdxJsxTextElement'
                        ? child.name
                        : undefined

            if (name) {
                const count = countsByName.get(name) || 0
                key = name + '-' + count
                countsByName.set(name, count + 1)
            }
        }

        const childPath = path + '/' + index

        const result = one(state, child, key, childPath)
        if (result !== undefined) children.push(result)
    }

    return children
}

/**
 * Handle a property.
 *
 * @param {State} state
 *   Info passed around.
 * @param {string} prop
 *   Key.
 * @param {Array<number | string> | boolean | number | string | null | undefined} value
 *   hast property value.
 * @returns {Field | undefined}
 *   Field for runtime, optional.
 */
function createProperty(state, prop, value) {
    const info = find(state.schema, prop)

    // Ignore nullish and `NaN` values.
    if (
        value === null ||
        value === undefined ||
        (typeof value === 'number' && Number.isNaN(value))
    ) {
        return
    }

    if (Array.isArray(value)) {
        // Accept `array`.
        // Most props are space-separated.
        value = info.commaSeparated ? commas(value) : spaces(value)
    }

    // React only accepts `style` as object.
    if (info.property === 'style') {
        let styleObject =
            typeof value === 'object' ? value : parseStyle(state, String(value))

        if (state.stylePropertyNameCase === 'css') {
            styleObject = transformStylesToCssCasing(styleObject)
        }

        return ['style', styleObject]
    }

    return [
        state.elementAttributeNameCase === 'react' && info.space
            ? hastToReact[info.property] || info.property
            : info.attribute,
        value
    ]
}

/**
 * Parse a CSS declaration to an object.
 *
 * @param {State} state
 *   Info passed around.
 * @param {string} value
 *   CSS declarations.
 * @returns {Style}
 *   Properties.
 * @throws
 *   Throws `VFileMessage` when CSS cannot be parsed.
 */
function parseStyle(state, value) {
    /** @type {Style} */
    const result = {}

    try {
        styleToObject(value, replacer)
    } catch (error) {
        if (!state.ignoreInvalidStyle) {
            const cause = /** @type {Error} */ (error)
            const message = new VFileMessage('Cannot parse `style` attribute', {
                ancestors: state.ancestors,
                cause,
                ruleId: 'style',
                source: 'hast-util-to-jsx-runtime'
            })
            message.file = state.filePath || undefined
            message.url = docs + '#cannot-parse-style-attribute'

            throw message
        }
    }

    return result

    /**
     * Add a CSS property (normal, so with dashes) to `result` as a DOM CSS
     * property.
     *
     * @param {string} name
     *   Key.
     * @param {string} value
     *   Value
     * @returns {undefined}
     *   Nothing.
     */
    function replacer(name, value) {
        let key = name

        if (key.slice(0, 2) !== '--') {
            if (key.slice(0, 4) === '-ms-') key = 'ms-' + key.slice(4)
            key = key.replace(dashSomething, toCamel)
        }

        result[key] = value
    }
}

/**
 * Create a JSX name from a string.
 *
 * @param {State} state
 *   To do.
 * @param {string} name
 *   Name.
 * @param {boolean} allowExpression
 *   Allow member expressions and identifiers.
 * @returns {unknown}
 *   To do.
 */
function findComponentFromName(state, name, allowExpression) {
    /** @type {Identifier | Literal | MemberExpression} */
    let result

    if (!allowExpression) {
        result = {type: 'Literal', value: name}
    } else if (name.includes('.')) {
        const identifiers = name.split('.')
        let index = -1
        /** @type {Identifier | Literal | MemberExpression | undefined} */
        let node

        while (++index < identifiers.length) {
            /** @type {Identifier | Literal} */
            const prop = isIdentifierName(identifiers[index])
                ? {type: 'Identifier', name: identifiers[index]}
                : {type: 'Literal', value: identifiers[index]}
            node = node
                ? {
                    type: 'MemberExpression',
                    object: node,
                    property: prop,
                    computed: Boolean(index && prop.type === 'Literal'),
                    optional: false
                }
                : prop
        }

        assert(node, 'always a result')
        result = node
    } else {
        result =
            isIdentifierName(name) && !/^[a-z]/.test(name)
                ? {type: 'Identifier', name}
                : {type: 'Literal', value: name}
    }

    // Only literals can be passed in `components` currently.
    // No identifiers / member expressions.
    if (result.type === 'Literal') {
        const name = /** @type {keyof JSX.IntrinsicElements} */ (result.value)

        return own.call(state.components, name) ? state.components[name] : name
    }

    // Assume component.
    if (state.evaluater) {
        return state.evaluater.evaluateExpression(result)
    }

    crashEstree(state)
}

/**
 * @param {State} state
 * @param {Position | undefined} [place]
 * @returns {never}
 */
function crashEstree(state, place) {
    const message = new VFileMessage(
        'Cannot handle MDX estrees without `createEvaluater`',
        {
            ancestors: state.ancestors,
            place,
            ruleId: 'mdx-estree',
            source: 'hast-util-to-jsx-runtime'
        }
    )
    message.file = state.filePath || undefined
    message.url = docs + '#cannot-handle-mdx-estrees-without-createevaluater'

    throw message
}

/**
 * Transform a DOM casing style object to a CSS casing style object.
 *
 * @param {Style} domCasing
 * @returns {Style}
 */
function transformStylesToCssCasing(domCasing) {
    /** @type {Style} */
    const cssCasing = {}
    /** @type {string} */
    let from

    for (from in domCasing) {
        if (own.call(domCasing, from)) {
            cssCasing[transformStyleToCssCasing(from)] = domCasing[from]
        }
    }

    return cssCasing
}

/**
 * Transform a DOM casing style field to a CSS casing style field.
 *
 * @param {string} from
 * @returns {string}
 */
function transformStyleToCssCasing(from) {
    let to = from.replace(cap, toDash)
    // Handle `ms-xxx` -> `-ms-xxx`.
    if (to.slice(0, 3) === 'ms-') to = '-' + to
    return to
}

/**
 * Make `$1` capitalized.
 *
 * @param {string} _
 *   Whatever.
 * @param {string} $1
 *   Single ASCII alphabetical.
 * @returns {string}
 *   Capitalized `$1`.
 */
function toCamel(_, $1) {
    return $1.toUpperCase()
}

/**
 * Make `$0` dash cased.
 *
 * @param {string} $0
 *   Capitalized ASCII leter.
 * @returns {string}
 *   Dash and lower letter.
 */
function toDash($0) {
    return '-' + $0.toLowerCase()
}

// Note: types exposed from `index.d.ts`.
