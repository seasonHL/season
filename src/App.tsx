import { useState, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import Settings from "./components/Settings";
import { View, Message, Task } from "./types";
import { useConversations } from "./hooks/useConversations";

function App() {
  const [currentView, setCurrentView] = useState<View>("chat");
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const {
    conversations,
    currentConversation,
    createConversation,
    selectConversation,
    saveConversation,
    deleteConversation,
  } = useConversations();

  useEffect(() => {
    const initConversation = async () => {
      if (!currentConversation && conversations.length > 0) {
        await selectConversation(conversations[0].id);
      } else if (!currentConversation && conversations.length === 0) {
        await createConversation();
      }
    };
    initConversation();
  }, [currentConversation, conversations.length]);

  const savePendingChanges = useCallback(async () => {
    if (currentConversation && (pendingMessages.length > 0 || pendingTasks.length > 0)) {
      await saveConversation(currentConversation, pendingMessages, pendingTasks);
      setPendingMessages([]);
      setPendingTasks([]);
    }
  }, [currentConversation, pendingMessages, pendingTasks, saveConversation]);

  const handleViewChange = (view: View) => {
    if (view !== currentView) {
      savePendingChanges();
    }
    setCurrentView(view);
  };

  const handleNewConversation = async () => {
    await savePendingChanges();
    createConversation();
    setCurrentView("chat");
  };

  const handleSelectConversation = async (id: string) => {
    if (currentConversation?.id !== id) {
      await savePendingChanges();
    }
    selectConversation(id);
    setCurrentView("chat");
  };

  const handleSaveConversation = (messages: Message[], tasks: Task[]) => {
    setPendingMessages(messages);
    setPendingTasks(tasks);
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      savePendingChanges();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [savePendingChanges]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7faf9] text-[#18201e]">
      <Sidebar
        onViewChange={handleViewChange}
        conversations={conversations}
        currentConversation={currentConversation}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={deleteConversation}
      />
      {currentView === "chat" ? (
        <ChatArea
          conversation={currentConversation}
          onSaveConversation={handleSaveConversation}
        />
      ) : (
        <Settings onBack={() => handleViewChange("chat")} />
      )}
    </div>
  );
}

export default App;
