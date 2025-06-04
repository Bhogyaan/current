import { useState, useEffect } from "react";
import { Avatar, Box, Button, Typography, TextField, IconButton } from "@mui/material";
import { message } from "antd";
import { formatDistanceToNow } from "date-fns";
import { Particles, initParticlesEngine } from "@tsparticles/react";
import { loadFull } from "tsparticles";
import PanToolIcon from '@mui/icons-material/PanTool';
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined';
import EditIcon from '@mui/icons-material/Edit';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { motion } from "framer-motion";

const LikeButton = ({ count, onLike, isLiked, disabled }) => {
  const [showParticles, setShowParticles] = useState(false);
  const [particlesLoaded, setParticlesLoaded] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadFull(engine);
      setParticlesLoaded(true);
    });
  }, []);

  const handleLike = () => {
    if (!disabled && particlesLoaded) {
      setShowParticles(true);
      onLike();
      setTimeout(() => setShowParticles(false), 1000);
    }
  };

  return (
    <Box sx={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <IconButton
        component={motion.button}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleLike}
        disabled={disabled || !particlesLoaded}
        sx={{
          color: isLiked ? "#ED4956" : "text.secondary",
          "&:hover": { color: "#ED4956" },
        }}
      >
        {isLiked ? (
          <PanToolIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
        ) : (
          <PanToolOutlinedIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
        )}
        <Typography variant="caption" sx={{ ml: 0.5, color: "text.secondary" }}>
          {count || 0}
        </Typography>
      </IconButton>
      {showParticles && particlesLoaded && (
        <Particles
          id={`like-particles-${Math.random()}`}
          options={{
            particles: {
              number: { value: 20, density: { enable: true, value_area: 800 } },
              color: { value: ["#ED4956", "#FFA500", "#FF4500"] },
              shape: { type: "circle" },
              opacity: { value: 0.5, random: true },
              size: { value: 5, random: true },
              move: {
                enable: true,
                speed: 6,
                direction: "top",
                random: true,
                out_mode: "out",
              },
            },
            interactivity: { events: { onhover: { enable: false }, onclick: { enable: false } } },
            retina_detect: true,
          }}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
        />
      )}
    </Box>
  );
};

const CommentItem = ({
  comment,
  currentUser,
  postId,
  postPostedBy,
  onEdit,
  onDelete,
  onLike,
  fetchComments,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(comment.text);
  const [isLiked, setIsLiked] = useState(
    currentUser && comment.likes?.includes(currentUser._id?.toString())
  );
  const [likeCount, setLikeCount] = useState(comment.likes?.length || 0);
  const [isLoading, setIsLoading] = useState(false);

  const commentUser = {
    username: comment.username || "Unknown User",
    profilePic: comment.userProfilePic || "/default-avatar.png",
  };

  const isValidDate = comment.createdAt && !isNaN(new Date(comment.createdAt).getTime());

  const currentUserId = currentUser?._id?.toString();
  const commentUserId = comment.userId?.toString();
  const postPostedById = postPostedBy?.toString();

  const canEdit = currentUser && (currentUserId === commentUserId || currentUser?.isAdmin);
  const canDelete = currentUser && (
    currentUserId === commentUserId || 
    currentUserId === postPostedById || 
    currentUser?.isAdmin
  );

  const handleLike = async () => {
    if (!currentUser) {
      message.error("Please login to like comments");
      return;
    }
    try {
      setIsLoading(true);
      const newLikes = await onLike(comment._id);
      setIsLiked(!isLiked);
      setLikeCount(newLikes.length);
    } catch (error) {
      message.error(error.message || "Failed to like comment");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!currentUser) {
      message.error("Please login to edit comments");
      return;
    }
    if (!editedText.trim()) {
      message.error("Comment cannot be empty");
      return;
    }
    try {
      setIsLoading(true);
      await onEdit(comment._id, editedText);
      setIsEditing(false);
      message.success("Comment updated successfully");
    } catch (error) {
      message.error(error.message || "Failed to edit comment");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentUser) {
      message.error("Please login to delete comments");
      return;
    }
    try {
      setIsLoading(true);
      await onDelete(comment._id);
      message.success("Comment deleted successfully");
    } catch (error) {
      message.error(error.message || "Failed to delete comment");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        mt: 1,
        p: 1.5,
        bgcolor: "rgba(255, 255, 255, 0.05)",
        borderRadius: 2,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        position: "relative",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          <Avatar
            src={commentUser.profilePic}
            alt={commentUser.username}
            sx={{ width: { xs: 32, sm: 36 }, height: { xs: 32, sm: 36 } }}
          />
          <Typography variant="caption" color="text.primary" sx={{ fontWeight: "bold" }}>
            {commentUser.username}
          </Typography>
        </Box>

        {isValidDate && (
          <Typography
            variant="caption"
            color="text.secondary"
          >
            {`${formatDistanceToNow(new Date(comment.createdAt))} ago${comment.isEdited ? " (Edited)" : ""}`}
          </Typography>
        )}
      </Box>

      <Box sx={{ mt: 1 }}>
        {isEditing ? (
          <Box>
            <TextField
              fullWidth
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              multiline
              sx={{
                mb: 1,
                bgcolor: "rgba(255, 255, 255, 0.3)",
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { borderColor: "rgba(255, 255, 255, 0.3)" },
                  "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.5)" },
                  "&.Mui-focused fieldset": { borderColor: "primary.main" },
                  "& .MuiInputBase-input": { color: "text.primary" },
                },
              }}
            />
            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button
                size="small"
                variant="contained"
                onClick={handleEdit}
                disabled={!editedText.trim() || isLoading}
                sx={{
                  bgcolor: "primary.main",
                  "&:hover": { bgcolor: "primary.dark" },
                }}
              >
                {isLoading ? "Saving..." : "Save"}
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => setIsEditing(false)}
                disabled={isLoading}
                sx={{
                  borderColor: "rgba(255, 255, 255, 0.3)",
                  "&:hover": { borderColor: "rgba(255, 255, 255, 0.5)", bgcolor: "rgba(255, 255, 255, 0.1)" },
                }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        ) : (
          <Typography
            variant="body2"
            color="text.primary"
            sx={{ wordBreak: "break-word" }}
          >
            {comment.text}
          </Typography>
        )}
      </Box>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
        <LikeButton
          count={likeCount}
          onLike={handleLike}
          isLiked={isLiked}
          disabled={!currentUser || isLoading}
        />
        {currentUser && (
          <Box sx={{ display: "flex", gap: 1 }}>
            {canEdit && (
              <IconButton
                size="small"
                onClick={() => setIsEditing(true)}
                disabled={isLoading}
                sx={{ color: "primary.main" }}
              >
                <EditIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />
              </IconButton>
            )}
            {canDelete && (
              <IconButton
                size="small"
                onClick={handleDelete}
                disabled={isLoading}
                sx={{ color: "error.main" }}
              >
                <DeleteForeverIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />
              </IconButton>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default CommentItem;