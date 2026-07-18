const express = require("express");
const expressRouter = express.Router();
const User = require("../models/User");
const Follow = require("../models/Follow");
const requireAuth = require("../middleware/auth");

const router = expressRouter;

// GET /api/users/exists - Check if user profile exists in MongoDB by email, phoneNumber, or username
router.get("/exists", async (req, res) => {
  try {
    const { identifier } = req.query;
    if (!identifier) {
      return res.status(400).json({ error: "Missing identifier query parameter" });
    }

    let query = {};
    const cleanIdentifier = identifier.trim();

    if (cleanIdentifier.includes("@")) {
      // It's an email
      query.email = { $regex: new RegExp(`^${cleanIdentifier.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, "i") };
    } else if (/^\+?[0-9\s\-()]+$/.test(cleanIdentifier) && cleanIdentifier.length >= 7) {
      // It's a phone number
      query.phoneNumber = cleanIdentifier;
    } else {
      // Assume it's a username / displayName
      query["profile.displayName"] = { $regex: new RegExp(`^${cleanIdentifier.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, "i") };
    }

    const user = await User.findOne(query);
    res.json({ exists: !!user, email: user ? user.email : null });
  } catch (error) {
    console.error("Error checking user existence:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/users/sync - Sync Firebase authentication identity to MongoDB
router.post("/sync", requireAuth, async (req, res) => {
  console.log('Syncing user:', req.body);

  try {
    const firebaseUid = req.body.uid || req.user.uid;
    const phone = req.body.phoneNumber || req.user.phone_number;
    const email = req.user.email;
    const { username, isSignUp } = req.body;

    // Check if the email or phone number is already linked to another account in MongoDB (only during sign-up)
    if (isSignUp) {
      if (email) {
        const existingEmailUser = await User.findOne({ email, firebaseUid: { $ne: firebaseUid } });
        if (existingEmailUser) {
          console.log(`❌ Sync blocked: Email ${email} already linked to another user UID: ${existingEmailUser.firebaseUid}`);
          return res.status(400).json({ error: "Email is already linked to another account." });
        }
      }

      if (phone) {
        const existingPhoneUser = await User.findOne({ phoneNumber: phone, firebaseUid: { $ne: firebaseUid } });
        if (existingPhoneUser) {
          console.log(`❌ Sync blocked: Phone ${phone} already linked to another user UID: ${existingPhoneUser.firebaseUid}`);
          return res.status(400).json({ error: "Phone number is already linked to another account." });
        }
      }
    }

    // 1. Find existing record by checking phoneNumber first, then fallback to UID/Email
    let user = null;
    if (phone) {
      user = await User.findOne({ phoneNumber: phone });
    }

    if (!user) {
      user = await User.findOne({ firebaseUid });
    }

    if (!user && email) {
      user = await User.findOne({ email });
    }

    // 2. Link identity details if document exists
    if (user) {
      user.firebaseUid = firebaseUid;
      if (email) user.email = email;
      if (phone) user.phoneNumber = phone;
      
      // Update display name if a name is provided during sign-up
      if (isSignUp && username) {
        if (!user.profile) {
          user.profile = {};
        }
        user.profile.displayName = username;
      }
      
      await user.save();
      console.log(`🔗 Linked/Updated existing MongoDB profile for Firebase user: ${firebaseUid}`);
    } else {
      // If no document exists and the user is attempting to sign in (not sign up), block creation
      if (isSignUp === false) {
        console.log(`❌ Sign-in blocked: No existing profile found for UID: ${firebaseUid}`);
        return res.status(404).json({ error: "No account found. Please sign up first!" });
      }

      // 3. Fallback to default display name generation
      let defaultDisplayName = "New User";
      if (email) {
        defaultDisplayName = email.split("@")[0];
      } else if (phone) {
        const lastFour = phone.slice(-4);
        defaultDisplayName = `User_${lastFour}`;
      }

      const displayName = username || defaultDisplayName;

      // 4. Create new user document
      user = await User.create({
        firebaseUid,
        email: email || undefined,
        phoneNumber: phone || undefined,
        profile: {
          displayName,
          bio: "Hey there! I am using StoryShare.",
          photoUrl: "",
          privacySetting: "public",
        },
        followersCount: 0,
        followingCount: 0,
      });
      console.log(`✅ Created new MongoDB profile for Firebase user: ${firebaseUid}`);
    }

    res.json(user);
  } catch (error) {
    console.error("❌ Critical sync failure inside /api/users/sync:");
    console.error(" - Error Details:", error);
    res.status(500).json({ error: "Server error during sync: " + error.message });
  }
});

// GET /api/users/ - Fetch all users except the currently logged-in user with followStatus
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    console.log(`GET /api/users: Requesting UID: ${userId}`);

    const currentUser = await User.findOne({ firebaseUid: userId });
    if (!currentUser) {
      console.log(`GET /api/users: Logged-in user record not found for UID: ${userId}`);
      return res.status(404).json({ error: "Logged-in user record not found" });
    }
    console.log(`GET /api/users: Found current user: ${currentUser.profile?.displayName} (ID: ${currentUser._id})`);

    const users = await User.find({ _id: { $ne: currentUser._id } });
    console.log(`GET /api/users: Found ${users.length} other users in database`);
    
    // Check follow statuses
    const usersWithFollowStatus = await Promise.all(
      users.map(async (u) => {
        const followDoc = await Follow.findOne({
          followerId: currentUser._id,
          followeeId: u._id,
        });
        return {
          ...u.toObject(),
          followStatus: followDoc ? followDoc.status : "none",
        };
      })
    );

    res.json(usersWithFollowStatus);
  } catch (error) {
    console.error("Error in GET /api/users:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users/check-profile - Check if a user profile document exists in MongoDB
router.get("/check-profile", requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const user = await User.findOne({ firebaseUid: userId });
    if (!user) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error in GET /api/users/check-profile:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users/me - Fetch the logged-in user (strictly return 404 if missing, no auto-seed)
router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const user = await User.findOne({ firebaseUid: userId });
    if (!user) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error in GET /api/users/me:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/users/me - Update bio, displayName, photoUrl, privacySetting, email, and phoneNumber
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    let user = await User.findOne({ firebaseUid: userId });
    if (!user) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const { displayName, bio, photoUrl, privacySetting, email, phoneNumber } = req.body;

    if (displayName !== undefined) {
      user.profile.displayName = displayName;
    }
    if (bio !== undefined) {
      user.profile.bio = bio;
    }
    if (photoUrl !== undefined) {
      user.profile.photoUrl = photoUrl;
    }
    if (privacySetting !== undefined) {
      if (!["public", "private", "followers"].includes(privacySetting)) {
        return res.status(400).json({ error: "Invalid privacy setting. Allowed: 'public', 'private', 'followers'" });
      }
      user.profile.privacySetting = privacySetting;
    }

    if (email !== undefined) {
      if (email) {
        const existingEmailUser = await User.findOne({ email, _id: { $ne: user._id } });
        if (existingEmailUser) {
          return res.status(400).json({ error: "Email is already linked to another account." });
        }
      }
      user.email = email || undefined;
    }

    if (phoneNumber !== undefined) {
      if (phoneNumber) {
        const existingPhoneUser = await User.findOne({ phoneNumber, _id: { $ne: user._id } });
        if (existingPhoneUser) {
          return res.status(400).json({ error: "Phone number is already linked to another account." });
        }
      }
      user.phoneNumber = phoneNumber || undefined;
    }

    await user.save();
    res.json(user);
  } catch (error) {
    console.error("Error in PATCH /api/users/me:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/users/:id - Fetch target profile with privacy checks
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const loggedInUser = await User.findOne({ firebaseUid: userId });
    if (!loggedInUser) {
      return res.status(404).json({ error: "Logged-in user record not found in database" });
    }

    const isSelf = targetUser._id.toString() === loggedInUser._id.toString();

    // Verify followers check on private profiles
    if ((targetUser.profile.privacySetting === "private" || targetUser.profile.privacySetting === "followers") && !isSelf) {
      const isFollower = await Follow.exists({
        followerId: loggedInUser._id,
        followeeId: targetUser._id,
        status: "accepted",
      });

      if (!isFollower) {
        return res.status(403).json({ error: "Access denied. You must follow this user to view their profile." });
      }
    }

    res.json(targetUser);
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).json({ error: "User profile not found" });
    }
    console.error("Error in GET /api/users/:id:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/users/:uid - Delete user account and all related database records (follows, memories, etc.)
router.delete("/:uid", requireAuth, async (req, res) => {
  const { uid } = req.params;

  // 1. Guard Rail: Ensure user is deleting their own account
  if (req.user.uid !== uid) {
    return res.status(403).json({ error: "Access denied. You can only delete your own account." });
  }

  // Attempt to initialize Mongoose Transaction Session
  const mongoose = require("mongoose");
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
  } catch (e) {
    session = null;
  }

  try {
    const userDoc = await User.findOne({ firebaseUid: uid }).session(session ? session : undefined);
    if (!userDoc) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      return res.status(404).json({ error: "User profile not found in database." });
    }

    // A. Delete follows associated with this user
    await Follow.deleteMany(
      { $or: [{ followerId: userDoc._id }, { followeeId: userDoc._id }] },
      session ? { session } : {}
    );

    // B. Delete memories associated with this user
    await mongoose.connection.db.collection('memories').deleteMany(
      {
        $or: [
          { userId: userDoc._id },
          { userId: userDoc._id.toString() },
          { userId: uid }
        ]
      },
      session ? { session } : {}
    );

    // C. Delete memory likes and favorites associated with this user
    await mongoose.connection.db.collection('memory_likes').deleteMany(
      {
        $or: [
          { userId: userDoc._id },
          { userId: userDoc._id.toString() }
        ]
      },
      session ? { session } : {}
    );

    await mongoose.connection.db.collection('memory_favorites').deleteMany(
      {
        $or: [
          { userId: userDoc._id },
          { userId: userDoc._id.toString() }
        ]
      },
      session ? { session } : {}
    );

    // D. Finally delete the user document itself
    await User.deleteOne({ _id: userDoc._id }, session ? { session } : {});

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    res.json({ message: "Account and related data successfully deleted from database." });
  } catch (error) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    console.error("Error in DELETE /api/users/:uid:", error);
    res.status(500).json({ error: "Failed to delete account from database: " + error.message });
  }
});

module.exports = router;
