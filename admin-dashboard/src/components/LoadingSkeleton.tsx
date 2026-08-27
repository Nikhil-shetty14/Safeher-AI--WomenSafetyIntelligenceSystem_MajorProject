import React from 'react';

export default function LoadingSkeleton({ className = '', h = 'h-4' }: { className?: string; h?: string }) {
  return <div className={`${h} rounded bg-slate-800 animate-pulse ${className}`} />;
}
