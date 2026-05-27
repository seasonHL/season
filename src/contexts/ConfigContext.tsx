import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Config } from '../types';

interface ConfigContextType {
  config: Config;
  isLoaded: boolean;
  saveConfig: (newConfig: Config) => Promise<void>;
  loadConfig: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<Config>({ base_url: '', api_key: '', model: 'deepseek-v4-pro' });
  const [isLoaded, setIsLoaded] = useState(false);

  const saveConfig = useCallback(async (newConfig: Config) => {
    try {
      console.log('ConfigContext - Saving config:', newConfig);
      await invoke('save_config', { config: newConfig });
      setConfig(newConfig);
      console.log('ConfigContext - Config saved successfully');
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      console.log('ConfigContext - Loading config...');
      const loadedConfig = await invoke<Config>('load_config');
      console.log('ConfigContext - Loaded config:', loadedConfig);
      setConfig(loadedConfig);
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  return (
    <ConfigContext.Provider value={{ config, isLoaded, saveConfig, loadConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfigContext = (): ConfigContextType => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfigContext must be used within a ConfigProvider');
  }
  return context;
};
