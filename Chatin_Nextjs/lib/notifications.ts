// Notification sound and browser notification utilities

let notificationSound: HTMLAudioElement | null = null;

// Initialize notification sound
export function initNotificationSound() {
  if (typeof window !== 'undefined') {
    notificationSound = new Audio('/sounds/notification.mp3');
    notificationSound.volume = 0.5; // 50% volume
  }
}

// Play notification sound
export function playNotificationSound() {
  if (notificationSound) {
    notificationSound.currentTime = 0; // Reset to start
    notificationSound.play().catch(err => {
      console.error('Failed to play notification sound:', err);
    });
  }
}

// Request browser notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

// Show browser notification
export function showBrowserNotification(title: string, options?: NotificationOptions) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });

      // Auto-close notification after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      return notification;
    } catch (err) {
      console.error('Failed to show notification:', err);
    }
  }
}

// Show new message notification
export function notifyNewMessage(
  senderName: string,
  messageText: string,
  onClick?: () => void
) {
  // Play sound
  playNotificationSound();

  // Show browser notification
  const notification = showBrowserNotification(senderName, {
    body: messageText.length > 100 ? messageText.substring(0, 100) + '...' : messageText,
    tag: 'new-message', // Replace previous notification
    requireInteraction: false,
    silent: true // We already play sound separately
  });

  // Handle notification click
  if (notification && onClick) {
    notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
  }
}
