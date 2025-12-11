"use client";
import CalculadoraAvanzadaMargen from "@/app/(app)/herramientas/calculadora-margen/components/CalculadoraAvanzadaMargen";

export default function CalculadoraMargen() {
  return (
    <main className="flex flex-col gap-4 p-4 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-3">
        Calculadora de márgenes de ganancia
      </h1>
      <CalculadoraAvanzadaMargen />
    </main>
  );
}
