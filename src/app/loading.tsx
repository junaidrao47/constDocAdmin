export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-warning/30 border-t-amber-700" />
        <p className="mt-4 text-sm font-medium">Loading workspace...</p>
      </div>
    </main>
  );
}
