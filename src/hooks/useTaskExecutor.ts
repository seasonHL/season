import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PermissionMode, TaskAction, TaskRequest, TaskResult } from '../types';

export const useTaskExecutor = (permissionMode: PermissionMode) => {
 const executeTask = useCallback(async (action: TaskAction): Promise<TaskResult> => {
 try {
 const request: TaskRequest = { action, permissionMode };
 const result = await invoke<TaskResult>('execute_task', { request });
 return result;
 }
 catch (error) {
 return {
 success: false,
 error: error instanceof Error ? error.message : 'Unknown error',
 };
 }
 }, [permissionMode]);
 return {
 executeTask,
 };
};
