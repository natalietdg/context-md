// Enhanced medical transcript analysis with improved security (Summary output parsing)
// Supabase Edge Function (Deno)

const MAX_REQUEST_SIZE = 1024 * 50; // 50KB limit
const MAX_REQUESTS_PER_MINUTE = 20;

// Rate limiting tracking
const requestLog = new Map<string, number[]>(); // IP -> timestamps array

const ALLOWED_ORIGINS = new Set<string>([
  "https://contextmd.netlify.app",
  "http://localhost:3000",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://contextmd.netlify.app";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-api-key",
    "Vary": "Origin",
  } as Record<string, string>;
}

Deno.serve(async (req: Request) => {
  // CORS Headers
  const corsHeaders = cors(req);

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // 1. Apply rate limiting
    const clientIP = req.headers.get("x-forwarded-for") || "unknown";

    if (!requestLog.has(clientIP)) {
      requestLog.set(clientIP, []);
    }
    const now = Date.now();
    const clientRequests = requestLog.get(clientIP)!;

    // Remove entries older than 1 minute
    const oneMinuteAgo = now - 60_000;
    const recentRequests = clientRequests.filter((timestamp) => timestamp > oneMinuteAgo);
    requestLog.set(clientIP, recentRequests);

    // Check if rate limit exceeded
    if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
      return new Response(
        JSON.stringify({ error: "Too many requests", retryAfter: "60 seconds" }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
        },
      );
    }

    // Add current request to log
    recentRequests.push(now);
    requestLog.set(clientIP, recentRequests);

    // 2. Check request size
    const contentLengthHeader = req.headers.get("content-length");
    const contentLength = contentLengthHeader ? parseInt(contentLengthHeader) : 0;
    if (contentLength > MAX_REQUEST_SIZE) {
      return new Response(
        JSON.stringify({ error: "Payload too large" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Check API key (optional enhancement)
    const apiKey = req.headers.get("x-api-key");
    const API_KEYS = (Deno.env.get("ALLOWED_API_KEYS") || "").split(",").filter(Boolean);
    const API_KEY_REQUIRED = Deno.env.get("API_KEY_REQUIRED") === "true";
    if (API_KEY_REQUIRED && (!apiKey || !API_KEYS.includes(apiKey))) {
      return new Response(
        JSON.stringify({ error: "Invalid or missing API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse incoming request body
    const { transcript, language, outputLanguage } = await req.json();

    // Validate input
    if (!transcript || !language || !outputLanguage) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch Sea Lion API Key from environment variables
    const SEA_LION_API_KEY = Deno.env.get("SEA_LION_API_KEY");
    if (!SEA_LION_API_KEY) {
      console.error("Sea Lion API Key not configured");
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Prepare Sea Lion API request
    const seaLionResponse = await fetch("https://api.sea-lion.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        accept: "text/plain",
        Authorization: `Bearer ${SEA_LION_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        max_completion_tokens: 200,
        messages: [
          { role: "system", content: "You are a medical assistant that extracts key information from medical transcripts." },
          {
            role: "user",
            content: `Analyze the following medical transcript. 
            Provide a summary focusing on:
            1. Chief symptoms or primary complaint
            2. Recommended treatment plan
            3. Any important medical caveats
            4. List of medications mentioned
            5. Check for any potential medication conflicts`,
          },
          { role: "user", content: JSON.stringify(transcript) },
        ],
        model: "aisingapore/Llama-SEA-LION-v3-70B-IT",
      }),
    });

    // Check if request was successful
    if (!seaLionResponse.ok) {
      const errorText = await seaLionResponse.text();
      console.error(`Sea Lion API Error: ${errorText}`);
      return new Response(
        JSON.stringify({ error: "External API error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse Sea Lion API response
    const result = await seaLionResponse.json();

    const messageContent: string = result?.choices?.[0]?.message?.content ?? "";
    const lines = messageContent.split("\n").map((l: string) => l.trim()).filter(Boolean);

    const getAfter = (prefix: string) =>
      lines.find((line: string) => line.toLowerCase().startsWith(prefix.toLowerCase()))
        ?.slice(prefix.length)
        .trim();

    const transformedResponse = {
      symptoms: getAfter("Symptoms:") || "No specific symptoms found",
      treatment: getAfter("Treatment Plan:") || "No specific treatment plan found",
      caveats: getAfter("Caveats:") || "No specific medical caveats found",
      medications:
        lines
          .filter((line: string) => line.toLowerCase().startsWith("medication:"))
          .map((line: string) => {
            const medName = line.slice("Medication:".length).trim();
            return { name: medName, conflict: false as boolean, warning: null as string | null };
          }) || [],
      ...(Deno.env.get("ENVIRONMENT") === "development" ? { rawSeaLionData: result } : {}),
    };

    // Return response
    return new Response(JSON.stringify(transformedResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing Sea Lion analysis:", error);
    // Don't expose detailed error messages to clients
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
