import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Простой React Query клиент
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false, // По умолчанию не делать запрос при монтировании
      refetchOnReconnect: false, // По умолчанию не делать запрос при переподключении
      staleTime: 1000 * 60, // 1 minute по умолчанию
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
