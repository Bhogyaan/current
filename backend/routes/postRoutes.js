import express from "express";
import multer from "multer";
import {
  getAllPosts,
  createPost,
  createStory,
  getPost,
  deletePost,
  likeUnlikePost,
  commentOnPost,
  likeUnlikeComment,
  banPost,
  unbanPost,
  getFeedPosts,
  getUserPosts,
  getStories,
  editPost,
  editComment,
  deleteComment,
  getBookmarks,
  bookmarkUnbookmarkPost,
  getSuggestedPosts,
  getPaginatedComments,
  // sharePost,
  // getBookmarkedUsersCount,
} from "../controllers/postController.js";
import protectRoute from "../middlewares/protectRoute.js";
import rateLimit from "express-rate-limit";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  next();
});

const commentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit to 100 comments per IP
});

router.get("/all", protectRoute, getAllPosts);
router.get("/feed", protectRoute, getFeedPosts);
router.get("/stories", protectRoute, getStories);
// router.get("/user/:username", getUserPosts);
router.get("/:id", getPost);
// router.get("/bookmarks/:username", protectRoute, getBookmarks);
router.get("/suggested", protectRoute, getSuggestedPosts);
router.get("/:postId/comments", protectRoute, getPaginatedComments);
router.get("/user/:username", protectRoute, getUserPosts);
router.get("/bookmarks/:username", protectRoute, getBookmarks);
// router.get("/bookmarked/:id", protectRoute, getBookmarkedUsersCount);

router.post("/create", protectRoute, upload.single("media"), createPost);
router.post("/story", protectRoute, upload.single("media"), createStory);
router.post("/:postId/comment", protectRoute, commentLimiter, commentOnPost);
// router.post("/:id/share", protectRoute, sharePost);

router.put("/like/:id", protectRoute, likeUnlikePost);
router.put("/bookmark/:id", protectRoute, bookmarkUnbookmarkPost);
router.put("/:id", protectRoute, editPost);
router.put("/:postId/comment/:commentId/like", protectRoute, likeUnlikeComment);
router.put("/:id/ban", protectRoute, banPost);      // Fixed route
router.put("/:id/unban", protectRoute, unbanPost); 
router.put("/:postId/comment/:commentId", protectRoute, editComment);

router.delete("/:id", protectRoute, deletePost);
router.delete("/:postId/comment/:commentId", protectRoute, deleteComment);

export default router;