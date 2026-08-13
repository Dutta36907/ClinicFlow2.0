import server from "../dist/server/server.js";

export default async function handler(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  const request = new Request(`http://${req.headers.host}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? body : undefined,
  });

  try {
    const response = await server.fetch(request, {}, {});

    res.statusCode = response.status;
    for (const [key, value] of response.headers) {
      // set-cookie can appear multiple times; preserve all values.
      if (key.toLowerCase() === "set-cookie") {
        res.appendHeader("set-cookie", value);
      } else {
        res.setHeader(key, value);
      }
    }

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error("[ssr] handler error:", err?.stack || err);
    res.statusCode = 500;
    res.setHeader("content-type", "text/html; charset=utf-8");
    const detail =
      process.env.NODE_ENV === "production"
        ? ""
        : `<pre>${String(err?.stack || err)}</pre>`;
    res.end(`<h1>Server Error</h1>${detail}`);
  }
}
