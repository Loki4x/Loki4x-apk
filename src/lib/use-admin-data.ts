import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { fetchAdminData, type AdminSection } from "@/lib/admin";
import { friendlyApiError } from "@/lib/journal";

/** Muat data satu menu admin tiap layar dibuka, plus tarik-untuk-refresh. */
export function useAdminData<T>(section: AdminSection) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await fetchAdminData<T>(section));
      setError(null);
    } catch (err) {
      setError(friendlyApiError(err));
    }
  }, [section]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { data, setData, error, load, refresh, refreshing };
}
