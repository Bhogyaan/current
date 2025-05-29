import React, { useEffect, useState, useCallback, useContext } from "react";
import {
  Avatar,
  Box,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Modal,
  Button,
  TextField,
  Skeleton,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  MoreVert,
  Edit,
  Delete,
  Download,
  Verified as VerifiedIcon,
  Share,
  Block,
  CheckCircle,
} from "@mui/icons-material";
import { formatDistanceToNow } from "date-fns";
import { message } from "antd";
import { useRecoilState, useRecoilValue } from "recoil";
import userAtom from "../atoms/userAtom";
import postsAtom from "../atoms/postsAtom";
import Actions from "./Actions";
import { motion } from "framer-motion";
import {
  BsFileEarmarkTextFill,
  BsFileZipFill,
  BsFileWordFill,
  BsFileExcelFill,
  BsFilePptFill,
  BsFileTextFill,
} from "react-icons/bs";
import CommentItem from "./CommentItem";
import { SocketContext } from "../context/SocketContext";
import { debounce } from "lodash";
import { ThumbUp, Comment, Bookmark } from "@mui/icons-material";

const Post = ({ post, postedBy }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [posts, setPosts] = useRecoilState(postsAtom);
  const currentUser = useRecoilValue(userAtom);
  const navigate = useNavigate();
  const { socket } = useContext(SocketContext);

  const fetchComments = useCallback(async () => {
    if (!post?._id) {
      message.error("Invalid post ID");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        message.error("No authentication token found");
        return;
      }
      const res = await fetch(`/api/posts/${post._id}/comments?page=1&limit=10`, {
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
          p._id === post._id ? { ...p, comments: data.comments } : p
        ),
      }));
    } catch (error) {
      console.error("Fetch comments exception:", error);
      message.error("Failed to fetch comments");
    }
  }, [post?._id, setPosts]);

  const debouncedUpdateComments = debounce((postId, updatedComments) => {
    setPosts((prev) => ({
      ...prev,
      posts: prev.posts.map((p) =>
        p._id === postId ? { ...p, comments: updatedComments } : p
      ),
    }));
  }, 300);

  useEffect(() => {
    if (socket && post?._id) {
      socket.emit("joinPost", post._id);

      socket.on("newComment", ({ postId, comment, post: updatedPost }) => {
        if (postId === post._id && updatedPost) {
          debouncedUpdateComments(postId, updatedPost.comments);
          fetchComments();
        }
      });

      socket.on("likeUnlikeComment", ({ postId, commentId, userId, likes, post: updatedPost }) => {
        if (postId === post._id && updatedPost) {
          debouncedUpdateComments(postId, updatedPost.comments);
          fetchComments();
        }
      });

      socket.on("editComment", ({ postId, commentId, text, post: updatedPost }) => {
        if (postId === post._id && updatedPost) {
          debouncedUpdateComments(postId, updatedPost.comments);
          fetchComments();
        }
      });

      socket.on("deleteComment", ({ postId, commentId, post: updatedPost }) => {
        if (postId === post._id && updatedPost) {
          debouncedUpdateComments(postId, updatedPost.comments);
          fetchComments();
        }
      });

      socket.on("postDeleted", ({ postId }) => {
        if (postId === post._id) {
          message.info("Post has been deleted");
          setPosts((prev) => ({
            ...prev,
            posts: prev.posts.filter((p) => p._id !== postId),
          }));
        }
      });

      socket.on("postBanned", ({ postId, post: updatedPost }) => {
        if (postId === post._id) {
          setPosts((prev) => ({
            ...prev,
            posts: prev.posts.map((p) =>
              p._id === postId ? { ...p, isBanned: true } : p
            ),
          }));
        }
      });

      socket.on("postUnbanned", ({ postId, post: updatedPost }) => {
        if (postId === post._id) {
          setPosts((prev) => ({
            ...prev,
            posts: prev.posts.map((p) =>
              p._id === postId ? { ...p, isBanned: false } : p
            ),
          }));
        }
      });

      return () => {
        socket.emit("leavePost", post._id);
        socket.off("newComment");
        socket.off("likeUnlikeComment");
        socket.off("editComment");
        socket.off("deleteComment");
        socket.off("postDeleted");
        socket.off("postBanned");
        socket.off("postUnbanned");
      };
    }
  }, [socket, post?._id, setPosts, fetchComments]);

  const fetchUserData = useCallback(async () => {
    try {
      setIsLoading(true);
      const queryParam = typeof postedBy === "string" ? postedBy : postedBy?._id || postedBy?.username;
      if (!queryParam) {
        message.error("Invalid user data for post");
        return;
      }
      const res = await fetch(`/api/users/profile/${queryParam}`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      if (data.error) {
        message.error("User not found");
        return;
      }
      setUser({
        ...data,
        username: data.username || "Unknown User",
        profilePic: data.profilePic || "/default-avatar.png",
        name: data.name || "Unknown",
      });
    } catch (error) {
      console.error(error);
      message.error(error.message || "Failed to fetch user data");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [postedBy]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleDeletePost = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      const res = await fetch(`/api/posts/${post._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        credentials: "include",
      });
      const data = await res.json();
      if (data.error) {
        message.error(data.error);
        return;
      }
      message.success("Post deleted");
      setPosts((prev) => ({
        ...prev,
        posts: prev.posts.filter((p) => p._id !== post._id),
      }));
    } catch (error) {
      message.error(error.message || "Failed to delete post");
    }
  };

  const handleEditPost = () => {
    navigate(`/edit-post/${post._id}`);
  };

  const handleDownloadPost = () => {
    const content = post.content || post.text;
    const mediaType = post?.mediaType || "text/plain";
    const blob = new Blob([content], { type: mediaType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = post.originalFilename || `post_${post._id}.${mediaType.split('/')[1] || "txt"}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBanPost = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/posts/${post._id}/ban`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        credentials: "include",
      });
      const data = await res.json();
      if (data.error) {
        message.error(data.error);
        return;
      }
      message.success("Post banned successfully");
      setPosts((prev) => ({
        ...prev,
        posts: prev.posts.map((p) =>
          p._id === post._id ? { ...p, isBanned: true } : p
        ),
      }));
    } catch (error) {
      message.error(error.message || "Failed to ban post");
    }
  };

  const handleUnbanPost = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/posts/${post._id}/unban`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        credentials: "include",
      });
      const data = await res.json();
      if (data.error) {
        message.error(data.error);
        return;
      }
      message.success("Post unbanned successfully");
      setPosts((prev) => ({
        ...prev,
        posts: prev.posts.map((p) =>
          p._id === post._id ? { ...p, isBanned: false } : p
        ),
      }));
    } catch (error) {
      message.error(error.message || "Failed to unban post");
    }
  };

  const handleMoreClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMoreClose = () => {
    setAnchorEl(null);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      message.error("Comment cannot be empty");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/posts/${post._id}/comment`, {
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
      await fetchComments();
      if (socket) {
        socket.emit("newComment", { postId: post._id, comment: data, userId: currentUser._id });
      }
    } catch (error) {
      message.error(error.message || "Failed to add comment");
    }
  };

  const handleLikeComment = async (commentId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        message.error("No authentication token found");
        return;
      }
      const res = await fetch(`/api/posts/${post._id}/comment/${commentId}/like`, {
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
      await fetchComments();
      if (socket) {
        socket.emit("likeUnlikeComment", {
          postId: post._id,
          commentId,
          userId: currentUser._id,
          likes: data.likes,
        });
      }
    } catch (error) {
      message.error(error.message || "Failed to like/unlike comment");
    }
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

  const getFileName = () => {
    return (
      post.originalFilename ||
      post.media?.split("/")?.pop() ||
      "Unknown Document"
    );
  };

  const renderPost = (post, postUser) => {
    if (!post || !postUser) {
      return null;
    }

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
              alt={postUser.name || "Unknown User"}
              src={postUser.profilePic || "/default-avatar.png"}
              onClick={() => navigate(`/${postUser.username}`)}
            />
            <Box display="flex" alignItems="center">
              <Typography
                variant="body2"
                fontWeight="bold"
                color="text.primary"
                sx={{ cursor: "pointer" }}
                onClick={() => navigate(`/${postUser.username}`)}
              >
                {postUser.username || "Unknown User"}
              </Typography>
              {postUser.isVerified && (
                <Typography variant="span" sx={{ color: "primary.main", fontSize: "small", marginLeft: 1 }}>
                  <VerifiedIcon sx={{ fontSize: "small" }} />
                </Typography>
              )}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.75rem", marginLeft: 1 }}
              >
                {formatDistanceToNow(new Date(post.createdAt))} ago
                {post.isEdited && " (Edited)"}
              </Typography>
            </Box>
          </Box>
          <Box>
            <IconButton
              onClick={handleMoreClick}
              sx={{ color: "text.primary", fontSize: { xs: "20px", sm: "24px" } }}
            >
              <MoreVert />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMoreClose}
            >
              {(currentUser && (currentUser._id === postUser._id)) && [
                <MenuItem
                  key="edit"
                  onClick={() => {
                    handleEditPost();
                    handleMoreClose();
                  }}
                >
                  <Edit sx={{ marginRight: "10px" }} />
                  Edit
                </MenuItem>,
                <MenuItem
                  key="delete"
                  onClick={() => {
                    handleDeletePost();
                    handleMoreClose();
                  }}
                >
                  <Delete sx={{ marginRight: "10px" }} />
                  Delete
                </MenuItem>,
              ]}
              <MenuItem
                onClick={() => {
                  handleDownloadPost();
                  handleMoreClose();
                }}
              >
                <Download sx={{ marginRight: "10px" }} />
                Download
              </MenuItem>
              {currentUser?.isAdmin && (
                post.isBanned ? (
                  <MenuItem
                    onClick={() => {
                      handleUnbanPost();
                      handleMoreClose();
                    }}
                  >
                    <CheckCircle sx={{ marginRight: "10px" }} />
                    Unban Post
                  </MenuItem>
                ) : (
                  <MenuItem
                    onClick={() => {
                      handleBanPost();
                      handleMoreClose();
                    }}
                  >
                    <Block sx={{ marginRight: "10px" }} />
                    Ban Post
                  </MenuItem>
                )
              )}
            </Menu>
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 2, flex: 1 }}>
          <Typography
            variant="body2"
            color="text.primary"
            sx={{
              fontSize: {
                xs: "0.875rem",
                sm: "1rem",
              },
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
                <>
                  <img
                    src={post.media}
                    alt="Post"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => (e.target.src = "/default-image.png")}
                  />
                  {post.isEdited && (
                    <Typography
                      variant="span"
                      sx={{
                        position: "absolute",
                        bottom: 10,
                        right: 10,
                        backgroundColor: "rgba(0, 0, 0, 0.6)",
                        color: "white",
                        padding: "2px 4px",
                        borderRadius: "2px",
                        fontSize: { xs: "0.65rem", sm: "0.75rem" },
                      }}
                    >
                      Edited
                    </Typography>
                  )}
                </>
              )}
              {post.mediaType === "video" && (
                <Box sx={{ height: "100%", width: "100%" }}>
                  <video
                    src={post.media}
                    controls
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => (e.target.src = "/default-video.mp4")}
                  />
                </Box>
              )}
              {post.mediaType === "audio" && (
                <Box sx={{ width: "100%", paddingX: { xs: 1, sm: 2 }, paddingY: 1, display: "flex", justifyContent: "center" }}>
                  <Box sx={{ width: "100%", maxWidth: "100%" }}>
                    <audio
                      src={post.media}
                      controls
                      style={{ width: "100%", maxWidth: 400 }}
                      onError={(e) => (e.target.src = "/default-audio.mp3")}
                    />
                  </Box>
                </Box>
              )}
              {post.mediaType === "document" && (
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 2, width: "100%" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {getDocumentIcon(getFileName())}
                    <Typography
                      color="text.primary"
                      sx={{ fontSize: { xs: "14px", sm: "16px" }, wordBreak: "break-word", textAlign: "center" }}
                    >
                      {getFileName()}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Box>

        <Box sx={{ marginTop: 1, width: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
          {currentUser?.isAdmin ? (
            <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
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
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
              <Actions post={post} onCommentClick={() => setCommentModalOpen(true)} />
            </Box>
          )}
        </Box>

        <Modal
          open={commentModalOpen}
          onClose={() => {
            setCommentModalOpen(false);
            setNewComment("");
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
                }}
              >
                Close
              </Button>
            </Box>
            {currentUser && !currentUser.isAdmin && (
              <Box
                sx={{
                  display: "flex",
                  gap: { xs: 1, sm: 2 },
                  marginBottom: 2,
                  flexDirection: { xs: "column", sm: "row" },
                }}
              >
                <Avatar
                  src={currentUser.profilePic}
                  alt={currentUser.username}
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
                  onClick={handleAddComment}
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
            )}
            {(post.comments || []).length > 0 ? (
              post.comments.map((comment) => (
                <CommentItem
                  key={comment._id}
                  comment={comment}
                  currentUser={currentUser}
                  postId={post._id}
                  postPostedBy={post.postedBy?._id?.toString() || post.postedBy}
                  onLike={() => handleLikeComment(comment._id)}
                  fetchComments={fetchComments}
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
      </Box>
    );
  };

  if (isLoading) {
    return (
      <Skeleton
        variant="rectangular"
        width="100%"
        height={400}
        sx={{ borderRadius: "16px", mb: 2 }}
      />
    );
  }

  if (!user || !post) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {renderPost(post, user)}
    </motion.div>
  );
};

export default Post;