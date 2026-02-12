import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/utils/utils';

interface NotificationLogProps {
  logs: Array<{ id: string; message: string; type: 'info' | 'warning' | 'error' | 'evacuation' }>;
  className?: string;
}

export function NotificationLog({ logs, className }: NotificationLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  // Scroll to bottom when logs change if auto-scroll is enabled
  useEffect(() => {
    if (isAutoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isAutoScroll]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // If user scrolls up (is not at bottom), disable auto-scroll
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
    setIsAutoScroll(isAtBottom);
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'border-l-red-500 text-red-400';
      case 'evacuation':
        return 'border-l-red-600 text-red-300';
      case 'warning':
      return 'border-l-yellow-600 text-yellow-200';
      default:
        return 'border-l-yellow-600 text-yellow-200';
    }
  }

  return (
    <div
      className={cn("bg-black/40 backdrop-blur-sm p-4 overflow-y-auto font-mono text-xs border border-[#8b4513]/30", className)}
      onScroll={handleScroll}
    >
      <div className="space-y-1">
        {logs.length === 0 && (
          <div className="text-[#8b4513]/50 italic text-center py-4">No recent activity</div>
        )}
        {logs.map((log) => (
          <div
            key={log.id}
            className={cn(
              "pl-2 py-1 border-l-2 border-opacity-50 hover:bg-white/5 transition-colors",
              getLogColor(log.type)
            )}
          >
            <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]</span>
            {log.message}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
