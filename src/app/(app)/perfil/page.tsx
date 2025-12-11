"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/utils/supabase/client";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

function getStrengthLabel(score: number) {
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

const schema = z
  .object({
    actual: z.string().min(1, "Ingresa tu contraseña actual"),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .regex(/[a-z]/, "Debe contener al menos una minúscula")
      .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
      .regex(/[0-9]/, "Debe contener al menos un número")
      .regex(
        /[!@#$%^&*]/,
        "Debe contener al menos un carácter especial (!@#$%^&*)",
      ),
  })
  .refine((data) => data.actual !== data.password, {
    message: "La nueva contraseña no puede ser igual a la anterior.",
    path: ["password"],
  });

type FormValues = z.infer<typeof schema>;

export default function Perfil() {
  const [user, setUser] = useState<any>(null);
  const [serverError, setServerError] = useState<string>("");
  const [serverSuccess, setServerSuccess] = useState<string>("");
  const [showActual, setShowActual] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const supabase = createClient();

  // Obtener usuario
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      actual: "",
      password: "",
    },
  });

  // Fuerza de la contraseña
  const passwordValue = form.watch("password");
  const passwordScore = getPasswordStrength(passwordValue || "");
  const strength = getStrengthLabel(passwordScore);

  // Manejo de envío
  async function onSubmit(values: FormValues) {
    setServerError("");
    setServerSuccess("");
    const email = user?.email;
    if (!email) {
      setServerError("No se pudo obtener el usuario autenticado.");
      return;
    }

    // 1. Reautenticar usuario con la contraseña actual
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: values.actual,
    });
    if (signInError) {
      setServerError("La contraseña actual es incorrecta.");
      return;
    }

    // 2. Cambiar contraseña
    const { error: updateError } = await supabase.auth.updateUser({
      password: values.password,
    });
    if (updateError) {
      setServerError(updateError.message);
      return;
    }

    setServerSuccess("¡Contraseña actualizada con éxito!");
    form.reset();
  }

  return (
    <main className="max-w-md mx-auto mt-12 p-6 bg-background rounded-2xl shadow-xl border">
      <h1 className="text-2xl font-bold mb-4">Perfil de usuario</h1>

      {user ? (
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <span className="block text-muted-foreground mb-1 text-sm">
            Email:
          </span>
          <span className="block text-base font-medium">{user.email}</span>
        </motion.div>
      ) : (
        <div className="text-center mb-8 text-muted-foreground">
          Cargando usuario…
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Contraseña actual */}
          <FormField
            control={form.control}
            name="actual"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contraseña actual</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showActual ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Contraseña actual"
                      {...field}
                      className="pr-10"
                    />
                  </FormControl>
                  <Button
                    type="button"
                    aria-label={showActual ? "Ocultar" : "Mostrar"}
                    className="absolute inset-y-0 right-2 flex items-center px-1 text-muted-foreground"
                    tabIndex={-1}
                    onClick={() => setShowActual((v) => !v)}
                    size="icon"
                    variant="ghost"
                  >
                    {showActual ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Nueva contraseña */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nueva contraseña</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Nueva contraseña"
                      {...field}
                      className="pr-10"
                    />
                  </FormControl>
                  <Button
                    type="button"
                    aria-label={showPassword ? "Ocultar" : "Mostrar"}
                    className="absolute inset-y-0 right-2 flex items-center px-1 text-muted-foreground"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    size="icon"
                    variant="ghost"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </Button>
                </div>
                <FormDescription>
                  Mínimo 8 caracteres, al menos una mayúscula, una minúscula, un
                  número y un carácter especial.
                </FormDescription>
                {/* Barra fuerza */}
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(passwordScore / 5) * 100}%` }}
                  className={cn(
                    "h-2 rounded transition-all mt-2 mb-1",
                    strength.color,
                    passwordValue ? "w-full" : "w-0 bg-gray-200",
                  )}
                  style={{
                    maxWidth: "100%",
                  }}
                />
                {passwordValue && (
                  <motion.span
                    key={strength.text}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "text-xs font-semibold",
                      passwordScore >= 4
                        ? "text-green-600"
                        : passwordScore === 3
                          ? "text-yellow-600"
                          : "text-red-600",
                    )}
                  >
                    {strength.text}
                  </motion.span>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting
              ? "Guardando..."
              : "Actualizar contraseña"}
          </Button>
        </form>
      </Form>

      {/* Alertas de feedback */}
      <motion.div
        className="mt-6 space-y-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: serverError || serverSuccess ? 1 : 0 }}
        transition={{ duration: 0.4 }}
      >
        {serverError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        {serverSuccess && (
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>¡Listo!</AlertTitle>
            <AlertDescription>{serverSuccess}</AlertDescription>
          </Alert>
        )}
      </motion.div>
    </main>
  );
}
