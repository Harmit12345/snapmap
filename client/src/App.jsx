import React, { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, deleteUser, linkWithPhoneNumber, RecaptchaVerifier } from "firebase/auth";
import { auth } from "./firebase";
import {
  Calendar,
  Lock,
  Globe,
  Users,
  UserCheck,
  UserPlus,
  Trash2,
  Save,
  BookOpen,
  Heart,
  Sparkles,
  Info,
  CheckCircle,
  AlertCircle,
  Eye,
  Clock,
} from "lucide-react";
import CloudinaryUpload from "./components/CloudinaryUpload";
import AuthPage from "./components/AuthPage";

function App() {
  const [user, setUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Active viewed profile state ('me' or target user MongoDB ID)
  const [viewedUserId, setViewedUserId] = useState("me");

  // Tab State: 'view' or 'edit'
  const [activeTab, setActiveTab] = useState("view");

  // Sub-Tab state inside the Relations Manager: 'counts' or 'requests'
  const [relationsTab, setRelationsTab] = useState("counts");

  // Logged-in user's MongoDB profile state
  const [mongoUser, setMongoUser] = useState(null);
  
  // Other real users fetched from the database
  const [otherUsers, setOtherUsers] = useState([]);

  // Pending incoming follow requests for the logged-in user
  const [pendingRequests, setPendingRequests] = useState([]);

  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Helper to format/sanitize display names (especially for phone numbers)
  const getCleanDisplayName = (profileName) => {
    if (profileName) {
      // Prioritize explicit display name. If it looks like a phone number, extract suffix
      if (/^\+?[0-9\s-]{7,15}$/.test(profileName)) {
        const lastFour = profileName.slice(-4);
        return `User_${lastFour}`;
      }
      return profileName;
    }

    // Fallback: Check if the logged-in Firebase user has a phone number set
    const firebasePhone = auth.currentUser?.phoneNumber;
    if (firebasePhone) {
      const lastFour = firebasePhone.slice(-4);
      return `User_${lastFour}`;
    }

    return "New User";
  };

  // Edit Profile Form State
  const [editFullName, setEditFullName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editPrivacy, setEditPrivacy] = useState("public");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // Phone Linking form states
  const [linkPhone, setLinkPhone] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);

  // Mock stories for the logged-in user
  const [myStories, setMyStories] = useState([
    { id: 101, title: "First Story!", content: "Starting my journey on StoryShare. Excited to share memories and locations here!", likes: 12, date: "Just now" },
  ]);
  const [newStoryTitle, setNewStoryTitle] = useState("");
  const [newStoryContent, setNewStoryContent] = useState("");

  // Subscribe to Firebase Authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          const res = await fetch("http://localhost:5050/api/users/me", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            setMongoUser(data);
            setUser(firebaseUser);
            setEditFullName(data.profile?.displayName || "");
            setEditUsername(data.firebaseUid || "");
            setEditBio(data.profile?.bio || "");
            setEditPrivacy(data.profile?.privacySetting || "public");
            setEditEmail(data.email || "");
            setEditPhone(data.phoneNumber || "");
          } else {
            // User authenticated in Firebase, but profile not found in MongoDB (404)
            setUser(firebaseUser);
            setMongoUser(null);
          }
        } catch (err) {
          console.error("Error fetching initial user profile:", err);
          setUser(null);
          setMongoUser(null);
        }
      } else {
        setUser(null);
        setMongoUser(null);
      }
      setIsLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  // 1. Fetch logged-in user's profile from MongoDB
  const fetchMyProfile = useCallback(async () => {
    try {
      setLoading(true);
      if (!auth.currentUser) return;
      const token = await auth.currentUser.getIdToken();

      const res = await fetch("http://localhost:5050/api/users/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setMongoUser(data);
        // Prepopulate edit form
        setEditFullName(data.profile?.displayName || "");
        setEditUsername(data.firebaseUid || "");
        setEditBio(data.profile?.bio || "");
        setEditPrivacy(data.profile?.privacySetting || "public");
        setEditEmail(data.email || "");
        setEditPhone(data.phoneNumber || "");
        setError("");
      } else {
        console.warn("User profile not found in MongoDB yet.");
        setError("MongoDB profile not found.");
      }
    } catch (err) {
      console.error("Error fetching MongoDB profile:", err);
      setError("Unable to connect to the backend server.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch other real database users (excluding me) to populate sidebar
  const fetchOtherUsers = useCallback(async () => {
    try {
      console.log("🔄 fetchOtherUsers called");
      if (!auth.currentUser) {
        console.log("⚠️ fetchOtherUsers: No auth.currentUser");
        return;
      }
      const token = await auth.currentUser.getIdToken();

      const res = await fetch("http://localhost:5050/api/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("📡 fetchOtherUsers: Response status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("✅ fetchOtherUsers: Loaded other users count:", data.length);
        setOtherUsers(data);
      } else {
        console.log("❌ fetchOtherUsers: Response not ok");
      }
    } catch (err) {
      console.error("❌ Error fetching other database users:", err);
    }
  }, []);

  // 3. Fetch incoming pending follow requests
  const fetchPendingRequests = useCallback(async () => {
    try {
      if (!auth.currentUser) return;
      const token = await auth.currentUser.getIdToken();

      const res = await fetch("http://localhost:5050/api/follow/requests", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setPendingRequests(data);
      }
    } catch (err) {
      console.error("Error fetching pending requests:", err);
    }
  }, []);

  // Initialize profile and user lists on login
  useEffect(() => {
    if (user) {
      fetchMyProfile();
      fetchOtherUsers();
      fetchPendingRequests();
    }
  }, [user, fetchMyProfile, fetchOtherUsers, fetchPendingRequests]);

  // 4. Handle profile update form submission (PATCH /api/users/me)
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSuccess("");
    setError("");
    setLoading(true);

    try {
      if (!auth.currentUser) return;
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("http://localhost:5050/api/users/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName: editFullName,
          bio: editBio,
          privacySetting: editPrivacy,
          email: editEmail,
          phoneNumber: editPhone,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMongoUser(data);
        setSuccess("Profile settings saved to database successfully!");
        fetchOtherUsers();
        setActiveTab("view");
      } else {
        setError(data.error || "Failed to update profile.");
      }
    } catch (err) {
      console.error(err);
      setError("Server connection issue.");
    } finally {
      setLoading(false);
    }
  };

  // Handle account and profile deletion
  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to permanently delete your account? This action cannot be undone.")) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error("No authenticated user session found.");
      }

      const token = await firebaseUser.getIdToken();

      // A. Delete user profile and all associated data from MongoDB first
      const res = await fetch(`http://localhost:5050/api/users/${firebaseUser.uid}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete MongoDB database records.");
      }

      // B. Delete user from Firebase Authentication
      try {
        await deleteUser(firebaseUser);
      } catch (fbErr) {
        console.error("Firebase deletion failed:", fbErr);
        if (fbErr.code === "auth/requires-recent-login") {
          throw new Error("For security reasons, you must log out and log back in before you can delete your account.");
        }
        throw new Error(`Database record cleared, but Firebase auth deletion failed: ${fbErr.message}`);
      }

      alert("Your account and all associated data have been successfully deleted.");
      window.location.reload();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to complete account deletion.");
      alert(`Account Deletion Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle Send Link Verification OTP Code
  const handleSendLinkCode = async (e) => {
    e.preventDefault();
    setLinkLoading(true);
    setSuccess("");
    setError("");
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        throw new Error("No active user session.");
      }

      // Check if reCAPTCHA element container exists
      let verifier = window.recaptchaVerifier;
      if (!verifier) {
        const containerEl = document.getElementById("link-recaptcha-container") || document.getElementById("recaptcha-container");
        if (!containerEl) {
          const div = document.createElement("div");
          div.id = "link-recaptcha-container";
          document.body.appendChild(div);
        }
        verifier = new RecaptchaVerifier(auth, "link-recaptcha-container", {
          size: "invisible",
        });
        window.recaptchaVerifier = verifier;
      }

      const confirmation = await linkWithPhoneNumber(firebaseUser, linkPhone, verifier);
      window.linkConfirmationResult = confirmation;
      setLinkSent(true);
      setSuccess("Verification SMS code sent successfully!");
    } catch (err) {
      console.error("Link phone error:", err);
      setError(err.message || "Failed to send verification SMS.");
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (cErr) {
          console.error(cErr);
        }
        window.recaptchaVerifier = null;
      }
    } finally {
      setLinkLoading(false);
    }
  };

  // Handle Verify OTP and Link Account
  const handleConfirmLink = async (e) => {
    e.preventDefault();
    setLinkLoading(true);
    setSuccess("");
    setError("");
    try {
      if (!window.linkConfirmationResult) {
        throw new Error("No pending verification session found.");
      }
      await window.linkConfirmationResult.confirm(linkCode);
      
      // Perform database sync to link phone details to Mongoose User
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("http://localhost:5050/api/users/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error("Linked in Firebase successfully, but failed to sync details to database.");
      }

      const data = await res.json();
      setMongoUser(data);
      setLinkSent(false);
      setLinkPhone("");
      setLinkCode("");
      setSuccess("Phone number successfully linked to your profile!");
    } catch (err) {
      console.error("Link verification failed:", err);
      setError(err.message || "Invalid or expired OTP code.");
    } finally {
      setLinkLoading(false);
    }
  };

  // 5. Follow / Request / Unfollow / Cancel sent follow request API Call Actions
  const handleFollowToggle = async (targetUser) => {
    const isPendingOrAccepted = targetUser.followStatus && targetUser.followStatus !== "none";
    const url = `http://localhost:5050/api/follow/${targetUser._id}`;
    const method = isPendingOrAccepted ? "DELETE" : "POST";

    try {
      if (!auth.currentUser) return;
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        await fetchMyProfile();
        await fetchOtherUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to toggle follow status");
      }
    } catch (err) {
      console.error("Error toggling follow status:", err);
    }
  };

  // 6. Approve Follow Request
  const handleApproveRequest = async (requesterId) => {
    try {
      if (!auth.currentUser) return;
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`http://localhost:5050/api/follow/approve/${requesterId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        await fetchMyProfile();
        await fetchOtherUsers();
        await fetchPendingRequests();
      } else {
        const data = await res.json();
        alert(data.error || "Approval failed");
      }
    } catch (err) {
      console.error("Error approving request:", err);
    }
  };

  // 7. Decline Follow Request
  const handleDeclineRequest = async (requesterId) => {
    try {
      if (!auth.currentUser) return;
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`http://localhost:5050/api/follow/decline/${requesterId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        await fetchPendingRequests();
      } else {
        const data = await res.json();
        alert(data.error || "Decline failed");
      }
    } catch (err) {
      console.error("Error declining request:", err);
    }
  };

  // Add a story to my feed (local mock store for demo)
  const handleAddStory = (e) => {
    e.preventDefault();
    if (!newStoryTitle || !newStoryContent) return;

    const newStory = {
      id: Date.now(),
      title: newStoryTitle,
      content: newStoryContent,
      likes: 0,
      date: "Just now",
    };

    setMyStories([newStory, ...myStories]);
    setNewStoryTitle("");
    setNewStoryContent("");
  };

  // Find viewed user object (either 'me' or one of the database users)
  const getActiveViewUser = () => {
    if (viewedUserId === "me") {
      return {
        isSelf: true,
        displayName: getCleanDisplayName(mongoUser?.profile?.displayName) || "Loading profile...",
        username: mongoUser?.profile?.displayName ? getCleanDisplayName(mongoUser.profile.displayName).toLowerCase().replace(/[\s+]+/g, '') : "me",
        photoUrl: mongoUser?.profile?.photoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        bio: mongoUser?.profile?.bio || "No biography added yet.",
        privacySetting: mongoUser?.profile?.privacySetting || "public",
        followersCount: mongoUser?.followersCount || 0,
        followingCount: mongoUser?.followingCount || 0,
        joinedDate: mongoUser ? new Date(mongoUser.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long" }) : "July 2026",
        stories: myStories,
      };
    }

    const dbUser = otherUsers.find((u) => u._id === viewedUserId);
    if (dbUser) {
      return {
        ...dbUser,
        isSelf: false,
        photoUrl: dbUser.profile?.photoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        displayName: getCleanDisplayName(dbUser.profile?.displayName) || "Other User",
        username: dbUser.firebaseUid ? `user_${dbUser.firebaseUid.substring(0, 8)}` : "user",
        bio: dbUser.profile?.bio || "No biography added yet.",
        privacySetting: dbUser.profile?.privacySetting || "public",
        followStatus: dbUser.followStatus || "none",
        joinedDate: new Date(dbUser.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long" }),
        stories: [
          {
            id: 1,
            title: "Spatial Log",
            content: `Hey! I am sharing a spatial memory. My privacy setting is configured to ${dbUser.profile?.privacySetting || "public"}.`,
            likes: 18,
            date: "3 days ago",
          },
        ],
      };
    }

    return {
      isSelf: false,
      displayName: "Loading profile...",
      photoUrl: "",
      bio: "",
      privacySetting: "public",
      followStatus: "none",
      joinedDate: "July 2026",
      stories: [],
    };
  };

  const activeProfile = getActiveViewUser();

  // Real Privacy Gating Evaluation Logic (requires 'accepted' status to unlock)
  const isProfileLocked = () => {
    if (activeProfile.isSelf) return false;
    const isFollower = activeProfile.followStatus === "accepted"; // Requires accepted status
    if (activeProfile.privacySetting === "private" && !isFollower) return true;
    if (activeProfile.privacySetting === "followers" && !isFollower) return true;
    return false;
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || !mongoUser) {
    return (
      <AuthPage
        onProfileSynced={(firebaseUser, mongoProfile) => {
          setMongoUser(mongoProfile);
          setUser(firebaseUser);
        }}
      />
    );
  }

  const isLocked = isProfileLocked();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setViewedUserId("me")}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-200">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            StoryShare
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
            <span className="text-sm font-medium text-gray-600">
              {getCleanDisplayName(mongoUser?.profile?.displayName) || "Logged-in User"}
            </span>
            <button
              onClick={() => auth.signOut()}
              className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1 rounded-full font-bold transition cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-10 gap-8 items-start">
          
          {/* Left Column (Main Content) - 70% width */}
          <div className="md:col-span-7 space-y-6">
            
            {/* Tab Navigation (Visible if viewing self) */}
            {viewedUserId === "me" && (
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab("view")}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                    activeTab === "view"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  View My Profile
                </button>
                <button
                  onClick={() => setActiveTab("edit")}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                    activeTab === "edit"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Edit Profile & Privacy
                </button>
              </div>
            )}

            {/* View Profile View */}
            {(viewedUserId !== "me" || activeTab === "view") && (
              <div className="space-y-6">
                {/* Profile Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
                  {/* Blue gradient banner */}
                  <div className="h-32 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 relative">
                    <div className="absolute top-4 right-4 flex space-x-2">
                      {activeProfile.privacySetting === "public" ? (
                        <span className="flex items-center space-x-1 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold text-white border border-white/30">
                          <Globe className="w-3.5 h-3.5" />
                          <span>Public</span>
                        </span>
                      ) : activeProfile.privacySetting === "followers" ? (
                        <span className="flex items-center space-x-1 px-3 py-1 bg-amber-500/25 backdrop-blur-md rounded-full text-xs font-semibold text-amber-200 border border-amber-500/30">
                          <Users className="w-3.5 h-3.5" />
                          <span>Followers Only</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 px-3 py-1 bg-red-500/25 backdrop-blur-md rounded-full text-xs font-semibold text-red-200 border border-red-500/30">
                          <Lock className="w-3.5 h-3.5" />
                          <span>Private</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="px-6 pb-6 pt-1 relative">
                    {/* Avatar Overlay */}
                    <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden absolute -top-12 left-6 bg-gray-200">
                      <img
                        src={activeProfile.photoUrl}
                        alt={activeProfile.displayName}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Header Controls (Follow / Requested / Following button states) */}
                    <div className="flex justify-end pt-3 h-12 items-center">
                      {activeProfile._id === mongoUser?._id || activeProfile.isSelf ? (
                        <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full font-semibold border border-gray-200">
                          Self
                        </span>
                      ) : (
                        <button
                          onClick={() => handleFollowToggle(activeProfile)}
                          className={`px-4 py-1.5 rounded-full text-sm font-semibold flex items-center space-x-1.5 transition-all ${
                            activeProfile.followStatus === "accepted"
                              ? "bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
                              : activeProfile.followStatus === "pending"
                              ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 cursor-pointer"
                              : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200 cursor-pointer"
                          }`}
                        >
                          {activeProfile.followStatus === "accepted" ? (
                            <>
                              <UserCheck className="w-4 h-4" />
                              <span>Following</span>
                            </>
                          ) : activeProfile.followStatus === "pending" ? (
                            <>
                              <Clock className="w-4 h-4 animate-pulse" />
                              <span>Requested</span>
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-4 h-4" />
                              <span>Follow</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Bio Details */}
                    <div className="mt-4 text-left">
                      <div className="flex items-center space-x-2">
                        <h2 className="text-xl font-bold text-gray-900">
                          {activeProfile.displayName}
                        </h2>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md capitalize">
                          {activeProfile.privacySetting}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 font-mono mt-0.5">
                        @{activeProfile.username || "user"}
                      </p>
                      <p className="mt-3 text-sm text-gray-700 leading-relaxed">
                        {activeProfile.bio}
                      </p>

                      <div className="mt-4 flex items-center text-xs text-gray-400 space-x-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Joined {activeProfile.joinedDate}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Relations Manager */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-left space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-55 pb-2">
                    <h3 className="font-bold text-gray-900 flex items-center space-x-2">
                      <Users className="w-5 h-5 text-gray-400" />
                      <span>Relations Manager</span>
                    </h3>
                    
                    {/* Sub-tabs only visible on self profile */}
                    {activeProfile.isSelf && (
                      <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs">
                        <button
                          onClick={() => setRelationsTab("counts")}
                          className={`px-3 py-1 rounded-md font-semibold transition ${
                            relationsTab === "counts" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
                          }`}
                        >
                          Counts
                        </button>
                        <button
                          onClick={() => setRelationsTab("requests")}
                          className={`px-3 py-1 rounded-md font-semibold transition flex items-center space-x-1 ${
                            relationsTab === "requests" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
                          }`}
                        >
                          <span>Requests</span>
                          {pendingRequests.length > 0 && (
                            <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.2 rounded-full">
                              {pendingRequests.length}
                            </span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* View Counts Panel */}
                  {(viewedUserId !== "me" || relationsTab === "counts") && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                        <p className="text-2xl font-black text-blue-600">
                          {activeProfile.followersCount}
                        </p>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">
                          Followers
                        </p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                        <p className="text-2xl font-black text-indigo-600">
                          {activeProfile.followingCount}
                        </p>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">
                          Following
                        </p>
                      </div>
                    </div>
                  )}

                  {/* View Requests Panel (Approve Queue) */}
                  {activeProfile.isSelf && relationsTab === "requests" && (
                    <div className="space-y-3">
                      {pendingRequests.length === 0 ? (
                        <div className="p-6 bg-gray-50 rounded-xl text-center">
                          <p className="text-xs text-gray-400">No pending follow requests.</p>
                          <p className="text-[10px] text-gray-300 mt-1">Private profiles will prompt incoming approvals here.</p>
                        </div>
                      ) : (
                        pendingRequests.map((reqDoc) => (
                          <div
                            key={reqDoc._id}
                            className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between hover:border-gray-200 transition"
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <img
                                src={reqDoc.followerId?.profile?.photoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}
                                alt={reqDoc.followerId?.profile?.displayName}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-800 truncate">
                                  {getCleanDisplayName(reqDoc.followerId?.profile?.displayName) || "Other User"}
                                </p>
                                <p className="text-[9px] font-mono text-gray-400 truncate">
                                  @{reqDoc.followerId?.firebaseUid ? `user_${reqDoc.followerId.firebaseUid.substring(0, 8)}` : "user"}
                                </p>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleApproveRequest(reqDoc.followerId?._id)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => handleDeclineRequest(reqDoc.followerId?._id)}
                                className="px-3 py-1.5 border border-gray-200 hover:bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold transition"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Feed and privacy block evaluation */}
                {isLocked ? (
                  <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center space-y-4">
                    <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto border border-amber-100 text-amber-500">
                      <Lock className="w-8 h-8 animate-pulse" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">This profile is private</h3>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto">
                      Your follow request is currently pending. Wait for @{activeProfile.displayName} to approve your request.
                    </p>
                    <button
                      onClick={() => handleFollowToggle(activeProfile)}
                      className="px-6 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 shadow-md animate-pulse"
                    >
                      Cancel Request
                    </button>
                  </div>
                ) : (
                  /* Shared Memories & Stories Feed Box */
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-left space-y-6">
                    <div className="flex justify-between items-center border-b border-gray-55 pb-4">
                      <h3 className="font-bold text-gray-900 flex items-center space-x-2">
                        <BookOpen className="w-5 h-5 text-gray-400" />
                        <span>Shared Memories & Stories</span>
                      </h3>
                      <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-semibold">
                        {activeProfile.stories.length} Posts
                      </span>
                    </div>

                    {/* Create Story Form (Only visible on self-profile) */}
                    {activeProfile.isSelf && (
                      <form onSubmit={handleAddStory} className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Publish New Memory</h4>
                        <input
                          type="text"
                          placeholder="Memory Title"
                          value={newStoryTitle}
                          onChange={(e) => setNewStoryTitle(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                          required
                        />
                        <textarea
                          placeholder="What did you experience? Tag location here..."
                          rows="2"
                          value={newStoryContent}
                          onChange={(e) => setNewStoryContent(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                          required
                        ></textarea>
                        <button
                          type="submit"
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
                        >
                          Publish Story
                        </button>
                      </form>
                    )}

                    {/* Stories Feed */}
                    <div className="space-y-4">
                      {activeProfile.stories.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">No stories shared yet.</p>
                      ) : (
                        activeProfile.stories.map((story) => (
                          <div key={story.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-all">
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-gray-900 text-base">{story.title}</h4>
                              <span className="text-xs text-gray-400">{story.date}</span>
                            </div>
                            <p className="mt-2 text-sm text-gray-600 leading-relaxed">{story.content}</p>
                            <div className="mt-3 flex items-center space-x-1.5 text-xs text-gray-400">
                              <Heart className="w-3.5 h-3.5 fill-red-400 text-red-400" />
                              <span>{story.likes} Likes</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Edit Profile & Privacy View */}
            {viewedUserId === "me" && activeTab === "edit" && (
              <>
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-left space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Profile Settings</h3>
                  <p className="text-sm text-gray-400">Modify your card layout, visual metadata, and public privacy gates.</p>
                </div>

                {/* Cloudinary Widget for changing photo */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col md:flex-row items-center gap-6">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 border border-gray-300 flex-shrink-0">
                    <img
                      src={mongoUser?.profile?.photoUrl || user?.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}
                      alt="Profile Placeholder"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 w-full text-center md:text-left">
                    <h4 className="text-sm font-bold text-gray-700">Update Profile Avatar</h4>
                    <p className="text-xs text-gray-400 mb-2">Upload a picture to save directly to your MongoDB record.</p>
                    
                    {/* Integrated Cloudinary Component */}
                    <CloudinaryUpload onUploadSuccess={() => fetchMyProfile()} />
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  {/* Status Display */}
                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>{error}</span>
                    </div>
                  )}
                  {success && (
                    <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>{success}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                      <input
                        type="text"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                        placeholder="Your display name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Username Handle</label>
                      <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm">
                          @
                        </span>
                        <input
                          type="text"
                          value={editUsername}
                          disabled
                          className="w-full px-3 py-2 border border-gray-200 rounded-r-lg text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                          placeholder="Firebase account ID"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-gray-500 uppercase">Biography</label>
                      <span className="text-xs text-gray-400">{editBio.length}/500</span>
                    </div>
                    <textarea
                      rows="3"
                      maxLength="500"
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                      placeholder="Write a little about yourself, locations you explore..."
                    ></textarea>
                  </div>

                  <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email Address</label>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-white"
                          placeholder="email@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone Number</label>
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-white"
                          placeholder="+919876543210"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Privacy Gating Mode</label>
                    <select
                      value={editPrivacy}
                      onChange={(e) => setEditPrivacy(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="public">Public</option>
                      <option value="followers">Followers Only</option>
                      <option value="private">Private</option>
                    </select>
                    <div className="mt-1.5 p-2.5 bg-gray-50 rounded-lg text-xs text-gray-500 border border-gray-100">
                      {editPrivacy === "public" && (
                        <p>🌐 <strong>Public:</strong> Anyone can search and view your profile, counts, and feed.</p>
                      )}
                      {editPrivacy === "followers" && (
                        <p>👥 <strong>Followers Only:</strong> Anyone can search you, but your feed remains hidden unless they follow you.</p>
                      )}
                      {editPrivacy === "private" && (
                        <p>🔒 <strong>Private:</strong> Hide all feed stories and profile details. Users must follow you to see anything.</p>
                      )}
                    </div>
                  </div>

                  {/* Bottom controls */}
                  <div className="flex justify-between pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={loading}
                      className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-lg flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Account</span>
                    </button>

                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab("view")}
                        className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-sm font-semibold rounded-lg text-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-md flex items-center space-x-1.5 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        <span>{loading ? "Saving..." : "Save Changes"}</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Account Linking Panel */}
              {auth.currentUser && !auth.currentUser.phoneNumber && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-left space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Link Phone Number</h3>
                    <p className="text-xs text-gray-400">Merge SMS verification access into your existing profile.</p>
                  </div>

                  {!linkSent ? (
                    <form onSubmit={handleSendLinkCode} className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="tel"
                        value={linkPhone}
                        onChange={(e) => setLinkPhone(e.target.value)}
                        placeholder="+919876543210 (include country code)"
                        required
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={linkLoading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 cursor-pointer"
                      >
                        {linkLoading ? "Sending..." : "Send Verification SMS"}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleConfirmLink} className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        value={linkCode}
                        onChange={(e) => setLinkCode(e.target.value)}
                        placeholder="6-digit OTP code"
                        required
                        maxLength="6"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 text-center font-mono"
                      />
                      <button
                        type="submit"
                        disabled={linkLoading}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 cursor-pointer"
                      >
                        {linkLoading ? "Verifying..." : "Verify & Link"}
                      </button>
                    </form>
                  )}
                  <div id="link-recaptcha-container"></div>
                </div>
              )}
            </>
          )}
          </div>

          {/* Right Column (Simulation Controller) - 30% width */}
          <div className="md:col-span-3 space-y-6 md:sticky md:top-24">
            <div className="bg-gray-100 p-5 rounded-2xl text-left border border-gray-200 shadow-sm space-y-5">
              <div>
                <h3 className="font-bold text-gray-800 flex items-center space-x-1.5">
                  <Eye className="w-5 h-5 text-gray-500" />
                  <span>Simulation Controller</span>
                </h3>
                <p className="text-xs text-gray-500 mt-1">Select and follow other real database users to verify privacy gating rules.</p>
              </div>

              {/* Section 1: Active Session (Viewer) */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Session (Viewer)</h4>
                <div className="bg-green-50 border border-green-200 p-3.5 rounded-xl flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-green-300">
                    <img
                      src={mongoUser?.profile?.photoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}
                      alt="Logged In User"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-green-800 truncate">
                      {getCleanDisplayName(mongoUser?.profile?.displayName) || "Logged-in User"}
                    </p>
                    <p className="text-[10px] text-green-600 font-mono">MongoDB Connected</p>
                  </div>
                </div>
              </div>

              {/* Section 2: View Target Profile */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">View Target Profile</h4>
                
                <div className="space-y-2">
                  {/* Logged in User Select */}
                  <button
                    onClick={() => setViewedUserId("me")}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                      viewedUserId === "me"
                        ? "bg-blue-600 text-white border-blue-700 shadow-sm animate-fade-in"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <span>👤 Logged-in Profile (You)</span>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-black/10">Self</span>
                  </button>

                  {/* Real users list from MongoDB */}
                  {otherUsers.length === 0 ? (
                    <div className="p-4 bg-white rounded-xl border border-gray-200 text-center space-y-1">
                      <p className="text-xs text-gray-400">No other database users found.</p>
                      <p className="text-[10px] text-gray-300 mt-0.5">Try logging in with another test account or check MongoDB.</p>
                    </div>
                  ) : (
                    otherUsers.map((target) => (
                      <div key={target._id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <button
                          onClick={() => {
                            setViewedUserId(target._id);
                            setActiveTab("view");
                          }}
                          className={`w-full p-3 text-left flex items-center space-x-2.5 transition-all ${
                            viewedUserId === target._id
                              ? "bg-blue-50 border-l-4 border-blue-600"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <img
                            src={target.profile?.photoUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"}
                            alt={target.profile?.displayName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-gray-800 truncate">
                              {getCleanDisplayName(target.profile?.displayName) || "Other User"}
                            </p>
                            <p className="text-[9px] font-mono text-gray-400 truncate">
                               @{target.firebaseUid ? `user_${target.firebaseUid.substring(0, 8)}` : "user"}
                            </p>
                          </div>
                          
                          {/* Privacy badge */}
                          {target.profile?.privacySetting === "private" ? (
                            <span className="text-[8px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono uppercase">Private</span>
                          ) : target.profile?.privacySetting === "followers" ? (
                            <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-mono uppercase">Followers</span>
                          ) : (
                            <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-mono uppercase">Public</span>
                          )}
                        </button>
                        
                        {/* Real Follow Status Toggle */}
                        <div className="bg-gray-50 border-t border-gray-100 px-3 py-1.5 flex items-center justify-between text-[10px]">
                          <span className="text-gray-400 font-semibold">Follow Status:</span>
                          {target._id === mongoUser?._id ? (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-bold border border-gray-200">
                              SELF
                            </span>
                          ) : (
                            <button
                              onClick={() => handleFollowToggle(target)}
                              className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                                target.followStatus === "accepted"
                                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                                  : target.followStatus === "pending"
                                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                              }`}
                            >
                              {target.followStatus === "accepted"
                                ? "FOLLOWING"
                                : target.followStatus === "pending"
                                ? "REQUESTED"
                                : "FOLLOW"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-2 text-[10px] text-gray-400 border-t border-gray-200 flex items-center space-x-1">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Updates counts on follower documents in real-time.</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer info */}
      <footer className="py-6 border-t border-gray-100 text-center text-xs text-gray-400 mt-12 bg-white">
        <p>© 2026 StoryShare Dashboard. Designed for pairing MongoDB & Firebase authentication.</p>
      </footer>
    </div>
  );
}

export default App;
