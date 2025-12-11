"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function LoaderTable() {
  return (
    <div className="space-y-4 w-full border rounded-md p-4">
      {/* Header simulado */}
      <div className="flex w-full">
        <Skeleton className="h-6 w-1/4 mr-2" />
        <Skeleton className="h-6 w-1/4 mr-2" />
        <Skeleton className="h-6 w-1/4 mr-2" />
        <Skeleton className="h-6 w-1/4" />
      </div>

      {/* Filas simuladas */}
      {Array.from({ length: 5 }).map((_, idx) => (
        <div key={idx} className="flex w-full space-x-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
}
