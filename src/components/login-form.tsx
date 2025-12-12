"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

const loginSchema = z.object({
  username: z
    .string()
    .min(1, "El usuario es obligatorio"),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const handleSubmit = async (values: LoginFormValues) => {
    const supabase = createClient();

    // Check if input is an email (contains @) or a username
    const isEmail = values.username.includes('@');
    const email = isEmail
      ? values.username
      : `${values.username.toLowerCase().replace(/\s/g, '')}@sanseperfumes.local`;

    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: values.password,
    });

    if (error) {
      toast.error("Error al iniciar sesión", {
        description: error.message,
      });
    } else {
      toast.success("Bienvenido 👋", {
        description: "Has iniciado sesión correctamente",
      });
      router.refresh();
      router.push("/");
    }
  };

  return (
    <div
      className={cn(
        "w-full max-w-md mx-auto rounded-lg border p-8 shadow-md",
        className,
      )}
      {...props}
    >
      <h1 className="text-2xl font-bold text-center mb-6">Iniciar sesión</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="username">Usuario</Label>
                <FormControl>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Tu nombre de usuario"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <FormControl>
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      {...field}
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
              ? "Iniciando sesión..."
              : "Iniciar sesión"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
