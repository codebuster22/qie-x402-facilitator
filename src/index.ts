import { facilitator } from "./facilitator";
import { PORT } from "./config";
import { account } from "./config";

console.log("Facilitator address:", account.address);

// CORS headers for cross-origin requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// HTTP server
const server = Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      let result: unknown;

      if (req.method === "GET" && url.pathname === "/supported") {
        result = facilitator.getSupported();
      } else if (req.method === "POST" && url.pathname === "/verify") {
        const body = (await req.json()) as {
          paymentPayload: Parameters<typeof facilitator.verify>[0];
          paymentRequirements: Parameters<typeof facilitator.verify>[1];
        };
        result = await facilitator.verify(
          body.paymentPayload,
          body.paymentRequirements
        );
      } else if (req.method === "POST" && url.pathname === "/settle") {
        const body = (await req.json()) as {
          paymentPayload: Parameters<typeof facilitator.settle>[0];
          paymentRequirements: Parameters<typeof facilitator.settle>[1];
        };
        result = await facilitator.settle(
          body.paymentPayload,
          body.paymentRequirements
        );
        console.log(result);
      } else if (req.method === "GET" && url.pathname === "/health") {
        result = { status: "ok", timestamp: Date.now() };
      } else if (req.method === "GET" && url.pathname === "/") {
        result = {
          name: "x402 Facilitator for QIE",
          network: "eip155:1990",
          facilitator: account.address,
          endpoints: ["/supported", "/verify", "/settle", "/health"],
        };
      } else {
        return Response.json(
          { error: "Not Found" },
          { status: 404, headers: corsHeaders }
        );
      }

      return Response.json(result, { headers: corsHeaders });
    } catch (error) {
      console.error("Error:", error);
      return Response.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500, headers: corsHeaders }
      );
    }
  },
});

console.log(`
x402 Facilitator for QIE Blockchain
===================================
Network:    eip155:1990 (QIE Mainnet)
Listening:  http://localhost:${server.port}
Endpoints:  /supported, /verify, /settle, /health
`);
