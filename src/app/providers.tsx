"use client";

import dynamic from "next/dynamic";
import * as React from "react";

const NextThemeProvider = dynamic(
  () => import("@/components/theme-provider").then((e) => e.ThemeProvider),
  {
    ssr: false,
  }
);

export function Providers({ children, ...props }: any) {
  return <NextThemeProvider {...props}>{children}</NextThemeProvider>;
}
