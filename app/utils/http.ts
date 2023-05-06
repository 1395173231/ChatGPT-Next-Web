import { getServerSideConfig } from "@/app/config/server";

type HttpMethod = "GET" | "POST";

interface RequestProps {
  url: string;
  method: HttpMethod;
  headers?: HeadersInit;
  body?: any;
}

let serverConfig = getServerSideConfig();
const request = async ({
  url,
  method,
  headers,
  body,
}: RequestProps): Promise<any> => {
  let header;
  try {
    if (method === "GET") {
      if (!url.includes("?")) {
        url += "?";
      }
    } else {
      headers = { ...headers, "Content-Type": "application/json" };
    }

    if (body) {
      if (!url.includes("&")) {
        url += "&";
      }
      url += `${new URLSearchParams(body).toString()}`;
    }

    if (serverConfig.prefixProxy) {
      url = serverConfig.prefixProxy + "?" + url;
      header = {
        "x-cors-headers": headers ? JSON.stringify(headers) : undefined,
      };
    }
    console.log(`new [${url}]`);
    return await fetch(url, {
      method,
      headers: {
        ...headers,
        ...header,
      },
      body: method == "POST" ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const get = async (
  url: string,
  headers?: HeadersInit,
  body?: any,
): Promise<any> => {
  return request({ url, method: "GET", headers, body });
};

export const post = async (
  url: string,
  headers?: HeadersInit,
  body?: any,
): Promise<any> => {
  return request({ url, method: "POST", headers, body });
};
