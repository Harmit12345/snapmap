const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const User = require("../models/User");
const Follow = require("../models/Follow");
const requireAuth = require("../middleware/auth");

// ground-truth count sync helper function
const updateCounts = async (userId, session = null) => {
  const opts = session ? { session } : {};
  // Count ground-truth follow relationships
  const followersCount = await Follow.countDocuments({
    followeeId: userId,
    status: "accepted",
  }).session(session ? session : undefined);

  const followingCount = await Follow.countDocuments({
    followerId: userId,
    status: "accepted",
  }).session(session ? session : undefined);

  // Hard write counts to the user profile document
  await User.findByIdAndUpdate(
    userId,
    { followersCount, followingCount },
    opts
  );

  return { followersCount, followingCount };
};

// GET /api/follow/requests - Fetch incoming pending follow requests for the logged-in user
router.get("/requests", requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;

    const currentUser = await User.findOne({ firebaseUid: userId });
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find all pending follow requests where the current user is the followee
    const requests = await Follow.find({
      followeeId: currentUser._id,
      status: "pending",
    }).populate("followerId");

    // Filter out requests where the follower user document no longer exists in database
    const validRequests = requests.filter(r => r.followerId !== null);

    res.json(validRequests);
  } catch (error) {
    console.error("Error in GET /api/follow/requests:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/follow/:id - Follow a user or send a follow request
router.post("/:id", requireAuth, async (req, res) => {
  const userId = req.user.uid;
  const targetUserId = req.params.id;

  // Validate ObjectID format
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return res.status(400).json({ error: "Invalid target user ID format." });
  }

  // Attempt to initialize Mongoose Transaction Session
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (e) {
    console.warn("⚠️ Mongoose transactions are not supported on this MongoDB server setup. Running non-transactional fallback.");
    session = null;
  }

  try {
    // Find the logged-in user's database record
    const currentUser = await User.findOne({ firebaseUid: userId }).session(session ? session : undefined);
    if (!currentUser) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(404).json({ error: "Logged-in user record not found" });
    }

    // Find the target user's database record
    const targetUser = await User.findById(targetUserId).session(session ? session : undefined);
    if (!targetUser) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(404).json({ error: "Target user not found" });
    }

    // 1. Guard Rail: Prevent self-following (verifying url param, Firebase uid, and MongoDB equivalents)
    if (
      targetUserId === userId ||
      currentUser._id.toString() === targetUserId ||
      currentUser._id.toString() === targetUser._id.toString()
    ) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(400).json({ error: "You cannot follow yourself." });
    }

    // 2. Guard Rail: Idempotency (returns status of existing document instead of duplicating)
    const existingFollow = await Follow.findOne({
      followerId: currentUser._id,
      followeeId: targetUser._id,
    }).session(session ? session : undefined);

    if (existingFollow) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(200).json({
        message: existingFollow.status === "accepted" ? "You are already following this user" : "Follow request already pending",
        status: existingFollow.status,
      });
    }

    // 3. Privacy-Aware Gating evaluation
    const targetPrivacy = targetUser.profile?.privacySetting || "public";
    // Check both profile privacy Setting enums and any boolean privacySettings.isPrivate properties
    const isPrivate = targetPrivacy === "private" || targetPrivacy === "followers" || targetUser.privacySettings?.isPrivate === true;
    const status = isPrivate ? "pending" : "accepted";

    // Create the Follow document
    await Follow.create(
      [
        {
          followerId: currentUser._id,
          followeeId: targetUser._id,
          status,
        }
      ],
      session ? { session } : {}
    );

    // Only update counts if follow relationship is accepted immediately
    if (status === "accepted") {
      await updateCounts(currentUser._id, session);
      await updateCounts(targetUser._id, session);
    }

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    res.json({
      message: status === "accepted" ? "Successfully followed user" : "Follow request sent",
      status,
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    console.error("Error in POST /api/follow/:id:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/follow/approve/:id - Approve a pending follow request from user :id
router.patch("/approve/:id", requireAuth, async (req, res) => {
  const userId = req.user.uid;
  const requesterId = req.params.id; // User who wants to follow current user

  // Validate requesterId format
  if (!mongoose.Types.ObjectId.isValid(requesterId)) {
    return res.status(400).json({ error: "Invalid requester user ID format." });
  }

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (e) {
    session = null;
  }

  try {
    // Find the logged-in user (the owner/followee of the request)
    const currentUser = await User.findOne({ firebaseUid: userId }).session(session ? session : undefined);
    if (!currentUser) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(404).json({ error: "Logged-in user record not found" });
    }

    // Find the pending follow relationship
    const followRequest = await Follow.findOne({
      followerId: requesterId,
      followeeId: currentUser._id,
      status: "pending",
    }).session(session ? session : undefined);

    if (!followRequest) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(404).json({ error: "Follow request not found or already approved" });
    }

    // Accept request
    followRequest.status = "accepted";
    await followRequest.save(session ? { session } : {});

    // Recalculate counts
    await updateCounts(currentUser._id, session);
    await updateCounts(requesterId, session);

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    res.json({ message: "Follow request approved successfully" });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    console.error("Error in PATCH /api/follow/approve/:id:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/follow/decline/:id - Decline a pending follow request from user :id
router.delete("/decline/:id", requireAuth, async (req, res) => {
  const userId = req.user.uid;
  const requesterId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(requesterId)) {
    return res.status(400).json({ error: "Invalid requester user ID format." });
  }

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (e) {
    session = null;
  }

  try {
    // Find the logged-in user
    const currentUser = await User.findOne({ firebaseUid: userId }).session(session ? session : undefined);
    if (!currentUser) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(404).json({ error: "Logged-in user record not found" });
    }

    // Delete the pending follow document
    const deletedRequest = await Follow.findOneAndDelete({
      followerId: requesterId,
      followeeId: currentUser._id,
      status: "pending",
    }).session(session ? session : undefined);

    if (!deletedRequest) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(404).json({ error: "Follow request not found" });
    }

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    res.json({ message: "Follow request declined successfully" });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    console.error("Error in DELETE /api/follow/decline/:id:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/follow/:id - Unfollow a user or cancel a sent follow request
router.delete("/:id", requireAuth, async (req, res) => {
  const userId = req.user.uid;
  const targetUserId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return res.status(400).json({ error: "Invalid target user ID format." });
  }

  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (e) {
    session = null;
  }

  try {
    // Find the logged-in user's database record
    const currentUser = await User.findOne({ firebaseUid: userId }).session(session ? session : undefined);
    if (!currentUser) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(404).json({ error: "Logged-in user record not found" });
    }

    // Find the target user's database record
    const targetUser = await User.findById(targetUserId).session(session ? session : undefined);
    if (!targetUser) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(404).json({ error: "Target user not found" });
    }

    // Attempt to delete the Follow record (can be pending or accepted)
    const deletedFollow = await Follow.findOneAndDelete({
      followerId: currentUser._id,
      followeeId: targetUser._id,
    }).session(session ? session : undefined);

    if (!deletedFollow) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(400).json({ error: "You are not following or requesting this user" });
    }

    // Recalculate counts
    await updateCounts(currentUser._id, session);
    await updateCounts(targetUser._id, session);

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    res.json({
      message: deletedFollow.status === "accepted" ? "Successfully unfollowed user" : "Follow request cancelled",
    });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    console.error("Error in DELETE /api/follow/:id:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
