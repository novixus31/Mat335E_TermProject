/**
 * Mask phone number - show first 3 and last 4 digits, rest as *
 * Example: 905551234567 -> 905*****4567
 * @param phoneNumber - Phone number to mask
 * @param role - User role (admin/superadmin see full number, manager/user see masked)
 */
export function maskPhoneNumber(phoneNumber: string, role?: string): string {
  if (!phoneNumber) return phoneNumber;

  // Admin and superadmin can see full phone numbers
  if (role === 'admin' || role === 'superadmin') {
    return phoneNumber;
  }

  // Manager and user see masked phone numbers
  if (phoneNumber.length < 7) return phoneNumber;

  const first3 = phoneNumber.slice(0, 3);
  const last4 = phoneNumber.slice(-4);
  const middleLength = phoneNumber.length - 7;
  const masked = '*'.repeat(middleLength);

  return `${first3}${masked}${last4}`;
}

/**
 * Format timestamp to readable time
 */
export function formatMessageTime(timestamp: Date | string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);

  if (diffInHours < 24) {
    // Show time if today
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else if (diffInHours < 48) {
    // Show "Yesterday" if within 48 hours
    return 'Yesterday';
  } else {
    // Show date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
