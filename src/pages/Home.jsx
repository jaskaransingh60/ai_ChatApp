import React, { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import ChatMobileBar from "../components/chat/ChatMobileBar.jsx";
import ChatSidebar from "../components/chat/ChatSideBar.jsx";
import ChatMessages from "../components/chat/ChatMeassage.jsx";
import ChatComposer from "../components/chat/ChatComposer.jsx";
import "../components/chat/ChatLayout.css";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import {
  startNewChat,
  selectChat,
  setInput,
  sendingStarted,
  sendingFinished,
  setChats,
} from "../store/chatSlice.js";

const Home = () => {
  const dispatch = useDispatch();
  const chats = useSelector((state) => state.chat.chats);
  const activeChatId = useSelector((state) => state.chat.activeChatId);
  const input = useSelector((state) => state.chat.input);
  const isSending = useSelector((state) => state.chat.isSending);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState([]);

  const socketRef = useRef(null); // ✅ useRef for socket

  const _activeChat = chats.find((c) => c.id === activeChatId) || null;

  // Initialize socket and fetch chats
  useEffect(() => {
    axios
      .get("http://localhost:3000/api/chat", { withCredentials: true })
      .then((response) => {
        dispatch(setChats(response.data.chats.reverse()));
      })
      .catch((err) => console.error("Failed to fetch chats:", err));

    const tempSocket = io("http://localhost:3000", { withCredentials: true });
    socketRef.current = tempSocket; // ✅ store socket in ref

    tempSocket.on("ai-response", (messagePayload) => {
      console.log("Received AI response:", messagePayload);
      setMessages((prevMessages) => [
        ...prevMessages,
        { type: "ai", content: messagePayload.content },
      ]);
      dispatch(sendingFinished());
    });

    return () => {
      tempSocket.disconnect();
    };
  }, [dispatch]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || !activeChatId || isSending) return;

    if (!socketRef.current) {
      console.error("Socket not connected yet!");
      return;
    }

    dispatch(sendingStarted());

    setMessages((prevMessages) => [
      ...prevMessages,
      { type: "user", content: trimmed },
    ]);
    dispatch(setInput(""));

    socketRef.current.emit("ai-message", {
      Chat: activeChatId,
      content: trimmed,
    });
  };

  const handleNewChat = async () => {
    let title = window.prompt("Enter a title for the new chat:", "");
    if (title) title = title.trim();
    if (!title) return;

    try {
      const response = await axios.post(
        "http://localhost:3000/api/chat",
        { title },
        { withCredentials: true }
      );
      const newChat = response.data.chat;
      dispatch(startNewChat(newChat));
      setSidebarOpen(false);
      getMessages(newChat._id);
    } catch (err) {
      console.error("Failed to create new chat:", err);
    }
  };

  const getMessages = async (chatId) => {
    try {
      const response = await axios.get(
        `http://localhost:3000/api/chat/messages/${chatId}`,
        { withCredentials: true }
      );

      setMessages(
        response.data.messages.map((m) => ({
          type: m.role === "user" ? "user" : "ai",
          content: m.content,
        }))
      );
    } catch (err) {
      console.error("Failed to fetch messages:", err);
      setMessages([]);
    }
  };

  return (
    <div className="chat-layout minimal">
      <ChatMobileBar
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        onNewChat={handleNewChat}
      />

      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={(id) => {
          dispatch(selectChat(id));
          setSidebarOpen(false);
          getMessages(id);
        }}
        onNewChat={handleNewChat}
        open={sidebarOpen}
      />

      <main className="chat-main" role="main">
        {messages.length === 0 && (
          <div className="chat-welcome" aria-hidden="true">
            <div className="chip">Early Preview</div>
            <h1>ChatGPT Clone</h1>
            <p>
              Ask anything. Paste text, brainstorm ideas, or get quick
              explanations. Your chats stay in the sidebar so you can pick up
              where you left off.
            </p>
          </div>
        )}

        <ChatMessages messages={messages} isSending={isSending} />

        {activeChatId && (
          <ChatComposer
            input={input}
            setInput={(v) => dispatch(setInput(v))}
            onSend={sendMessage}
            isSending={isSending}
          />
        )}
      </main>

      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Home;
