// @ts-ignore
import { unreachable } from 'devlop'
import { Jsx, toJsxRuntime } from './hast-util-to-jsx-runtime'
import { urlAttributes } from 'html-url-attributes'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { VFile } from 'vfile'
import type { Element, ElementContent, Nodes, Parents } from 'hast'
import type { Options as RemarkRehypeOptions } from 'remark-rehype'
import type { PluggableList } from 'unified'
import {ReactElement, ReactNode, useEffect, useRef, useState} from 'react'
import {AllowElement, UrlTransform } from "react-markdown";
import {Component, ExtraProps} from "./hast-util-to-jsx-runtime/lib/components";
import {LRUMap} from "lru_map";


interface Options {
    allowElement?: AllowElement | null | undefined
    allowedElements?: ReadonlyArray<string> | null | undefined
    children?: string | null | undefined
    className?: string | null | undefined
    components?: Components | null | undefined
    disallowedElements?: ReadonlyArray<string> | null | undefined
    rehypePlugins?: PluggableList | null | undefined
    remarkPlugins?: PluggableList | null | undefined
    remarkRehypeOptions?: Readonly<RemarkRehypeOptions> | null | undefined
    skipHtml?: boolean | null | undefined
    unwrapDisallowed?: boolean | null | undefined
    urlTransform?: UrlTransform | null | undefined
    enabledCache?: boolean | null |undefined
}

const emptyPlugins: PluggableList = []
const emptyRemarkRehypeOptions: Readonly<RemarkRehypeOptions> = {
    allowDangerousHtml: true
}
const safeProtocol = /^(https?|ircs?|mailto|xmpp)$/i

type Components = {
    [TagName in keyof JSX.IntrinsicElements]:
    | Component<JSX.IntrinsicElements[TagName] & ExtraProps>
    | keyof JSX.IntrinsicElements
}

// Add NodeCacheMap type
type NodeCacheMap = LRUMap<string, ReactElement>
type NodesCacheMap = LRUMap<string, Nodes>


export function IncrementalMarkdown(options: Readonly<Options>): JSX.Element {
    const allowedElements = options.allowedElements
    const allowElement = options.allowElement
    const children = options.children || ''
    const className = options.className
    const components = options.components
    const disallowedElements = options.disallowedElements
    const rehypePlugins = options.rehypePlugins || emptyPlugins
    const remarkPlugins = options.remarkPlugins || emptyPlugins
    const remarkRehypeOptions = options.remarkRehypeOptions
        ? { ...options.remarkRehypeOptions, ...emptyRemarkRehypeOptions }
        : emptyRemarkRehypeOptions
    const skipHtml = options.skipHtml
    const unwrapDisallowed = options.unwrapDisallowed
    const enabledCache = options.enabledCache || false
    const urlTransform = options.urlTransform || defaultUrlTransform

    const processorRef = useRef(
        unified()
            .use(remarkParse)
            .use(remarkPlugins)
            .use(remarkRehype, remarkRehypeOptions)
            .use(rehypePlugins)
    )
    const MAP_SIZE = 500 ;
    const nodeCache = useRef<NodeCacheMap>(new LRUMap(MAP_SIZE))
    const prevNodeCache = useRef<NodesCacheMap>(new LRUMap(MAP_SIZE))
    const file = new VFile()
    if (typeof children === 'string') {
        file.value = children
    } else {
        unreachable(
            'Unexpected value `' +
            children +
            '` for `children` prop, expected `string`'
        )
    }

    if (allowedElements && disallowedElements) {
        unreachable(
            'Unexpected combined `allowedElements` and `disallowedElements`, expected one or the other'
        )
    }

    const mdastTree = processorRef.current.parse(file)
    let hastTree = processorRef.current.runSync(mdastTree, file) as Nodes
    // Wrap in `div` if there's a class name.
    if (className) {
        hastTree = {
            type: 'element',
            tagName: 'div',
            properties: { className },
            children: (hastTree.type === 'root' ? hastTree.children : [hastTree]) as Array<ElementContent>
        }
    }
    // 在每次渲染后更新缓存
    useEffect(() => {
        if (!prevNodeCache.current) {
            prevNodeCache.current = new LRUMap(MAP_SIZE)
        }
        prevNodeCache.current.set("",hastTree)
        if (!nodeCache.current) {
            nodeCache.current = new LRUMap(MAP_SIZE)
        }
    })
    // @ts-ignore
    visit(hastTree, transform)
    // 使用新的节点级转换
    return enabledCache?toJsxRuntime(hastTree, {
        parentCache: prevNodeCache.current,
        Fragment,
        components,
        ignoreInvalidStyle: true,
        jsx:jsx as Jsx,
        jsxs:jsxs as Jsx,
        passKeys: true,
        passNode: true,
        nodeCache: nodeCache.current,
    }):toJsxRuntime(hastTree, {
        Fragment,
        components,
        ignoreInvalidStyle: true,
        jsx:jsx as Jsx,
        jsxs:jsxs as Jsx,
        passKeys: true,
        passNode: true,
    })

    function transform(node: any, index: number, parent: any) {
        if (node.type === 'raw' && parent && typeof index === 'number') {
            if (skipHtml) {
                parent.children.splice(index, 1)
            } else {
                parent.children[index] = {type: 'text', value: node.value}
            }

            return index
        }

        if (node.type === 'element') {
            /** @type {string} */
            let key

            for (key in urlAttributes) {
                if (
                    Object.hasOwn(urlAttributes, key) &&
                    Object.hasOwn(node.properties, key)
                ) {
                    const value = node.properties[key]
                    const test = urlAttributes[key]
                    if (test === null || test.includes(node.tagName)) {
                        node.properties[key] = urlTransform(String(value || ''), key, node)
                    }
                }
            }
        }

        if (node.type === 'element') {
            let remove = allowedElements
                ? !allowedElements.includes(node.tagName)
                : disallowedElements
                    ? disallowedElements.includes(node.tagName)
                    : false

            if (!remove && allowElement && typeof index === 'number') {
                remove = !allowElement(node, index, parent)
            }

            if (remove && parent && typeof index === 'number') {
                if (unwrapDisallowed && node.children) {
                    parent.children.splice(index, 1, ...node.children)
                } else {
                    parent.children.splice(index, 1)
                }

                return index
            }
        }
    }
}

function defaultUrlTransform(value: string, key: string, node: Readonly<Element>): string {
    const colon = value.indexOf(':')
    const questionMark = value.indexOf('?')
    const numberSign = value.indexOf('#')
    const slash = value.indexOf('/')

    if (
        colon < 0 ||
        (slash > -1 && colon > slash) ||
        (questionMark > -1 && colon > questionMark) ||
        (numberSign > -1 && colon > numberSign) ||
        safeProtocol.test(value.slice(0, colon))
    ) {
        return value
    }

    return ''
}
