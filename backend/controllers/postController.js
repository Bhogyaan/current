import { Post } from "../models/postModel.js";
import Story from "../models/storyModel.js";
import User from "../models/userModel.js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import sanitizeHtml from "sanitize-html";

const SUPPORTED_FORMATS = {
  image: ["image/jpeg", "image/png", "image/gif", "image/heic"],
  video: ["video/mp4", "video/x-matroska", "video/avi", "video/3gpp", "video/quicktime"],
  audio: ["audio/mpeg", "audio/aac", "audio/x-m4a", "audio/opus", "audio/wav", "audio/ogg", "audio/mp3"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "application/rtf",
    "application/zip",
    "application/x-zip-compressed",
  ],
};

const MAX_SIZES = {
  image: 16 * 1024 * 1024, // 16MB
  video: 100 * 1024 * 1024, // 100MB
  audio: 16 * 1024 * 1024, // 16MB
  document: 2 * 1024 * 1024 * 1024, // 2GB
};

const uploadToCloudinary = async (filePath, options) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, options);
    return result;
  } catch (error) {
    console.error("uploadToCloudinary: Failed", { message: error.message, stack: error.stack });
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath); // Clean up temporary file
    }
  }
};

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    if (!publicId) {
      console.warn("deleteFromCloudinary: Missing publicId");
      return;
    }
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (error) {
    console.error("deleteFromCloudinary: Failed", { publicId, message: error.message });
  }
};

const createPost = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { postedBy, text, mediaType } = req.body;
    const mediaFile = req.file;
    let mediaUrl, previewUrl, originalFilename;

    if (!postedBy || !text) {
      return res.status(400).json({ error: "postedBy and text fields are required" });
    }

    const user = await User.findById(postedBy);
    if (!user || user.isBanned) {
      return res.status(404).json({ error: "User not found or banned" });
    }

    if (user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized to create post" });
    }

    const maxLength = 500;
    const sanitizedText = sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
    if (sanitizedText.length > maxLength) {
      return res.status(400).json({ error: `Text must be less than ${maxLength} characters` });
    }

    let detectedMediaType = mediaFile
      ? mediaType && SUPPORTED_FORMATS[mediaType]
        ? mediaType
        : Object.keys(SUPPORTED_FORMATS).find((key) => SUPPORTED_FORMATS[key].includes(mediaFile.mimetype))
      : null;

    if (mediaFile && !detectedMediaType) {
      return res.status(400).json({ error: `Unsupported file format: ${mediaFile.mimetype}. Please upload a valid file.` });
    }

    let newPost;
    if (mediaFile) {
      if (mediaFile.size > MAX_SIZES[detectedMediaType]) {
        return res.status(400).json({
          error: `${detectedMediaType} size exceeds ${(MAX_SIZES[detectedMediaType] / (1024 * 1024)).toFixed(2)}MB limit`,
        });
      }

      const uploadOptions = {
        resource_type: detectedMediaType === "video" || detectedMediaType === "audio" ? "video" : detectedMediaType === "document" ? "raw" : "image",
        folder: detectedMediaType === "document" ? "documents" : "media",
      };

      if (detectedMediaType === "document") {
        const uploadResponse = await uploadToCloudinary(mediaFile.path, {
          ...uploadOptions,
          use_filename: true,
        });
        mediaUrl = uploadResponse.secure_url;
        originalFilename = mediaFile.originalname;

        if (mediaFile.mimetype === "application/pdf") {
          try {
            const previewResponse = await cloudinary.uploader.upload(mediaFile.path, {
              resource_type: "image",
              transformation: [{ page: 1, format: "jpg", width: 600, crop: "fit" }],
              folder: "previews",
            });
            previewUrl = previewResponse.secure_url;
          } catch (previewError) {
            console.warn("createPost: Failed to generate PDF preview", { message: previewError.message });
            previewUrl = null;
          }
        }
      } else if (mediaFile.mimetype === "image/heic") {
        uploadOptions.transformation = [{ fetch_format: "jpg" }];
        detectedMediaType = "image";
        const uploadResponse = await uploadToCloudinary(mediaFile.path, uploadOptions);
        mediaUrl = uploadResponse.secure_url;
        previewUrl = uploadResponse.thumbnail_url;
      } else {
        const uploadResponse = await uploadToCloudinary(mediaFile.path, uploadOptions);
        mediaUrl = uploadResponse.secure_url;
        previewUrl = detectedMediaType === "image" || detectedMediaType === "video" ? uploadResponse.thumbnail_url : null;
      }

      if (!mediaUrl) {
        throw new Error("Upload to Cloudinary failed");
      }

      newPost = new Post({
        postedBy,
        text: sanitizedText,
        media: mediaUrl,
        mediaType: detectedMediaType,
        previewUrl,
        originalFilename: detectedMediaType === "document" ? originalFilename : undefined,
      });
    } else {
      newPost = new Post({ postedBy, text: sanitizedText });
    }

    await newPost.save();
    const populatedPost = await Post.findById(newPost._id).populate("postedBy", "username profilePic");

    if (req.io) {
      const followerIds = [...(user.following || []), user._id.toString()];
      followerIds.forEach((followerId) => {
        const socketId = req.io.getRecipientSocketId?.(followerId);
        if (socketId) {
          req.io.to(socketId).emit("newPost", populatedPost);
        }
      });
      req.io.to(`post:${newPost._id}`).emit("newFeedPost", populatedPost);
    }

    res.status(201).json(populatedPost);
  } catch (err) {
    console.error("createPost: Error", { message: err.message, stack: err.stack, postedBy: req.body.postedBy });
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: `Failed to create post: ${err.message}` });
  }
};

const createStory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const mediaFile = req.file;
    const postedBy = req.user._id;

    if (!mediaFile) {
      return res.status(400).json({ error: "Media is required" });
    }

    const user = await User.findById(postedBy);
    if (!user || user.isBanned) {
      return res.status(404).json({ error: "User not found or banned" });
    }

    const mediaType = Object.keys(SUPPORTED_FORMATS).find((key) => SUPPORTED_FORMATS[key].includes(mediaFile.mimetype));
    if (!mediaType) {
      return res.status(400).json({ error: `Unsupported media type: ${mediaFile.mimetype}` });
    }

    if (mediaFile.size > MAX_SIZES[mediaType]) {
      return res.status(400).json({ error: `${mediaType} size exceeds ${(MAX_SIZES[mediaType] / (1024 * 1024)).toFixed(2)}MB limit` });
    }

    const uploadOptions = {
      resource_type: mediaType === "video" || mediaType === "audio" ? "video" : "image",
      folder: "stories",
    };

    if (mediaFile.mimetype === "image/heic") {
      uploadOptions.transformation = [{ fetch_format: "jpg" }];
    }

    const uploadResponse = await uploadToCloudinary(mediaFile.path, uploadOptions);
    const mediaUrl = uploadResponse.secure_url;

    if (!SUPPORTED_FORMATS[mediaType].includes(uploadResponse.format)) {
      await deleteFromCloudinary(uploadResponse.public_id, uploadOptions.resource_type);
      return res.status(400).json({ error: `Unsupported ${mediaType} format after upload` });
    }

    if (mediaType === "video" && uploadResponse.duration > 30) {
      await deleteFromCloudinary(uploadResponse.public_id, "video");
      return res.status(400).json({ error: "Story video must be less than 30 seconds" });
    }

    const newStory = new Story({
      postedBy,
      media: mediaUrl,
      mediaType,
      duration: mediaType === "video" ? uploadResponse.duration : 0,
      previewUrl: mediaType === "image" || mediaType === "video" ? uploadResponse.thumbnail_url : null,
    });
    await newStory.save();

    res.status(201).json(newStory);
  } catch (err) {
    console.error("createStory: Error", { message: err.message, stack: err.stack });
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: `Failed to create story: ${err.message}` });
  }
};

const deletePost = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.postedBy.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized to delete post" });
    }

    if (post.media) {
      const publicId = post.media.split("/").pop()?.split(".")[0];
      if (publicId) await deleteFromCloudinary(publicId, post.mediaType === "video" ? "video" : post.mediaType === "document" ? "raw" : "image");
    }

    if (post.previewUrl) {
      const previewPublicId = post.previewUrl.split("/").pop()?.split(".")[0];
      if (previewPublicId) await deleteFromCloudinary(previewPublicId, "image");
    }

    await Post.findByIdAndDelete(req.params.id);
    if (req.io) {
      req.io.to(`post:${req.params.id}`).emit("postDeleted", { postId: req.params.id, userId: post.postedBy });
    }

    res.status(200).json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("deletePost: Error", { message: err.message, stack: err.stack, postId: req.params.id });
    res.status(500).json({ error: `Failed to delete post: ${err.message}` });
  }
};

const editPost = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const postId = req.params.id;
    const userId = req.user._id;
    const { text, media, mediaType, previewUrl } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.postedBy.toString() !== userId.toString() && !req.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized to edit this post" });
    }

    let isEdited = post.isEdited || false;
    if (text !== undefined && text !== post.text) {
      const sanitizedText = sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
      if (sanitizedText.length > 500) {
        return res.status(400).json({ error: "Text must be less than 500 characters" });
      }
      post.text = sanitizedText;
      isEdited = true;
    }
    if (media !== undefined && media !== post.media) {
      if (post.media) {
        const publicId = post.media.split("/").pop()?.split(".")[0];
        if (publicId) await deleteFromCloudinary(publicId, post.mediaType === "video" ? "video" : post.mediaType === "document" ? "raw" : "image");
      }
      post.media = media;
      isEdited = true;
    }
    if (mediaType !== undefined && mediaType !== post.mediaType) {
      if (!Object.keys(SUPPORTED_FORMATS).includes(mediaType)) {
        return res.status(400).json({ error: `Invalid mediaType: ${mediaType}` });
      }
      post.mediaType = mediaType;
      isEdited = true;
    }
    if (previewUrl !== undefined && previewUrl !== post.previewUrl) {
      if (post.previewUrl) {
        const previewPublicId = post.previewUrl.split("/").pop()?.split(".")[0];
        if (previewPublicId) await deleteFromCloudinary(previewPublicId, "image");
      }
      post.previewUrl = previewUrl;
      isEdited = true;
    }

    post.isEdited = isEdited;
    await post.save();

    const populatedPost = await Post.findById(postId).populate("postedBy", "username profilePic");
    if (req.io) {
      req.io.to(`post:${postId}`).emit("postUpdated", populatedPost);
    }

    res.status(200).json(populatedPost);
  } catch (err) {
    console.error("editPost: Error", { message: err.message, stack: err.stack, postId: req.params.id });
    res.status(500).json({ error: `Failed to edit post: ${err.message}` });
  }
};

const getPost = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const post = await Post.findById(req.params.id)
      .populate("postedBy", "username profilePic")
      .populate("comments.userId", "username profilePic");
    if (!post || post.isBanned) {
      return res.status(404).json({ error: "Post not found or banned" });
    }
    res.status(200).json(post);
  } catch (err) {
    console.error("getPost: Error", { message: err.message, stack: err.stack, postId: req.params.id });
    res.status(500).json({ error: `Failed to fetch post: ${err.message}` });
  }
};

const likeUnlikePost = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { id: postId } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post || post.isBanned) {
      return res.status(404).json({ error: "Post not found or banned" });
    }

    const userLikedPost = post.likes.includes(userId);
    if (userLikedPost) {
      post.likes.pull(userId);
    } else {
      post.likes = [...new Set([...post.likes, userId])];
    }
    await post.save();

    const populatedPost = await Post.findById(postId)
      .populate("postedBy", "username profilePic")
      .populate("comments.userId", "username profilePic");

    if (req.io) {
      req.io.to(`post:${postId}`).emit("likeUnlikePost", {
        postId,
        userId,
        likes: populatedPost.likes,
        post: populatedPost,
        reactionType: "thumbs-up",
        timestamp: Date.now(),
      });
    }

    res.status(200).json({ likes: populatedPost.likes, post: populatedPost });
  } catch (err) {
    console.error("likeUnlikePost: Error", { message: err.message, stack: err.stack, postId: req.params.id });
    res.status(500).json({ error: `Failed to like/unlike post: ${err.message}` });
  }
};

const bookmarkUnbookmarkPost = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { id: postId } = req.params;
    const userId = req.user._id;
    const post = await Post.findById(postId);
    const user = await User.findById(userId);

    if (!post || !user || post.isBanned) {
      return res.status(404).json({ error: "Post or user not found, or post is banned" });
    }

    const isBookmarked = user.bookmarks.includes(postId);
    if (isBookmarked) {
      user.bookmarks.pull(postId);
      post.bookmarks.pull(userId);
    } else {
      user.bookmarks.push(postId);
      post.bookmarks.push(userId);
    }

    await Promise.all([user.save(), post.save()]);

    const populatedPost = await Post.findById(postId)
      .populate("postedBy", "username profilePic")
      .populate("comments.userId", "username profilePic");

    if (req.io) {
      req.io.to(`post:${postId}`).emit("bookmarkUnbookmarkPost", {
        postId,
        userId,
        bookmarked: !isBookmarked,
        post: populatedPost,
      });
    }

    res.status(200).json({
      message: isBookmarked ? "Post unbookmarked" : "Post bookmarked",
      bookmarked: !isBookmarked,
      bookmarks: populatedPost.bookmarks,
      post: populatedPost,
    });
  } catch (err) {
    console.error("bookmarkUnbookmarkPost: Error", { message: err.message, stack: err.stack, postId: req.params.id });
    res.status(500).json({ error: `Failed to bookmark/unbookmark post: ${err.message}` });
  }
};

// const getBookmarks = async (req, res) => {
//   try {
//     if (!req.user) {
//       return res.status(401).json({ error: "Authentication required" });
//     }

//     const { username } = req.params;
//     const requestingUser = req.user;

//     const user = await User.findOne({ username });
//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     // Only allow users to view their own bookmarks or admins to view any
//     if (user._id.toString() !== requestingUser._id.toString() && !requestingUser.isAdmin) {
//       return res.status(403).json({ error: "Unauthorized to view bookmarks" });
//     }

//     const bookmarks = await User.findOne({ username })
//       .populate({
//         path: "bookmarks",
//         match: { isBanned: false },
//         populate: {
//           path: "postedBy",
//           select: "username profilePic",
//           match: { _id: { $exists: true } },
//         },
//       })
//       .lean();

//     const validBookmarks = bookmarks.bookmarks.filter((post) => post.postedBy) || [];
//     res.status(200).json(validBookmarks);
//   } catch (err) {
//     console.error("getBookmarks: Error", { message: err.message, stack: err.stack, username: req.params.username });
//     res.status(500).json({ error: `Failed to fetch bookmarks: ${err.message}` });
//   }
// };

// Update the comment-related controller functions
const commentOnPost = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { postId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    const post = await Post.findById(postId);
    if (!post || post.isBanned) {
      return res.status(404).json({ error: "Post not found or banned" });
    }

    const user = await User.findById(userId).select("username profilePic");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const comment = {
      userId,
      text: sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} }),
      username: user.username,
      userProfilePic: user.profilePic,
      createdAt: new Date(),
      likes: [],
      isEdited: false,
    };

    post.comments.push(comment);
    await post.save();

    const populatedPost = await Post.findById(postId)
      .populate("postedBy", "username profilePic")
      .populate("comments.userId", "username profilePic");

    const newComment = populatedPost.comments[populatedPost.comments.length - 1];

    if (req.io) {
      req.io.to(`post:${postId}`).emit("commentAdded", {
        postId,
        comment: newComment,
        post: populatedPost,
      });
    }

    res.status(201).json({ comment: newComment, post: populatedPost });
  } catch (err) {
    console.error("commentOnPost: Error", { message: err.message, stack: err.stack, postId: req.params.postId });
    res.status(500).json({ error: `Failed to add comment: ${err.message}` });
  }
};

// Updated commentOnPost function
// const commentOnPost = async (req, res) => {
//   try {
//     if (!req.user) {
//       return res.status(401).json({ error: "Authentication required" });
//     }

//     const { postId } = req.params;
//     const { text } = req.body;
//     const userId = req.user._id;

//     if (!text || !text.trim()) {
//       return res.status(400).json({ error: "Comment text is required" });
//     }

//     if (text.length > 500) {
//       return res.status(400).json({ error: "Comment must be less than 500 characters" });
//     }

//     const post = await Post.findById(postId);
//     if (!post) {
//       return res.status(404).json({ error: "Post not found" });
//     }

//     if (post.isBanned && !req.user.isAdmin) {
//       return res.status(403).json({ error: "Cannot comment on banned post" });
//     }

//     const user = await User.findById(userId).select("username profilePic");
//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     const comment = {
//       userId,
//       text: sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} }),
//       username: user.username,
//       userProfilePic: user.profilePic,
//       createdAt: new Date(),
//       likes: [],
//       isEdited: false,
//     };

//     post.comments.push(comment);
//     await post.save();

//     const populatedPost = await Post.findById(post._id)
//       .populate("postedBy", "username profilePic")
//       .populate("comments.userId", "username profilePic");

//     const newComment = populatedPost.comments.find(c => 
//       c._id.toString() === comment._id.toString()
//     );

//     if (req.io) {
//       req.io.to(`post:${postId}`).emit("commentAdded", {
//         postId,
//         comment: newComment,
//         totalComments: post.comments.length
//       });
//     }

//     res.status(201).json({
//       comment: newComment,
//       totalComments: post.comments.length,
//       message: "Comment added successfully"
//     });
//   } catch (err) {
//     console.error("commentOnPost: Error", { 
//       message: err.message, 
//       stack: err.stack, 
//       postId: req.params.postId 
//     });
//     res.status(500).json({ error: "Failed to add comment" });
//   }
// };

// Updated editComment function
const editComment = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { postId, commentId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Comment text cannot be empty" });
    }

    if (text.length > 500) {
      return res.status(400).json({ error: "Comment must be less than 500 characters" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    // Check permissions: comment owner or admin
    if (comment.userId.toString() !== userId.toString() && !req.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized to edit this comment" });
    }

    const sanitizedText = sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
    comment.text = sanitizedText;
    comment.isEdited = true;
    comment.updatedAt = new Date();
    
    await post.save();

    const populatedPost = await Post.findById(postId)
      .populate("postedBy", "username profilePic")
      .populate("comments.userId", "username profilePic");

    if (req.io) {
      req.io.to(`post:${postId}`).emit("commentUpdated", {
        postId,
        commentId,
        text: sanitizedText,
        isEdited: true,
        updatedAt: comment.updatedAt,
        userId: comment.userId
      });
    }

    res.status(200).json({
      comment: comment,
      message: "Comment updated successfully"
    });
  } catch (err) {
    console.error("editComment: Error", { 
      message: err.message, 
      stack: err.stack, 
      postId: req.params.postId, 
      commentId: req.params.commentId 
    });
    res.status(500).json({ error: "Failed to edit comment" });
  }
};

// Updated deleteComment function
const deleteComment = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { postId, commentId } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    // Check permissions: comment owner, post owner, or admin
    const isCommentOwner = comment.userId.toString() === userId.toString();
    const isPostOwner = post.postedBy.toString() === userId.toString();
    const isAdmin = req.user.isAdmin;

    if (!isCommentOwner && !isPostOwner && !isAdmin) {
      return res.status(403).json({ error: "Unauthorized to delete this comment" });
    }

    post.comments.pull({ _id: commentId });
    await post.save();

    if (req.io) {
      req.io.to(`post:${postId}`).emit("commentDeleted", {
        postId,
        commentId,
        totalComments: post.comments.length,
        deletedBy: userId
      });
    }

    res.status(200).json({ 
      message: "Comment deleted successfully",
      totalComments: post.comments.length
    });
  } catch (err) {
    console.error("deleteComment: Error", { 
      message: err.message, 
      stack: err.stack, 
      postId: req.params.postId, 
      commentId: req.params.commentId 
    });
    res.status(500).json({ error: "Failed to delete comment" });
  }
};

// Updated likeUnlikeComment function
const likeUnlikeComment = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { postId, commentId } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const userLikedComment = comment.likes.includes(userId);
    if (userLikedComment) {
      comment.likes.pull(userId);
    } else {
      comment.likes.push(userId);
    }

    await post.save();

    const populatedPost = await Post.findById(postId)
      .populate("postedBy", "username profilePic")
      .populate("comments.userId", "username profilePic");

    if (req.io) {
      req.io.to(`post:${postId}`).emit("commentLiked", {
        postId,
        commentId,
        likes: comment.likes,
        totalLikes: comment.likes.length,
        likedBy: userId,
        action: userLikedComment ? "unliked" : "liked"
      });
    }

    res.status(200).json({ 
      likes: comment.likes,
      totalLikes: comment.likes.length,
      action: userLikedComment ? "unliked" : "liked"
    });
  } catch (err) {
    console.error("likeUnlikeComment: Error", { 
      message: err.message, 
      stack: err.stack, 
      postId: req.params.postId, 
      commentId: req.params.commentId 
    });
    res.status(500).json({ error: "Failed to like/unlike comment" });
  }
};

const banPost = async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ error: "Only admin can ban posts" });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.isBanned) {
      return res.status(400).json({ error: "Post is already banned" });
    }

    post.isBanned = true;
    await post.save();

    const populatedPost = await Post.findById(post._id)
      .populate("postedBy", "username profilePic")
      .populate("comments.userId", "username profilePic");

    if (req.io) {
      req.io.to(`post:${post._id}`).emit("postBanned", {
        postId: post._id,
        post: populatedPost,
      });
    }

    res.status(200).json({
      message: "Post banned successfully",
      post: populatedPost,
    });
  } catch (err) {
    console.error("banPost: Error", {
      message: err.message,
      stack: err.stack,
      postId: req.params.id,
    });
    res.status(500).json({ error: `Failed to ban post: ${err.message}` });
  }
};

const unbanPost = async (req, res) => {
  try {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ error: "Only admin can unban posts" });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (!post.isBanned) {
      return res.status(400).json({ error: "Post is not banned" });
    }

    post.isBanned = false;
    await post.save();

    const populatedPost = await Post.findById(post._id)
      .populate("postedBy", "username profilePic")
      .populate("comments.userId", "username profilePic");

    if (req.io) {
      req.io.to(`post:${post._id}`).emit("postUnbanned", {
        postId: post._id,
        post: populatedPost,
      });
    }

    res.status(200).json({
      message: "Post unbanned successfully",
      post: populatedPost,
    });
  } catch (err) {
    console.error("unbanPost: Error", {
      message: err.message,
      stack: err.stack,
      postId: req.params.id,
    });
    res.status(500).json({ error: `Failed to unban post: ${err.message}` });
  }
};


const getFeedPosts = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const following = user.following || [];
    const posts = await Post.find({
      postedBy: { $in: [...following, userId] },
      isBanned: false,
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "postedBy",
        select: "username profilePic",
        match: { _id: { $exists: true } },
      })
      .populate({
        path: "comments.userId",
        select: "username profilePic",
        match: { _id: { $exists: true } },
      });

    const validPosts = posts.filter((post) => post.postedBy);
    res.status(200).json(validPosts);
  } catch (err) {
    console.error("getFeedPosts: Error", { message: err.message, stack: err.stack, userId: req.user?._id });
    res.status(500).json({ error: `Failed to fetch feed posts: ${err.message}` });
  }
};

 const getUserPosts = async (req, res) => {
  try {
    console.log("getUserPosts: User from req:", req.user); // Debug
    if (!req.user) {
      console.log("getUserPosts: No req.user, authentication required");
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const requestingUser = req.user;
    if (user._id.toString() !== requestingUser._id.toString() && !requestingUser.isAdmin) {
      return res.status(403).json({ error: "Unauthorized to view this user's posts" });
    }

    const posts = await Post.find({ postedBy: user._id, isBanned: false })
      .populate("postedBy", "username profilePic")
      .sort({ createdAt: -1 });

    res.status(200).json(posts);
  } catch (error) {
    console.error("getUserPosts error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

 const getBookmarks = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized to view this user's bookmarks" });
    }

    const posts = await Post.find({ _id: { $in: user.bookmarks }, isBanned: false })
      .populate("postedBy", "username profilePic")
      .sort({ createdAt: -1 });

    res.status(200).json(posts);
  } catch (error) {
    console.error("getBookmarks error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getAllPosts = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .populate({
        path: "postedBy",
        select: "username profilePic",
        match: { _id: { $exists: true } },
      })
      .populate({
        path: "comments.userId",
        select: "username profilePic",
        match: { _id: { $exists: true } },
      });

    const validPosts = posts.filter((post) => post.postedBy);
    res.status(200).json(validPosts);
  } catch (err) {
    console.error("getAllPosts: Error", { message: err.message, stack: err.stack, userId: req.user?._id });
    res.status(500).json({ error: `Failed to fetch all posts: ${err.message}` });
  }
};

const getPaginatedComments = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { postId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const post = await Post.findById(postId);
    if (!post || post.isBanned) {
      return res.status(404).json({ error: "Post not found or banned" });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const populatedPost = await Post.findById(postId)
      .populate({
        path: "postedBy",
        select: "username profilePic",
        match: { _id: { $exists: true } },
      })
      .populate({
        path: "comments.userId",
        select: "username profilePic",
        match: { _id: { $exists: true } },
      });

    if (!populatedPost.postedBy) {
      return res.status(200).json({
        comments: [],
        totalComments: 0,
        message: "Comments fetched, but postedBy is invalid",
      });
    }

    res.status(200).json({
      comments: populatedPost.comments.slice(skip, skip + parseInt(limit)),
      totalComments: populatedPost.comments.length,
    });
  } catch (err) {
    console.error("getPaginatedComments: Error", { message: err.message, stack: err.stack, postId: req.params.postId });
    res.status(500).json({ error: `Failed to fetch comments: ${err.message}` });
  }
};

const getStories = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const following = user.following || [];
    const stories = await Story.find({ postedBy: { $in: [...following, userId] } })
      .sort({ createdAt: -1 })
      .populate("postedBy", "username profilePic");

    res.status(200).json(stories);
  } catch (err) {
    console.error("getStories: Error", { message: err.message, stack: err.stack, userId: req.user._id });
    res.status(500).json({ error: `Failed to fetch stories: ${err.message}` });
  }
};

const getSuggestedPosts = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const following = user.following || [];
    const posts = await Post.find({
      postedBy: { $nin: [userId, ...following] },
      isBanned: false,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate({
        path: "postedBy",
        select: "username profilePic",
        match: { _id: { $exists: true } },
      })
      .populate({
        path: "comments.userId",
        select: "username profilePic",
        match: { _id: { $exists: true } },
      });

    const validPosts = posts.filter((post) => post.postedBy);
    res.status(200).json(validPosts);
  } catch (err) {
    console.error("getSuggestedPosts: Error", { message: err.message, stack: err.stack, userId: req.user._id });
    res.status(500).json({ error: `Failed to fetch suggested posts: ${err.message}` });
  }
};

export {
  createPost,
  createStory,
  getPost,
  deletePost,
  likeUnlikePost,
  bookmarkUnbookmarkPost,
  getBookmarks,
  commentOnPost,
  likeUnlikeComment,
  editComment,
  deleteComment,
  banPost,
  unbanPost,
  getFeedPosts,
  getUserPosts,
  getAllPosts,
  getStories,
  editPost,
  getSuggestedPosts,
  getPaginatedComments,
};