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
<<<<<<< HEAD
  React.useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("/sw.js").then(
          function (registration) {
            console.log("Service Worker registrado con éxito:", registration.scope);
          },
          function (err) {
            console.log("Fallo en el registro del Service Worker:", err);
          }
        );
      });
    }
  }, []);

=======
>>>>>>> 691132e2d938874488506d3085094b5708e80dd0
  return <NextThemeProvider {...props}>{children}</NextThemeProvider>;
}
