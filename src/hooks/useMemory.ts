import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useMemory() {
  const [memory, setMemory] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  const loadMemory = useCallback(async () => {
    try {
      const loadedMemory = await invoke<string>("load_memory");
      setMemory(loadedMemory);
      return loadedMemory;
    } catch (error) {
      console.error("Failed to load memory:", error);
      return "";
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveMemory = useCallback(async (content: string) => {
    const updatedMemory = await invoke<string>("save_memory", { content });
    setMemory(updatedMemory);
    return updatedMemory;
  }, []);

  useEffect(() => {
    loadMemory();
  }, [loadMemory]);

  return {
    memory,
    isLoaded,
    loadMemory,
    saveMemory,
  };
}
