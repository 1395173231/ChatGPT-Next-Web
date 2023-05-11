import md5 from "spark-md5";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      OPENAI_API_KEY?: string;
      CODE?: string;
      PROXY_URL?: string;
      VERCEL?: string;
      HIDE_USER_API_KEY?: string; // disable user's api key input
      KV_UPSTASH_URL?: string;
      KV_UPSTASH_TOKEN?: string;
    }
  }
}

const ACCESS_CODES = (function getAccessCodes(): Set<string> {
  const code = process.env.CODE;

  try {
    const codes = (code?.split(",") ?? [])
      .filter((v) => !!v)
      .map((v) => md5.hash(v.trim()));
    return new Set(codes);
  } catch (e) {
    return new Set();
  }
})();

export const getServerSideConfig = () => {
  if (typeof process === "undefined") {
    throw Error(
      "[Server Config] you are importing a nodejs-only module outside of nodejs",
    );
  }
  let index = 0; // 当前下标，初始化为 0
  const getNextElement = (arr: string | any[]) => {
    return () => {
      // 获取当前下标对应的元素，同时将下标指向下一个位置
      const element = arr[index];
      index = (index + 1) % arr.length; // 轮换到下一个位置
      return element;
    };
  };
  let delimiter = process.env.OPENAI_API_KEY_DELIMITER || ",";
  return {
    apiKey: process.env.OPENAI_API_KEY,
    apiKeyNext: () => {
      return process.env.OPENAI_API_KEY?.includes(delimiter)
        ? getNextElement(process.env.OPENAI_API_KEY.trim()?.split(delimiter))()
        : process.env.OPENAI_API_KEY;
    },
    keyNum: process.env.OPENAI_API_KEY?.trim()?.split(delimiter).length,
    code: process.env.CODE,
    codes: ACCESS_CODES,
    needCode: ACCESS_CODES.size > 0,
    proxyUrl: process.env.PROXY_URL,
    isVercel: !!process.env.VERCEL,
    hideUserApiKey: !!process.env.HIDE_USER_API_KEY,
    freeLimit: process.env.FREE_LIMIT ?? "10/30s",
    paidLimit: process.env.PAID_LIMIT ?? "10/10s",
    kvUrl: process.env.KV_REST_API_URL,
    kvToken: process.env.KV_REST_API_TOKEN,
    prefixProxy: process.env.GLOBAL_PREFIX_PROXY,
  };
};
