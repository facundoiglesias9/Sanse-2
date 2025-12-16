import React from "react";
import { Hammer } from "lucide-react";

export function MaintenanceView() {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-full bg-background text-foreground animate-in fade-in duration-700">
      <div className="space-y-6 text-center max-w-md px-6">
        <div className="flex justify-center mb-8">
          <div className="p-4 rounded-full bg-secondary/30 ring-1 ring-border/50">
            <Hammer className="h-8 w-8 text-foreground/80" />
          </div>
        </div>

        <h1 className="text-xl md:text-2xl font-medium tracking-[0.2em] uppercase text-foreground/90">
          En Mantenimiento
        </h1>

        <div className="h-px w-16 bg-border mx-auto my-6" />

        <p className="text-sm md:text-base text-muted-foreground leading-relaxed font-light">
          Estamos realizando ajustes para mejorar tu experiencia.
          <br className="hidden sm:block" />
          Volveremos en breve.
        </p>
      </div>
    </div>
  );
}
