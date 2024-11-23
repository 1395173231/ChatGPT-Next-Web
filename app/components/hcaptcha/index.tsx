// HCaptcha.tsx
"use client"

import React, { useRef } from "react";
import dynamic from "next/dynamic";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import {corsPath} from "@/app/utils/cors";
import {ApiPath} from "@/app/constant"; // 确保已安装此依赖

export interface HCaptchaConfig {
    onVerify?: (token: string) => void;
    onExpire?: () => void;
    endpoint?: string;
    assethost?: string;
    imghost?: string;
    scriptSource?: string;
    sitekey?: string;
}

export function HCaptchaComponent(props: HCaptchaConfig) {
    const captcha = useRef<HCaptcha>(null);

    return (
        <HCaptcha
            ref={captcha}
            theme="light"
            //@ts-ignore
            endpoint={"https://api-hcaptcha.eqing.tech"}
            assethost={`${corsPath(ApiPath.Cors)}${"https:/newassets.hcaptcha.com"}`}
            imghost={`${corsPath(ApiPath.Cors)}${"https:/imgs3.hcaptcha.com"}`}
            scriptSource={`${corsPath(ApiPath.Cors)}${"https:/js.hcaptcha.com/1/api.js"}`}
            sitekey="f62580b1-4c7d-4d2d-bbf3-b52bd664bb14"
            onVerify={(token) => {
                if (props.onVerify) {
                    props.onVerify(token);
                }
            }}
            onOpen={() => {
                document.body.style.pointerEvents = "";
            }}
            onClose={() => {
                document.body.style.pointerEvents = "none";
            }}
            onExpire={() => {
                if (props.onExpire) {
                    props.onExpire();
                }
                captcha.current?.resetCaptcha();
            }}
        />
    );
}

// 导出动态组件
export default dynamic(() => Promise.resolve(HCaptchaComponent), { ssr: false });
