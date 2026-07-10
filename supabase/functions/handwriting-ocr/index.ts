// Edge function: handwriting-ocr
// Nimmt eine PNG-Data-URL entgegen und lässt den erkannten Text
// via Lovable AI Gateway (google/gemini-2.5-flash) zurückgeben.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY nicht konfiguriert" }, 500);

    const body = await req.json().catch(() => ({}));
    const image = body?.image as string | undefined;
    if (!image || !image.startsWith("data:image/")) {
      return json({ error: "image (PNG data URL) erforderlich" }, 400);
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Du bist ein OCR-System für handschriftliche Notizen (Deutsch/Englisch, technischer Laborkontext). " +
              "Gib ausschließlich den erkannten Text zurück – keine Kommentare, keine Formatierung. " +
              "Wenn das Bild leer ist oder keine Handschrift erkennbar ist, gib einen leeren String zurück.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transkribiere den handschriftlichen Text in diesem Bild." },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error("AI gateway error", resp.status, errBody);
      if (resp.status === 429) return json({ error: "Zu viele Anfragen. Bitte kurz warten." }, 429);
      if (resp.status === 402) return json({ error: "AI-Credits aufgebraucht." }, 402);
      return json({ error: "OCR fehlgeschlagen", details: errBody }, resp.status);
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    return json({ text: String(text).trim() });
  } catch (err: any) {
    console.error("handwriting-ocr", err);
    return json({ error: err?.message ?? "unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
