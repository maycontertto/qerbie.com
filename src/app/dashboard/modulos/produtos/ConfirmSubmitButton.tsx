"use client";

import type { MouseEvent, ReactNode } from "react";

export function ConfirmSubmitButton({
  confirmMessage,
  children,
  className,
}: {
  confirmMessage: string;
  children: ReactNode;
  className?: string;
}) {
  function onClick(event: MouseEvent<HTMLButtonElement>) {
    const ok = window.confirm(confirmMessage);
    if (!ok) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return (
    <button type="submit" onClick={onClick} className={className}>
      {children}
    </button>
  );
}
