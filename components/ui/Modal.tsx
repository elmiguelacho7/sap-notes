import type { ReactNode } from "react";

export function Modal({
  children,
  onClose,
  className = "",
}: {
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-[1px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`rounded-2xl border border-[rgb(var(--rb-surface-border))]/90 bg-[rgb(var(--rb-surface))]/98 shadow-[0_24px_56px_-28px_rgba(15,23,42,0.3)] max-w-md w-full ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-5 pb-0 ${className}`}>{children}</div>;
}

export function ModalTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-lg font-semibold text-[rgb(var(--rb-text-primary))] ${className}`}>{children}</h2>;
}

export function ModalBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function ModalFooter({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex gap-2 pt-4 p-5 ${className}`}>{children}</div>;
}
