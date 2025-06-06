import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useRecoilValue } from "recoil";
import userAtom from "../atoms/userAtom";
import useShowToast from "../hooks/useShowToast";

// MUI Imports
import {
  Box,
  IconButton,
  Tooltip,
  Skeleton,
  Avatar,
} from "@mui/material";
import {
  HomeOutlined as HomeIcon,
  SearchOutlined as SearchIcon,
  AccountCircleOutlined as PersonIcon,
  ForumOutlined as ChatIcon,
  AddBoxOutlined as AddCircleIcon,
} from "@mui/icons-material";

// Antd Imports
import { Flex as AntdFlex } from "antd";

// Framer Motion Imports
import { motion } from "framer-motion";

const BottomNav = ({ onOpenCreatePost }) => {
  const [loading, setLoading] = useState(true); // Skeleton loading state
  const navigate = useNavigate();
  const location = useLocation();
  const user = useRecoilValue(userAtom);
  const showToast = useShowToast();

  // Simulate loading for demo purposes
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Only show on small screens (below 500px)
  const isBelow500px = window.innerWidth <= 500; // Simplified media query for demo
  if (!isBelow500px) return null;

  const isActive = (path) => location.pathname === path;

  const handleProfileClick = () => {
    if (!user || !user.username) {
      showToast("Error", "You must be logged in to view your profile", "error");
      return;
    }
    navigate(`/${user.username}`);
  };

  const handleCreatePostClick = () => {
    if (!user) {
      showToast("Error", "You must be logged in to create a post", "error");
      return;
    }
    onOpenCreatePost();
  };

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        bgcolor: "#080201",
        color: "white",
        py: 1.5,
        zIndex: 10,
        boxShadow: "0 -2px 15px rgba(0,0,0,0.3)", // Enhanced shadow
        borderTopLeftRadius: "20px", // Curved borders
        borderTopRightRadius: "20px", // Curved borders
      }}
    >
      {loading ? (
        <AntdFlex justify="space-around">
          {[...Array(5)].map((_, index) => (
            <Skeleton
              key={index}
              variant="circular"
              width={56}
              height={56}
              sx={{ bgcolor: "#334155" }} // Updated skeleton color
            />
          ))}
        </AntdFlex>
      ) : (
        <AntdFlex justify="space-around" align="center">
          <Tooltip title="Home">
            <IconButton
              component={motion.button}
              whileHover={{ scale: 1.2, rotate: 10 }} // Enhanced hover effect
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate("/")}
              sx={{
                color: isActive("/") ? "#8515fe" : "white", // Updated to a vibrant blue
                "&:hover": { color: "#8515fe" },
                borderRadius: "50%", // Curved border
                backgroundColor: isActive("/") ? "rgba(99, 102, 241, 0.1)" : "transparent", // Background color for active state
              }}
              aria-label="Home"
            >
              <HomeIcon fontSize="large" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Create Post">
            <IconButton
              component={motion.button}
              whileHover={{ scale: 1.2, rotate: -10 }} // Enhanced hover effect
              whileTap={{ scale: 0.9 }}
              onClick={handleCreatePostClick}
              sx={{
                color: isActive("/create-post") ? "#8515fe" : "white",
                "&:hover": { color: "#8515fe" },
                borderRadius: "50%", // Curved border
                backgroundColor: isActive("/create-post") ? "rgba(99, 102, 241, 0.1)" : "transparent", // Background color for active state
              }}
              aria-label="Create Post"
            >
              <AddCircleIcon fontSize="large" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Search">
            <IconButton
              component={motion.button}
              whileHover={{ scale: 1.2, rotate: 10 }} // Enhanced hover effect
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate("/search")}
              sx={{
                color: isActive("/search") ? "#8515fe" : "white",
                "&:hover": { color: "#8515fe" },
                borderRadius: "50%", // Curved border
                backgroundColor: isActive("/search") ? "rgba(99, 102, 241, 0.1)" : "transparent", // Background color for active state
              }}
              aria-label="Search"
            >
              <SearchIcon fontSize="large" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Profile">
            <IconButton
              component={motion.button}
              whileHover={{ scale: 1.2 }} // Enhanced hover effect
              whileTap={{ scale: 0.9 }}
              onClick={handleProfileClick}
              sx={{ p: 0, borderRadius: "50%" }}
              aria-label="Profile"
            >
              <Avatar
                src={user?.profilePic}
                alt={user?.username}
                sx={{ width: 40, height: 40, border: "2px solid #8515fe" }} // Updated avatar size and border
              />
            </IconButton>
          </Tooltip>

          <Tooltip title="Chat">
            <IconButton
              component={motion.button}
              whileHover={{ scale: 1.2, rotate: -10 }} // Enhanced hover effect
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate("/chat")}
              sx={{
                color: isActive("/chat") ? "#8515fe" : "white",
                "&:hover": { color: "#8515fe" },
                borderRadius: "50%", // Curved border
                backgroundColor: isActive("/chat") ? "rgba(99, 102, 241, 0.1)" : "transparent", // Background color for active state
              }}
              aria-label="Chat"
            >
              <ChatIcon fontSize="large" />
            </IconButton>
          </Tooltip>
        </AntdFlex>
      )}
    </Box>
  );
};

export default BottomNav;
