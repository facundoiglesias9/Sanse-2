"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getCurrencies, type CurrencyRates } from "@/utils/getCurrencies";

type CurrencyContextType = {
  currencies: CurrencyRates;
  isLoading: boolean;
  error: string | null;
};

const CurrencyContext = createContext<CurrencyContextType>({
  currencies: {},
  isLoading: true,
  error: null,
});

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currencies, setCurrencies] = useState<CurrencyRates>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const data = await getCurrencies();
        if (!data) {
          setError("No se pudieron obtener las monedas");
          setCurrencies({});
          return;
        }

        setError(null);
        setCurrencies(data);
      } catch (err: any) {
        setError(err.message || "Error al obtener monedas");
        setCurrencies({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrencies();
  }, []);

  return (
    <CurrencyContext.Provider value={{ currencies, isLoading, error }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrencies = () => {
  return useContext(CurrencyContext);
};
