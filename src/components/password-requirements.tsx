import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PASSWORD_REQUIREMENTS } from "@/lib/password-utils";

interface PasswordRequirementsProps {
  password: string;
  className?: string;
}

export function PasswordRequirements({ password, className }: PasswordRequirementsProps) {
  const requirements = [
    {
      label: `Mínimo ${PASSWORD_REQUIREMENTS.minLength} caracteres`,
      isValid: password.length >= PASSWORD_REQUIREMENTS.minLength,
    },
    {
      label: "Al menos una minúscula",
      isValid: PASSWORD_REQUIREMENTS.lowercase.test(password),
    },
    {
      label: "Al menos una mayúscula",
      isValid: PASSWORD_REQUIREMENTS.uppercase.test(password),
    },
    {
      label: "Al menos un número",
      isValid: PASSWORD_REQUIREMENTS.number.test(password),
    },
    {
      label: "Al menos un carácter especial (!@#$%^&*)",
      isValid: PASSWORD_REQUIREMENTS.symbol.test(password),
    },
  ];

  return (
    <div className={cn("bg-popover border text-popover-foreground shadow-md rounded-md p-3 text-xs space-y-2 w-full z-50", className)}>
      <p className="font-medium mb-1">Requisitos de contraseña:</p>
      <ul className="space-y-1">
        {requirements.map((req, index) => (
          <li key={index} className="flex items-center gap-2">
            {req.isValid ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={cn(req.isValid ? "text-green-600 font-medium" : "text-muted-foreground")}>
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
