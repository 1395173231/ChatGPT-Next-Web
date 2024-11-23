"use client"

import React, {useEffect, useState} from "react"
import dynamic from "next/dynamic";
import {useTheme} from "next-themes";
declare global {
    interface Window {
        procaptcha: any; // or specify the correct type instead of 'any'
    }
}
// 定义 ProCaptchaOptions 接口
export interface ProCaptchaOptions {
    siteKey: string;
    callback?: string | ((data: any) => void);
    theme?: 'light' | 'dark';
    captchaType?: 'frictionless' | 'image' | 'pow';
    'chalexpired-callback'?: string | (() => void);
    'error-callback'?: string | (() => void);
    'close-callback'?: string | (() => void);
    'open-callback'?: string | (() => void);
    'expired-callback'?: string | (() => void);
    'failed-callback'?: string | (() => void);
    'reset-callback'?: string | (() => void);
    'challenge-valid-length'?: number;
    language?: string;
}

export interface ProConfig {
    onVerify?: (data:any) => void;
    onExpire?: () => void;
}

export function ProCaptcha(props: ProConfig) {
    const uTheme = useTheme();
    const [isLightMode, setIsLightMode] = useState(uTheme.theme === "light");
    useEffect(() => {
        if(typeof document == "undefined" || typeof window == "undefined" ){
            return
        }

        function onCaptchaVerified(output:any) {
            console.log('Captcha verified, output: ' + JSON.stringify(output))
        }
        // 处理验证码出错
        function onCaptchaError() {
            console.error("Captcha encountered an error.");
            if (window.procaptcha) {
                window.procaptcha.reset(); // 出错时重置验证码
            }
        }

        // 处理验证码过期
        function onCaptchaExpired() {
            console.warn("Captcha expired.");
            if (window.procaptcha) {
                window.procaptcha.reset(); // 验证码过期时重置
            }
            if (props.onExpire) {
                props.onExpire()
            }
        }
        if (window.procaptcha) {
            const captchaContainer = document.getElementById('procaptcha-container')
            // Render the CAPTCHA explicitly on a container with id "procaptcha-container"
            const options: ProCaptchaOptions = {
                siteKey: "5HMxhJJs1BigmGJrSKqokqfL1sBSjpxkUuLondnrti3ES7MW",
                theme: "dark",  // 可选：支持 'light' 或 'dark'
                callback: props.onVerify ?? onCaptchaVerified,  // 验证成功后的回调函数
                'error-callback': onCaptchaError,  // 错误回调
                'close-callback': ()=>{
                    document.body.style.pointerEvents = "none";
                },
                'open-callback': ()=>{
                    document.body.style.pointerEvents = "";
                },
                'expired-callback': onCaptchaExpired,  // 过期回调
                language: "zh",  // 可选：设置语言
                captchaType: "image",  // 可选：设置验证码类型
            };


            window.procaptcha.render(captchaContainer, options)
        }
    }, []);
    // bind altcha script to the document head
    return <div id="procaptcha-container"></div>
}

export default dynamic(() => Promise.resolve(ProCaptcha), { ssr: false })
