"use client";

import React, { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { cn } from "@/lib/utils";

type Calendar22Props = {
  value: Date | null;
  onChange: (date: Date | null) => void;
  isEditing?: boolean;
  className?: string;
  disabled?: (date: Date) => boolean;
  fromDate?: Date;
};

export function Calendar22({ value, onChange, isEditing, className, disabled, fromDate }: Calendar22Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {!isEditing && (
        <Label htmlFor="date" className="px-1">
          Fecha de vencimiento
        </Label>
      )}
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id="date"
            className={cn("w-48 justify-between font-normal", className)}
            type="button"
          >
            {value ? value.toLocaleDateString("es-AR") : "Seleccionar fecha"}
            <ChevronDownIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={value ?? undefined}
            captionLayout="dropdown"
            onSelect={(date) => {
              if (date) {
                onChange(date);
                setOpen(false);
              }
            }}
            disabled={disabled}
            fromDate={fromDate}
          />
          <Button
            type="button"
            variant="ghost"
            className="bg-accent w-full rounded-none text-xs"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            Limpiar fecha
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
