import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/messageModel.js";
import Conversation from "../models/conversationModel.js";
import User from "../models/userModel.js";
import {Post} from "../models/postModel.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://your-production-domain.com"],
    methods: ["GET", "POST"],
    credentials: true,
  },
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
});

app.use((req, res, next) => {
  req.io = io;
  req.io.getRecipientSocketId = getRecipientSocketId;
  next();
});

const userSocketMap = {};
const typingUsers = new Map();
const postRooms = new Map();

export const getRecipientSocketId = (recipientId) => {
  return userSocketMap[recipientId];
};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  const userId = socket.handshake.query.userId;

  if (userId && userId !== "undefined") {
    userSocketMap[userId] = socket.id;
    socket.join(`user:${userId}`);
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  } else {
    console.warn("Invalid userId on connection:", userId);
    socket.disconnect(true);
    return;
  }

  // Post room management
  socket.on("joinPost", (postId) => {
    if (postId) {
      socket.join(`post:${postId}`);
      if (!postRooms.has(postId)) {
        postRooms.set(postId, new Set());
      }
      postRooms.get(postId).add(socket.id);
      console.log(`User ${userId} joined post room: post:${postId}`);
    }
  });

  socket.on("leavePost", (postId) => {
    if (postId) {
      socket.leave(`post:${postId}`);
      if (postRooms.has(postId)) {
        postRooms.get(postId).delete(socket.id);
        if (postRooms.get(postId).size === 0) {
          postRooms.delete(postId);
        }
      }
      console.log(`User ${userId} left post room: post:${postId}`);
    }
  });

  // Conversation handlers (keep existing)
  socket.on("messageDelivered", async ({ messageId, conversationId, recipientId }) => {
    try {
      if (!messageId || !conversationId || !recipientId) return;
      
      const updatedMessage = await Message.findByIdAndUpdate(
        messageId,
        { status: "delivered" },
        { new: true }
      ).lean();
      
      if (!updatedMessage) return;
      
      const senderSocketId = getRecipientSocketId(updatedMessage.sender);
      if (senderSocketId) {
        io.to(senderSocketId).emit("messageDelivered", { 
          messageId, 
          conversationId 
        });
      }
    } catch (error) {
      console.error("Error broadcasting message delivered:", error.message);
    }
  });

  socket.on("markMessagesAsSeen", async ({ conversationId, userId }) => {
    try {
      if (!conversationId || !userId) return;
      
      const conversation = await Conversation.findById(conversationId).lean();
      if (!conversation) return;

      const messages = await Message.find({
        conversationId,
        seen: false,
        sender: { $ne: userId },
      }).lean();

      if (!messages.length) return;

      const seenMessageIds = messages.map((msg) => msg._id.toString());
      
      await Message.updateMany(
        { _id: { $in: seenMessageIds } },
        { $set: { seen: true, status: "seen" } }
      );

      await Conversation.updateOne(
        { _id: conversationId },
        { $set: { "lastMessage.seen": true } }
      );

      io.to(`conv:${conversationId}`).emit("messagesSeen", { 
        conversationId, 
        seenMessages: seenMessageIds 
      });
    } catch (error) {
      console.error("Error marking messages as seen:", error.message);
    }
  });

  socket.on("newMessage", async (message) => {
    try {
      if (!message?.recipientId || !message?.sender?._id || !message?.conversationId) {
        console.error("Invalid message format", message);
        return;
      }

      const newMessage = new Message({
        conversationId: message.conversationId,
        sender: message.sender._id,
        recipient: message.recipientId,
        text: message.text,
        img: message.img,
        status: "sent",
      });

      const savedMessage = await newMessage.save();
      
      await Conversation.findByIdAndUpdate(message.conversationId, {
        lastMessage: {
          text: message.text || "Media",
          sender: message.sender._id,
          seen: false,
        },
        updatedAt: new Date(),
      });

      const populatedMessage = await Message.findById(savedMessage._id)
        .populate('sender', 'username profilePic')
        .lean();

      io.to(`conv:${message.conversationId}`).emit("newMessage", {
        ...populatedMessage,
        status: "sent",
      });

      const recipientSocketId = getRecipientSocketId(message.recipientId);
      if (recipientSocketId) {
        setTimeout(() => {
          io.to(recipientSocketId).emit("messageDelivered", {
            messageId: savedMessage._id,
            conversationId: message.conversationId,
          });
        }, 500);
      }
    } catch (error) {
      console.error("Error handling new message:", error);
    }
  });

  socket.on("typing", ({ conversationId, userId }) => {
    try {
      if (!conversationId || !userId) return;
      
      socket.to(`conv:${conversationId}`).emit("typing", {
        conversationId,
        userId,
      });
    } catch (error) {
      console.error("Error handling typing event:", error);
    }
  });

  socket.on("stopTyping", ({ conversationId, userId }) => {
    try {
      if (!conversationId || !userId) return;
      
      socket.to(`conv:${conversationId}`).emit("stopTyping", {
        conversationId,
        userId,
      });
    } catch (error) {
      console.error("Error handling stopTyping event:", error);
    }
  });

  socket.on("joinConversation", ({ conversationId }) => {
    if (conversationId) {
      socket.join(`conv:${conversationId}`);
    }
  });

  socket.on("leaveConversation", ({ conversationId }) => {
    if (conversationId) {
      socket.leave(`conv:${conversationId}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    if (userId && userSocketMap[userId] === socket.id) {
      delete userSocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
      
      // Clean up post rooms
      postRooms.forEach((sockets, postId) => {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            postRooms.delete(postId);
          }
        }
      });

      // Clean up typing indicators
      typingUsers.forEach((conversationTyping, conversationId) => {
        if (conversationTyping.has(userId)) {
          conversationTyping.delete(userId);
          if (conversationTyping.size === 0) {
            typingUsers.delete(conversationId);
          }
          io.to(`conv:${conversationId}`).emit("stopTyping", { 
            conversationId, 
            userId 
          });
        }
      });
    }
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error.message);
  });

  socket.on("reconnect", (attempt) => {
    console.log(`Socket reconnected after ${attempt} attempts: ${socket.id}`);
  });

  socket.on("reconnect_error", (error) => {
    console.error("Socket reconnection error:", error.message);
  });

  socket.on("reconnect_failed", () => {
    console.error("Socket reconnection failed");
  });
});

export { io, server, app };