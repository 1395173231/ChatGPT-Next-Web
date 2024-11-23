import React, { type DOMAttributes } from "react"

export interface Strings {
    error: string
    expired: string
    footer: string
    label: string
    verified: string
    verifying: string
    waitAlert: string
}

export interface Configure {
    auto?: 'off' | 'onfocus' | 'onload' | 'onsubmit';
    blockspam?: boolean;
    challengeurl?: string;
    challengejson?: string;
    debug?: boolean;
    delay?: number;
    expire?: number;
    floating?: 'auto' | 'top' | 'bottom' | 'false' | '' | boolean;
    floatinganchor?: string;
    floatingoffset?: number;
    hidefooter?: boolean;
    hidelogo?: boolean;
    maxnumber?: number;
    mockerror?: boolean;
    name?: string;
    obfuscated?: string;
    refetchonexpire?: boolean;
    spamfilter?: boolean | 'ipAddress';
    strings?: string;
    test?: boolean | number;
    verifyurl?: string;
    workers?: number;
    workerurl?: string;
    onStateChange?: (ev: Event | CustomEvent) => void
}

export interface Challenge {
    algorithm: string
    challenge: string
    maxnumber?: number
    salt: string
    signature: string
}

// export interface SpamFilter {
//   email?: string | false
//   expectedLanguages?: string[]
//   expectedCountries?: string[]
//   fields?: string[] | false
//   ipAddress?: string | false
//   timeZone?: string | false
// }

// export interface ServerVerificationPayload {
//   email?: string
//   expectedCountries?: string[]
//   expectedLanguages?: string[]
//   fields?: Record<string, string>
//   ipAddress?: string
//   payload: string
//   timeZone?: string
// }

// export interface Solution {
//   number: number
//   took: number
//   worker?: boolean
// }

// export interface Payload {
//   algorithm: string
//   challenge: string
//   number: number
//   salt: string
//   signature: string
//   test?: boolean
//   took: number
// }

export enum State {
  ERROR = "error",
  VERIFIED = "verified",
  VERIFYING = "verifying",
  UNVERIFIED = "unverified",
  EXPIRED = "expired",
}

type CustomElement<T> = Partial<T & DOMAttributes<T> & { children: any ,ref?:React.RefObject<HTMLElement>} >

declare global {
    namespace JSX {
        interface IntrinsicElements {
            ["altcha-widget"]: CustomElement<Configure>
        }
    }
}

