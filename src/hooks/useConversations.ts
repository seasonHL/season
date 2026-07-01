import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Conversation, Message, Task } from "../types";

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  // 加载所有对话
  const loadConversations = async () => {
    setLoading(true);
    try {
      const loadedConversations = await invoke<Conversation[]>("load_conversations");
      // 转换日期字符串为 Date 对象
      const processed = loadedConversations.map((conv) => ({
        ...conv,
        created_at: new Date(conv.created_at),
        updated_at: new Date(conv.updated_at),
        messages: conv.messages.map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
        tasks: conv.tasks.map((task) => ({
          ...task,
          created_at: new Date(task.created_at),
          updated_at: new Date(task.updated_at),
        })),
      }));
      // 按更新时间倒序排列
      processed.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
      setConversations(processed);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  // 创建新对话
  const createConversation = (): Conversation => {
    const now = new Date();
    return {
      id: crypto.randomUUID(),
      title: "新对话",
      messages: [],
      tasks: [],
      created_at: now,
      updated_at: now,
    };
  };

  const clearCurrentConversation = () => {
    setCurrentConversation(null);
  };

  // 选择对话
  const selectConversation = async (id: string) => {
    try {
      const conv = await invoke<Conversation>("load_conversation", { id });
      const processed: Conversation = {
        ...conv,
        created_at: new Date(conv.created_at),
        updated_at: new Date(conv.updated_at),
        messages: conv.messages.map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
        tasks: conv.tasks.map((task) => ({
          ...task,
          created_at: new Date(task.created_at),
          updated_at: new Date(task.updated_at),
        })),
      };
      setCurrentConversation(processed);
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  };

  // 保存对话
  const saveConversation = async (
    conversation: Conversation,
    messages: Message[],
    tasks: Task[]
  ) => {
    try {
      const title =
        messages.length > 0
          ? messages[0].content.length > 30
            ? messages[0].content.substring(0, 30) + "..."
            : messages[0].content
          : "新对话";

      const convToSave: Conversation = {
        ...conversation,
        title,
        messages,
        tasks,
        updated_at: new Date(),
      };

      // 转换日期为字符串以保存
      const serialized = {
        ...convToSave,
        created_at: convToSave.created_at.toISOString(),
        updated_at: convToSave.updated_at.toISOString(),
        messages: convToSave.messages.map((msg) => ({
          ...msg,
          timestamp: msg.timestamp.toISOString(),
        })),
        tasks: convToSave.tasks.map((task) => ({
          ...task,
          created_at: task.created_at.toISOString(),
          updated_at: task.updated_at.toISOString(),
        })),
      };

      await invoke("save_conversation", { conversation: serialized });

      // 更新本地状态
      setCurrentConversation(convToSave);
      
      // 仅更新列表中的对应对话，避免全量重载
      setConversations((prev) => {
        const index = prev.findIndex((c) => c.id === conversation.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = convToSave;
          return updated.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
        } else {
          return [...prev, convToSave].sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
        }
      });
    } catch (error) {
      console.error("Failed to save conversation:", error);
    }
  };

  // 删除对话
  const deleteConversation = async (id: string) => {
    try {
      await invoke("delete_conversation", { id });
      const loadedConversations = await invoke<Conversation[]>("load_conversations");
      const processed = loadedConversations.map((conv) => ({
        ...conv,
        created_at: new Date(conv.created_at),
        updated_at: new Date(conv.updated_at),
        messages: conv.messages.map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
        tasks: conv.tasks.map((task) => ({
          ...task,
          created_at: new Date(task.created_at),
          updated_at: new Date(task.updated_at),
        })),
      }));
      processed.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
      setConversations(processed);

      if (currentConversation?.id === id) {
        setCurrentConversation(null);
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  // 初始化时加载对话
  useEffect(() => {
    loadConversations();
  }, []);

  return {
    conversations,
    currentConversation,
    loading,
    loadConversations,
    createConversation,
    clearCurrentConversation,
    selectConversation,
    saveConversation,
    deleteConversation,
  };
}
