import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { getServerSideConfig } from "../config/server";
import md5 from "spark-md5";
import { get } from "../utils/http";
import { I18NConfig } from "next/dist/server/config-shared";

const serverConfig = getServerSideConfig();

function getIP(req: NextRequest) {
  let ip = req.ip ?? req.headers.get("x-real-ip");
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (!ip && forwardedFor) {
    ip = forwardedFor.split(",").at(0) ?? "";
  }

  return ip;
}

async function getObjectFromRequestBodyStream(
  body: ReadableStream<Uint8Array>,
) {
  const input = await body.getReader().read();
  const decoder = new TextDecoder();
  const string = decoder.decode(input.value);
  return JSON.parse(string);
}

const reply_language =
  "the same language as the question, such as English, 中文, 日本語, Español, Français, or Deutsch.";
const WEBSEARCH_PTOMPT_TEMPLATE =
  "Web search results:\n" +
  "\n" +
  "{web_results}\n" +
  "Current date: {current_date}\n" +
  "\n" +
  "Instructions: Using the provided web search results, write a comprehensive reply to the given query. Make sure to cite results using [[number](URL)] notation after the reference. If the provided search results refer to multiple subjects with the same name, write separate answers for each subject.\n" +
  "Query: {query}\n" +
  "Reply in {reply_language} And use the markdown syntax.";

const DdgSearch = async (
  searchQuery: string | number | boolean,
  region: string | undefined,
  headers: Headers,
) => {
  try {
    const response = await get(
      `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`,
      { ...headers },
    );
    const html = await response.text();
    const regex = /vqd='(.*?)'/;
    const match = regex.exec(html);
    const vqd = match && match[1];
    let safesearch_base = { On: 1, Moderate: -1, Off: -2 };
    let PAGINATION_STEP = 25,
      MAX_API_RESULTS = 200,
      page = 1;
    let payload = {
      q: searchQuery,
      l: region,
      p: safesearch_base["On"],
      s: Math.max(PAGINATION_STEP * (page - 1), 0),
      df: new Date().getTime(),
      o: "json",
      vqd: vqd,
    };

    let result = await get(
      "https://links.duckduckgo.com/d.js",
      { ...headers },
      payload,
    );
    return result.json();
  } catch (e) {
    return;
  }
};

export async function search(req: NextRequest) {
  let display_append_str;
  const needSearch = req.headers.get("needSearch");
  if (needSearch == String(true)) {
    const body = req.body && (await getObjectFromRequestBodyStream(req.body));
    try {
      let contents = body.messages
        .filter((message: { role: string }) => message.role === "user") // 过滤出 role 为 user 的 message
        .map((message: { content: string }) => message.content.trim()) // 提取 content 并去除前后空格
        .filter((content: string) => content !== ""); // 过滤出非空的 content

      const lastContent = contents[contents.length - 1];

      let result = await DdgSearch(lastContent, req.geo?.region, req.headers);

      let reference_results: any[] = [];
      let display_append = [];
      if (result["results"]) {
        for (let row of result["results"]) {
          if (!row["n"]) {
            let body = row["a"];
            if (body) {
              let domain_name = row["i"];
              reference_results.push([body, row["u"]]);
              display_append.push(`> - [${domain_name}](${row["u"]})\n`);
              if (reference_results.length > 5) {
                break;
              }
            }
          }
        }
      }
      display_append_str =
        "\n>搜索结果:\n" +
        display_append.join("") +
        ">**搜索数据来源互联网,本站不保证其内容可靠性,安全性及合法性,请谨慎访问**";
      let input = WEBSEARCH_PTOMPT_TEMPLATE.replace("{query}", lastContent)
        .replace(
          "{web_results}",
          reference_results.length > 0
            ? reference_results.join("\n\n")
            : `no web result`,
        )
        .replace("{reply_language}", reply_language)
        .replace(
          "{current_date}",
          new Date().toLocaleString("zh-CN", { hour12: false }),
        );

      for (let i = body.messages.length - 1; i >= 0; i--) {
        if (body.messages[i].role === "user") {
          body.messages[i].content = input;
          break; // 找到并修改后跳出循环
        }
      }
      console.log(`${input}`);
      let modifyReq = new NextRequest(req.url, {
        method: req.method,
        headers: req.headers,
        body: JSON.stringify(body),
        geo: req.geo,
        ip: req.ip,
      });

      return {
        req: modifyReq,
        searchResult: input,
        display_append: display_append_str,
        error: false,
      };
    } catch (e) {
      return {
        error: true,
        message: `search error`,
        req: req,
      };
    }
  } else {
    return {
      error: false,
      req: req,
    };
  }
}
