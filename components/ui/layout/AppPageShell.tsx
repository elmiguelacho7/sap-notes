/**
 * Shared outer page shell for consistent alignment across the app.
 * Use as the single root wrapper for page content.
 */
export function AppPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[1440px] mx-auto px-6 lg:px-8 py-8 flex flex-col gap-8">
      {children}
    </div>
  );
}
