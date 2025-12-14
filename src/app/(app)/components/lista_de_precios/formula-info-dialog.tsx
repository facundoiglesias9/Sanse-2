import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";

export function FormulaInfoDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 ml-2 text-muted-foreground hover:text-primary">
          <Info className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cómo se calculan los costos y precios</DialogTitle>
          <DialogDescription>
            Explicación detallada de la lógica de costos basada en densidad y concentración.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          <section>
            <h3 className="font-semibold text-lg mb-2">Costos</h3>
            <div className="bg-muted/50 p-4 rounded-lg border space-y-3">
              <p className="font-medium">
                1. Calculamos cuánto nos cuesta <strong>1 gramo de esencia</strong>.
              </p>
              <p className="text-muted-foreground pl-4 border-l-2">
                (Precio de Lista ÷ Tamaño del Frasco)
              </p>

              <p className="font-medium pt-2">
                2. Multiplicamos ese valor por la <strong>receta del proveedor</strong>.
              </p>
              <p className="text-muted-foreground pl-4 border-l-2">
                (Precio x Gramo × Gramos Configurados)
              </p>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-lg mb-2">Ejemplo Rápido</h3>
            <div className="space-y-1">
              <p>Si el frasco de 30g de esencia nos sale <strong>$6.000</strong>:</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                <li>1 gramo = <strong>$200</strong> ($6.000 ÷ 30)</li>
                <li>La receta lleva <strong>15g</strong>.</li>
                <li>Costo de Esencia = <strong>$3.000</strong> ($200 × 15).</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2 italic">
                * A este valor luego se le suma el frasco y otros insumos.
              </p>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">2. Precios de Venta</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 border rounded-md">
                <h4 className="font-medium mb-1">Precio Minorista</h4>
                <p className="text-muted-foreground mb-2">Suma de costos + ganancia.</p>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  (Costo + Frasco) * (1 + Margen%)
                </code>
              </div>
              <div className="p-3 border rounded-md">
                <h4 className="font-medium mb-1">Precio Mayorista</h4>
                <p className="text-muted-foreground mb-2">Precio Minorista con descuento.</p>
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  Precio Minorista * 0.85
                </code>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
