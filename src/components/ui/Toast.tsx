/**
 * Toast -- ephemeral notification popup.
 *
 * Auto-dismisses after 2.5 seconds. Renders nothing when message is null.
 * Uses the `.toast` CSS class defined in style.css.
 */
import { useEffect } from 'react';

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    if (message == null) return;

    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (message == null) return null;

  return <div className="toast">{message}</div>;
}
