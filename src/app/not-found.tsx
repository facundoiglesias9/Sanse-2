"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex items-center justify-center h-screen px-4">
      <div className="max-w-lg text-center space-y-6">
        <h3 className="text-lg font-semibold text-destructive">Error 404</h3>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Página no encontrada
        </h1>
        <p className="text-muted-foreground">
          Lo sentimos, la página que está buscando no se pudo encontrar.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild>
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
