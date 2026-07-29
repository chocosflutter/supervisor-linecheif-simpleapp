import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { queryClient, bridgeStoreToQueryCache } from "@/data/queryClient";
import { SUPABASE_MODE } from "@/store/appStore";
import { startOutboxSync } from "@/offline/outbox";
import { restoreStore, startAutoPersist } from "@/offline/persist";
import "./i18n";
import "./index.css";

// Restore persisted store from IndexedDB (offline survival).
// Then mount the app — if restore succeeded, hydrated=true so screens render immediately.
async function boot() {
  if (SUPABASE_MODE) {
    await restoreStore();
    startAutoPersist();
    startOutboxSync();
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
