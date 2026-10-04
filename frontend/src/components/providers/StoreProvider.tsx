"use client";

import { setupListeners } from "@reduxjs/toolkit/query";
import { useEffect, useState, type ReactNode } from "react";
import { Provider } from "react-redux";

import { registerStoreForDownloads } from "@/lib/api/download";
import { makeStore, type AppStore } from "@/store";

import { Toaster } from "../ui/Toaster";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState<AppStore>(() => makeStore());
  useEffect(() => {
    registerStoreForDownloads(store);
    return setupListeners(store.dispatch);
  }, [store]);
  return (
    <Provider store={store}>
      {children}
      <Toaster />
    </Provider>
  );
}
