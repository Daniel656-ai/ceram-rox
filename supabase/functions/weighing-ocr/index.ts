import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) throw new Error('Missing LOVABLE_API_KEY');

    const { image, mime } = await req.json();
    if (!image || typeof image !== 'string') {
      return new Response(JSON.stringify({ error: 'image (base64 data URL or raw base64) required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const dataUrl = image.startsWith('data:') ? image : `data:${mime || 'image/jpeg'};base64,${image}`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': key,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content:
              'Du liest den angezeigten Zahlenwert einer Laborwaage aus dem Foto. Antworte ausschließlich als reines JSON: {"value": <zahl>, "unit": "<kg|g|mg|t>", "confidence": <0..1>}. Benutze Punkt als Dezimaltrennzeichen. Kein Text drumherum.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Welcher Wert wird auf dem Waagen-Display angezeigt?' },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(JSON.stringify({ error: `AI ${resp.status}: ${text}` }), {
        status: resp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const data = await resp.json();
    const raw: string = data.choices?.[0]?.message?.content ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    let parsed: any = null;
    try {
      parsed = JSON.parse(match ? match[0] : raw);
    } catch {
      parsed = { value: null, unit: null, confidence: 0, raw };
    }
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
