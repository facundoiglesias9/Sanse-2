"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string; };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-4">
      <h2 className="text-2xl font-bold">¡Uy! Algo salió mal.</h2>
      <p className="text-muted-foreground">{error.message || "Ha ocurrido un error inesperado."}</p>
      <Button onClick={() => reset()}>Intentar de nuevo</Button>
    </div>
  );
}
