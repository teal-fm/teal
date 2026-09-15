import http from "node:http";
import net from "node:net";

const listenPort = Number.parseInt(process.env.DEV_PROXY_PORT ?? "8081", 10);
const webPort = Number.parseInt(process.env.DEV_WEB_PORT ?? "8082", 10);
const apiPort = Number.parseInt(process.env.DEV_API_PORT ?? "3000", 10);
const publicOrigin =
  process.env.DEV_PUBLIC_ORIGIN ?? `http://localhost:${listenPort}`;

function targetPort(pathname) {
  return pathname.startsWith("/xrpc/") ? apiPort : webPort;
}

const server = http.createServer((request, response) => {
  if (request.url === "/client-metadata.json") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify(
        {
          redirect_uris: [`${publicOrigin}/auth/callback`],
          response_types: ["code"],
          grant_types: ["authorization_code", "refresh_token"],
          scope: "atproto transition:generic",
          token_endpoint_auth_method: "none",
          application_type: "web",
          client_id: `${publicOrigin}/client-metadata.json`,
          client_name: "teal",
          client_uri: publicOrigin,
          dpop_bound_access_tokens: true,
        },
        null,
        2,
      ),
    );
    return;
  }

  const proxyRequest = http.request(
    {
      hostname: "127.0.0.1",
      port: targetPort(request.url ?? "/"),
      path: request.url,
      method: request.method,
      headers: { ...request.headers, host: request.headers.host },
    },
    (proxyResponse) => {
      response.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
      proxyResponse.pipe(response);
    },
  );

  proxyRequest.on("error", (error) => {
    if (!response.headersSent) {
      response.writeHead(502, { "content-type": "text/plain" });
    }
    response.end(`Development server unavailable: ${error.message}\n`);
  });
  request.pipe(proxyRequest);
});

server.on("upgrade", (request, socket, head) => {
  const upstream = net.connect(webPort, "127.0.0.1", () => {
    const headers = Object.entries(request.headers)
      .map(([name, value]) => `${name}: ${value}`)
      .join("\r\n");
    upstream.write(
      `${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${headers}\r\n\r\n`,
    );
    upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });

  upstream.on("error", () => socket.destroy());
});

server.listen(listenPort, "127.0.0.1", () => {
  console.log(
    `Development proxy listening on http://127.0.0.1:${listenPort} (${publicOrigin})`,
  );
});
