var CHATGPT_NEXT_WEB_CACHE = "chatgpt-next-web-cache";
var CHATGPT_NEXT_WEB_FILE_CACHE = "chatgpt-next-web-file";
var a = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
var nanoid = function (e) {
  if (e === void 0) e = 21;
  var t = "";
  var r = crypto.getRandomValues(new Uint8Array(e));
  for (var n = 0; n < e; n++) {
    t += a[63 & r[n]];
  }
  return t;
};

self.addEventListener("activate", function (event) {
  console.log("ServiceWorker activated.");
});

self.addEventListener("install", function (event) {
  self.skipWaiting(); // enable new version
  event.waitUntil(
    caches.open(CHATGPT_NEXT_WEB_CACHE).then(function (cache) {
      return cache.addAll([]);
    })
  );
});

function jsonify(data) {
  return new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" }
  });
}

function upload(request, url) {
  return request.formData().then(function (formData) {
    var file = formData.getAll("file")[0];
    var ext = file.name.split(".").pop();
    if (ext === "blob") {
      ext = file.type.split("/").pop();
    }
    var fileUrl = url.origin + "/api/cache/" + nanoid() + "." + ext;
    return caches.open(CHATGPT_NEXT_WEB_FILE_CACHE).then(function (cache) {
      return cache
        .put(
          new Request(fileUrl),
          new Response(file, {
            headers: {
              "content-type": file.type,
              "content-length": file.size,
              "cache-control": "no-cache", // file already stored on disk
              server: "ServiceWorker"
            }
          })
        )
        .then(function () {
          return jsonify({ code: 0, data: fileUrl });
        });
    });
  });
}

function remove(request, url) {
  return caches.open(CHATGPT_NEXT_WEB_FILE_CACHE).then(function (cache) {
    return cache.delete(request.url).then(function (res) {
      return jsonify({ code: 0 });
    });
  });
}

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (/^\/api\/cache/.test(url.pathname)) {
    if ("GET" === e.request.method) {
      e.respondWith(caches.match(e.request));
    }
    if ("POST" === e.request.method) {
      e.respondWith(upload(e.request, url));
    }
    if ("DELETE" === e.request.method) {
      e.respondWith(remove(e.request, url));
    }
  }
});
