import { getLoginUrl } from "@/const";
import { api } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};
  const queryClient = useQueryClient();
  const [location] = useLocation();

  // Проверяем, находимся ли мы на странице логина
  const isLoginPage = location === redirectPath || location === "/login";

  // Проверяем, есть ли данные в кэше перед выполнением запроса
  const cachedData = queryClient.getQueryData(["auth", "me"]);
  const hasCachedData = cachedData !== undefined;

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => {
      console.log("[useAuth] Making request to /api/auth/me");
      return api.auth.me();
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Не делать запрос при монтировании, если данные уже есть
    refetchOnReconnect: false, // Не делать запрос при переподключении
    // Запрос выполняется только если:
    // 1. Не на странице логина
    // 2. Нет данных в кэше
    // 3. window доступен
    enabled: !isLoginPage && typeof window !== "undefined" && !hasCachedData,
    staleTime: Infinity, // Данные никогда не устаревают автоматически
    gcTime: 1000 * 60 * 10, // 10 minutes
    // Отключаем все автоматические обновления
    networkMode: "offlineFirst", // Использовать кэш, если есть
    // Используем начальные данные из кэша, если они есть
    initialData: hasCachedData ? (cachedData as any) : undefined,
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.auth.logout(),
    onSuccess: () => {
      queryClient.setQueryData(["auth", "me"], null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      // Ignore errors on logout
      console.error("Logout error:", error);
    } finally {
      queryClient.setQueryData(["auth", "me"], null);
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    }
  }, [logoutMutation, queryClient]);

  // Сохраняем в localStorage только при изменении user, не при каждом рендере
  useEffect(() => {
    if (meQuery.data !== undefined) {
      localStorage.setItem("manus-runtime-user-info", JSON.stringify(meQuery.data));
    }
  }, [meQuery.data]);

  const state = useMemo(() => {
    const user = meQuery.data ?? null;
    return {
      user,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(user),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  // Убираем useEffect с редиректом - он может вызывать циклы
  // Редирект теперь обрабатывается в ProtectedRoute

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
