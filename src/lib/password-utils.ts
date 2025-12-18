import { z } from "zod";

export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  lowercase: /[a-z]/,
  uppercase: /[A-Z]/,
  number: /[0-9]/,
  symbol: /[!@#$%^&*]/,
};

export function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= PASSWORD_REQUIREMENTS.minLength) score++;
  if (PASSWORD_REQUIREMENTS.lowercase.test(password)) score++;
  if (PASSWORD_REQUIREMENTS.uppercase.test(password)) score++;
  if (PASSWORD_REQUIREMENTS.number.test(password)) score++;
  if (PASSWORD_REQUIREMENTS.symbol.test(password)) score++;
  return score;
}

export function getStrengthLabel(score: number) {
  switch (score) {
    case 5:
      return { color: "bg-green-500", text: "Muy segura" };
    case 4:
      return { color: "bg-lime-500", text: "Segura" };
    case 3:
      return { color: "bg-yellow-400", text: "Media" };
    case 2:
      return { color: "bg-orange-400", text: "Débil" };
    default:
      return { color: "bg-red-500", text: "Muy débil" };
  }
}

export const passwordSchema = z
  .string()
  .min(
    PASSWORD_REQUIREMENTS.minLength,
    `La contraseña debe tener al menos ${PASSWORD_REQUIREMENTS.minLength} caracteres`
  )
  .regex(PASSWORD_REQUIREMENTS.lowercase, "Debe contener al menos una minúscula")
  .regex(PASSWORD_REQUIREMENTS.uppercase, "Debe contener al menos una mayúscula")
  .regex(PASSWORD_REQUIREMENTS.number, "Debe contener al menos un número")
  .regex(
    PASSWORD_REQUIREMENTS.symbol,
    "Debe contener al menos un carácter especial (!@#$%^&*)"
  );
