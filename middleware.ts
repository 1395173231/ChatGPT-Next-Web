import {NextFetchEvent, NextRequest, NextResponse} from "next/server";
import {getServerSideConfig} from "./app/config/server";
import {Redis} from '@upstash/redis'
import SensitiveWordTool from 'sensitive-word-tool'
import {Ratelimit} from "@upstash/ratelimit";
import "isomorphic-fetch";


export const config = {
    matcher: ["/api/openai/:function*"],
};

const serverConfig = getServerSideConfig();

function getIP(req: NextRequest) {
    let ip = req.ip ?? req.headers.get("x-real-ip");
    const forwardedFor = req.headers.get("x-forwarded-for");

    if (!ip && forwardedFor) {
        ip = forwardedFor.split(",").at(0) ?? "";
    }
    return ip;
}

async function getObjectFromRequestBodyStream(body: ReadableStream<Uint8Array>) {
    const input = await body.getReader().read();
    const decoder = new TextDecoder();
    const string = decoder.decode(input.value);
    return JSON.parse(string);
}

let sensitiveWordTool: SensitiveWordTool

function getRedisClient() {
    let redis: Redis
    if (serverConfig.kvUrl && serverConfig.kvToken) {
        redis = new Redis({
            url: serverConfig.kvUrl,
            token: serverConfig.kvToken
        })
    } else {
        redis = Redis.fromEnv()
    }
    return redis
}

type Unit = "ms" | "s" | "m" | "h" | "d";
type Duration = `${number} ${Unit}` | `${number}${Unit}`;

function getRatelimit() {
    let redis = getRedisClient()
    return {
        free: new Ratelimit({
            redis,
            analytics: true,
            prefix: "ratelimit:free",
            limiter: Ratelimit.slidingWindow(Number(serverConfig.freeLimit.split('/')[0]), <Duration>serverConfig.freeLimit.split('/')[1]),
        }),
        paid: new Ratelimit({
            redis,
            analytics: true,
            prefix: "ratelimit:paid",
            limiter: Ratelimit.slidingWindow(Number(serverConfig.paidLimit.split('/')[0]), <Duration>serverConfig.paidLimit.split('/')[1]),
        })
    }
}



async function init_mint() {
    // startTime
    if (sensitiveWordTool) return
    console.log("init SensitiveWordTool")
    let keys = await getRedisClient().smembers("bad_word")
    sensitiveWordTool = new SensitiveWordTool({wordList: keys})
    console.log("init SensitiveWordTool done")
}

const NextResponseText = (body: any) => {
    return new NextResponse(body, {
        status: 200,
    })
}

export async function middleware(req: NextRequest, event: NextFetchEvent) {
    await init_mint()
    const body = req.body && await getObjectFromRequestBodyStream(req.body);
    const ip = getIP(req)
    let ratelimit = getRatelimit();
    if (ratelimit && ratelimit.free) {
        const {success, pending, limit, reset, remaining} = await ratelimit.free.limit(ip ?? "127.0.0.1", req);
        event.waitUntil(pending);
        if (!success) {
            return NextResponseText(
                `当前ip:${ip}请求频繁,请稍后重试`)
        }
    }


    if (body && sensitiveWordTool) {
        const messages = body.messages.map((currentValue: { content: any; }) => {
            return currentValue.content;
        }).join(',')
        sensitiveWordTool.addWords(["六四运动"])
        let status = sensitiveWordTool.match(messages)
        for (let s of status) {
            if (s.length > 2) {
                return NextResponseText(
                    `聊天记录存在违禁词${s},请删除当前会话重试`)
            }
        }
    }

    return NextResponse.next({
        request: {
            headers: req.headers,
        },
    });
}
