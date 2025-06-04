import { useEffect, useState, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRecoilState, useRecoilValue } from "recoil";
import { motion } from "framer-motion";
import {
  Avatar,
  Box,
  Button,
  Typography,
  Divider,
  Menu,
  MenuItem,
  IconButton,
  TextField,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  MoreVert,
  Edit,
  Delete,
  Download,
  ThumbUp,
  Comment,
  Bookmark,
  Share,
} from "@mui/icons-material";
import { message } from "antd";
import { debounce } from "lodash";
import Actions from "../components/Actions";
import useGetUserProfile from "../hooks/useGetUserProfile";
import userAtom from "../atoms/userAtom";
import postsAtom from "../atoms/postsAtom";
import { SocketContext } from "../context/SocketContext";
import CommentItem from "../components/CommentItem";

const PostPage = () => {
  const { user, loading } = useGetUserProfile();
  const [posts, setPosts] = useRecoilState(postsAtom);
  const { pid } = useParams();
  const currentUser = useRecoilValue(userAtom);
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [dialogComment, setDialogComment] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [openCommentDialog, setOpenCommentDialog] = useState(false);
  const commentInputRef = useRef(null);
  const dialogCommentInputRef = useRef(null);
  const { socket } = useContext(SocketContext);

  const currentPost = posts.posts?.find((p) => p._id === pid);

  const debouncedSetNewComment = debounce((value) => {
    setNewComment(value);
  }, 100);

  const debouncedSetDialogComment = debounce((value) => {
    setDialogComment(value);
  }, 100);

  useEffect(() => {
    if (!socket || !pid) return;

    socket.emit("joinPostRoom", pid);

    const debouncedUpdatePost = debounce((postId, post) => {
      setPosts((prev) => ({
        ...prev,
        posts: prev.posts.map((p) => (p._id === postId ? post : p)),
      }));
    }, 300);

    const handleNewComment = ({ postId, comment, post }) => {
      if (postId === pid) {
        debouncedUpdatePost(postId, post);
        fetchComments();
      }
    };

    socket.on("newComment", handleNewComment);

    socket.on("likeUnlikePost", ({ postId, userId, likes, post }) => {
      if (postId === pid) {
        debouncedUpdatePost(postId, post);
      }
    });

    socket.on("likeUnlikeComment", ({ postId, commentId, userId, likes, post }) => {
      if (postId === pid) {
        debouncedUpdatePost(postId, post);
        fetchComments();
      }
    });

    socket.on("editComment", ({ postId, commentId, text, post }) => {
      if (postId === pid) {
        debouncedUpdatePost(postId, post);
        fetchComments();
      }
    });

    socket.on("deleteComment", ({ postId, commentId, post }) => {
      if (postId === pid) {
        debouncedUpdatePost(postId, post);
        fetchComments();
      }
    });

    socket.on("postDeleted", ({ postId }) => {
      if (postId === pid) {
        message.info("This post has been deleted");
        navigate(`/${user.username}`);
      }
    });

    socket.on("commentLiked", ({ postId, commentId, likes, post }) => {
      if (postId === pid) {
        debouncedUpdatePost(postId, post);
        fetchComments();
      }
    });

    socket.on("commentUpdated", ({ postId, commentId, text, isEdited, post }) => {
      if (postId === pid) {
        debouncedUpdatePost(postId, post);
        fetchComments();
      }
    });

    socket.on("commentDeleted", ({ postId, commentId, post }) => {
      if (postId === pid) {
        debouncedUpdatePost(postId, post);
        fetchComments();
      }
    });

    return () => {
      socket.emit("leavePostRoom", pid);
      socket.off("newComment", handleNewComment);
      socket.off("likeUnlikePost");
      socket.off("likeUnlikeComment");
      socket.off("editComment");
      socket.off("deleteComment");
      socket.off("postDeleted");
      socket.off("commentLiked");
      socket.off("commentUpdated");
      socket.off("commentDeleted");
    };
  }, [socket, pid, setPosts, navigate, user]);

  const fetchComments = async () => {
    if (!pid) {
      message.error("Invalid post ID");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        message.error("No authentication token found");
        return;
      }
      const res = await fetch(`/api/posts/${pid}/comments?page=1&limit=20`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
          p._id === pid ? { ...p, comments: data.comments, commentCount: data.totalComments } : p
        ),
      }));
    } catch (error) {
      console.error("Fetch comments exception:", error);
      message.error("Failed to fetch comments");
    }
  };

  useEffect(() => {
    if (!currentPost) fetchComments();
  }, [pid, currentPost]);

  const handleDeletePost = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      const res = await fetch(`/api/posts/${currentPost._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await res.json();
      if (data.error) {
        message.error(data.error);
        return;
      }
      message.success("Post deleted");
      if (socket) {
        socket.emit("postDeleted", { postId: currentPost._id, userId: currentUser._id });
      }
      navigate(`/${user.username}`);
    } catch (error) {
      message.error(error.message);
    }
  };

  const handleEditPost = () => navigate(`/edit-post/${currentPost._id}`);

  const handleDownloadPost = () => {
    const content = currentPost.media || currentPost.text;
    const blob = new Blob([content], {
      type: currentPost.media ? "application/octet-stream" : "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = currentPost.media
      ? `post_${currentPost._id}.${currentPost.mediaType}`
      : `post_${currentPost._id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBanUnbanPost = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/posts/${currentPost._id}/ban`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (data.error) {
        message.error(data.error);
        return;
      }
      message.success(currentPost.isBanned ? "Post unbanned" : "Post banned");
      setPosts((prev) => ({
        ...prev,
        posts: prev.posts.map((p) =>
          p._id === currentPost._id ? { ...p, isBanned: !p.isBanned } : p
        ),
      }));
    } catch (error) {
      message.error(error.message || "Failed to ban/unban post");
    }
  };

  const handleMoreClick = (event) => setAnchorEl(event.currentTarget);
  const handleMoreClose = () => setAnchorEl(null);

  const handleAddComment = async () => {
    const commentText = openCommentDialog ? dialogComment : newComment;
    if (!commentText.trim()) {
      message.error("Comment cannot be empty");
      return;
    }
    setIsCommenting(true);
    try {
      const res = await fetch(`/api/posts/${currentPost._id}/comment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ text: commentText }),
      });
      const data = await res.json();
      if (data.error) {
        message.error(data.error);
        return;
      }
      setNewComment("");
      setDialogComment("");
      setOpenCommentDialog(false);
      message.success("Comment added");
      fetchComments();
      if (socket) {
        socket.emit("newComment", { postId: currentPost._id, comment: data, userId: currentUser._id });
      }
    } catch (error) {
      message.error(error.message);
    } finally {
      setIsCommenting(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  const handleEdit = async (commentId, text) => {
    try {
      const endpoint = `/api/posts/${currentPost._id}/comment/${commentId}`;
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.error) {
        message.error(data.error);
        return;
      }
      message.success("Comment updated");
      fetchComments();
      if (socket) {
        socket.emit("editComment", { postId: currentPost._id, commentId, text, userId: currentUser._id });
      }
    } catch (error) {
      message.error(error.message);
    }
  };

  const handleDelete = async (commentId) => {
    try {
      const endpoint = `/api/posts/${currentPost._id}/comment/${commentId}`;
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await res.json();
      if (data.error) {
        message.error(data.error);
        return;
      }
      message.success("Comment deleted");
      fetchComments();
      if (socket) {
        socket.emit("deleteComment", { postId: currentPost._id, commentId, userId: currentUser._id });
      }
    } catch (error) {
      message.error(error.message);
    }
  };

  const handleLike = async (commentId) => {
    if (!currentUser) return message.error("You must be logged in to like");
    try {
      const endpoint = `/api/posts/${currentPost._id}/comment/${commentId}/like`;
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await res.json();
      if (data.error) {
        console.error("Like comment error:", data.error);
        message.error(data.error);
        return;
      }
      message.success(data.likes.includes(currentUser._id) ? "Liked" : "Unliked");
      fetchComments();
      if (socket) {
        socket.emit("likeUnlikeComment", {
          postId: currentPost._id,
          commentId,
          userId: currentUser._id,
          likes: data.likes,
        });
      }
    } catch (error) {
      console.error("Like comment exception:", error);
      message.error(error.message);
    }
  };

  const handleCommentClick = () => {
    if (!currentUser) {
      message.error("Please log in to comment");
      navigate("/auth");
      return;
    }
    setOpenCommentDialog(true);
  };

  if (!user && loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!currentPost) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{ backgroundColor: "#F5F5F5", minHeight: "100vh", padding: { xs: "8px", sm: "16px" } }}
    >
      <Paper
        elevation={3}
        sx={{
          maxWidth: 700,
          mx: "auto",
          bgcolor: "white",
          borderRadius: "12px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" p={2}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Avatar src={user.profilePic} alt={user.username} sx={{ width: 40, height: 40 }} />
            <Typography fontWeight="600" fontSize="16px">{user.username}</Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="caption" color="text.secondary" fontSize="12px">
              {new Date(currentPost.createdAt).toLocaleString()}
            </Typography>
            <IconButton onClick={handleMoreClick} size="small">
              <MoreVert fontSize="small" />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMoreClose}
              PaperProps={{
                sx: { borderRadius: "8px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" },
              }}
            >
              {(currentUser?._id === user._id || currentUser?.isAdmin) && [
                <MenuItem key="edit" onClick={handleEditPost}>
                  <Edit fontSize="small" sx={{ mr: 1 }} /> Edit
                </MenuItem>,
                <MenuItem key="delete" onClick={handleDeletePost}>
                  <Delete fontSize="small" sx={{ mr: 1 }} /> Delete
                </MenuItem>,
              ]}
              <MenuItem onClick={handleDownloadPost}>
                <Download fontSize="small" sx={{ mr: 1 }} /> Download
              </MenuItem>
              {currentUser?.isAdmin && (
                <MenuItem
                  onClick={() => {
                    handleBanUnbanPost();
                    handleMoreClose();
                  }}
                >
                  {currentPost.isBanned ? "Unban Post" : "Ban Post"}
                </MenuItem>
              )}
            </Menu>
          </Box>
        </Box>

        {currentPost.media && (
          <Box borderRadius={0} overflow="hidden">
            {currentPost.mediaType === "image" && (
              <img
                src={currentPost.media}
                alt="Post media"
                style={{ width: "100%", objectFit: "contain", maxHeight: "500px" }}
              />
            )}
            {currentPost.mediaType === "video" && (
              <video
                controls
                src={currentPost.media}
                style={{ width: "100%", maxHeight: "500px" }}
              />
            )}
            {currentPost.mediaType === "audio" && (
              <audio
                controls
                src={currentPost.media}
                style={{ width: "100%", padding: "16px" }}
              />
            )}
            {currentPost.mediaType === "document" && (
              <a
                href={currentPost.media}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outlined" sx={{ m: 2, fontSize: "14px", borderRadius: "8px" }}>
                  View Document
                </Button>
              </a>
            )}
          </Box>
        )}

        <Box p={2}>
          {currentUser?.isAdmin ? (
            <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 2 }}>
              <Typography variant="caption" sx={{ display: "flex", alignItems: "center" }}>
                <ThumbUp sx={{ fontSize: 16, mr: 0.5 }} /> {currentPost.likes?.length || 0}
              </Typography>
              <Typography variant="caption" sx={{ display: "flex", alignItems: "center" }}>
                <Comment sx={{ fontSize: 16, mr: 0.5 }} /> {currentPost.comments?.length || 0}
              </Typography>
              <Typography variant="caption" sx={{ display: "flex", alignItems: "center" }}>
                <Bookmark sx={{ fontSize: 16, mr: 0.5 }} /> {currentPost.bookmarks?.length || 0}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Actions post={currentPost} onCommentClick={handleCommentClick} />
            </Box>
          )}
          <Typography fontSize="15px" sx={{ wordBreak: "break-word" }} mb={2}>
            <strong>{user.username}</strong> {currentPost.text}
          </Typography>

          <Divider sx={{ my: 2, borderColor: "rgba(0,0,0,0.1)" }} />

          {currentUser && !currentUser.isAdmin && (
            <Box display="flex" gap={1.5} mb={3} alignItems="center">
              <Avatar
                src={currentUser.profilePic}
                alt={currentUser.username}
                sx={{ width: 32, height: 32 }}
              />
              <TextField
                inputRef={commentInputRef}
                fullWidth
                variant="outlined"
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => debouncedSetNewComment(e.target.value)}
                onKeyPress={handleKeyPress}
                size="small"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "24px",
                    bgcolor: "#F5F5F5",
                    "& fieldset": { border: "1px solid #E0E0E0" },
                    "&:hover fieldset": { borderColor: "#B0B0B0" },
                    "&.Mui-focused fieldset": { borderColor: "#1976D2" },
                  },
                  "& .MuiInputBase-input": { fontSize: "15px", py: 1.2 },
                }}
              />
              <Button
                onClick={handleAddComment}
                disabled={!newComment.trim() || isCommenting}
                sx={{
                  fontSize: "14px",
                  color: "#1976D2",
                  fontWeight: "600",
                  borderRadius: "20",
                  px: 2,
                  "&:hover": { bgcolor: "#E3F2FD" },
                }}
              >
                {isCommenting ? "Posting..." : "Post"}
              </Button>
            </Box>
          )}

          <Box>
            {currentPost.comments?.length > 0 ? (
              currentPost.comments.map((comment) => (
                <CommentItem
                  key={comment._id}
                  comment={comment}
                  currentUser={currentUser}
                  postId={currentPost._id}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onLike={handleLike}
                  fetchComments={fetchComments}
                />
              ))
            ) : (
              <Typography variant="body2" color="text.secondary" fontSize="14px" textAlign="center">
                No comments yet. Be the first to comment!
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>

      <Dialog
        open={openCommentDialog}
        onClose={() => {
          setOpenCommentDialog(false);
          setDialogComment("");
        }}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: { borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" },
        }}
      >
        <DialogTitle sx={{ fontSize: "18px", fontWeight: 600 }}>Add a Comment</DialogTitle>
        <DialogContent>
          <TextField
            inputRef={dialogCommentInputRef}
            autoFocus
            fullWidth
            variant="outlined"
            placeholder="Write your comment..."
            value={dialogComment}
            onChange={(e) => debouncedSetDialogComment(e.target.value)}
            multiline
            rows={4}
            sx={{
              "& .MuiOutlinedInput-root": {
                "& fieldset": { borderColor: "rgba(0,0,0,0.1)" },
                "&:hover fieldset": { borderColor: "rgba(0,0,0,0.2)" },
                "&.Mui-focused fieldset": { borderColor: "#1976D2" },
                "& .MuiInputBase-input": { fontSize: "15px" },
                mt: 1,
              },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            variant="text"
            onClick={() => {
              setOpenCommentDialog(false);
              setDialogComment("");
            }}
            sx={{ fontSize: "14px", color: "text.secondary" }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddComment}
            variant="contained"
            disabled={!dialogComment.trim() || isCommenting}
            sx={{
              fontSize: "14px",
              borderRadius: "8px",
              bgcolor: "#1976D2",
              "&:hover": { bgcolor: "#1565C0" },
            }}
          >
            {isCommenting ? "Posting..." : "Post"}
          </Button>
        </DialogActions>
      </Dialog>
    </motion.div>
  );
};

export default PostPage;
