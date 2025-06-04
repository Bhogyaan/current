import React, { useEffect, useState, useCallback, useContext } from "react";
import {
  Avatar,
  Box,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Skeleton,
  Button,
  TextField,
  Modal,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  MoreVert,
  Block,
  CheckCircle,
  ThumbUp,
  Comment,
  Bookmark,
  Share,
  Delete,
} from "@mui/icons-material";
import { formatDistanceToNow } from "date-fns";
import { message } from "antd";
import { useRecoilState, useRecoilValue } from "recoil";
import userAtom from "../../atoms/userAtom";
import postsAtom from "../../atoms/postsAtom";
import { SocketContext } from "../context/SocketContext.jsx";
import { motion } from "framer-motion";
import CommentItem from "../components/comments/CommentItem.jsx";
import { debounce } from "lodash";
import {
  BsFileEarmarkTextFill,
  BsFileZipFill,
  BsFileWordFill,
  BsFileExcelFill,
  BsFilePptFill,
  BsFileTextFill,
} from "react-icons/bs";

const AdminHomepage = () => {
  const [posts, setPosts] = useRecoilState(postsAtom);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const currentUser = useRecoilValue(userAtom);
  const navigate = useNavigate();
  const { socket } = useContext(SocketContext);

  const fetchPosts = useCallback(async () => {
    try {
      setIsLoadingPosts(true);
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }
      const res = await fetch(`/api/posts/all?page=1&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP error: ${res.status}`);
      }
      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error("Invalid data format");
      }
      setPosts((prev) => ({ ...prev, posts: data }));
    } catch (error) {
      console.error("Fetch posts error:", error);
      message.error("Failed to load posts: " + error.message);
      setPosts((prev) => ({ ...prev, posts: [] }));
    } finally {
      setIsLoadingPosts(false);
    }
  }, [setPosts]);

  const fetchComments = useCallback(async (postId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        message.error("No authentication token found");
        return;
      }
      const res = await fetch(`/api/posts/${postId}/comments?page=1&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (data.error) {
        console.error("Fetch comments error:", data.error);
        message.error(data.error);
        return;
      }
      setPosts((prev) => ({
        ...prev,
        posts: prev.posts.map((p) =>
          p._id === postId ? { ...p, comments: data.comments } : p
        ),
      }));
    } catch (error) {
      console.error("Error fetching comments:", error);
      message.error("Failed to fetch comments");
    }
  }, [setPosts]);

  const debouncedUpdateComments = debounce((postId, updatedComments) => {
    setPosts((prev) => ({
      ...prev,
      posts: prev.posts.map((p) =>
        p._id === postId ? { ...p, comments: updatedComments } : p
      ),
    }));
  }, 300);

  useEffect(() => {
    if (currentUser?.isAdmin) {
      fetchPosts();
    } else {
      message.error("Admin access required");
      navigate("/posts");
    }
  }, [currentUser, navigate, fetchPosts]);

  useEffect(() => {
    if (!socket) return;

    const handleNewPost = (post) => {
      setPosts((prev) => ({ ...prev, posts: [post, ...prev.posts] }));
      message.success("New post added");
    };

    const handlePostStatusUpdate = ({ postId, isBanned }) => {
      setPosts((prev) => ({
        ...prev,
        posts: prev.posts.map((p) =>
          p._id === postId ? { ...p, isBanned } : p
        ),
      }));
      message.info(isBanned ? "Post banned" : "Post unbanned");
    };

    const handlePostDeleted = ({ postId }) => {
      setPosts((prev) => ({
        ...prev,
        posts: prev.posts.filter((p) => p._id !== postId),
      }));
      message.success("Post deleted");
    };

    const handleNewComment = ({ postId, comment, post: updatedPost }) => {
      if (updatedPost) {
        debouncedUpdateComments(postId, updatedPost.comments);
        fetchComments(postId);
      }
    };

    const handleCommentLike = ({ postId, commentId, likes, post: updatedPost }) => {
      if (updatedPost) {
        debouncedUpdateComments(postId, updatedPost.comments);
        fetchComments(postId);
      }
    };

    const handleCommentEdit = ({ postId, commentId, text, isEdited, post: updatedPost }) => {
      if (updatedPost) {
        debouncedUpdateComments(postId, updatedPost.comments);
        fetchComments(postId);
      }
    };

    const handleCommentDelete = ({ postId, commentId, post: updatedPost }) => {
      if (updatedPost) {
        debouncedUpdateComments(postId, updatedPost.comments);
        fetchComments(postId);
      }
    };

    socket.on("newPost", handleNewPost);
    socket.on("postStatusUpdate", handlePostStatusUpdate);
    socket.on("postDeleted", handlePostDeleted);
    socket.on("newComment", handleNewComment);
    socket.on("commentLiked", handleCommentLike);
    socket.on("commentUpdated", handleCommentEdit);
    socket.on("commentDeleted", handleCommentDelete);

    return () => {
      socket.off("newPost", handleNewPost);
      socket.off("postStatusUpdate", handlePostStatusUpdate);
      socket.off("postDeleted", handlePostDeleted);
      socket.off("newComment", handleNewComment);
      socket.off("commentLiked", handleCommentLike);
      socket.off("commentUpdated", handleCommentEdit);
      socket.off("commentDeleted", handleCommentDelete);
    };
  }, [socket, fetchComments, setPosts, debouncedUpdateComments]);

  const handleBanUnbanPost = async (postId, isBanned) => {
    try {
      const token = localStorage.getItem("token");
      const endpoint = isBanned ? `/api/posts/unban/${postId}` : `/api/posts/ban/${postId}`;
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setPosts((prev) => ({
        ...prev,
        posts: prev.posts.map((p) =>
          p._id === postId ? { ...p, isBanned: !isBanned } : p
        ),
      }));
      socket?.emit("postStatusUpdate", { postId, isBanned: !isBanned });
      message.success(isBanned ? "Post unbanned successfully" : "Post banned successfully");
    } catch (error) {
      message.error("Failed to update post status: " + error.message);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setPosts((prev) => ({
        ...prev,
        posts: prev.posts.filter((p) => p._id !== postId),
      }));
      socket?.emit("postDeleted", { postId });
      message.success("Post deleted successfully");
    } catch (error) {
      message.error("Failed to delete post: " + error.message);
    }
  };

  const handleAddComment = async (postId) => {
    if (!newComment.trim()) {
      message.error("Comment cannot be empty");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/posts/${postId}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: newComment }),
        credentials: "include",
      });
      const data = await res.json();
      if (data.error) {
        message.error(data.error);
        return;
      }
      setNewComment("");
      message.success("Comment added");
      await fetchComments(postId);
      if (socket) {
        socket.emit("newComment", { postId, comment: data, userId: currentUser._id });
      }
    } catch (error) {
      message.error("Failed to add comment: " + error.message);
    }
  };

  const handleLikeComment = async (postId, commentId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        message.error("No authentication token found");
        return;
      }
      const res = await fetch(`/api/posts/${postId}/comment/${commentId}/like`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (data.error) {
        message.error(data.error);
        return;
      }
      message.success(data.likes.includes(currentUser._id) ? "Comment liked" : "Comment unliked");
      await fetchComments(postId);
      if (socket) {
        socket.emit("commentLiked", {
          postId,
          commentId,
          userId: currentUser._id,
          likes: data.likes,
        });
      }
    } catch (error) {
      message.error("Failed to like/unlike comment: " + error.message);
    }
  };

  const handleMoreClick = (event, post) => {
    setAnchorEl(event.currentTarget);
    setSelectedPost(post);
  };

  const handleMoreClose = () => {
    setAnchorEl(null);
    setSelectedPost(null);
  };

  const getDocumentIcon = (filename) => {
    const extension = filename?.split(".")?.pop()?.toLowerCase() || "";
    switch (extension) {
      case "pdf":
        return <BsFileEarmarkTextFill size={24} />;
      case "zip":
        return <BsFileZipFill size={24} />;
      case "doc":
      case "docx":
        return <BsFileWordFill size={24} />;
      case "xls":
      case "xlsx":
        return <BsFileExcelFill size={24} />;
      case "ppt":
      case "pptx":
        return <BsFilePptFill size={24} />;
      case "txt":
      case "rtf":
        return <BsFileTextFill size={24} />;
      default:
        return <BsFileTextFill size={24} />;
    }
  };

  const getFileName = (post) => {
    return post.originalFilename || post.media?.split("/")?.pop() || "Unknown Document";
  };

  const renderPost = (post) => {
    if (!post) return null;

    return (
      <Box
        key={post._id}
        mb={2}
        sx={{
          width: { xs: "100%", sm: "90%", md: "600px" },
          maxWidth: "600px",
          minHeight: { xs: "auto", sm: "350px", md: "400px" },
          mx: { xs: 0, sm: "auto" },
          background: "rgba(255, 255, 255, 0.2)",
          borderRadius: "16px",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          padding: { xs: 1, sm: 2, md: 2.5 },
          boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
        }}
      >
        {post.isBanned && (
          <Typography
            variant="caption"
            sx={{
              position: "absolute",
              top: 10,
              left: 10,
              color: "red",
              fontWeight: "bold",
              backgroundColor: "rgba(255, 255, 255, 0.7)",
              padding: 1,
              borderRadius: 2,
              zIndex: 10,
            }}
          >
            Banned Post
          </Typography>
        )}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar
              sx={{
                width: { xs: 32, sm: 40, md: 48 },
                height: { xs: 32, sm: 40, md: 48 },
                cursor: "pointer",
              }}
              alt={post.postedBy?.username || "Unknown User"}
              src={post.postedBy?.profilePic || "/default-avatar.png"}
              onClick={() => navigate(`/${post.postedBy?.username}`)}
            />
            <Box>
              <Typography
                variant="body2"
                fontWeight="bold"
                color="text.primary"
                sx={{ cursor: "pointer" }}
                onClick={() => navigate(`/${post.postedBy?.username}`)}
              >
                {post.postedBy?.username || "Unknown User"}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.75rem" }}
              >
                {formatDistanceToNow(new Date(post.createdAt))} ago
                {post.isEdited && " (Edited)"}
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={(e) => handleMoreClick(e, post)}
            sx={{ color: "text.primary", fontSize: { xs: "20px", sm: "24px" } }}
          >
            <MoreVert />
          </IconButton>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 2, flex: 1 }}>
          <Typography
            variant="body2"
            color="text.primary"
            sx={{
              fontSize: { xs: "0.875rem", sm: "1rem" },
              wordBreak: "break-word",
            }}
          >
            {post.text}
          </Typography>

          {post?.media && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                marginTop: 2,
                width: "100%",
                height: {
                  xs: post.mediaType === "audio" || post.mediaType === "document" ? "auto" : "180px",
                  sm: post.mediaType === "audio" || post.mediaType === "document" ? "auto" : "250px",
                  md: post.mediaType === "audio" || post.mediaType === "document" ? "auto" : "300px",
                },
                borderRadius: "8px",
                overflow: "hidden",
              }}
            >
              {post.mediaType === "image" && (
                <img
                  src={post.media}
                  alt="Post"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => (e.target.src = "/default-image.png")}
                />
              )}
              {post.mediaType === "video" && (
                <video
                  src={post.media}
                  controls
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={(e) => (e.target.src = "/default-video.mp4")}
                />
              )}
              {post.mediaType === "audio" && (
                <Box sx={{ width: "100%", paddingX: { xs: 1, sm: 2 }, paddingY: 1 }}>
                  <audio
                    src={post.media}
                    controls
                    style={{ width: "100%", maxWidth: 400 }}
                    onError={(e) => (e.target.src = "/default-audio.mp3")}
                  />
                </Box>
              )}
              {post.mediaType === "document" && (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 2, width: "100%" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {getDocumentIcon(getFileName(post))}
                    <Typography
                      color="text.primary"
                      sx={{ fontSize: { xs: "14px", sm: "16px" }, wordBreak: "break-word", textAlign: "center" }}
                    >
                      {getFileName(post)}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Box>

        <Box sx={{ marginTop: 1, width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ display: "flex", alignItems:"center" ,justifyContent: "center", gap: 2 }}>
            <Typography variant="caption" sx={{ display: "flex", alignItems: "center" }}>
              <ThumbUp sx={{ fontSize: 16, mr: 0.5 }} /> {post.likes?.length || 0}
            </Typography>
            <Typography variant="caption" sx={{ display: "flex", alignItems: "center" }}>
              <Comment sx={{ fontSize: 16, mr: 0.5 }} /> {post.comments?.length || 0}
            </Typography>
            <Typography variant="caption" sx={{ display: "flex", alignItems: "center" }}>
              <Bookmark sx={{ fontSize: 16, mr: 0.5 }} /> {post.bookmarks?.length || 0}
            </Typography>
            <Typography variant="caption" sx={{ display: "flex", alignItems: "center" }}>
              <Share sx={{ fontSize: 16, mr: 0.5 }} /> {post.shares || 0}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setSelectedPost(post);
              setCommentModalOpen(true);
            }}
          >
            View Comments
          </Button>
        </Box>
      </Box>
    );
  };

  if (isLoadingPosts) {
    return (
      <Box sx={{ width: "100%", maxWidth: "600px", mx: "auto" }}>
        {[...Array(3)].map((_, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            width="100%"
            height={400}
            sx={{ borderRadius: "16px", mb: 2 }}
          />
        ))}
      </Box>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      sx={{ width: "100%", maxWidth: "600px", mx: "auto", p: { xs: 1, sm: 2 } }}
    >
      <Typography variant="h5" sx={{ mb: 2, textAlign: "center" }}>
        Admin Dashboard - Manage Posts
      </Typography>
      {posts.posts?.length > 0 ? (
        posts.posts.map((post) => renderPost(post))
      ) : (
        <Typography textAlign="center" color="text.secondary">
          No posts available.
        </Typography>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMoreClose}
      >
        <MenuItem
          onClick={() => {
            handleBanUnbanPost(selectedPost?._id, selectedPost?.isBanned);
            handleMoreClose();
          }}
        >
          {selectedPost?.isBanned ? (
            <>
              <CheckCircle sx={{ marginRight: "10px" }} />
              Unban Post
            </>
          ) : (
            <>
              <Block sx={{ marginRight: "10px" }} />
              Ban Post
            </>
          )}
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleDeletePost(selectedPost?._id);
            handleMoreClose();
          }}
        >
          <Delete sx={{ marginRight: "10px" }} />
          Delete Post
        </MenuItem>
      </Menu>

      <Modal
        open={commentModalOpen}
        onClose={() => {
          setCommentModalOpen(false);
          setNewComment("");
          setSelectedPost(null);
        }}
        sx={{
          display: "flex",
          alignItems: { xs: "flex-end", sm: "center" },
          justifyContent: "center",
          px: { xs: 0, sm: 1 },
        }}
      >
        <Box
          sx={{
            width: { xs: "100%", sm: "90%", md: "600px" },
            maxWidth: "800px",
            maxHeight: { xs: "70vh", sm: "80vh" },
            backgroundColor: "rgba(255, 255, 255, 0.2)",
            backdropFilter: "blur(10px)",
            borderTopLeftRadius: { xs: 16, sm: 8 },
            borderTopRightRadius: { xs: 16, sm: 8 },
            borderBottomLeftRadius: { xs: 0, sm: 8 },
            borderBottomRightRadius: { xs: 0, sm: 8 },
            border: "1px solid rgba(255, 255, 255, 0.2)",
            padding: { xs: 1.5, sm: 2, md: 3 },
            overflowY: "auto",
            boxShadow: "0 4px 30px rgba(0, 0, 0, 0.2)",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
            <Typography
              variant="h6"
              color="text.primary"
              sx={{ fontSize: { xs: "1rem", sm: "1.25rem" } }}
            >
              Comments
            </Typography>
            <Button
              variant="text"
              sx={{
                color: "text.primary",
                fontSize: "14px",
              }}
              onClick={() => {
                setCommentModalOpen(false);
                setNewComment("");
                setSelectedPost(null);
              }}
            >
              Close
            </Button>
          </Box>
          <Box
            sx={{
              display: "flex",
              gap: { xs: 1, sm: 2 },
              marginBottom: 2,
              flexDirection: { xs: "column", sm: "row" },
            }}
          >
            <Avatar
              src={currentUser?.profilePic}
              alt={currentUser?.username}
              sx={{ width: { xs: 24, sm: 32 }, height: 32 }}
            />
            <Box sx={{ flex: 1 }}>
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                sx={{
                  backgroundColor: "rgba(255, 255, 255, 0.3)",
                  backdropFilter: "blur(5px)",
                  input: { color: "text.primary" },
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                    "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.5)" },
                    "&.Mui-focused fieldset": { borderColor: "primary.main" },
                  },
                  fontSize: { xs: "0.875rem", sm: "1rem" },
                }}
              />
            </Box>
            <Button
              variant="contained"
              onClick={() => handleAddComment(selectedPost?._id)}
              sx={{
                color: "primary.main",
                backgroundColor: "rgba(255, 255, 255, 0.3)",
                backdropFilter: "blur(5px)",
                "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.5)" },
                fontSize: { xs: "0.875rem", sm: "1rem" },
                paddingX: { xs: 1, sm: 2 },
              }}
            >
              Post
            </Button>
          </Box>
          {(selectedPost?.comments || []).length > 0 ? (
            selectedPost.comments.map((comment) => (
              <CommentItem
                key={comment._id}
                comment={comment}
                currentUser={currentUser}
                postId={selectedPost?._id}
                postPostedBy={selectedPost?.postedBy?._id?.toString() || selectedPost?.postedBy}
                onLike={() => handleLikeComment(selectedPost?._id, comment._id)}
                fetchComments={() => fetchComments(selectedPost?._id)}
              />
            ))
          ) : (
            <Typography
              color="text.primary"
              textAlign="center"
              sx={{ fontSize: { xs: "0.875rem", sm: "1rem" } }}
            >
              No comments yet.
            </Typography>
          )}
        </Box>
      </Modal>
    </motion.div>
  );
};

export default AdminHomepage;