import { useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatArea from "./components/ChatArea";
import Settings from "./components/Settings";
import { Conversation, View, Message, Task } from "./types";
import { useConversations } from "./hooks/useConversations";

function App() {
  const [currentView, setCurrentView] = useState<View>("chat");
  const {
    conversations,
    currentConversation,
    createConversation,
    clearCurrentConversation,
    selectConversation,
    saveConversation,
    deleteConversation,
  } = useConversations();

  const handleViewChange = (view: View) => {
    setCurrentView(view);
  };

  const handleNewConversation = () => {
    clearCurrentConversation();
    setCurrentView("chat");
  };

  const handleSelectConversation = (id: string) => {
    selectConversation(id);
    setCurrentView("chat");
  };

  const handleDeleteConversation = async (id: string) => {
    await deleteConversation(id);
  };

  const handleSaveConversation = async (
    conversation: Conversation,
    messages: Message[],
    tasks: Task[]
  ) => {
    await saveConversation(conversation, messages, tasks);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7faf9] text-[#18201e]">
      <Sidebar
        onViewChange={handleViewChange}
        conversations={conversations}
        currentConversation={currentConversation}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
      />
      {currentView === "chat" ? (
        <ChatArea
          conversation={currentConversation}
          onCreateConversation={createConversation}
          onSaveConversation={handleSaveConversation}
        />
      ) : (
        <Settings onBack={() => handleViewChange("chat")} />
      )}
    </div>
  );
}

export default App;
