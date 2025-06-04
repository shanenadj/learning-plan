import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm"

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabaseAdmin            = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

serve(async (req: Request) => {
  // 1) Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin":  "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type",
      },
    })
  }

  // 2) Common headers for all JSON responses
  const commonHeaders = {
    "access-control-allow-origin":     "*",
    "access-control-expose-headers":   "Authorization",
    "content-type":                    "application/json",
  }

  // 3) Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: commonHeaders }
    )
  }

  try {
    // 4) Parse the incoming JSON from React
    const { filePath, userId } = await req.json()
    //    e.g. filePath = "abc123/1622467890123.pdf"

    // 5) Slight delay to ensure the upload to campaign-files is fully registered
    await new Promise((res) => setTimeout(res, 500))

    // 6) Build the key where we’ll re-upload in campaign-outputs
    const justFilename = filePath.split("/").pop()       // e.g. "1622467890123.pdf"
    const destKey      = `${userId}/${justFilename}`     // e.g. "abc123/1622467890123.pdf"

    // 7) Generate a public URL for the source file in campaign-files
    const {
      data: { publicUrl: sourceUrl },
      error: sourceUrlErr,
    } = supabaseAdmin
      .storage
      .from("campaign-files")
      .getPublicUrl(filePath)

    if (sourceUrlErr || !sourceUrl) {
      console.error("Error getting public URL for source:", sourceUrlErr)
      return new Response(
        JSON.stringify({ error: "Could not get source URL" }),
        { status: 500, headers: commonHeaders }
      )
    }

    // 8) Fetch the raw bytes from that public URL
    let fetched: Response
    try {
      fetched = await fetch(sourceUrl)
    } catch (networkErr) {
      console.error("Network error fetching source file:", networkErr)
      return new Response(
        JSON.stringify({ error: "Failed to download source file" }),
        { status: 500, headers: commonHeaders }
      )
    }
    if (!fetched.ok) {
      console.error("Source download returned status", fetched.status)
      return new Response(
        JSON.stringify({ error: "Source file not found" }),
        { status: 500, headers: commonHeaders }
      )
    }

    // 9) Read the bytes into a Uint8Array
    const arrayBuffer = await fetched.arrayBuffer()
    const fileBytes   = new Uint8Array(arrayBuffer)

    // 10) Upload those bytes into campaign-outputs under destKey
    const { data: uploadData, error: uploadErr } = await supabaseAdmin
      .storage
      .from("campaign-outputs")
      .upload(destKey, fileBytes, {
        contentType:  fetched.headers.get("Content-Type") ?? undefined,
        cacheControl: "3600",
        upsert:       false,
      })

    if (uploadErr) {
      console.error("Error uploading to campaign-outputs:", uploadErr)
      return new Response(
        JSON.stringify({ error: uploadErr.message }),
        { status: 500, headers: commonHeaders }
      )
    }

    // 11) Generate a public URL for the newly uploaded file in campaign-outputs
    const {
      data: { publicUrl: finalUrl },
      error: finalUrlErr,
    } = supabaseAdmin
      .storage
      .from("campaign-outputs")
      .getPublicUrl(destKey)

    if (finalUrlErr || !finalUrl) {
      console.error("Error getting public URL for destination:", finalUrlErr)
      return new Response(
        JSON.stringify({ error: "Could not get final URL" }),
        { status: 500, headers: commonHeaders }
      )
    }

    // 12) Return the final public URL
    return new Response(
      JSON.stringify({ publicUrl: finalUrl }),
      { status: 200, headers: commonHeaders }
    )
  } catch (err) {
    console.error("Function caught an exception:", err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: {
          "access-control-allow-origin": "*",
          "content-type":                "application/json",
        },
      }
    )
  }
})
