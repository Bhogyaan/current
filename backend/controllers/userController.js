import User from "../models/userModel.js";
import { Post } from "../models/postModel.js";
import bcrypt from "bcryptjs";
import generateTokenAndSetCookie from "../utils/helpers/generateTokenAndSetCookie.js";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import fs from "fs";
import jwt from "jsonwebtoken";

const ADMIN_USERNAME = "adminblog";
const ADMIN_PASSWORD = "Admin123";

// Refresh Token Endpoint
const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.jwt;
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const newToken = generateTokenAndSetCookie(user._id, res);
    res.status(200).json({ token: newToken });
  } catch (error) {
    console.error("Error in refreshToken:", error.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Get User Profile
const getUserProfile = async (req, res) => {
  try {
    const { query } = req.params;
    let user;

    if (mongoose.Types.ObjectId.isValid(query)) {
      user = await User.findById(query).select("-password");
    } else {
      user = await User.findOne({ username: query }).select("-password");
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      _id: user._id,
      username: user.username,
      profilePic: user.profilePic,
      name: user.name,
      bio: user.bio,
      followers: user.followers,
      following: user.following,
      isAdmin: user.isAdmin,
      isBanned: user.isBanned,
      isFrozen: user.isFrozen,
      isVerified: user.isVerified,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in getUserProfile: ", error.message);
  }
};

// Get Multiple Users
const getMultipleUsers = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "IDs must be a non-empty array" });
    }
    const users = await User.find({ _id: { $in: ids } }).select("username profilePic _id");
    if (users.length === 0) {
      return res.status(404).json({ error: "No users found for the provided IDs" });
    }
    res.status(200).json(users);
  } catch (err) {
    console.error("Error in getMultipleUsers:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get User Stats
const getUserStats = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const posts = await Post.find({ postedBy: user._id, isBanned: false });
    const totalPosts = posts.length;
    const totalLikes = posts.reduce((acc, post) => acc + (post.likes?.length || 0), 0);
    const totalComments = posts.reduce((acc, post) => acc + (post.comments?.length || 0), 0);

    const activityData = [
      { month: "Jan", likes: Math.floor(totalLikes / 4), posts: Math.floor(totalPosts / 4) },
      { month: "Feb", likes: Math.floor(totalLikes / 3), posts: Math.floor(totalPosts / 3) },
      { month: "Mar", likes: Math.floor(totalLikes / 2), posts: Math.floor(totalPosts / 2) },
      { month: "Apr", likes: totalLikes, posts: totalPosts },
    ];

    res.status(200).json({
      totalLikes,
      totalPosts,
      totalComments,
      activityData,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in getUserStats: ", error.message);
  }
};

// Signup User
const signupUser = async (req, res) => {
  try {
    const { name, email, username, password } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      if (existingUser.email === email && existingUser.username === username) {
        return res.status(400).json({ error: "Email and username already taken" });
      }
      if (existingUser.email === email) {
        return res.status(400).json({ error: "Email already taken" });
      }
      if (existingUser.username === username) {
        return res.status(400).json({ error: "Username already taken" });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      username,
      password: hashedPassword,
    });
    await newUser.save();

    if (newUser) {
      generateTokenAndSetCookie(newUser._id, res);

      res.status(201).json({
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        bio: newUser.bio,
        profilePic: newUser.profilePic,
        followers: newUser.followers,
        following: newUser.following,
        isAdmin: newUser.isAdmin,
        isBanned: newUser.isBanned,
        isFrozen: newUser.isFrozen,
      });
    } else {
      res.status(400).json({ error: "Invalid user data" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log("Error in signupUser: ", err.message);
  }
};

// Login User
const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    const isPasswordCorrect = await bcrypt.compare(password, user?.password || "");

    if (!user || !isPasswordCorrect) return res.status(400).json({ error: "Invalid username or password" });
    if (user.isBanned) return res.status(403).json({ error: "Account is banned" });

    if (user.isFrozen) {
      user.isFrozen = false;
      await user.save();
    }

    generateTokenAndSetCookie(user._id, res);

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      bio: user.bio,
      profilePic: user.profilePic,
      followers: user.followers,
      following: user.following,
      isAdmin: user.isAdmin,
      isBanned: user.isBanned,
      isFrozen: user.isFrozen,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in loginUser: ", error.message);
  }
};

// Admin Login
const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return res.status(400).json({ error: "Invalid admin credentials" });
    }

    let adminUser = await User.findOne({ username: ADMIN_USERNAME });
    if (!adminUser) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, salt);
      adminUser = new User({
        name: "Admin Blog",
        username: ADMIN_USERNAME,
        email: "admin@NRBLOGclone.com",
        password: hashedPassword,
        isAdmin: true,
      });
      await adminUser.save();
    }

    generateTokenAndSetCookie(adminUser._id, res);

    res.status(200).json({
      _id: adminUser._id,
      name: adminUser.name,
      username: adminUser.username,
      isAdmin: adminUser.isAdmin,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in adminLogin: ", error.message);
  }
};

// Promote to Admin
const promoteToAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = await User.findById(req.user._id);

    if (!currentUser.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const userToPromote = await User.findById(id);
    if (!userToPromote) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userToPromote.isAdmin) {
      return res.status(400).json({ error: "User is already an admin" });
    }

    userToPromote.isAdmin = true;
    await userToPromote.save();

    res.status(200).json({ message: "User promoted to admin successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in promoteToAdmin: ", error.message);
  }
};

// Logout User
const logoutUser = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 1 });
    res.status(200).json({ message: "User logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log("Error in logoutUser: ", err.message);
  }
};

// Follow/Unfollow User
const followUnFollowUser = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user._id;

    if (currentUserId.toString() === id) {
      return res.status(400).json({ error: "You cannot follow/unfollow yourself" });
    }

    const userToFollow = await User.findById(id);
    const currentUser = await User.findById(currentUserId);

    if (!userToFollow || !currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (userToFollow.isBanned) {
      return res.status(403).json({ error: "Cannot follow a banned user" });
    }

    userToFollow.followers = Array.isArray(userToFollow.followers) ? userToFollow.followers : [];
    currentUser.following = Array.isArray(currentUser.following) ? currentUser.following : [];

    const isFollowing = currentUser.following.includes(id);

    if (isFollowing) {
      currentUser.following = currentUser.following.filter((userId) => userId.toString() !== id);
      userToFollow.followers = userToFollow.followers.filter((userId) => userId.toString() !== currentUserId.toString());
      await Promise.all([currentUser.save(), userToFollow.save()]);
      if (req.io) {
        const unfollowData = {
          unfollowedId: id,
          follower: {
            _id: currentUserId,
            username: currentUser.username,
            profilePic: currentUser.profilePic,
            name: currentUser.name,
          },
        };
        const unfollowedSocketId = req.io.getRecipientSocketId(id);
        if (unfollowedSocketId) {
          req.io.to(unfollowedSocketId).emit("userUnfollowed", unfollowData);
        }
        const currentUserSocketId = req.io.getRecipientSocketId(currentUserId.toString());
        if (currentUserSocketId) {
          req.io.to(currentUserSocketId).emit("userUnfollowed", unfollowData);
        }
        userToFollow.followers.forEach((followerId) => {
          const socketId = req.io.getRecipientSocketId(followerId.toString());
          if (socketId) {
            req.io.to(socketId).emit("userUnfollowed", unfollowData);
          }
        });
      }
      res.status(200).json({ message: "Unfollowed successfully" });
    } else {
      currentUser.following.push(id);
      userToFollow.followers.push(currentUserId);
      await Promise.all([currentUser.save(), userToFollow.save()]);
      if (req.io) {
        const followData = {
          followedId: id,
          follower: {
            _id: currentUserId,
            username: currentUser.username,
            profilePic: currentUser.profilePic,
            name: currentUser.name,
          },
        };
        const followedSocketId = req.io.getRecipientSocketId(id);
        if (followedSocketId) {
          req.io.to(followedSocketId).emit("userFollowed", followData);
        }
        const currentUserSocketId = req.io.getRecipientSocketId(currentUserId.toString());
        if (currentUserSocketId) {
          req.io.to(currentUserSocketId).emit("userFollowed", followData);
        }
        userToFollow.followers.forEach((followerId) => {
          const socketId = req.io.getRecipientSocketId(followerId.toString());
          if (socketId) {
            req.io.to(socketId).emit("userFollowed", followData);
          }
        });
      }
      res.status(200).json({ message: "Followed successfully" });
    }
  } catch (error) {
    console.error("Follow/Unfollow error:", error);
    res.status(500).json({ error: `Failed to ${isFollowing ? "unfollow" : "follow"} user: ${error.message}` });
  }
};

// Update User
const updateUser = async (req, res) => {
  const { name, email, username, password, bio } = req.body;
  let profilePic;

  if (req.file) {
    try {
      const uploadedResponse = await cloudinary.uploader.upload(req.file.path);
      profilePic = uploadedResponse.secure_url;
      fs.unlinkSync(req.file.path);
    } catch (error) {
      return res.status(500).json({ error: "Failed to upload image to Cloudinary" });
    }
  }

  const userId = req.user._id;
  try {
    let user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: userId } });
      if (emailExists) {
        return res.status(400).json({ error: "Email already taken" });
      }
    }
    if (username && username !== user.username) {
      const usernameExists = await User.findOne({ username, _id: { $ne: userId } });
      if (usernameExists) {
        return res.status(400).json({ error: "Username already taken" });
      }
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      user.password = hashedPassword;
    }

    if (profilePic && user.profilePic) {
      await cloudinary.uploader.destroy(user.profilePic.split("/").pop().split(".")[0]);
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.username = username || user.username;
    user.bio = bio || user.bio;
    user.profilePic = profilePic || user.profilePic;

    user = await user.save();

    await Post.updateMany(
      { "comments.userId": userId },
      {
        $set: {
          "comments.$[comment].username": user.username,
          "comments.$[comment].userProfilePic": user.profilePic,
        },
      },
      { arrayFilters: [{ "comment.userId": userId }] }
    );

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json(userResponse);
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log("Error in updateUser: ", err.message);
  }
};

// Get Suggested Users
const getSuggestedUsers = async (req, res) => {
  try {
    const userId = req.user._id;
    const usersFollowedByYou = await User.findById(userId).select("following");

    const users = await User.aggregate([
      {
        $match: {
          _id: { $ne: userId },
          isBanned: false,
        },
      },
      {
        $sample: { size: 10 },
      },
    ]);
    const filteredUsers = users.filter((user) => !usersFollowedByYou.following.includes(user._id.toString()));
    const suggestedUsers = filteredUsers.slice(0, 4);

    suggestedUsers.forEach((user) => delete user.password);

    res.status(200).json(suggestedUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in getSuggestedUsers: ", error.message);
  }
};

// Freeze Account
const freezeAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    user.isFrozen = true;
    await user.save();

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in freezeAccount: ", error.message);
  }
};

// Ban User
const banUser = async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: "Admin access required" });

    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.isBanned = true;
    await user.save();

    res.status(200).json({ message: "User banned successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in banUser: ", error.message);
  }
};

// Unban User
const unbanUser = async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: "Admin access required" });

    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.isBanned = false;
    await user.save();

    res.status(200).json({ message: "User unbanned successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in unbanUser: ", error.message);
  }
};

// Get User Dashboard
const getUserDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const posts = await Post.find({ postedBy: userId });
    const totalPosts = posts.length;
    const totalLikes = posts.reduce((acc, post) => acc + post.likes.length, 0);
    const totalComments = posts.reduce((acc, post) => acc + post.comments.length, 0);
    const totalInteractions = totalLikes + totalComments;

    res.status(200).json({
      totalPosts,
      totalLikes,
      totalComments,
      totalInteractions,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in getUserDashboard: ", error.message);
  }
};

// Get Admin Realtime Dashboard
const getAdminRealtimeDashboard = async (req, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const range = req.query.range || 'week';
    let days;
    switch (range) {
      case 'week': days = 7; break;
      case 'month': days = 30; break;
      case 'year': days = 365; break;
      default: days = 7;
    }

    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      bannedUsers,
      totalPosts,
      bannedPosts,
      likesAndComments,
      bookmarksAndShares,
      activityData,
      recentPosts,
      activeUsersByHour,
      userGrowth,
      postGrowth,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isBanned: true }),
      Post.countDocuments({}),
      Post.countDocuments({ isBanned: true }),
      Post.aggregate([
        {
          $group: {
            _id: null,
            totalLikes: { $sum: { $size: "$likes" } },
            totalComments: { $sum: { $size: "$comments" } },
          },
        },
      ]),
      Post.aggregate([
        {
          $group: {
            _id: null,
            totalBookmarks: { $sum: { $size: "$bookmarks" } },
            totalShares: { $sum: { $size: "$shares" } },
          },
        },
      ]),
      Post.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            isBanned: false,
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            posts: { $sum: 1 },
            likes: { $sum: { $size: "$likes" } },
            comments: { $sum: { $size: "$comments" } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Post.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("postedBy", "username profilePic isBanned")
        .lean(),
      User.aggregate([
        {
          $match: {
            lastActive: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: { $hour: "$lastActive" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      User.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            newUsers: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Post.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            isBanned: false,
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            newPosts: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Format activity data to fill missing days
    const formattedActivityData = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const existingData = activityData.find((d) => d._id === dateStr);
      formattedActivityData.push({
        date: dateStr,
        posts: existingData?.posts || 0,
        likes: existingData?.likes || 0,
        comments: existingData?.comments || 0,
      });
    }

    // Format user growth data
    const formattedUserGrowth = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const existingData = userGrowth.find((d) => d._id === dateStr);
      formattedUserGrowth.push({
        date: dateStr,
        newUsers: existingData?.newUsers || 0,
      });
    }

    // Format post growth data
    const formattedPostGrowth = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const existingData = postGrowth.find((d) => d._id === dateStr);
      formattedPostGrowth.push({
        date: dateStr,
        newPosts: existingData?.newPosts || 0,
      });
    }

    // Format active users by hour
    const activeUsersByHourFormatted = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      users: activeUsersByHour.find((item) => item._id === i)?.count || 0,
    }));

    // Calculate engagement rate
    const activeUsers = totalUsers - bannedUsers;
    const engagementRate = activeUsers > 0
      ? ((likesAndComments[0]?.totalLikes || 0 + likesAndComments[0]?.totalComments || 0) / activeUsers).toFixed(2)
      : 0;

    res.status(200).json({
      totalUsers,
      bannedUsers,
      totalPosts,
      bannedPosts,
      totalLikes: likesAndComments[0]?.totalLikes || 0,
      totalComments: likesAndComments[0]?.totalComments || 0,
      totalBookmarks: bookmarksAndShares[0]?.totalBookmarks || 0,
      totalShares: bookmarksAndShares[0]?.totalShares || 0,
      activityData: formattedActivityData,
      userActivityByHour: activeUsersByHourFormatted,
      userGrowth: formattedUserGrowth,
      postGrowth: formattedPostGrowth,
      recentPosts: recentPosts.map((post) => ({
        ...post,
        text: post.text || "No content",
        postedBy: post.postedBy || { username: "Unknown", isBanned: false },
      })),
      engagementRate,
    });
  } catch (error) {
    console.error("Error in getAdminRealtimeDashboard:", error);
    res.status(500).json({
      error: "Failed to fetch dashboard data",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get All Users
const getAllUsers = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const users = await User.find({}).select("-password");
    res.status(200).json(users);
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    res.status(500).json({ error: error.message });
  }
};

export {
  signupUser,
  loginUser,
  adminLogin,
  logoutUser,
  followUnFollowUser,
  updateUser,
  promoteToAdmin,
  getUserProfile,
  getSuggestedUsers,
  freezeAccount,
  banUser,
  unbanUser,
  getUserDashboard,
  getUserStats,
  getAdminRealtimeDashboard,
  getMultipleUsers,
  getAllUsers,
  refreshToken,
};