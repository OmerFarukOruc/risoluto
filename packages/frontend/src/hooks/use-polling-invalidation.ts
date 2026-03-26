import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function usePollingInvalidation(intervalMs = 5_000): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      queryClient.invalidateQueries({
        predicate: (query) => query.meta?.poll === true,
      });
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [intervalMs, queryClient]);
}
