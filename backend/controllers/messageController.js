import Conversation from '../models/conversationModel.js';
import Message from '../models/messageModel.js';
import { getRecipientSocketId, io } from '../socket/socket.js';
import { v2 as cloudinary } from 'cloudinary';
import sanitizeHtml from 'sanitize-html';

const userRequestCounts = new Map();
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW = 60 * 1000;

const validateMedia = (mediaUrl, fileType) => {
  const allowedTypes = ['image/', 'video/', 'audio/', 'application/pdf', 'text/'];
  if (!allowedTypes.some((type) => fileType.startsWith(type))) {
    throw new Error('Unsupported media type');
  }
  return true;
};

async function sendMessage(req, res) {
  try {
    const { recipientId, message, img } = req.body;
    const senderId = req.user._id;

    const now = Date.now();
    const userKey = `${senderId}_sendMessage`;
    const requestData = userRequestCounts.get(userKey) || { count: 0, resetTime: now };
    if (now > requestData.resetTime) {
      requestData.count = 0;
      requestData.resetTime = now + RATE_LIMIT_WINDOW;
    }
    requestData.count += 1;
    userRequestCounts.set(userKey, requestData);
    if (requestData.count > RATE_LIMIT) {
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }

    if (!recipientId || (!message && !img)) {
      return res.status(400).json({ error: 'Recipient ID and message or media required' });
    }

    if (img) {
      const fileType = img.split(';')[0].split(':')[1] || '';
      validateMedia(img, fileType);
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] },
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, recipientId],
        lastMessage: { text: message || 'Media', sender: senderId, seen: false },
      });
      await conversation.save();
    }

    const sanitizedMessage = sanitizeHtml(message || '', {
      allowedTags: [],
      allowedAttributes: {},
    });

    const newMessage = new Message({
      conversationId: conversation._id,
      sender: senderId,
      recipient: recipientId,
      text: sanitizedMessage,
      img: img || '',
      status: 'sent',
    });

    await newMessage.save();

    await conversation.updateOne({
      lastMessage: { text: sanitizedMessage || 'Media', sender: senderId, seen: false },
      updatedAt: new Date(),
    });

    const populatedMessage = await Message.findById(newMessage._id)
      .populate('sender', 'username profilePic')
      .lean();

    const messagePayload = {
      ...populatedMessage,
      conversationId: conversation._id,
      recipientId,
    };

    const recipientSocketId = getRecipientSocketId(recipientId);
    if (recipientSocketId) {
      await Message.updateOne({ _id: newMessage._id }, { status: 'received' });
      messagePayload.status = 'received';
      io.to(`conv:${conversation._id}`).emit('newMessage', messagePayload);
      io.to(recipientSocketId).emit('newMessageNotification', {
        conversationId: conversation._id,
        sender: populatedMessage.sender,
        text: sanitizedMessage || 'Media',
        img,
        messageId: newMessage._id,
      });
    }

    io.to(`user:${senderId}`).emit('newMessage', messagePayload);

    res.status(201).json(messagePayload);
  } catch (error) {
    console.error('Send message error:', {
      message: error.message,
      stack: error.stack,
      userId: req.user._id,
      recipientId: req.body.recipientId,
    });
    res.status(error.message.includes('Too many requests') ? 429 : 500).json({ error: error.message });
  }
}

async function getMessages(req, res) {
  const { otherUserId } = req.params;
  const userId = req.user._id;
  const { page = 1, limit = 20 } = req.query;

  try {
    const now = Date.now();
    const userKey = `${userId}_getMessages`;
    const requestData = userRequestCounts.get(userKey) || { count: 0, resetTime: now };
    if (now > requestData.resetTime) {
      requestData.count = 0;
      requestData.resetTime = now + RATE_LIMIT_WINDOW;
    }
    requestData.count += 1;
    userRequestCounts.set(userKey, requestData);
    if (requestData.count > RATE_LIMIT) {
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }

    const conversation = await Conversation.findOne({
      participants: { $all: [userId, otherUserId] },
    });

    if (!conversation) {
      return res.status(200).json([]);
    }

    const messages = await Message.find({ conversationId: conversation._id })
      .populate('sender', 'username profilePic')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const updatedMessages = await Message.updateMany(
      { conversationId: conversation._id, sender: otherUserId, seen: false },
      { $set: { seen: true, status: 'seen' } }
    );

    if (updatedMessages.modifiedCount > 0) {
      const seenMessages = messages
        .filter((msg) => msg.sender._id.toString() === otherUserId && !msg.seen)
        .map((msg) => msg._id.toString());
      io.to(`conv:${conversation._id}`).emit('messagesSeen', {
        conversationId: conversation._id,
        seenMessages,
      });
    }

    res.status(200).json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', {
      message: error.message,
      stack: error.stack,
      userId,
      otherUserId,
    });
    res.status(error.message.includes('Too many requests') ? 429 : 500).json({ error: error.message });
  }
}

async function getConversations(req, res) {
  const userId = req.user._id;

  try {
    const now = Date.now();
    const userKey = `${userId}_getConversations`;
    const requestData = userRequestCounts.get(userKey) || { count: 0, resetTime: now };
    if (now > requestData.resetTime) {
      requestData.count = 0;
      requestData.resetTime = now + RATE_LIMIT_WINDOW;
    }
    requestData.count += 1;
    userRequestCounts.set(userKey, requestData);
    if (requestData.count > RATE_LIMIT) {
      return res.status(429).json({ error: 'Too many requests, please try again later' });
    }

    const conversations = await Conversation.find({ participants: userId }).populate({
      path: 'participants',
      select: 'username profilePic',
    });

    conversations.forEach((conversation) => {
      conversation.participants = conversation.participants.filter(
        (participant) => participant._id.toString() !== userId.toString()
      );
    });

    res.status(200).json(conversations);
  } catch (error) {
    console.error('Get conversations error:', {
      message: error.message,
      stack: error.message,
      userId,
    });
    res.status(error.message.includes('Too many requests') ? 429 : 500).json({ error: error.message });
  }
}

export { sendMessage, getMessages, getConversations };