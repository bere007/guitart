// Supabase Edge Function: create-checkout-session
//
// Called by payment.html with the logged-in user's access token.
// - If STRIPE_SECRET_KEY is set as a function secret, it creates a real
//   Stripe Checkout session and returns its hosted URL.
// - If no Stripe key is configured yet, it marks the enrollment paid using
//   the service-role key (server-side, RLS-exempt) and returns a demo
//   success redirect -- this is what keeps the site fully working before
//   you've connected a real payment provider.
//
// Deploy: supabase functions deploy create-checkout-session
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_test_...

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const PRICE_AMOUNT = Number(Deno.env.get('PRICE_AMOUNT') ?? '2000'); // in the smallest currency unit
const PRICE_CURRENCY = Deno.env.get('PRICE_CURRENCY') ?? 'usd';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Не авторизован' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { origin } = await req.json().catch(() => ({ origin: null }));
    const returnOrigin = origin || req.headers.get('origin') || '';

    if (!STRIPE_SECRET_KEY) {
      await admin
        .from('enrollments')
        .update({ paid: true, paid_at: new Date().toISOString() })
        .eq('user_id', user.id);

      return new Response(
        JSON.stringify({ mode: 'demo', redirect: `${returnOrigin}/payment.html?status=success` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: { user_id: user.id },
      line_items: [
        {
          price_data: {
            currency: PRICE_CURRENCY,
            unit_amount: PRICE_AMOUNT,
            product_data: { name: 'GuitArt — курс, недели 2–8' },
          },
          quantity: 1,
        },
      ],
      success_url: `${returnOrigin}/payment.html?status=success`,
      cancel_url: `${returnOrigin}/payment.html?status=cancel`,
    });

    return new Response(JSON.stringify({ mode: 'stripe', redirect: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
