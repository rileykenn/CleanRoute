import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-03-25.dahlia',
  });
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  );
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature') || '';

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Stripe webhook signature verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (subscriptionId) {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
          const tier = determineTier(subscription);

          await getSupabaseAdmin()
            .from('organizations')
            .update({
              subscription_status: 'active',
              subscription_tier: tier,
            })
            .eq('stripe_customer_id', customerId);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const tier = determineTier(subscription);
        const status = mapStripeStatus(subscription.status);

        await getSupabaseAdmin()
          .from('organizations')
          .update({
            subscription_status: status,
            subscription_tier: tier,
          })
          .eq('stripe_customer_id', customerId);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await getSupabaseAdmin()
          .from('organizations')
          .update({
            subscription_status: 'canceled',
          })
          .eq('stripe_customer_id', customerId);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await getSupabaseAdmin()
          .from('organizations')
          .update({
            subscription_status: 'past_due',
          })
          .eq('stripe_customer_id', customerId);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Error processing webhook:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

function determineTier(subscription: Stripe.Subscription): string {
  const priceId = subscription.items?.data?.[0]?.price?.id;
  // Map price IDs to tiers — these will be configured per Stripe account
  const tierMap: Record<string, string> = {
    // These will be replaced with actual Stripe price IDs
    [process.env.STRIPE_PRICE_BASIC || 'price_basic']: 'basic',
    [process.env.STRIPE_PRICE_PRO || 'price_pro']: 'pro',
    [process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise']: 'enterprise',
  };
  return tierMap[priceId || ''] || 'pro';
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  const statusMap: Record<string, string> = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'past_due',
    incomplete: 'trialing',
    incomplete_expired: 'canceled',
    paused: 'canceled',
  };
  return statusMap[status] || 'trialing';
}
