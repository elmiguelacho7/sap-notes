"use client";

import { useEffect } from "react";

export default function PrivateRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Private route error boundary:", error);
  }, [error]);

  return (
    <div className="w-full min-h-[50vh] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-sm ring-1 ring-red-100">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
          Something went wrong
        </p>
        <p className="mt-2 text-sm text-red-900">
          We could not load this workspace view. Try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-xl rb-btn-primary px-4 py-2 text-sm font-medium"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
