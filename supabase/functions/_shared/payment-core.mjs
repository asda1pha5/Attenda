const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idOf = (value) => typeof value === 'string' ? value : value?.id;
export function campaignToken(value) {
  return typeof value === 'string' && /^[a-z][a-z0-9_-]{0,63}$/i.test(value) && !/\d{7}/.test(value) ? value.toLowerCase() : null;
}
export function attributionMetadata(input = {}, visitorId) {
  const metadata = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
    const value = campaignToken(input?.[key]); if (value) metadata[key] = value;
  }
  if (typeof visitorId === 'string' && uuid.test(visitorId)) metadata.visitor_id = visitorId;
  return metadata;
}
export function validEventId(value) { return typeof value === 'string' && uuid.test(value); }
export function validateSignatureSession(session, expectedPriceId) {
  const meta = session.metadata || {};
  const intent = session.payment_intent;
  const items = session.line_items?.data || [];
  if (session.mode !== 'payment' || session.status !== 'complete' || session.payment_status !== 'paid') throw Error('Payment not complete');
  if (session.amount_total !== 1900 || session.currency !== 'usd' || !expectedPriceId) throw Error('Invalid Signature price');
  if (items.length !== 1 || session.line_items.has_more || items[0].quantity !== 1 || idOf(items[0].price) !== expectedPriceId) throw Error('Invalid Signature product');
  if (!validEventId(meta.user_id) || !validEventId(meta.event_id) || session.client_reference_id !== meta.user_id || meta.plan !== 'signature_pass') throw Error('Invalid purchase ownership');
  if (!intent || typeof intent === 'string' || intent.status !== 'succeeded' || intent.amount_received !== 1900 || intent.currency !== 'usd') throw Error('Payment intent not settled');
  if (intent.metadata?.user_id !== meta.user_id || intent.metadata?.event_id !== meta.event_id || intent.metadata?.plan !== 'signature_pass') throw Error('Payment intent ownership mismatch');
  if (idOf(intent.customer) !== idOf(session.customer)) throw Error('Payment customer mismatch');
  return {
    session_id: session.id, payment_intent_id: intent.id, event_id: meta.event_id, user_id: meta.user_id,
    customer_id: idOf(session.customer) || null, amount: 1900, currency: 'usd',
    ...attributionMetadata(meta, meta.visitor_id),
  };
}
export async function activateSignature(admin, session, expectedPriceId, webhook) {
  const purchase = validateSignatureSession(session, expectedPriceId);
  const { data, error } = await admin.rpc('activate_signature_purchase', { purchase: { ...purchase, webhook_id: webhook.id, webhook_type: webhook.type } });
  if (error || data?.active !== true) throw Error('Activation not confirmed');
  return data;
}

// No receipt is written here: the database transaction records completion last.
export async function fulfillWebhook({ stripe, admin, event, priceId }) {
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    const session = await stripe.checkout.sessions.retrieve(event.data.object.id, { expand: ['payment_intent', 'line_items'] });
    if (session.mode === 'payment') {
      if (session.payment_status !== 'paid') return { received: true, pending: true };
      return { received: true, ...await activateSignature(admin, session, priceId, event) };
    }
    if (session.mode === 'subscription' && idOf(session.subscription)) {
      const subscription = await stripe.subscriptions.retrieve(idOf(session.subscription));
      return syncLegacy(admin, subscription, session, event);
    }
  }
  if (['customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
    // Retrieve current state so an older delivery cannot restore cancelled access.
    const subscription = await stripe.subscriptions.retrieve(event.data.object.id);
    return syncLegacy(admin, subscription, null, event);
  }
  return { received: true, ignored: true };
}
async function syncLegacy(admin, subscription, session, event) {
  const customerId = idOf(subscription.customer);
  const userId = session?.client_reference_id || subscription.metadata?.user_id || null;
  if (!customerId || (userId && !validEventId(userId))) throw Error('Invalid legacy subscription');
  if (session && (idOf(session.customer) !== customerId || (subscription.metadata?.user_id && subscription.metadata.user_id !== userId))) throw Error('Legacy subscription ownership mismatch');
  const { data, error } = await admin.rpc('sync_legacy_signature_subscription', { subscription_data: {
    id: subscription.id, customer_id: customerId, user_id: userId, status: subscription.status,
    webhook_id: event.id, webhook_type: event.type,
    period_end: subscription.items?.data?.[0]?.current_period_end || subscription.current_period_end || null,
  } });
  if (error || data?.processed !== true) throw Error('Legacy subscription update not confirmed');
  return { received: true, legacy: true };
}
