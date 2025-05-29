import { useEffect, useState, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import useShowToast from "../hooks/useShowToast";
import { Box, Typography } from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { useRecoilValue } from "recoil";
import userAtom from "../atoms/userAtom";
import { selectedConversationAtom } from "../atoms/messagesAtom";
import { useSocket } from "../context/SocketContext";
import Message from "./Message";

const MessageContainer = ({ userId }) => {
  const currentUser = useRecoilValue(userAtom);
  const selectedConversation = useRecoilValue(selectedConversationAtom);
  const { socket } = useSocket();
  const showToast = useShowToast();
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const fetchMessages = useCallback(async () => {
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      console.warn("Invalid userId provided to MessageContainer:", userId);
      setLoadingMessages(false);
      return;
    }

    try {
      setLoadingMessages(true);
      const res = await fetch(`/api/messages/${userId}`, {
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch messages: ${res.status} ${errorText}`);
      }
      
      const data = await res.json();
      if (data.error) {
        showToast("Error", data.error, "error");
        return;
      }
      
      setMessages(data);
      if (data.length > 0) {
        setConversationId(data[0].conversationId);
      } else {
        const convRes = await fetch(`/api/messages/conversations`, {
          credentials: "include",
        });
        if (!convRes.ok) {
          const errorText = await convRes.text();
          throw new Error(`Failed to fetch conversations: ${convRes.status} ${errorText}`);
        }
        const convData = await convRes.json();
        const conv = convData.find((c) => c.participants.some((p) => p._id === userId));
        if (conv) setConversationId(conv._id);
      }
    } catch (error) {
      console.error("Fetch messages error:", error.message);
      showToast("Error", error.message, "error");
    } finally {
      setLoadingMessages(false);
    }
  }, [userId, showToast]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!socket || !selectedConversation._id) return;

    socket.emit("joinConversation", { conversationId: selectedConversation._id });

    const handleNewMessage = (message) => {
      const isRelevantChat =
        message.conversationId === selectedConversation._id ||
        (message.sender._id === userId && message.recipientId === currentUser._id) ||
        (message.sender._id === currentUser._id && message.recipientId === userId);

      if (isRelevantChat) {
        setMessages((prev) => {
          const existingIndex = prev.findIndex((m) => m._id === message._id);
          if (existingIndex !== -1) {
            const newMessages = [...prev];
            newMessages[existingIndex] = {
              ...newMessages[existingIndex],
              ...message
            };
            return newMessages;
          }
          return [...prev, {
            ...message,
            status: message.sender._id === currentUser._id ? message.status || "sent" : "received"
          }];
        });

        if (!conversationId) setConversationId(message.conversationId);

        if (message.sender._id !== currentUser._id) {
          socket.emit("messageDelivered", {
            messageId: message._id,
            conversationId: message.conversationId,
            recipientId: currentUser._id,
          });
          socket.emit("markMessagesAsSeen", {
            conversationId: message.conversationId,
            userId: currentUser._id,
          });
        }
      }
    };

    const handleMessagesSeen = ({ conversationId: cid, seenMessages }) => {
      if (cid === selectedConversation._id) {
        setMessages((prev) =>
          prev.map((msg) =>
            seenMessages.includes(msg._id.toString())
              ? { ...msg, seen: true, status: "seen" }
              : msg
          )
        );
      }
    };

    const handleMessageDelivered = ({ messageId, conversationId: cid }) => {
      if (cid === selectedConversation._id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId ? { ...msg, status: "delivered" } : msg
          )
        );
      }
    };

    const handleTyping = ({ conversationId: cid, userId: typingUserId }) => {
      if (cid === selectedConversation._id && typingUserId !== currentUser._id) {
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      }
    };

    const handleStopTyping = ({ conversationId: cid, userId: typingUserId }) => {
      if (cid === selectedConversation._id && typingUserId !== currentUser._id) {
        setIsTyping(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      }
    };

    socket.on("newMessage", handleNewMessage);
    socket.on("messagesSeen", handleMessagesSeen);
    socket.on("messageDelivered", handleMessageDelivered);
    socket.on("typing", handleTyping);
    socket.on("stopTyping", handleStopTyping);

    if (selectedConversation._id && !selectedConversation.mock) {
      socket.emit("markMessagesAsSeen", {
        conversationId: selectedConversation._id,
        userId: currentUser._id,
      });
    }

    return () => {
      socket.off("newMessage", handleNewMessage);
      socket.off("messagesSeen", handleMessagesSeen);
      socket.off("messageDelivered", handleMessageDelivered);
      socket.off("typing", handleTyping);
      socket.off("stopTyping", handleStopTyping);
      socket.emit("leaveConversation", { conversationId: selectedConversation._id });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [socket, userId, currentUser._id, selectedConversation._id, selectedConversation.mock, conversationId]);

  const dotVariants = {
    animate: {
      y: [0, -4, 0],
      transition: { duration: 0.5, repeat: Infinity, ease: "easeInOut" },
    },
  };

  if (loadingMessages) {
    return (
      <Box sx={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Typography variant="h6">Loading messages...</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        p: { xs: 2, sm: 3 },
        pb: { xs: 1, sm: 5 },
        overflowY: "auto",
        overflowX: "hidden",
        bgcolor: "transparent",
        scrollBehavior: "smooth",
        height: "calc(100vh - 120px)",
        "&::-webkit-scrollbar": {
          width: "6px",
        },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "#A9A9A9",
          borderRadius: "3px",
        },
        "@supports (-moz-appearance:none)": {
          scrollbarWidth: "thin",
          scrollbarColor: "#A9A9A9 transparent",
        },
      }}
    >
      {messages.length === 0 ? (
        <Typography
          color="text.secondary"
          textAlign="center"
          sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          No messages yet. Start the conversation!
        </Typography>
      ) : (
        <>
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message._id}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <Message
                  message={message}
                  isOwnMessage={message.sender._id === currentUser._id}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isTyping && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                p: 1,
                bgcolor: "#EDEDED",
                borderRadius: 10,
                maxWidth: 200,
                mx: "auto",
                mt: 2,
              }}
            >
              <motion.div
                variants={dotVariants}
                animate="animate"
                style={{ width: 6, height: 6, backgroundColor: "#075E54", borderRadius: "50%" }}
              />
              <motion.div
                variants={dotVariants}
                animate="animate"
                style={{ width: 6, height: 6, backgroundColor: "#075E54", borderRadius: "50%" }}
                transition={{ delay: 0.1 }}
              />
              <motion.div
                variants={dotVariants}
                animate="animate"
                style={{ width: 6, height: 6, backgroundColor: "#075E54", borderRadius: "50%" }}
                transition={{ delay: 0.2 }}
              />
            </Box>
          )}
        </>
      )}
      <div ref={messagesEndRef} />
    </Box>
  );
};

MessageContainer.propTypes = {
  userId: PropTypes.string.isRequired,
};

export default MessageContainer;