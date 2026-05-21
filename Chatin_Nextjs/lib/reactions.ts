interface SendReactionParams {
  accountId: string;
  remoteJid: string;
  messageId: string; // WhatsApp message ID
  emoji: string; // Empty string to remove
  token: string;
}

export async function sendReaction({
  accountId,
  remoteJid,
  messageId,
  emoji,
  token
}: SendReactionParams): Promise<{ success: boolean; error?: string }> {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

    const response = await fetch(`${backendUrl}/api/chats/${accountId}/send-reaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        remoteJid,
        messageId,
        emoji
      })
    });

    const result = await response.json();

    if (!result.success) {
      return { success: false, error: result.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
