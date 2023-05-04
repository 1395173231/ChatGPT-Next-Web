const CHATGPT_NEXT_WEB_CACHE = "chatgpt-next-web-cache";

self.addEventListener("activate", function (event) {
  console.log("ServiceWorker activated.");
});

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CHATGPT_NEXT_WEB_CACHE).then(function (cache) {
      return cache.addAll([]);
    }),
  );
});

self.addEventListener('fetch', event => {
    console.log(event.request.url)
    if (!isAssetUrl(event.request.url) && event.request.destination !== 'document') return
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return fetch(event.request)
                    .then(resp => {
                        let respClone = resp.clone()
                        caches.open(CHATGPT_NEXT_WEB_CACHE).then(cache => {
                            cache.put(event.request, respClone)
                        })
                        return resp
                    })
                    .catch(err => {
                        return response
                    })
            })
    )
})
function isAssetUrl(assetUrl) {
    const filterAssetUrl = pureAssetUrl(assetUrl)
    return isAssetRegx(filterAssetUrl)
}

function pureAssetUrl(assetUrl) {
    const decodeAssetUrl = decodeURIComponent(assetUrl)
    const lastIndex = decodeAssetUrl.lastIndexOf('/'); // 链接最后一个 /
    let lastSymbol1 = Math.max(0, decodeAssetUrl.indexOf('#', lastIndex)); // 匹配链接中第一个 #
    let lastSymbol2 = Math.max(0, decodeAssetUrl.indexOf('?', lastIndex)); // 匹配链接中第一个 ?
    let forwardIndex = [lastSymbol1, lastSymbol2].filter(num => num > 0); // 获取最靠前的一个特殊字符类型
    if (forwardIndex.length) {
        forwardIndex.push(forwardIndex[0])
        forwardIndex = Math.min(...forwardIndex)
    } else {
        forwardIndex = decodeAssetUrl.length
    }
    return decodeAssetUrl.substring(0, forwardIndex)
}

function isAssetRegx(text) {
    return /\.(png|jpg|jpeg|svg|css|json|ico)$/.test(text)
}