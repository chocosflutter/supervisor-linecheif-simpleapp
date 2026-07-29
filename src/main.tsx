import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { queryClient, bridgeStoreToQueryCache, restoreQueryCache, persistQueryCache } from "@/data/queryClient";
import { SUPABASE_MODE, useApp } from "@/store/appStore";
import { startOutboxSync } from "@/offline/outbox";
import { restoreStore, startAutoPersist } from "@/offline/persist";
import "./i18n";
import "./index.css";

// Restore persisted store from IndexedDB (offline survival).
// Then mount the app — if restore succeeded, hydrated=true so screens render immediately.
async function boot() {
  if (SUPABASE_MODE) {
    const restored = await restoreStore();
    await restoreQueryCache();
    startAutoPersist();
    startOutboxSync();
    setInterval(persistQueryCache, 30_000);

    // If we restored a cached user and we're offline, skip auth bootstrap
    // (it would hang trying to refresh the token). Mark ready immediately.
    if (restored && useApp.getState().user && !navigator.onLine) {
      useApp.setState({ authReady: true });
    }
  }

  // Keep React Query cache in sync with mock-store mutations (Phase 0).
  bridgeStoreToQueryCache();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <div className="aurora" />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

boot();
