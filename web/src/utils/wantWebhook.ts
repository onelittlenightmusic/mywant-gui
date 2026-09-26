export async function postWantWebhook(wantId: string, payload: Record<string, unknown>, logPrefix: string): Promise<boolean> {
  try {
    await fetch(`/api/v1/webhooks/${wantId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (err) {
    console.error(`[${logPrefix}] webhook failed:`, err);
    return false;
  }
}
