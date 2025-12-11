import { forwardRef, useCallback, useEffect, useState, useRef } from "react";
import { NumericFormat, NumericFormatProps } from "react-number-format";
import { Input } from "@/components/ui/input";

export interface NumberInputProps
  extends Omit<NumericFormatProps, "value" | "onValueChange"> {
  stepper?: number; // Paso de unidad al usar flechas
  thousandSeparator?: string; // Separador de miles (por defecto ".")
  placeholder?: string; // Placeholder del input
  defaultValue?: number; // Valor inicial si el componente no es controlado
  min?: number; // Límite inferior permitido
  max?: number; // Límite superior permitido
  value?: number; // Valor controlado (si se usa como controlado)
  suffix?: string; // Sufijo a mostrar (ej: " kg")
  prefix?: string; // Prefijo a mostrar (ej: "$ ")
  onValueChange?: (value: number | undefined) => void; // Callback con el valor numérico (o undefined si vacío)
  fixedDecimalScale?: boolean; // Forzar cantidad fija de decimales al mostrar
  decimalScale?: number; // Cantidad de decimales permitidos
  decimalSeparator?: string; // Separador decimal (por defecto ",")
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      stepper,
      thousandSeparator = ".",
      decimalSeparator = ",",
      placeholder,
      defaultValue,
      min = -Infinity,
      max = Infinity,
      onValueChange,
      fixedDecimalScale = false,
      decimalScale = 0,
      suffix,
      prefix,
      value: controlledValue,
      ...props
    },
    ref,
  ) => {
    // Ref interno + combinación con el ref externo
    const internalRef = useRef<HTMLInputElement>(null);
    const combinedRef =
      (ref as React.RefObject<HTMLInputElement>) || internalRef;

    // Estado interno del valor cuando no es controlado
    const [value, setValue] = useState<number | undefined>(
      controlledValue ?? defaultValue,
    );

    // Incrementar con flecha arriba o stepper
    const handleIncrement = useCallback(() => {
      setValue((prev) =>
        prev === undefined
          ? stepper ?? 1
          : Math.min(prev + (stepper ?? 1), max),
      );
    }, [stepper, max]);

    // Decrementar con flecha abajo o stepper
    const handleDecrement = useCallback(() => {
      setValue((prev) =>
        prev === undefined
          ? -(stepper ?? 1)
          : Math.max(prev - (stepper ?? 1), min),
      );
    }, [stepper, min]);

    // Atajos de teclado: ↑ y ↓ cuando el input tiene foco
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (document.activeElement === combinedRef.current) {
          if (e.key === "ArrowUp") handleIncrement();
          else if (e.key === "ArrowDown") handleDecrement();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleIncrement, handleDecrement, combinedRef]);

    // Si viene un valor controlado desde afuera, sincronizar
    useEffect(() => {
      if (controlledValue !== undefined) {
        setValue(controlledValue);
      }
    }, [controlledValue]);

    // Cambio de valor desde react-number-format:
    // - values.floatValue es el número parseado (respeta separadores)
    // - values.value es el número sin formato en string
    const handleChange = (values: {
      value: string;
      floatValue: number | undefined;
    }) => {
      const nuevo =
        values.floatValue === undefined ? undefined : values.floatValue;
      setValue(nuevo);
      onValueChange?.(nuevo);
    };

    // Al salir de foco, forzar límites min/max y sincronizar visualmente
    const handleBlur = () => {
      if (value === undefined) return;
      const inputEl = combinedRef.current;
      if (value < min) {
        setValue(min);
        if (inputEl) inputEl.value = String(min);
        onValueChange?.(min);
      } else if (value > max) {
        setValue(max);
        if (inputEl) inputEl.value = String(max);
        onValueChange?.(max);
      }
    };

    return (
      <div className="flex items-center">
        <NumericFormat
          value={value}
          onValueChange={handleChange}
          thousandSeparator={thousandSeparator}
          decimalSeparator={decimalSeparator}
          decimalScale={decimalScale}
          fixedDecimalScale={fixedDecimalScale}
          allowNegative={min < 0}
          onBlur={handleBlur}
          max={max}
          min={min}
          suffix={suffix}
          prefix={prefix}
          customInput={Input}
          placeholder={placeholder}
          className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none relative"
          getInputRef={combinedRef}
          {...props}
        />
      </div>
    );
  },
);
