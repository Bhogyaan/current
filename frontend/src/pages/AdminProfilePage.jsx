import React, { useEffect, useState, memo } from "react";
import PropTypes from "prop-types";
import { useParams, useNavigate } from "react-router-dom";
import { useRecoilState, useRecoilValue, useSetRecoilState } from "recoil";
import { motion } from "framer-motion";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Typography,
  Tabs,
  Tab,
  useMediaQuery,
  TextField,
  Grid,
  Chip,
  IconButton,
} from "@mui/material";
import {
  Dashboard,
  People,
  Block,
  Edit,
  ExitToApp,
  Search,
  Verified as VerifiedIcon,
  Gavel,
} from "@mui/icons-material";
import { ConfigProvider, App, message } from "antd";
import userAtom from "../atoms/userAtom";
import postsAtom from "../atoms/postsAtom";
import { useSocket } from "../context/SocketContext";
import useShowToast from "../hooks/useShowToast";
import Post from "../components/Post";
import AdminDashboard from "./AdminDashboard";
import { debounce } from "lodash";

const AdminProfilePage = memo(() => {
  const { username } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchingPosts, setFetchingPosts] = useState(true);
  const [fetchingUsers, setFetchingUsers] = useState(true);
  const [postsState, setPostsState] = useRecoilState(postsAtom);
  const currentUser = useRecoilValue(userAtom);
  const setCurrentUser = useSetRecoilState(userAtom);
  const navigate = useNavigate();
  const isSmallScreen = useMediaQuery("(max-width:600px)");
  const isMediumScreen = useMediaQuery("(max-width:960px)");
  const [tabValue, setTabValue] = useState(0);
  const { socket } = useSocket();
  const showToast = useShowToast();
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dashboardError, setDashboardError] = useState(null);

  const debouncedSearch = debounce((value) => {
    setSearchQuery(value);
  }, 300);

  useEffect(() => {
    if (!socket) {
      console.warn("Socket is not initialized in AdminProfilePage");
      showToast("Warning", "Real-time updates are disabled due to socket initialization failure", "warning");
      return;
    }

    // Log socket connection status
    console.log("Socket connection status:", socket.connected ? "Connected" : "Disconnected");

    // Handle connection events
    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      showToast("Success", "Real-time updates enabled", "success");
    });

    socket.on("disconnect", () => {
      console.warn("Socket disconnected");
      showToast("Warning", "Real-time updates disabled", "warning");
    });

    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
      showToast("Error", "Failed to connect to real-time updates", "error");
    });

    // Socket event listeners
    const handleNewPost = (post) => {
      setPostsState((prev) => ({
        ...prev,
        posts: [post, ...prev.posts],
      }));
      showToast("New Post", "A new post has been created", "info");
    };

    const handlePostDeleted = ({ postId }) => {
      setPostsState((prev) => ({
        ...prev,
        posts: prev.posts.filter((p) => p._id !== postId),
      }));
      showToast("Post Deleted", "A post has been deleted", "info");
    };

    const handleUserStatusUpdate = ({ userId, isBanned }) => {
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, isBanned } : u))
      );
      showToast("User Status Updated", `User ${isBanned ? "banned" : "unbanned"}`, "success");
    };

    const handlePostStatusUpdate = ({ postId, isBanned }) => {
      setPostsState((prev) => ({
        ...prev,
        posts: prev.posts.map((p) => (p._id === postId ? { ...p, isBanned } : p)),
      }));
      showToast("Post Status Updated", `Post ${isBanned ? "banned" : "unbanned"}`, "success");
    };

    const handleLikeUnlikePost = ({ postId, likes }) => {
      setPostsState((prev) => ({
        ...prev,
        posts: prev.posts.map((p) => (p._id === postId ? { ...p, likes } : p)),
      }));
    };

    const handleLikeUnlikeComment = ({ postId, commentId, likes }) => {
      setPostsState((prev) => ({
        ...prev,
        posts: prev.posts.map((p) =>
          p._id === postId
            ? {
                ...p,
                comments: p.comments.map((c) =>
                  c._id === commentId ? { ...c, likes } : c
                ),
              }
            : p
        ),
      }));
    };

    // Attach event listeners
    socket.on("newPost", handleNewPost);
    socket.on("postDeleted", handlePostDeleted);
    socket.on("userStatusUpdate", handleUserStatusUpdate);
    socket.on("postStatusUpdate", handlePostStatusUpdate);
    socket.on("likeUnlikePost", handleLikeUnlikePost);
    socket.on("likeUnlikeComment", handleLikeUnlikeComment);

    // Cleanup
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("newPost", handleNewPost);
      socket.off("postDeleted", handlePostDeleted);
      socket.off("userStatusUpdate", handleUserStatusUpdate);
      socket.off("postStatusUpdate", handlePostStatusUpdate);
      socket.off("likeUnlikePost", handleLikeUnlikePost);
      socket.off("likeUnlikeComment", handleLikeUnlikeComment);
    };
  }, [socket, setPostsState, showToast]);

  useEffect(() => {
    const getUser = async () => {
      try {
        let userData;
        if (currentUser && currentUser.username === username) {
          userData = currentUser;
        } else {
          const userRes = await fetch(`/api/users/profile/${username}`, {
            credentials: "include",
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          });
          userData = await userRes.json();
          if (!userRes.ok) throw new Error(userData.error || "Error fetching user profile");
        }
        setUser(userData);
      } catch (error) {
        console.error("Error fetching user:", error.message);
        showToast("Error", error.message, "error");
      } finally {
        setLoading(false);
      }
    };

    const getAllPosts = async () => {
      try {
        const res = await fetch("/api/posts/all", {
          credentials: "include",
          headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` },
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setPostsState((prev) => ({ ...prev, posts: data }));
      } catch (error) {
        console.log("Error fetching posts:", error.message);
        showToast("Error", error.message, "error");
      } finally {
        setFetchingPosts(false);
      }
    };

    const getAllUsers = async () => {
      try {
        const res = await fetch(`/api/users/all`, {
          credentials: "include",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setUsers(data);
      } catch (error) {
        console.error("Error fetching users:", error.message);
        showToast("Error", error.message, "error");
      } finally {
        setFetchingUsers(false);
      }
    };

    if (currentUser?.isAdmin) {
      getUser();
      getAllPosts();
      getAllUsers();
    }
  }, [username, currentUser, setPostsState]);

  const handleLogout = () => {
    localStorage.removeItem("user-NRBLOG");
    localStorage.removeItem("token");
    setCurrentUser(null);
    navigate("/auth");
    message.success("Logged out successfully");
  };

  const handleEditProfile = () => {
    navigate("/edit-profile");
  };

  const handleBanUnbanPost = async (postId, isBanned) => {
    try {
      const endpoint = isBanned ? `/api/posts/unban/${postId}` : `/api/posts/ban/${postId}`;
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        credentials: "include",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPostsState((prev) => ({
        ...prev,
        posts: prev.posts.map((p) => (p._id === postId ? { ...p, isBanned: !isBanned } : p)),
      }));
      if (socket) {
        socket.emit("postStatusUpdate", { postId, isBanned: !isBanned });
      }
      showToast("Success", data.message, "success");
    } catch (error) {
      console.error("Error banning/unbanning post:", error.message);
      showToast("Error", error.message, "error");
    }
  };

  const handleBanUnbanUser = async (userId, isBanned) => {
    try {
      const endpoint = isBanned ? `/api/users/unban/${userId}` : `/api/users/ban/${userId}`;
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        credentials: "include",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, isBanned: !isBanned } : u))
      );
      if (socket) {
        socket.emit("userStatusUpdate", { userId, isBanned: !isBanned });
      }
      showToast("Success", data.message, "success");
    } catch (error) {
      console.error("Error banning/unbanning user:", error.message);
      showToast("Error", error.message, "error");
    }
  };

  if (!currentUser?.isAdmin) {
    return (
      <Box sx={{ p: 3, textAlign: "center", bgcolor: "background.paper", borderRadius: 2, minHeight: "100vh" }}>
        <Typography variant="h6" color="text.primary">
          Admin access required
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", py: 2 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", py: 2 }}>
        <Typography variant="h6" color="text.primary">User not found</Typography>
      </Box>
    );
  }

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const bannedPosts = postsState.posts.filter((p) => p.isBanned);
  const bannedUsers = users.filter((u) => u.isBanned);
  const followers = users.filter((u) => user.followers?.includes(u._id));
  const following = users.filter((u) => user.following?.includes(u._id));

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#8515fe",
          borderRadius: 8,
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        },
      }}
    >
      <App>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="min-h-screen bg-gray-900 text-white"
        >
          <Box sx={{ maxWidth: "1400px", mx: "auto", px: { xs: 1, sm: 2, md: 3 }, py: 2 }}>
            <Card
              sx={{
                mb: 2,
                p: { xs: 1, sm: 2, md: 3 },
                bgcolor: "rgba(255, 255, 255, 0.05)",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
              }}
            >
              <Grid container spacing={2} alignItems="center" direction={isSmallScreen ? "column" : "row"}>
                <Grid item xs={12} sm={4} sx={{ textAlign: "center", mb: isSmallScreen ? 2 : 0 }}>
                  <Avatar
                    src={user.profilePic}
                    alt={user.username}
                    sx={{
                      width: { xs: 60, sm: 80, md: 120 },
                      height: { xs: 60, sm: 80, md: 120 },
                      border: "3px solid rgba(255, 255, 255, 0.3)",
                      mx: "auto",
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={8}>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 1, justifyContent: "center" }}>
                    <Typography
                      variant={isSmallScreen ? "h6" : "h5"}
                      sx={{ fontWeight: 500, color: "text.primary", mr: 1 }}
                    >
                      {user.username}
                    </Typography>
                    <VerifiedIcon color="primary" fontSize="small" />
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2, textAlign: "center", maxWidth: "90%" }}
                  >
                    {user.bio || "Admin User"}
                  </Typography>
                  <Grid container spacing={1} sx={{ mb: 2, justifyContent: "center" }}>
                    {[
                      { label: "Posts", value: postsState.posts.length },
                      { label: "Users", value: users.length },
                      { label: "Likes", value: postsState.posts.reduce((total, post) => total + (post.likes?.length || 0), 0) },
                      {
                        label: "Comments",
                        value: postsState.posts.reduce((total, post) => total + (post.comments?.length || 0), 0),
                      },
                    ].map((stat) => (
                      <Grid item xs={6} sm={3} key={stat.label} sx={{ textAlign: "center" }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: "text.primary" }}>
                          {stat.value.toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {stat.label}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "center" }}>
                    <Button
                      variant="contained"
                      onClick={handleEditProfile}
                      startIcon={<Edit />}
                      size={isSmallScreen ? "small" : "medium"}
                      sx={{
                        borderRadius: 20,
                        px: isSmallScreen ? 1.5 : 2,
                        bgcolor: "primary.main",
                        "&:hover": { bgcolor: "#6b12cb" },
                      }}
                    >
                      Edit Profile
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={handleLogout}
                      startIcon={<ExitToApp />}
                      size={isSmallScreen ? "small" : "medium"}
                      sx={{
                        borderRadius: 20,
                        px: isSmallScreen ? 1.5 : 2,
                        borderColor: "text.secondary",
                        color: "text.secondary",
                        "&:hover": { borderColor: "text.primary", color: "text.primary" },
                      }}
                    >
                      Logout
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Card>

            <Box
              sx={{
                position: "sticky",
                top: 0,
                zIndex: 1000,
                bgcolor: "rgba(255, 255, 255, 0.05)",
                borderRadius: 2,
                mb: 2,
                border: "2px solid rgba(255, 255, 255, 0.2)",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                px: { xs: 0.5, sm: 2 },
                py: 0.5,
                mx: "auto",
                width: { xs: "100%", sm: "90%", md: "80%" },
              }}
            >
              <Tabs
                value={tabValue}
                onChange={(e, newValue) => setTabValue(newValue)}
                variant={isSmallScreen ? "scrollable" : "standard"}
                scrollButtons="auto"
                allowScrollButtonsMobile
                centered={!isSmallScreen}
                sx={{
                  "& .MuiTab-root": {
                    fontWeight: 500,
                    px: { xs: 0.5, sm: 2 },
                    py: 0.5,
                    fontSize: { xs: "0.75rem", sm: "0.875rem" },
                    color: "text.secondary",
                    "&.Mui-selected": { color: "primary.main" },
                    minWidth: { xs: 60, sm: 90 },
                  },
                  "& .MuiTabs-indicator": { backgroundColor: "primary.main" },
                }}
              >
                <Tab icon={<Dashboard fontSize={isSmallScreen ? "small" : "medium"} />} label="Dashboard" />
                <Tab icon={<People fontSize={isSmallScreen ? "small" : "medium"} />} label="All Users" />
                <Tab icon={<Block fontSize={isSmallScreen ? "small" : "medium"} />} label="Banned Posts" />
                <Tab icon={<Block fontSize={isSmallScreen ? "small" : "medium"} />} label="Banned Users" />
                <Tab icon={<People fontSize={isSmallScreen ? "small" : "medium"} />} label="Followers" />
                <Tab icon={<People fontSize={isSmallScreen ? "small" : "medium"} />} label="Following" />
              </Tabs>
            </Box>

            <Box sx={{ mx: "auto", minHeight: "60vh", overflowY: "auto", width: { xs: "100%", sm: "90%", md: "80%" } }}>
              {tabValue === 0 && (
                <>
                  {dashboardError ? (
                    <Box sx={{ p: 3, textAlign: "center", bgcolor: "background.paper", borderRadius: 2, minHeight: "60vh" }}>
                      <Typography variant="h6" color="error">
                        Error loading dashboard: {dashboardError}
                      </Typography>
                      <Button
                        variant="contained"
                        onClick={() => setDashboardError(null)}
                        sx={{ mt: 2 }}
                      >
                        Retry
                      </Button>
                    </Box>
                  ) : (
                    <AdminDashboard />
                  )}
                </>
              )}

              {tabValue === 1 && (
                <Box
                  sx={{
                    py: 2,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    maxHeight: "70vh",
                    overflowY: "auto",
                    width: "100%",
                    px: { xs: 0, sm: 1 },
                  }}
                >
                  <TextField
                    placeholder="Search users by username"
                    onChange={(e) => debouncedSearch(e.target.value)}
                    InputProps={{
                      startAdornment: <Search sx={{ color: "text.secondary", mr: 1 }} />,
                    }}
                    sx={{
                      mb: 3,
                      width: { xs: "100%", sm: 500 },
                      bgcolor: "rgba(255, 255, 255, 0.05)",
                      borderRadius: 2,
                      "& .MuiInputBase-input": { py: 1.5, color: "text.primary" },
                      "& .MuiOutlinedInput-root": {
                        "& fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                        "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.4)" },
                        "&.Mui-focused fieldset": { borderColor: "primary.main" },
                      },
                    }}
                  />
                  {fetchingUsers ? (
                    <CircularProgress sx={{ color: "primary.main", display: "block", mx: "auto" }} />
                  ) : filteredUsers.length === 0 ? (
                    <Typography color="text.primary" sx={{ textAlign: "center" }}>
                      No users found
                    </Typography>
                  ) : (
                    <Grid container spacing={2} sx={{ width: "100%", justifyContent: "center" }}>
                      {filteredUsers.map((u) => (
                        <Grid item xs={12} sm={6} md={4} key={u._id} sx={{ display: "flex", justifyContent: "center" }}>
                          <Card
                            sx={{
                              width: "100%",
                              maxWidth: { xs: "100%", sm: 320 },
                              bgcolor: "rgba(255, 255, 255, 0.05)",
                              border: "2px solid rgba(255, 255, 255, 0.2)",
                              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                              transition: "transform 0.2s",
                              "&:hover": { transform: isSmallScreen ? "none" : "scale(1.02)" },
                            }}
                          >
                            <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
                              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                                <Avatar
                                  src={u.profilePic}
                                  alt={u.username}
                                  sx={{ width: { xs: 36, sm: 48 }, height: { xs: 36, sm: 48 }, mr: 2 }}
                                />
                                <Box>
                                  <Typography
                                    variant="body1"
                                    sx={{
                                      fontWeight: 500,
                                      color: "text.primary",
                                      cursor: "pointer",
                                      fontSize: { xs: "0.875rem", sm: "1rem" },
                                    }}
                                    onClick={() => navigate(`/${u.username}`)}
                                  >
                                    {u.username}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    ID: {u._id.slice(0, 8)}...
                                  </Typography>
                                </Box>
                              </Box>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                <Typography
                                  variant="body2"
                                  sx={{ color: u.isBanned ? "#f44336" : "#4caf50" }}
                                >
                                  Status: {u.isBanned ? "Banned" : "Active"}
                                </Typography>
                                <IconButton
                                  onClick={() => handleBanUnbanUser(u._id, u.isBanned)}
                                  sx={{ ml: "auto" }}
                                >
                                  <Gavel color={u.isBanned ? "success" : "error"} />
                                </IconButton>
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Box>
              )}

              {tabValue === 2 && (
                <Box
                  sx={{
                    py: 2,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    maxHeight: "70vh",
                    overflowY: "auto",
                    width: "100%",
                    px: { xs: 0, sm: 1 },
                  }}
                >
                  {fetchingPosts ? (
                    <CircularProgress sx={{ color: "primary.main", display: "block", mx: "auto" }} />
                  ) : bannedPosts.length === 0 ? (
                    <Typography color="text.primary" sx={{ textAlign: "center" }}>
                      No banned posts found
                    </Typography>
                  ) : (
                    <Grid container spacing={2} sx={{ width: "100%", justifyContent: "center" }}>
                      {bannedPosts.map((post) => (
                        <Grid item xs={12} sm={6} md={4} key={post._id}>
                          <Card
                            sx={{
                              bgcolor: "rgba(255, 255, 255, 0.05)",
                              border: "2px solid rgba(255, 255, 255, 0.2)",
                              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                            }}
                          >
                            <CardContent>
                              <Post post={post} />
                              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
                                <Button
                                  variant="outlined"
                                  color="success"
                                  size="small"
                                  onClick={() => handleBanUnbanPost(post._id, post.isBanned)}
                                  startIcon={<Gavel />}
                                >
                                  Unban Post
                                </Button>
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Box>
              )}

              {tabValue === 3 && (
                <Box
                  sx={{
                    py: 2,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    maxHeight: "70vh",
                    overflowY: "auto",
                    width: "100%",
                    px: { xs: 0, sm: 1 },
                  }}
                >
                  {fetchingUsers ? (
                    <CircularProgress sx={{ color: "primary.main", display: "block", mx: "auto" }} />
                  ) : bannedUsers.length === 0 ? (
                    <Typography color="text.primary" sx={{ textAlign: "center" }}>
                      No banned users found
                    </Typography>
                  ) : (
                    <Grid container spacing={2} sx={{ width: "100%", justifyContent: "center" }}>
                      {bannedUsers.map((u) => (
                        <Grid item xs={12} sm={6} md={4} key={u._id} sx={{ display: "flex", justifyContent: "center" }}>
                          <Card
                            sx={{
                              width: "100%",
                              maxWidth: { xs: "100%", sm: 320 },
                              bgcolor: "rgba(255, 255, 255, 0.05)",
                              border: "2px solid rgba(255, 255, 255, 0.2)",
                              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                              transition: "transform 0.2s",
                              "&:hover": { transform: isSmallScreen ? "none" : "scale(1.02)" },
                            }}
                          >
                            <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
                              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                                <Avatar
                                  src={u.profilePic}
                                  alt={u.username}
                                  sx={{ width: { xs: 36, sm: 48 }, height: { xs: 36, sm: 48 }, mr: 2 }}
                                />
                                <Box>
                                  <Typography
                                    variant="body1"
                                    sx={{
                                      fontWeight: 500,
                                      color: "text.primary",
                                      cursor: "pointer",
                                      fontSize: { xs: "0.875rem", sm: "1rem" },
                                    }}
                                    onClick={() => navigate(`/${u.username}`)}
                                  >
                                    {u.username}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    ID: {u._id.slice(0, 8)}...
                                  </Typography>
                                </Box>
                              </Box>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                                <Typography variant="body2" sx={{ color: "#f44336" }}>
                                  Status: Banned
                                </Typography>
                                <IconButton
                                  onClick={() => handleBanUnbanUser(u._id, u.isBanned)}
                                  sx={{ ml: "auto" }}
                                >
                                  <Gavel color="success" />
                                </IconButton>
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Box>
              )}

              {tabValue === 4 && (
                <Box
                  sx={{
                    py: 2,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    maxHeight: "70vh",
                    overflowY: "auto",
                    width: "100%",
                    px: { xs: 0, sm: 1 },
                  }}
                >
                  {fetchingUsers ? (
                    <CircularProgress sx={{ color: "primary.main", display: "block", mx: "auto" }} />
                  ) : followers.length === 0 ? (
                    <Typography color="text.primary" sx={{ textAlign: "center" }}>
                      No followers found
                    </Typography>
                  ) : (
                    <Grid container spacing={2} sx={{ width: "100%", justifyContent: "center" }}>
                      {followers.map((u) => (
                        <Grid item xs={12} sm={6} md={4} key={u._id} sx={{ display: "flex", justifyContent: "center" }}>
                          <Card
                            sx={{
                              width: "100%",
                              maxWidth: { xs: "100%", sm: 320 },
                              bgcolor: "rgba(255, 255, 255, 0.05)",
                              border: "2px solid rgba(255, 255, 255, 0.2)",
                              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
                              transition: "transform 0.2s",
                              "&:hover": { transform: isSmallScreen ? "none" : "scale(1.02)" },
                            }}
                          >
                            <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
                              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                                <Avatar
                                  src={u.profilePic}
                                  alt={u.username}
                                  sx={{ width: { xs: 36, sm: 48 }, height: { xs: 36, sm: 48 }, mr: 2 }}
                                />
                                <Box>
                                  <Typography
                                    variant="body1"
                                    sx={{
                                      fontWeight: 500,
                                      color: "text.primary",
                                      cursor: "pointer",
                                      fontSize: { xs: "0.875rem", sm: "1rem" },
                                    }}
                                    onClick={() => navigate(`/${u.username}`)}
                                  >
                                    {u.username}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    ID: {u._id.slice(0, 8)}...
                                  </Typography>
                                </Box>
                              </Box>
                              <Typography
                                variant="body2"
                                sx={{ color: u.isBanned ? "#f44336" : "#4caf50" }}
                              >
                                Status: {u.isBanned ? "Banned" : "Active"}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Box>
              )}

              {tabValue === 5 && (
                <Box
                  sx={{
                    py: 2,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    maxHeight: "70vh",
                    overflowY: "auto",
                    width: "100%",
                    px: { xs: 0, sm: 1 },
                  }}
                >
                  {fetchingUsers ? (
                    <CircularProgress sx={{ color: "primary.main", display: "block", mx: "auto" }} />
                  ) : following?.length === 0 ? (
                    <Typography color="text.primary" sx={{ textAlign: "center" }}>
                      No following found
                    </Typography>
                  ) : (
                    <Grid container spacing={2} sx={{ width: "100%", justifyContent: "center" }}>
                      {following.map((u) => (
                        <Grid item xs={12} sm={6} md={4} key={u._id} sx={{ display: "flex", justifyContent: "center" }}>
                          <Card
                            sx={{
                              width: "100%",
                              maxWidth: { xs: "100%", sm: 320 },
                              bgcolor: "rgba(255, 255, 255, 0.05)",
                              border: "2px solid rgba(255, 255, 0.2)",
                              boxShadow: "0 8px 24px rgba(0,0,0, 0.2)",
                              transition: "transform 0.3s",
                              "&:hover": { transform: isSmallScreen ? "none" : "scale(1.02)" },
                            }}
                          >
                            <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
                              <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                                <Avatar
                                  src={u.profilePic}
                                  alt={u.username}
                                  sx={{ width: { xs: 36, sm: 48 }, height: { xs: 36, sm: 48 }, mr: 2 }}
                                />
                                <Box>
                                  <Typography
                                    variant="body1"
                                    sx={{
                                      fontWeight: 500,
                                      color: "text.primary",
                                      cursor: "pointer",
                                      fontSize: { xs: "0.875rem", sm: "1rem" },
                                    }}
                                    onClick={() => navigate(`/${u.username}`)}>
                                    {u.username}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    ID: {u._id.slice(0, 8)}...
                                  </Typography>
                                </Box>
                              </Box>
                              <Typography
                                variant="body2"
                                sx={{ color: u.isBanned ? "#f44336" : "#4caf50" }}
                              >
                                Status: {u.isBanned ? "Banned" : "Active"}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </motion.div>
      </App>
    </ConfigProvider>
  );
});

AdminProfilePage.propTypes = {
  username: PropTypes.string,
};

export default AdminProfilePage;