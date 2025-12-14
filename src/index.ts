import { handleSupported } from "./handlers/supported";
import { handleVerify } from "./handlers/verify";
import { handleSettle } from "./handlers/settle";
import { config } from "./config";

// CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Add CORS headers to a response
 */
function addCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

const server = Bun.serve({
  port: config.port,

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Handle CORS preflight requests
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    let response: Response;

    try {
      // Route matching
      if (path === "/supported" && method === "GET") {
        response = handleSupported();
      } else if (path === "/verify" && method === "POST") {
        response = await handleVerify(request);
      } else if (path === "/settle" && method === "POST") {
        response = await handleSettle(request);
      } else if (path === "/health" && method === "GET") {
        response = Response.json({ status: "ok", timestamp: Date.now() });
      } else if (path === "/" && method === "GET") {
        response = Response.json({
          name: "x402 Facilitator",
          version: config.x402Version,
          network: config.networkId,
          endpoints: {
            supported: "GET /supported",
            verify: "POST /verify",
            settle: "POST /settle",
            health: "GET /health",
          },
        });
      } else {
        response = Response.json(
          { error: "Not Found", path, method },
          { status: 404 }
        );
      }
    } catch (error) {
      console.error("Unhandled error:", error);
      response = Response.json(
        {
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }

    // Add CORS headers to all responses
    return addCorsHeaders(response);
  },
});

console.log(`
╔═══════════════════════════════════════════════════════════╗
║             x402 Facilitator for QIE Blockchain           ║
╠═══════════════════════════════════════════════════════════╣
║  Network:    ${config.networkId.padEnd(43)}║
║  Listening:  http://localhost:${String(server.port).padEnd(27)}║
╠═══════════════════════════════════════════════════════════╣
║  Endpoints:                                               ║
║    GET  /           - Service info                        ║
║    GET  /supported  - Supported schemes & networks        ║
║    POST /verify     - Verify payment authorization        ║
║    POST /settle     - Execute payment on-chain            ║
║    GET  /health     - Health check                        ║
╚═══════════════════════════════════════════════════════════╝
`);
