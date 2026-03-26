"use client";

import { useEffect } from "react";

export default function ProjectRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Project route error boundary:", error);
  }, [error]);

  return (
    <div className="w-full min-h-[40vh] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-sm ring-1 ring-red-100">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
          Project workspace error
        </p>
        <p className="mt-2 text-sm text-red-900">
          This project section could not be rendered. Try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-xl rb-btn-primary px-4 py-2 text-sm font-medium"
        >
          Retry section
        </button>
      </div>
    </div>
  );
}
