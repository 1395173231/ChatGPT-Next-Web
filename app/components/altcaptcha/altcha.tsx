"use client"

import React, {useEffect, useRef, useState, forwardRef, useImperativeHandle} from "react";
import dynamic from "next/dynamic";
import {Configure, State} from "@/app/components/altcaptcha/types";
import "altcha"
import {showToast} from "@/app/components/ui-lib";

export const Altcha = forwardRef<{ value: string | null }, Configure>(
    (props: Configure, ref) => {
        const widgetRef = useRef<HTMLElement>(null);
        const [value, setValue] = useState<string | null>(null);

        useImperativeHandle(ref, () => {
            return {
                get value() {
                    return value;
                }
            };
        }, [value])

        useEffect(() => {
            showToast("验证开始, 请耐心等待(由于设备性能差异, 此验证可能在1~45秒钟完成).如果提示验证失败, 代表你的页面可能过时, 请刷新页面后重试")
            const handleStateChange = (ev: Event | CustomEvent) => {
                if ("detail" in ev) {
                    if (ev.detail.state == State.VERIFIED && !!ev?.detail?.payload){
                        setValue(ev?.detail?.payload)
                        showToast("验证通过")
                    }
                }
                props?.onStateChange?.(ev);
            };

            const { current } = widgetRef;

            if (current) {
                current.addEventListener("statechange", handleStateChange);
                return () => current.removeEventListener("statechange", handleStateChange);
            }else{
                console.error("widgetRef is null")
            }
        }, []);

        return <altcha-widget {...props} ref={widgetRef}></altcha-widget>;
    }
);

// Assign a display name to the component
Altcha.displayName = "Altcha";

export default dynamic(() => Promise.resolve(Altcha), { ssr: false });
