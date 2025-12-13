"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an analytics service
        console.error("Error en página de notas:", error);
    }, [error]);

    return (
        <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-4">
            <h2 className="text-2xl font-bold text-destructive">¡Ups! Algo salió mal.</h2>
            <p className="text-muted-foreground text-center max-w-md">
                {error.message || "Ocurrió un error inesperado al cargar las notas."}
            </p>
            <div className="p-4 bg-muted rounded-md text-xs font-mono max-w-lg overflow-auto">
                {error.stack}
            </div>
            <Button onClick={() => reset()}>Intentar de nuevo</Button>
        </div>
    );
}
