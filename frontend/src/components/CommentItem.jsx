import { useState } from "react";
import { Avatar, Box, Button, Typography, TextField, IconButton } from "@mui/material";
import { message } from "antd";
import { formatDistanceToNow } from "date-fns";
import { Particles, initParticlesEngine } from "@tsparticles/react";
import { loadFull } from "tsparticles";
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOffAltIcon from '@mui/icons-material/ThumbUpOffAlt';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { motion } from "framer-motion";

const LikeButton = ({ count, onLike, isLiked, disabled }) => {
  const [showParticles, setShowParticles] = useState(false);
  const [particlesLoaded, setParticlesLoaded] = useState(false);

  useState(() => {
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
          <ThumbUpIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
        ) : (
          <ThumbUpOffAltIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
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
  users,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(comment.text);

  const commentUser = {
    username: comment.username || users[comment.userId]?.username || "Unknown User",
    profilePic: comment.userProfilePic || users[comment.userId]?.profilePic || "/default-avatar.png",
  };

  const isValidDate = comment.createdAt && !isNaN(new Date(comment.createdAt).getTime());

  // Ensure IDs are strings for comparison
  const currentUserId = currentUser?._id?.toString();
  const commentUserId = comment.userId?.toString();
  const postPostedById = postPostedBy?.toString();

  // Authorization check
  const canEdit = currentUserId === commentUserId || currentUser?.isAdmin;
  const canDelete = currentUserId === commentUserId || currentUserId === postPostedById || currentUser?.isAdmin;

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
          sx={{ position: "absolute", top: 10, right: 10 }}
        >
          {`${formatDistanceToNow(new Date(comment.createdAt))} ago${comment.isEdited ? " (Edited)" : ""}`}
        </Typography>
      )}

      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
        <Box sx={{ flex: 1 }}>
          {isEditing ? (
            <Box sx={{ mt: 1 }}>
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
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={async () => {
                    if (!editedText.trim()) {
                      message.error("Comment cannot be empty");
                      return;
                    }
                    try {
                      await onEdit(comment._id, editedText);
                      setIsEditing(false);
                      message.success("Comment updated successfully");
                      await fetchComments();
                    } catch (error) {
                      message.error(error.message || "Failed to update comment");
                    }
                  }}
                  disabled={!editedText.trim()}
                  sx={{
                    bgcolor: "primary.main",
                    "&:hover": { bgcolor: "primary.dark" },
                  }}
                >
                  Save
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setIsEditing(false)}
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
            <Box>
              <Typography
                variant="body2"
                color="text.primary"
                sx={{ wordBreak: "break-word" }}
              >
                {comment.text}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center" }}>
          <LikeButton
            count={comment.likes?.length || 0}
            onLike={onLike}
            isLiked={currentUser && comment.likes?.includes(currentUser._id?.toString())}
            disabled={!currentUser}
          />
        </Box>
      </Box>

      {(canEdit || canDelete) && !isEditing && (
        <Box sx={{ display: "flex", gap: 1, mt: 1, justifyContent: "flex-end" }}>
          {canEdit && (
            <IconButton
              size="small"
              onClick={() => setIsEditing(true)}
              sx={{ color: "primary.main" }}
            >
              <EditIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />
            </IconButton>
          )}
          {canDelete && (
            <IconButton
              size="small"
              onClick={async () => {
                try {
                  await onDelete(comment._id);
                  message.success("Comment deleted successfully");
                  await fetchComments();
                } catch (error) {
                  message.error(error.message || "Failed to delete comment");
                }
              }}
              sx={{ color: "error.main" }}
            >
              <DeleteIcon sx={{ fontSize: { xs: 16, sm: 18 } }} />
            </IconButton>
          )}
        </Box>
      )}
    </Box>
  );
};

export default CommentItem;