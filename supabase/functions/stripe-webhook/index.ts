import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

// Webhook must always return 200 to Stripe — errors are logged, not propagated
const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Read raw body for signature verification (must happen before any parsing)
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    console.error("Webhook: missing stripe-signature header");
    return new Response("Missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // Look up Supabase user by stripe_customer_id
        const { data: profile, error: lookupError } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (lookupError || !profile) {
          console.error("checkout.session.completed: could not find profile for customer", customerId, lookupError);
          break;
        }

        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({
            is_premium: true,
            stripe_subscription_id: subscriptionId,
            premium_expires_at: null, // Active subscription — no expiry
          })
          .eq("id", profile.id);

        if (updateError) {
          console.error("checkout.session.completed: failed to update profile:", updateError);
        } else {
          console.log("checkout.session.completed: premium activated for user", profile.id);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: profile, error: lookupError } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (lookupError || !profile) {
          console.error("subscription.updated: could not find profile for customer", customerId, lookupError);
          break;
        }

        if (subscription.cancel_at_period_end) {
          // Cancellation scheduled — set expiry date, keep premium active until then
          const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
          const { error: updateError } = await supabaseAdmin
            .from("profiles")
            .update({ premium_expires_at: expiresAt })
            .eq("id", profile.id);

          if (updateError) {
            console.error("subscription.updated: failed to set premium_expires_at:", updateError);
          } else {
            console.log("subscription.updated: cancellation scheduled, expires", expiresAt);
          }
        } else if (subscription.status === "canceled" || subscription.status === "unpaid") {
          // Subscription is no longer active
          const { error: updateError } = await supabaseAdmin
            .from("profiles")
            .update({
              is_premium: false,
              stripe_subscription_id: null,
              premium_expires_at: null,
            })
            .eq("id", profile.id);

          if (updateError) {
            console.error("subscription.updated: failed to revoke premium:", updateError);
          } else {
            console.log("subscription.updated: premium revoked for user", profile.id);
          }
        } else if (subscription.status === "active" && !subscription.cancel_at_period_end) {
          // Subscription reactivated (e.g. user re-subscribed or re-enabled after cancellation)
          const { error: updateError } = await supabaseAdmin
            .from("profiles")
            .update({
              is_premium: true,
              stripe_subscription_id: subscription.id,
              premium_expires_at: null,
            })
            .eq("id", profile.id);

          if (updateError) {
            console.error("subscription.updated: failed to reactivate premium:", updateError);
          } else {
            console.log("subscription.updated: premium reactivated for user", profile.id);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: profile, error: lookupError } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (lookupError || !profile) {
          console.error("subscription.deleted: could not find profile for customer", customerId, lookupError);
          break;
        }

        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({
            is_premium: false,
            stripe_subscription_id: null,
            premium_expires_at: null,
          })
          .eq("id", profile.id);

        if (updateError) {
          console.error("subscription.deleted: failed to revoke premium:", updateError);
        } else {
          console.log("subscription.deleted: premium revoked for user", profile.id);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn("invoice.payment_failed: customer", invoice.customer, "subscription", invoice.subscription);
        // Flag for monitoring — no immediate premium revocation (Stripe retries)
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (processingError) {
    // Log but always return 200 so Stripe doesn't retry
    console.error("Error processing webhook event:", event.type, processingError);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

serve(handler);
