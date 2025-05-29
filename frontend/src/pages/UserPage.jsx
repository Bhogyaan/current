import { useEffect, useState } from "react";
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
} from "@mui/material";
import { ConfigProvider, App, message } from "antd";
import userAtom from "../atoms/userAtom";
import postsAtom from "../atoms/postsAtom";
import { useSocket } from "../context/SocketContext";
import useBookmark from "../hooks/useBookmark";
import useFollowUnfollow from "../hooks/useFollowUnfollow";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LineChart,
  Line,
  CartesianGrid,
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";
import { Verified as VerifiedIcon } from "@mui/icons-material";
import Post from "../components/Post";
import AdminProfilePage from "./AdminProfilePage";

const COLORS = ["#8515fe", "#8b5cf6", "#f44336"];

const UserPage = () => {
  const { username } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchingPosts, setFetchingPosts] = useState(true);
  const [fetchingBookmarks, setFetchingBookmarks] = useState(true);
  const [postsState, setPostsState] = useRecoilState(postsAtom);
  const currentUser = useRecoilValue(userAtom);
  const setCurrentUser = useSetRecoilState(userAtom);
  const navigate = useNavigate();
  const isSmallScreen = useMediaQuery("(max-width: 600px)");
  const [tabValue, setTabValue] = useState(0);
  const { handleBookmark } = useBookmark();
  const { handleFollowUnfollow, updating, following } = useFollowUnfollow(user);
  const socketContext = useSocket();
  const socket = socketContext?.socket;

  if (currentUser?.isAdmin && currentUser?.username === username) {
    return <AdminProfilePage />;
  }

  useEffect(() => {
    console.log("Current user:", currentUser);
    const getUserAndStats = async () => {
      try {
        let userData;
        if (currentUser && currentUser.username === username) {
          userData = currentUser;
        } else {
          const userRes = await fetch(`/api/users/profile/${username}`, {
            credentials: "include",
          });
          const userResponse = await userRes.json();
          console.log("User profile response:", userResponse);
          if (!userRes.ok) throw new Error(userResponse.error || "User profile not found");
          userData = userResponse;
        }

        let statsData = {};
        try {
          const statsRes = await fetch(`/api/users/stats/${username}`, {
            credentials: "include",
          });
          statsData = statsRes.ok
            ? await statsRes.json()
            : { totalLikes: 0, totalPosts: 0, totalComments: 0, activityData: [] };
        } catch (statsError) {
          console.warn("Stats endpoint not available:", statsError.message);
          statsData = { totalLikes: 0, totalPosts: 0, totalComments: 0, activityData: [] };
        }

        setUser({ ...userData, stats: statsData });
      } catch (error) {
        console.error("Error fetching user and stats:", error.stack);
        message.error(error.message || "Failed to load user profile");
      } finally {
        setLoading(false);
      }
    };

    const getPosts = async () => {
      try {
        const endpoint = currentUser?.isAdmin ? "/api/posts/all" : `/api/posts/user/${username}`;
        console.log("Fetching posts from:", endpoint);
        const res = await fetch(endpoint, {
          credentials: "include",
          headers: {
            "X-Debug-Cookie": document.cookie || "No cookie sent", // Debug: Log cookie
          },
        });
        const data = await res.json();
        console.log("Posts response:", { status: res.status, data });
        if (!res.ok) throw new Error(data.error || `HTTP error ${res.status}`);
        const enrichedPosts = data.map((post) => ({
          ...post,
          postedBy: post.postedBy._id
            ? post.postedBy
            : { _id: post.postedBy, username: user?.username, profilePic: user?.profilePic },
        }));
        setPostsState((prev) => ({ ...prev, posts: enrichedPosts }));
      } catch (error) {
        console.error("Error fetching posts:", error.message, error.stack);
        message.error(error.message || "Failed to load posts");
      } finally {
        setFetchingPosts(false);
      }
    };

    const getBookmarks = async () => {
      try {
        const res = await fetch(`/api/posts/bookmarks/${username}`, {
          credentials: "include",
          headers: {
            "X-Debug-Cookie": document.cookie || "No cookie sent",
          },
        });
        const data = await res.json();
        console.log("Bookmarks response:", { status: res.status, data });
        if (!res.ok) throw new Error(data.error || `HTTP error ${res.status}`);
        const enrichedBookmarks = data.map((post) => ({
          ...post,
          postedBy: post.postedBy._id
            ? post.postedBy
            : { _id: post.postedBy, username: user?.username, profilePic: user?.profilePic },
        }));
        setPostsState((prev) => ({ ...prev, bookmarks: enrichedBookmarks || [] }));
      } catch (error) {
        console.error("Error fetching bookmarks:", error.stack);
        message.error(error.message || "Failed to load bookmarks");
      } finally {
        setFetchingBookmarks(false);
      }
    };

    getUserAndStats();
    getPosts();
    getBookmarks();
  }, [username, currentUser, setPostsState, user?.username, user?.profilePic]);

  useEffect(() => {
    if (!socket) {
      console.warn("Socket is not initialized in UserPage");
      message.warning("Real-time updates are unavailable. Please check your connection.");
      return;
    }

    const handleUserFollowed = ({ followedId, follower }) => {
      if (followedId === user?._id) {
        setUser((prev) => ({
          ...prev,
          followers: [...(prev.followers || []), follower._id],
        }));
      }
      if (follower._id === user?._id) {
        setUser((prev) => ({
          ...prev,
          following: [...(prev.following || []), followedId],
        }));
      }
    };

    const handleUserUnfollowed = ({ unfollowedId, follower }) => {
      if (unfollowedId === user?._id) {
        setUser((prev) => ({
          ...prev,
          followers: prev.followers?.filter((id) => id !== follower._id) || [],
        }));
      }
      if (follower._id === user?._id) {
        setUser((prev) => ({
          ...prev,
          following: prev.following?.filter((id) => id !== unfollowedId) || [],
        }));
      }
    };

    socket.on("userFollowed", handleUserFollowed);
    socket.on("userUnfollowed", handleUserUnfollowed);

    socket.on("newPost", (post) => {
      if (post.postedBy._id === user?._id || currentUser.following.includes(post.postedBy._id)) {
        setPostsState((prev) => ({
          ...prev,
          posts: [post, ...prev.posts],
        }));
      }
    });

    socket.on("postDeleted", ({ postId, userId }) => {
      if (userId === user?._id) {
        setPostsState((prev) => ({
          ...prev,
          posts: prev.posts.filter((p) => p._id !== postId),
          bookmarks: prev.bookmarks.filter((p) => p._id !== postId),
        }));
      }
    });

    return () => {
      socket.off("userFollowed", handleUserFollowed);
      socket.off("userUnfollowed", handleUserUnfollowed);
      socket.off("newPost");
      socket.off("postDeleted");
    };
  }, [socket, user, currentUser, setPostsState]);

  const handleLogout = () => {
    localStorage.removeItem("user-NRBLOG");
    document.cookie = "jwt=; Max-Age=0; path=/"; // Clear jwt cookie
    setCurrentUser(null);
    navigate("/auth");
    message.success("Logged out successfully");
  };

  const handleEditProfile = () => {
    navigate("/edit-profile");
  };

  const handleBanUnbanUser = async () => {
    if (!currentUser?.isAdmin) {
      message.error("Unauthorized action");
      return;
    }
    try {
      const action = user.isBanned ? "unban" : "ban";
      const res = await fetch(`/api/users/${action}/${user._id}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setUser((prev) => ({ ...prev, isBanned: !prev.isBanned }));
        message.success(`User ${action}ned successfully`);
      } else {
        throw new Error(data.error || `Failed to ${action} user`);
      }
    } catch (error) {
      console.error(`Error ${user.isBanned ? "unbanning" : "banning"} user:`, error.stack);
      message.error(error.message || `Failed to ${user.isBanned ? "unban" : "ban"} user`);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <Typography variant="h6" color="text.primary">
          User not found
        </Typography>
      </Box>
    );
  }

  const pieData = [
    { name: "Likes", value: user.stats?.totalLikes || 0 },
    { name: "Posts", value: user.stats?.totalPosts || 0 },
    { name: "Comments", value: user.stats?.totalComments || 0 },
  ];

  const barData = user.stats?.activityData || [];
  const lineData = user.stats?.activityData || [];
  const areaData = user.stats?.activityData || [];

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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <Box sx={{ minHeight: "100vh", p: isSmallScreen ? 1 : 3, pb: isSmallScreen ? 8 : 0, bgcolor: "#1a1a1a" }}>
            <Card
              sx={{
                mb: 2,
                pt: 2,
                bgcolor: "background.paper",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                width: "100%",
                maxWidth: 600,
                mx: "auto",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  flexDirection: isSmallScreen ? "column" : "row",
                  height: "100%",
                  m: 2,
                }}
              >
                <Avatar
                  src={user.profilePic || undefined}
                  alt={user.username}
                  sx={{
                    width: isSmallScreen ? 77 : 150,
                    height: isSmallScreen ? 77 : 150,
                    border: "2px solid rgba(255, 255, 255, 0.2)",
                    mb: isSmallScreen ? 2 : 0,
                    mr: !isSmallScreen ? 3 : 0,
                  }}
                />
                <Box sx={{ flex: 1, textAlign: isSmallScreen ? "center" : "left", overflow: "hidden" }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      mb: 1,
                      justifyContent: isSmallScreen ? "center" : "flex-start",
                      flexWrap: "wrap",
                      gap: 1,
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 400, mr: 2, color: "text.primary" }}>
                      {user.username}
                    </Typography>
                    {user.isVerified && <VerifiedIcon color="primary" fontSize="small" />}
                    {currentUser?._id === user._id ? (
                      <>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleEditProfile}
                          sx={{
                            mr: 1,
                            borderRadius: 20,
                            textTransform: "none",
                            borderColor: "primary.main",
                            color: "text.primary",
                            "&:hover": { bgcolor: "rgba(255, 255, 255, 0.1)" },
                          }}
                        >
                          Edit Profile
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleLogout}
                          sx={{
                            borderRadius: 20,
                            textTransform: "none",
                            borderColor: "primary.main",
                            color: "text.primary",
                            "&:hover": { bgcolor: "rgba(255, 255, 255, 0.1)" },
                          }}
                        >
                          Logout
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant={following ? "outlined" : "contained"}
                          size="small"
                          onClick={handleFollowUnfollow}
                          disabled={updating}
                          sx={{
                            mr: 1,
                            borderRadius: 20,
                            textTransform: "none",
                            bgcolor: following ? "transparent" : "primary.main",
                            color: "text.primary",
                            borderColor: following ? "primary.main" : "transparent",
                            "&:hover": { bgcolor: following ? "rgba(255, 255, 255, 0.1)" : "#6b12cb" },
                          }}
                        >
                          {following ? "Unfollow" : "Follow"}
                        </Button>
                        {currentUser?.isAdmin && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={handleBanUnbanUser}
                            sx={{
                              borderRadius: 20,
                              textTransform: "none",
                              borderColor: user.isBanned ? "success.main" : "error.main",
                              color: user.isBanned ? "success.main" : "error.main",
                              "&:hover": {
                                bgcolor: user.isBanned ? "rgba(0, 255, 0, 0.1)" : "rgba(255, 0, 0, 0.1)",
                              },
                            }}
                          >
                            {user.isBanned ? "Unban" : "Ban"}
                          </Button>
                        )}
                      </>
                    )}
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      gap: isSmallScreen ? 2 : 4,
                      mb: 2,
                      justifyContent: isSmallScreen ? "center" : "flex-start",
                    }}
                  >
                    <Card sx={{ p: 1, minWidth: 80, textAlign: "center", bgcolor: "transparent", border: "none" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
                        {postsState.posts.length}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Posts
                      </Typography>
                    </Card>
                    <Card sx={{ p: 1, minWidth: 80, textAlign: "center", bgcolor: "transparent", border: "none" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
                        {user.followers?.length || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Followers
                      </Typography>
                    </Card>
                    <Card sx={{ p: 1, minWidth: 80, textAlign: "center", bgcolor: "transparent", border: "none" }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
                        {user.following?.length || 0}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Following
                      </Typography>
                    </Card>
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
                    {user.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ whiteSpace: "pre-wrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {user.bio}
                  </Typography>
                </Box>
              </Box>
            </Card>
            {/* Rest of the JSX remains unchanged */}
            <Box
              sx={{
                position: "sticky",
                top: 0,
                zIndex: 1000,
                bgcolor: "background.paper",
                borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: "12px",
              }}
            >
              <Tabs
                value={tabValue}
                onChange={(e, newValue) => setTabValue(newValue)}
                variant={isSmallScreen ? "scrollable" : "fullWidth"}
                scrollButtons={isSmallScreen ? "auto" : "off"}
                sx={{
                  "& .MuiTab-root": {
                    minWidth: isSmallScreen ? "100px" : "auto",
                    padding: isSmallScreen ? "6px 12px" : "12px 16px",
                    color: "text.secondary",
                    "&.Mui-selected": { color: "primary.main" },
                  },
                  "& .MuiTabs-scrollButtons": {
                    "& .MuiButtonBase-root": {
                      color: "text.primary",
                    },
                  },
                }}
                TabIndicatorProps={{ style: { backgroundColor: "primary.main" } }}
              >
                <Tab label="Posts" sx={{ textTransform: "none", fontWeight: 600 }} />
                <Tab label="Bookmarked Posts" sx={{ textTransform: "none", fontWeight: 600 }} />
                <Tab label="Followers" sx={{ textTransform: "none", fontWeight: 600 }} />
                <Tab label="Following" sx={{ textTransform: "none", fontWeight: 600 }} />
                {currentUser?._id === user._id && (
                  <Tab label="Dashboard" sx={{ textTransform: "none", fontWeight: 600 }} />
                )}
              </Tabs>
            </Box>

            <Box sx={{ mt: 2, overflowY: "auto", flex: 1 }}>
              {tabValue === 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                  {fetchingPosts ? (
                    <Card
                      sx={{
                        bgcolor: "background.paper",
                        borderRadius: "12px",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        width: "100%",
                        maxWidth: 600,
                        mx: "auto",
                      }}
                    >
                      <CardContent sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
                        <CircularProgress size={24} sx={{ color: "primary.main" }} />
                      </CardContent>
                    </Card>
                  ) : postsState.posts.length === 0 ? (
                    <Card
                      sx={{
                        bgcolor: "background.paper",
                        borderRadius: "12px",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        width: "100%",
                        maxWidth: 600,
                        mx: "auto",
                      }}
                    >
                      <CardContent
                        sx={{ textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", height: "auto" }}
                      >
                        <Typography variant="body1" color="text.primary">
                          No posts yet
                        </Typography>
                      </CardContent>
                    </Card>
                  ) : (
                    postsState.posts.map((post) => (
                      <Box key={post._id} sx={{ width: "100%", maxWidth: 600, pt: 2 }}>
                        <Post
                          post={post}
                          postedBy={post.postedBy}
                          isAdminView={currentUser?.isAdmin}
                          onBookmark={handleBookmark}
                        />
                      </Box>
                    ))
                  )}
                </Box>
              )}
              {/* Rest of the tabs (Bookmarked Posts, Followers, Following, Dashboard) remain unchanged */}
            </Box>
          </Box>
        </motion.div>
      </App>
    </ConfigProvider>
  );
};

// FollowerCard and FollowingCard components remain unchanged
const FollowerCard = ({ followerId, navigate }) => {
  const [follower, setFollower] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFollower = async () => {
      try {
        const res = await fetch(`/api/users/profile/${followerId}`, {
          credentials: "include",
        });
        const data = await res.json();
        console.log("Follower response:", data);
        if (res.ok) {
          setFollower(data);
        } else {
          throw new Error(data.error || "Failed to fetch follower");
        }
      } catch (error) {
        console.error("Error fetching follower:", error.stack);
        message.error(error.message || "Failed to load follower");
      } finally {
        setLoading(false);
      }
    };
    fetchFollower();
  }, [followerId]);

  if (loading) {
    return (
      <Card
        sx={{
          bgcolor: "background.paper",
          borderRadius: "12px",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          width: "100%",
          maxWidth: 500,
          mx: "auto",
        }}
      >
        <CardContent sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
          <CircularProgress size={24} sx={{ color: "primary.main" }} />
        </CardContent>
      </Card>
    );
  }

  if (!follower) return null;

  return (
    <Card
      sx={{
        bgcolor: "background.paper",
        borderRadius: "12px",
        border: "1px solid rgba(255, 255, 255, 0.2)",
      }}
    >
      {follower.isBanned && (
        <Typography
          sx={{
            position: "absolute",
            top: 8,
            left: 8,
            color: "#f44336",
            fontWeight: 600,
            bgcolor: "rgba(255,255,255,0.1)",
            px: 1,
            py: 0.5,
            borderRadius: 2,
            fontSize: "0.75rem",
          }}
        >
          Banned
        </Typography>
      )}
      <CardContent sx={{ display: "flex", alignItems: "center", p: { xs: 1.5, sm: 2 } }}>
        <Avatar src={follower.profilePic} sx={{ width: 40, height: 40, mr: 2 }} />
        <Box sx={{ display: "flex", alignItems: "center", flex: 1 }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 500, color: "text.primary", cursor: "pointer", mr: 1 }}
            onClick={() => navigate(`/${follower.username}`)}
          >
            {follower.username}
          </Typography>
          {follower.isVerified && (
            <VerifiedIcon color="primary" fontSize="small" />
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

const FollowingCard = ({ followingId, navigate }) => {
  const [followingUser, setFollowingUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFollowing = async () => {
      try {
        const res = await fetch(`/api/users/profile/${followingId}`, {
          credentials: "include",
        });
        const data = await res.json();
        console.log("Following user response:", data);
        if (res.ok) {
          setFollowingUser(data);
        } else {
          throw new Error(data.error || "Failed to fetch following user");
        }
      } catch (error) {
        console.error("Error fetching following user:", error.stack);
        message.error(error.message || "Failed to load following user");
      } finally {
        setLoading(false);
      }
    };
    fetchFollowing();
  }, [followingId]);

  if (loading) {
    return (
      <Card
        sx={{
          bgcolor: "background.paper",
          borderRadius: "12px",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          width: "100%",
          maxWidth: 500,
          mx: "auto",
        }}
      >
        <CardContent sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
          <CircularProgress size={24} sx={{ color: "primary.main" }} />
        </CardContent>
      </Card>
    );
  }

  if (!followingUser) return null;

  return (
    <Card
      sx={{
        bgcolor: "background.paper",
        borderRadius: "12px",
        border: "1px solid rgba(255, 255, 255, 0.2)",
      }}
    >
      {followingUser.isBanned && (
        <Typography
          sx={{
            position: "absolute",
            top: 8,
            left: 8,
            color: "#f44336",
            fontWeight: 600,
            bgcolor: "rgba(255,255,255,0.1)",
            px: 1,
            py: 0.5,
            borderRadius: 2,
            fontSize: "0.75rem",
          }}
        >
          Banned
        </Typography>
      )}
      <CardContent sx={{ display: "flex", alignItems: "center", p: { xs: 1.5, sm: 2 } }}>
        <Avatar src={followingUser.profilePic} sx={{ width: 40, height: 40, mr: 2 }} />
        <Box sx={{ display: "flex", alignItems: "center", flex: 1 }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 500, color: "text.primary", cursor: "pointer", mr: 1 }}
            onClick={() => navigate(`/${followingUser.username}`)}
          >
            {followingUser.username}
          </Typography>
          {followingUser.isVerified && (
            <VerifiedIcon color="primary" fontSize="small" />
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default UserPage;