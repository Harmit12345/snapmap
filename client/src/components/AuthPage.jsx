import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  linkWithPhoneNumber,
  sendPasswordResetEmail,
  deleteUser,
} from "firebase/auth";
import { auth } from "../firebase";
import {
  Mail,
  Lock,
  Phone,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";

export default function AuthPage({ onProfileSynced }) {
  const syncInProgress = useRef(false);
  const lastSyncedUid = useRef(null);
  const loginFlowActive = useRef(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Authentication mode: "email" or "phone"
  const [authMethod, setAuthMethod] = useState("email");

  // Syncing state
  const [syncing, setSyncing] = useState(false);

  // Forgot password form toggle state
  const [showForgotPasswordForm, setShowForgotPasswordForm] = useState(false);

  // Email form inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Phone form inputs
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Phone linking during email sign-up
  const [signUpPhone, setSignUpPhone] = useState("");
  const [linkingPhone, setLinkingPhone] = useState(false);
  const [linkOtp, setLinkOtp] = useState("");

  // Loading and error states
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Guaranteed Sync helper function
  const syncUserToDatabase = useCallback(async (firebaseUser, forceSignUp, customName) => {
    const idToken = await firebaseUser.getIdToken();
    const activeIsSignUp = forceSignUp !== undefined ? forceSignUp : isSignUp;
    const res = await fetch("http://localhost:5050/api/users/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        uid: firebaseUser.uid,
        phoneNumber: firebaseUser.phoneNumber || (signUpPhone ? signUpPhone.trim() : undefined) || undefined,
        email: firebaseUser.email || undefined,
        isSignUp: activeIsSignUp,
        username: customName || undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Profile sync failed.");
    }
    return data;
  }, [isSignUp, signUpPhone]);

  // Post-authenticate check: Sync Firebase auth identity with MongoDB document
  const handleAuthSuccess = useCallback(async (firebaseUser) => {
    if (!firebaseUser) return;
    if (syncInProgress.current || lastSyncedUid.current === firebaseUser.uid) {
      console.log("Sync already in progress or completed for UID:", firebaseUser.uid);
      return;
    }
    syncInProgress.current = true;
    lastSyncedUid.current = firebaseUser.uid;

    setSyncing(true);
    setAuthError("");
    try {
      let mongoProfile;

      if (isSignUp) {
        // Direct Sign-Up flow: prompt for name first
        const firstName = window.prompt("Enter your First Name to complete registration:");
        if (firstName === null) {
          lastSyncedUid.current = null;
          throw new Error("Registration cancelled: Missing first name.");
        }
        const lastName = window.prompt("Enter your Last Name to complete registration:");
        if (lastName === null) {
          lastSyncedUid.current = null;
          throw new Error("Registration cancelled: Missing last name.");
        }
        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || firebaseUser.displayName || "New User";

        mongoProfile = await syncUserToDatabase(firebaseUser, true, fullName);
      } else {
        // Sign-In flow: try syncing as an existing user
        try {
          mongoProfile = await syncUserToDatabase(firebaseUser, false);
        } catch (err) {
          if (err.message.includes("No account found")) {
            // No profile exists — sign out and redirect to the sign-up page
            await auth.signOut();
            alert("Account not found. Sign up first!");
            setAuthError("Account not found. Sign up first!");
            setIsSignUp(true);
            setSyncing(false);
            lastSyncedUid.current = null;
            syncInProgress.current = false;
            return;
          } else {
            throw err; // Rethrow other errors
          }
        }
      }

      // Sync verified, redirect user to the dashboard
      if (onProfileSynced && mongoProfile) {
        onProfileSynced(firebaseUser, mongoProfile);
      }
    } catch (err) {
      console.error("Sync error:", err);
      const errMsg = err.message || "Failed to sync user profile with MongoDB.";
      setAuthError(errMsg);
      // Trigger alert with the error message
      alert(`Sync Failure: ${errMsg}`);
      await auth.signOut();
      lastSyncedUid.current = null;
    } finally {
      setSyncing(false);
      syncInProgress.current = false;
    }
  }, [onProfileSynced, syncUserToDatabase, isSignUp]);

  // Initialize invisible Recaptcha Verifier exactly once when component mounts
  useEffect(() => {
    // Only initialize verifier if user is not already authenticated
    if (!auth.currentUser) {
      lastSyncedUid.current = null;
      try {
        const containerEl = document.getElementById("recaptcha-container");
        if (containerEl && !window.recaptchaVerifier) {
          window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
            size: "invisible",
            callback: (_response) => {
              // reCAPTCHA solved
            },
            "expired-callback": () => {
              setAuthError("reCAPTCHA session expired. Please try again.");
            }
          });
        }
      } catch (error) {
        console.error("Failed to initialize RecaptchaVerifier on mount:", error);
      }
    }

    // Auto-sync if Firebase already has an active session but MongoDB profile is missing
    const autoSyncOnMount = async () => {
      // Do not auto-sync if we are in the middle of executing a login flow
      if (auth.currentUser && !isLoggingIn && !loginFlowActive.current) {
        await handleAuthSuccess(auth.currentUser);
      }
    };
    autoSyncOnMount();

    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {
          console.error("Error clearing recaptchaVerifier on unmount:", e);
        }
        window.recaptchaVerifier = null;
      }
    };
  }, [handleAuthSuccess, isLoggingIn]);

  // Handle Password Reset Email Sending
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setAuthError("Please enter your email address first.");
      return;
    }
    setLoading(true);
    setAuthError("");
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset link sent to your email.");
      setShowForgotPasswordForm(false);
    } catch (err) {
      console.error("Password reset error:", err);
      let errMsg = err.message || "Failed to send password reset email.";
      if (err.code === "auth/user-not-found") {
        errMsg = "No user found with this email address.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "Invalid email address format.";
      }
      setAuthError(errMsg);
      // Trigger alert with the error message
      alert(`Password Reset Failure: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // 1. Handle Sign In (Email + Password)
  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    loginFlowActive.current = true;
    setLoading(true);
    setAuthError("");

    try {
      // 1. Check if user exists in MongoDB first
      const checkRes = await fetch(`http://localhost:5050/api/users/exists?identifier=${encodeURIComponent(email)}`);
      const checkData = await checkRes.json();
      if (!checkData.exists) {
        alert("Account not found. Sign up first!");
        setAuthError("Account not found. Sign up first!");
        setIsSignUp(true);
        setLoading(false);
        return;
      }

      // If the identifier was a username, we use the resolved email for Firebase login
      const firebaseEmail = checkData.email || email;

      const userCredential = await signInWithEmailAndPassword(auth, firebaseEmail, password);
      await handleAuthSuccess(userCredential.user);
    } catch (err) {
      console.error(err);
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.message.includes("user-not-found") || err.message.includes("invalid-credential")) {
        alert("Sign in failed. If you registered via Google or Mobile, please use those buttons to sign in.");
        setAuthError("Sign in failed. If you registered via Google or Mobile, please use those buttons to sign in.");
      } else {
        setAuthError(err.message || "Invalid email or password.");
      }
    } finally {
      setLoading(false);
      loginFlowActive.current = false;
    }
  };

  // 2. Handle Sign Up (Email + Password)
  const handleEmailSignUp = async (e) => {
    e.preventDefault();
    loginFlowActive.current = true;
    setLoading(true);
    setAuthError("");

    try {
      // 1. Check if email already exists
      const checkEmailRes = await fetch(`http://localhost:5050/api/users/exists?identifier=${encodeURIComponent(email)}`);
      const checkEmailData = await checkEmailRes.json();
      if (checkEmailData.exists) {
        alert("Email is already linked to another account.");
        setAuthError("Email is already linked to another account.");
        setLoading(false);
        loginFlowActive.current = false;
        return;
      }

      // 2. Check if phone number already exists
      if (signUpPhone.trim()) {
        const checkPhoneRes = await fetch(`http://localhost:5050/api/users/exists?identifier=${encodeURIComponent(signUpPhone.trim())}`);
        const checkPhoneData = await checkPhoneRes.json();
        if (checkPhoneData.exists) {
          alert("Phone number is already linked to another account.");
          setAuthError("Phone number is already linked to another account.");
          setLoading(false);
          loginFlowActive.current = false;
          return;
        }
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Sync both email and phone directly to MongoDB upon registration
      await handleAuthSuccess(userCredential.user);
    } catch (err) {
      console.error(err);
      setAuthError(err.message || "Failed to create account.");
      alert(err.message || "Failed to create account.");
      if (auth.currentUser) await auth.signOut();
    } finally {
      setLoading(false);
      loginFlowActive.current = false;
    }
  };

  // 2b. Verify OTP and complete phone linking after email sign-up
  const handleSignUpLinkVerify = async (e) => {
    e.preventDefault();
    loginFlowActive.current = true;
    setLoading(true);
    setAuthError("");

    try {
      if (!window.signUpLinkConfirmation) {
        throw new Error("No active phone verification session found.");
      }
      await window.signUpLinkConfirmation.confirm(linkOtp);

      // Phone linked successfully — now sync both email and phone to MongoDB
      const firebaseUser = auth.currentUser;
      await handleAuthSuccess(firebaseUser);
    } catch (err) {
      console.error(err);
      setAuthError(err.message || "Invalid verification code.");
    } finally {
      setLoading(false);
      loginFlowActive.current = false;
    }
  };

  // 3. Handle Phone Auth Start (Send Verification SMS OTP)
  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    loginFlowActive.current = true;
    setIsLoggingIn(true);
    setLoading(true);
    setAuthError("");

    try {
      console.log("⚙️ Starting phone login for:", phoneNumber);

      // Check if user exists in MongoDB first
      const checkRes = await fetch(`http://localhost:5050/api/users/exists?identifier=${encodeURIComponent(phoneNumber)}`);
      const checkData = await checkRes.json();

      if (isSignUp) {
        if (checkData.exists) {
          alert("Phone number is already linked to another account. Please sign in instead.");
          setAuthError("Phone number is already linked to another account. Please sign in instead.");
          setIsSignUp(false); // Switch to sign-in
          setLoading(false);
          setIsLoggingIn(false);
          loginFlowActive.current = false;
          return;
        }
      } else {
        if (!checkData.exists) {
          alert("Account not found. Sign up first!");
          setAuthError("Account not found. Sign up first!");
          setIsSignUp(true); // Switch to sign-up
          setLoading(false);
          setIsLoggingIn(false);
          loginFlowActive.current = false;
          return;
        }
      }

      // 1. Explicit DOM Container Check
      const containerEl = document.getElementById("recaptcha-container");
      if (!containerEl) {
        const err = new Error("reCAPTCHA target container element (#recaptcha-container) is missing from DOM.");
        console.error("❌ reCAPTCHA DOM Error:", err);
        throw err;
      }

      // 2. Cleanup any stale/previously broken verifiers before starting a clean attempt
      if (window.recaptchaVerifier) {
        console.log("🧹 Clearing existing stale reCAPTCHA verifier...");
        try {
          await window.recaptchaVerifier.clear();
        } catch (clearErr) {
          console.error("⚠️ Failed to clear stale verifier:", clearErr);
        }
        window.recaptchaVerifier = null;
      }

      // 3. Construct and initialize RecaptchaVerifier
      console.log("🚀 Initializing new RecaptchaVerifier on #recaptcha-container...");
      try {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
          callback: (_response) => {
            console.log("✅ reCAPTCHA solved successfully.");
          },
          "expired-callback": () => {
            console.warn("⚠️ reCAPTCHA session expired.");
            setAuthError("reCAPTCHA session expired. Please try again.");
          }
        });
      } catch (verifierInitErr) {
        console.error("❌ Failed to construct RecaptchaVerifier:", verifierInitErr);
        throw new Error("reCAPTCHA verifier construction failed: " + verifierInitErr.message);
      }

      const appVerifier = window.recaptchaVerifier;

      // 4. Trigger SMS verification request
      console.log("📲 Calling signInWithPhoneNumber...");
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier);
      console.log("✅ Verification SMS OTP sent successfully.");
      window.confirmationResult = confirmationResult;
      setVerifying(true);
    } catch (err) {
      console.error("❌ Phone authentication error inside handlePhoneLogin:", err);
      setAuthError(err.message || "Failed to send SMS code. Check phone format (e.g. +919876543210).");

      // 5. Enforce cleanup on failure
      if (window.recaptchaVerifier) {
        console.log("🧹 Cleaning up reCAPTCHA verifier after failed attempt...");
        try {
          await window.recaptchaVerifier.clear();
        } catch (clearErr) {
          console.error("⚠️ Failed to clear verifier on catch:", clearErr);
        }
        window.recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
      setIsLoggingIn(false);
      loginFlowActive.current = false;
    }
  };

  // 4. Verify Phone SMS OTP Code
  const handlePhoneAuthVerify = async (e) => {
    e.preventDefault();
    loginFlowActive.current = true;
    setLoading(true);
    setAuthError("");

    try {
      const confirmationResult = window.confirmationResult;
      if (!confirmationResult) {
        throw new Error("No active phone verification session found.");
      }
      const result = await confirmationResult.confirm(verificationCode);
      await handleAuthSuccess(result.user);
    } catch (err) {
      console.error(err);
      setAuthError(err.message || "Invalid verification code.");
    } finally {
      setLoading(false);
      loginFlowActive.current = false;
    }
  };

  // 5. Google Sign In using GoogleAuthProvider
  const handleGoogleLogin = async () => {
    loginFlowActive.current = true;
    setLoading(true);
    setAuthError("");

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);

      // Verify if the user has an existing profile in MongoDB
      const token = await userCredential.user.getIdToken();
      const checkRes = await fetch("http://localhost:5050/api/users/check-profile", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!checkRes.ok) {
        // No MongoDB profile exists
        if (!isSignUp) {
          // Sign In mode: Block sign-in, delete the auto-created Firebase user, and redirect to Sign Up
          try {
            await deleteUser(userCredential.user);
          } catch (delErr) {
            console.error("Failed to clean up Firebase Auth user:", delErr);
            await auth.signOut();
          }
          alert("Account not found. Please sign up first!");
          setAuthError("Account not found. Please sign up first!");
          setIsSignUp(true);
          return;
        }
        // Sign Up mode: Proceed to handleAuthSuccess (which will prompt for First and Last name)
        await handleAuthSuccess(userCredential.user);
      } else {
        // Profile exists: Bypass name prompts by setting isSignUp to false and logging in
        setIsSignUp(false);
        await handleAuthSuccess(userCredential.user);
      }
    } catch (err) {
      console.error(err);
      setAuthError(err.message || "Google Authentication failed.");
    } finally {
      setLoading(false);
      loginFlowActive.current = false;
    }
  };

  const resetFormState = () => {
    setAuthError("");
    setVerifying(false);
    setVerificationCode("");
    setEmail("");
    setPassword("");
    setPhoneNumber("");
    setSignUpPhone("");
    setLinkingPhone(false);
    setLinkOtp("");
  };

  /* ================= STANDARD RENDER PIPELINE ================= */
  return (
    <>
      {/* invisible Recaptcha Verifier container - kept at the root of the React Fragment to prevent unmounting */}
      <div id="recaptcha-container"></div>

      {syncing ? (
        /* ================= VISUAL PROFILE SYNCING STATE SCREEN ================= */
        <div className="min-h-screen flex flex-col items-center justify-center bg-indigo-950 text-white font-sans p-6">
          <div className="space-y-6 max-w-sm text-center">
            <div className="w-16 h-16 bg-blue-500/10 rounded-2xl border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight">Syncing Profile...</h3>
              <p className="text-sm text-indigo-200/70">
                Personalizing database settings and verification gates for your dashboard.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* ================= STANDARD LOGIN / SIGNUP VIEW ================= */
        <div className="min-h-screen w-full flex flex-col md:flex-row bg-white font-sans overflow-x-hidden">

          {/* Left Column (Auth Area) - 50% width */}
          <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-12 lg:p-16">
            <div className="w-full max-w-md space-y-6">

              {/* Header titles */}
              <div className="space-y-2 text-left">
                <h2 className="text-3xl font-black tracking-tight text-gray-900">
              {showForgotPasswordForm
                ? "Reset your password"
                : linkingPhone
                ? "Verify your phone number"
                : verifying
                ? "Enter verification code"
                : isSignUp
                ? "Create your account"
                : "Sign in to StoryShare"}
            </h2>
            <p className="text-sm text-gray-500">
              {showForgotPasswordForm
                ? "Enter your email address and we'll send you a recovery link"
                : linkingPhone
                ? "Enter the 6-digit code sent to your phone to link it to your account"
                : verifying
                ? "We sent a 6-digit code to complete the verification check"
                : isSignUp
                ? "Setup your email and phone credentials to continue"
                : "Enter your account details to access your dashboard"}
            </p>
          </div>

          {/* Error Alert Display */}
          {authError && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* FORGOT PASSWORD FORM SUB-STATE */}
          {showForgotPasswordForm ? (
            <form onSubmit={handleForgotPassword} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    placeholder="name@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold transition shadow-md shadow-blue-200 flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{loading ? "Sending..." : "Send Reset Link"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPasswordForm(false);
                  setAuthError("");
                }}
                className="w-full py-2 text-center text-xs text-gray-500 hover:underline cursor-pointer"
              >
                Back to sign in
              </button>
            </form>
          ) : linkingPhone ? (
            /* ================= PHONE LINKING OTP STEP (after email sign-up) ================= */
            <form onSubmit={handleSignUpLinkVerify} className="space-y-4 text-left">
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-xl">
                A verification code has been sent to <strong>{signUpPhone}</strong>. Enter it below to link your phone number.
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Verification Code
                </label>
                <input
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  value={linkOtp}
                  onChange={(e) => setLinkOtp(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-center font-bold tracking-widest text-lg focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold transition shadow-md shadow-blue-200 flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{loading ? "Verifying..." : "Verify & Complete Sign Up"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={async () => {
                  setLinkingPhone(false);
                  // Skip phone linking — sync to MongoDB without phone
                  if (auth.currentUser) {
                    try {
                      const mongoProfile = await syncUserToDatabase(auth.currentUser);
                      if (onProfileSynced) onProfileSynced(auth.currentUser, mongoProfile);
                    } catch (err) {
                      setAuthError("Failed to complete sign-up: " + err.message);
                    }
                  }
                }}
                className="w-full py-2 text-center text-xs text-gray-500 hover:underline cursor-pointer"
              >
                Skip phone linking for now
              </button>
            </form>
          ) : verifying ? (
            <form onSubmit={handlePhoneAuthVerify} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Verification Code
                </label>
                <input
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-center font-bold tracking-widest text-lg focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold transition shadow-md shadow-blue-200 flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{loading ? "Verifying..." : "Verify Code"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setVerifying(false)}
                className="w-full py-2 text-center text-xs text-gray-500 hover:underline"
              >
                Back to credentials
              </button>
            </form>
          ) : (
            /* REGULAR FORM VIEWS (SIGN IN OR SIGN UP) */
            <div className="space-y-5 text-left">
              
              {/* Form Submission */}
              <form
                onSubmit={
                  isSignUp
                    ? authMethod === "email"
                      ? handleEmailSignUp
                      : handlePhoneLogin
                    : authMethod === "email"
                    ? handleEmailSignIn
                    : handlePhoneLogin
                }
                className="space-y-4"
              >
                {/* DUAL INPUT LOGIC: EMAIL OR PHONE */}
                {authMethod === "email" ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                        {isSignUp ? "Email address" : "Email address or username"}
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="name@domain.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                          Password
                        </label>
                        {!isSignUp && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowForgotPasswordForm(true);
                              setAuthError("");
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 font-semibold cursor-pointer border-none bg-transparent p-0 focus:outline-none"
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Phone number field — visible only during email sign-up */}
                    {isSignUp && (
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                          Phone Number <span className="text-gray-400 font-normal normal-case">(for dual sign-in)</span>
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                          <input
                            type="tel"
                            placeholder="+919876543210"
                            value={signUpPhone}
                            onChange={(e) => setSignUpPhone(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Link your phone so you can sign in with either email or phone number.</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                        Mobile Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                          type="tel"
                          placeholder="+919876543210"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                          required
                        />
                      </div>
                    </div>

                    {isSignUp && (
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                          Password
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                          <input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-semibold transition shadow-md shadow-blue-200 flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>{loading ? "Processing..." : "Continue"}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-150"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-gray-400 font-semibold tracking-wider">or</span>
                </div>
              </div>

              {/* Alternative Auth Buttons below the divider */}
              <div className="space-y-2.5">
                {/* 1. Continue with Google */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full py-2.5 px-4 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.11C18.281 1.09 15.549 0 12.24 0 5.58 0 0 5.37 0 12s5.58 12 12.24 12c6.96 0 11.57-4.838 11.57-11.79 0-.79-.08-1.4-.17-1.925H12.24z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                {/* 2. Continue with Mobile Number (toggles auth method) */}
                {authMethod === "email" ? (
                  <button
                    onClick={() => {
                      setAuthMethod("phone");
                      setAuthError("");
                    }}
                    className="w-full py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center space-x-2 transition cursor-pointer"
                  >
                    <Phone className="w-4 h-4 text-gray-500" />
                    <span>Continue with Mobile Number</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setAuthMethod("email");
                      setAuthError("");
                    }}
                    className="w-full py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center space-x-2 transition cursor-pointer"
                  >
                    <Mail className="w-4 h-4 text-gray-500" />
                    <span>Continue with Email Address</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Toggle Sign Up / Sign In */}
          {!showForgotPasswordForm && (
            <div className="pt-2 text-center">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  resetFormState();
                }}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition cursor-pointer"
              >
                {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>
            </div>
          )}

          {/* Fine print */}
          <p className="text-[10px] text-gray-400 text-center leading-relaxed">
            By logging in, you agree to our <a href="#terms" className="underline hover:text-gray-600">Terms of Service</a> and <a href="#privacy" className="underline hover:text-gray-600">Privacy Notice</a>.
          </p>

        </div>
      </div>

      {/* Right Column (Brand Hero) - 50% width */}
      <div className="w-full md:w-1/2 bg-indigo-950 text-white flex flex-col justify-between p-8 md:p-12 lg:p-16 text-left relative overflow-hidden">
        
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/50 via-slate-950 to-indigo-950 z-0"></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl z-0"></div>

        <div className="relative z-10 flex justify-between items-center w-full">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white shadow shadow-blue-500/30">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <span className="font-bold text-lg tracking-wide">StoryShare</span>
          </div>
        </div>

        {/* Hero titles */}
        <div className="relative z-10 my-auto py-12 md:py-0 space-y-6 max-w-lg">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
            Share Location-based <br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
              Memories & Stories
            </span>
          </h1>
          <p className="text-sm md:text-base text-indigo-200/80 leading-relaxed">
            Connect with friends, publish spatial journals, and set fine-grained privacy controls for your profile feed. Keep your memories rooted in coordinates.
          </p>
        </div>

      </div>
    </div>
  )}
</>
);
}
