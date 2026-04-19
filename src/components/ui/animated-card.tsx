'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  onClick?: () => void;
  delay?: number;
  className?: string;
}

export function AnimatedCard({ icon, title, description, gradient, onClick, delay = 0, className }: AnimatedCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative rounded-xl p-[1px] overflow-hidden text-left',
        'animate-card-fade-in',
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Shimmer gradient border */}
      <div className={cn(
        'absolute inset-0 rounded-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500',
        'animate-shimmer',
        gradient
      )} />

      {/* Inner card */}
      <div className="relative rounded-[11px] bg-card p-4 h-full flex flex-col gap-2 transition-all duration-300 group-hover:bg-accent/50 group-hover:scale-[1.02] group-hover:shadow-lg">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110',
            gradient
          )}>
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </button>
  );
}
