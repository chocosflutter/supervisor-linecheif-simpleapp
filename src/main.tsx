import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { queryClient, bridgeStoreToQueryCache } from "@/data/queryClient";
import { SUPABASE_MODE } from "@/store/appStore";
import { startOutboxSync } from "@/offline/outbox";
import "./i18n";
import "./index.css";

// Keep React Query cache in sync with mock-store mutations (Phase 0).
bridgeStoreToQueryCache();

// Offline write path: flush the event log on reconnect + periodically (Phase 5).
if (SUPABASE_MODE) startOutboxSync();

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
