import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Config } from '../types';

export const useConfig = () => {
  const [config, setConfig] = useState<Config>({ base_url: '', api_key: '', model: 'deepseek-v4-pro' });
  const [isLoaded, setIsLoaded] = useState(false);

  const saveConfig = async (newConfig: Config) => {
    try {
      console.log('useConfig - Saving config:', newConfig);
      await invoke('save_config', { config: newConfig });
      setConfig(newConfig);
      console.log('useConfig - Config saved successfully');
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const loadConfig = async () => {
    try {
      console.log('useConfig - Loading config...');
      const loadedConfig = await invoke<Config>('load_config');
      console.log('useConfig - Loaded config:', loadedConfig);
      setConfig(loadedConfig);
      setIsLoaded(true);
    } catch (error) {
      console.error('Failed to load config:', error);
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  return {
    config,
    isLoaded,
    saveConfig,
    loadConfig,
  };
};
