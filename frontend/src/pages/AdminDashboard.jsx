import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  CircularProgress,
  Menu,
  MenuItem,
  IconButton,
} from "@mui/material";
import {
  Dashboard,
  BarChart as BarChartIcon,
  TrendingUp,
  MoreVert,
  Gavel,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { SocketContext } from "../context/SocketContext";
import useShowToast from "../hooks/useShowToast";
import { useRecoilValue } from "recoil";
import userAtom from "../atoms/userAtom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer as BarResponsiveContainer,
} from "recharts";

const COLORS = ["#8515fe", "#8b5cf6", "#f44336", "#ff9800"];

const AdminDashboard = () => {
  const showToast = useShowToast();
  const currentUser = useRecoilValue(userAtom);
  const socket = useContext(SocketContext);
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [error, setError] = useState(null);

  const defaultAnalytics = {
    totalPosts: 0,
    totalUsers: 0,
    totalLikes: 0,
    totalComments: 0,
    bannedPosts: 0,
    bannedUsers: 0,
    activityData: [],
    userActivity: [],
    recentPosts: [],
  };

  const refreshToken = async () => {
    try {
      const res = await fetch("/api/auth/refresh-token", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem("token", data.token);
        return data.token;
      }
      throw new Error("Failed to refresh token");
    } catch (error) {
      console.error("Token refresh failed:", error);
      return null;
    }
  };

  const fetchAnalytics = async (retries = 3, delay = 1000) => {
    try {
      setLoadingAnalytics(true);
      let token = localStorage.getItem("token");
      if (!token) {
        token = await refreshToken();
        if (!token) throw new Error("No authentication token found");
      }

      const res = await fetch("/api/posts/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (res.status === 401 && retries > 0) {
        const newToken = await refreshToken();
        if (newToken) {
          localStorage.setItem("token", newToken);
          return fetchAnalytics(retries - 1, delay * 2);
        }
        throw new Error("Unauthorized access. Please log in again.");
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch analytics: HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalytics(data);
      localStorage.setItem("cachedAnalytics", JSON.stringify(data));
    } catch (error) {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchAnalytics(retries - 1, delay * 2);
      }
      console.error("Failed to fetch analytics:", error.message);
      setError(error.message);
      showToast("Error", error.message, "error");
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleToggleBanPost = async (postId, isBanned) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/posts/${postId}/ban`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to update post status");
      }
      const updatedPost = await res.json();
      showToast(
        "Success",
        `Post ${isBanned ? "unbanned" : "banned"} successfully`,
        "success"
      );
      setAnalytics((prev) => ({
        ...prev,
        bannedPosts: prev.bannedPosts + (isBanned ? -1 : 1),
        recentPosts: prev.recentPosts.map((p) =>
          p._id === postId ? { ...p, isBanned: !isBanned } : p
        ),
      }));
      if (socket) {
        socket.emit("postStatusUpdate", { postId, isBanned: !isBanned });
      }
    } catch (error) {
      showToast("Error", error.message, "error");
    }
  };

  const handleToggleBanUser = async (userId, isBanned) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/users/${userId}/ban`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to update user status");
      }
      const updatedUser = await res.json();
      showToast(
        "Success",
        `User ${isBanned ? "unbanned" : "banned"} successfully`,
        "success"
      );
      setAnalytics((prev) => ({
        ...prev,
        bannedUsers: prev.bannedUsers + (isBanned ? -1 : 1),
        recentPosts: prev.recentPosts.map((p) =>
          p.postedBy._id === userId ? { ...p, postedBy: { ...p.postedBy, isBanned: !isBanned } } : p
        ),
      }));
      if (socket) {
        socket.emit("userStatusUpdate", { userId, isBanned: !isBanned });
      }
    } catch (error) {
      showToast("Error", error.message, "error");
    }
  };

  const handleMenuOpen = (event, post) => {
    setAnchorEl(event.currentTarget);
    setSelectedPost(post);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPost(null);
  };

  useEffect(() => {
    if (!currentUser?.isAdmin) return;
    if (!analytics) {
      setLoadingAnalytics(true);
      const cachedAnalytics = localStorage.getItem("cachedAnalytics");
      if (cachedAnalytics) {
        setAnalytics(JSON.parse(cachedAnalytics));
      } else {
        setAnalytics(defaultAnalytics);
      }
      fetchAnalytics();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!socket || typeof socket.on !== "function") return;

    const handleAnalyticsUpdate = (update) => {
      setAnalytics((prev) => ({
        ...prev,
        totalPosts: (prev.totalPosts || 0) + (update.totalPosts || 0),
        totalLikes: (prev.totalLikes || 0) + (update.totalLikes || 0),
        totalComments: (prev.totalComments || 0) + (update.totalComments || 0),
        bannedPosts: (prev.bannedPosts || 0) + (update.bannedPosts || 0),
        bannedUsers: (prev.bannedUsers || 0) + (update.bannedUsers || 0),
        recentPosts: update.recentPosts || prev.recentPosts,
      }));
    };

    const handlePostStatusUpdate = ({ postId, isBanned }) => {
      setAnalytics((prev) => ({
        ...prev,
        bannedPosts: prev.bannedPosts + (isBanned ? 1 : -1),
        recentPosts: prev.recentPosts.map((p) =>
          p._id === postId ? { ...p, isBanned } : p
        ),
      }));
    };

    const handleUserStatusUpdate = ({ userId, isBanned }) => {
      setAnalytics((prev) => ({
        ...prev,
        bannedUsers: prev.bannedUsers + (isBanned ? 1 : -1),
        recentPosts: prev.recentPosts.map((p) =>
          p.postedBy._id === userId ? { ...p, postedBy: { ...p.postedBy, isBanned } } : p
        ),
      }));
    };

    socket.on("analyticsUpdate", handleAnalyticsUpdate);
    socket.on("postStatusUpdate", handlePostStatusUpdate);
    socket.on("userStatusUpdate", handleUserStatusUpdate);

    return () => {
      if (typeof socket.off === "function") {
        socket.off("analyticsUpdate", handleAnalyticsUpdate);
        socket.off("postStatusUpdate", handlePostStatusUpdate);
        socket.off("userStatusUpdate", handleUserStatusUpdate);
      }
    };
  }, [socket]);

  if (!currentUser?.isAdmin) {
    return (
      <Box sx={{ p: 3, textAlign: "center", bgcolor: "background.paper", borderRadius: 2 }}>
        <Typography variant="h6" color="text.primary">
          Admin access required
        </Typography>
      </Box>
    );
  }

  if (loadingAnalytics) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !analytics || !Object.keys(analytics).length) {
    return (
      <Box sx={{ p: 3, textAlign: "center", bgcolor: "background.paper", borderRadius: 2 }}>
        <Typography variant="h6" color="text.primary">
          {error || "Unable to load analytics data. Please try refreshing the page or contact support."}
        </Typography>
        <Button
          variant="contained"
          onClick={() => {
            setError(null);
            fetchAnalytics();
          }}
          sx={{ mt: 2 }}
        >
          Retry
        </Button>
      </Box>
    );
  }

  const pieData = [
    { name: "Total Posts", value: analytics.totalPosts || 0 },
    { name: "Total Users", value: analytics.totalUsers || 0 },
    { name: "Banned Posts", value: analytics.bannedPosts || 0 },
    { name: "Banned Users", value: analytics.bannedUsers || 0 },
  ];

  const barData = analytics.activityData || [];
  const isSmallScreen = window.innerWidth < 600;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Box sx={{ p: 3, bgcolor: "background.default" }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
          <Dashboard sx={{ mr: 1, color: "primary.main" }} />
          <Typography variant="h4" color="text.primary">
            Admin Dashboard
          </Typography>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ bgcolor: "background.paper" }}>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  <BarChartIcon sx={{ mr: 1, color: "secondary.main" }} />
                  <Typography variant="h6" color="text.primary">
                    Platform Statistics
                  </Typography>
                </Box>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={isSmallScreen ? 80 : 100}
                      fill="#8884d8"
                      dataKey="value"
                      label
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ bgcolor: "background.paper" }}>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  <TrendingUp sx={{ mr: 1, color: "secondary.main" }} />
                  <Typography variant="h6" color="text.primary">
                    Monthly Activity
                  </Typography>
                </Box>
                <BarResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <RechartsTooltip />
                    <RechartsLegend />
                    <Bar dataKey="posts" fill="#8515fe" name="Posts" />
                    <Bar dataKey="likes" fill="#8b5cf6" name="Likes" />
                    <Bar dataKey="comments" fill="#f44336" name="Comments" />
                  </BarChart>
                </BarResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Card sx={{ bgcolor: "background.paper" }}>
              <CardContent>
                <Typography variant="h6" color="text.primary" gutterBottom>
                  Recent Posts
                </Typography>
                <Grid container spacing={2}>
                  {analytics.recentPosts?.map((post) => (
                    <Grid item xs={12} sm={6} md={4} key={post._id}>
                      <Card sx={{ position: "relative" }}>
                        <CardContent>
                          <Typography variant="subtitle1">{post.content || post.text}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            By {post.postedBy?.username || "Unknown"} on{" "}
                            {new Date(post.createdAt).toLocaleDateString()}
                          </Typography>
                          <IconButton
                            sx={{ position: "absolute", top: 8, right: 8 }}
                            onClick={(e) => handleMenuOpen(e, post)}
                          >
                            <MoreVert />
                          </IconButton>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem
            onClick={() => {
              handleToggleBanPost(selectedPost._id, selectedPost.isBanned);
              handleMenuClose();
            }}
          >
            <Gavel sx={{ mr: 1 }} />
            {selectedPost?.isBanned ? "Unban Post" : "Ban Post"}
          </MenuItem>
          <MenuItem
            onClick={() => {
              handleToggleBanUser(selectedPost.postedBy._id, selectedPost.postedBy.isBanned);
              handleMenuClose();
            }}
          >
            <Gavel sx={{ mr: 1 }} />
            {selectedPost?.postedBy?.isBanned ? "Unban User" : "Ban User"}
          </MenuItem>
        </Menu>
      </Box>
    </motion.div>
  );
};

export default AdminDashboard;