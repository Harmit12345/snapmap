"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  sendPasswordResetEmail,
  deleteUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Mail, Lock, Phone, Sparkles, ArrowRight, AlertCircle, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

// Extend Window interface for ReCaptcha
declare global {
  interface Window {
    recaptchaVerifier: any;
    confirmationResult: any;
    signUpLinkConfirmation: any;
  }
}

export default function LoginPage() {
  const router = useRouter();

  const syncInProgress = useRef(false);
  const lastSyncedUid = useRef<string | null>(null);
  const loginFlowActive = useRef(false);
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState("email");
  const [showForgotPasswordForm, setShowForgotPasswordForm] = useState(false);

  // Syncing state
  const [syncing, setSyncing] = useState(false);

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

  const syncUserToDatabase = useCallback(async (firebaseUser: any, forceSignUp?: boolean, customName?: string) => {
    const idToken = await firebaseUser.getIdToken();
    const activeIsSignUp = forceSignUp !== undefined ? forceSignUp : isSignUp;
    const res = await fetch("/api/users/sync", {
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

  const handleAuthSuccess = useCallback(async (firebaseUser: any) => {
    if (!firebaseUser) return;
    if (syncInProgress.current || lastSyncedUid.current === firebaseUser.uid) {
      return;
    }
    syncInProgress.current = true;
    lastSyncedUid.current = firebaseUser.uid;

    setSyncing(true);
    setAuthError("");
    try {
      if (isSignUp) {
        const firstName = window.prompt("Enter your First Name to complete registration:");
        if (firstName === null) throw new Error("Registration cancelled: Missing first name.");
        const lastName = window.prompt("Enter your Last Name to complete registration:");
        if (lastName === null) throw new Error("Registration cancelled: Missing last name.");
        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim() || firebaseUser.displayName || "New User";

        await syncUserToDatabase(firebaseUser, true, fullName);
      } else {
        try {
          await syncUserToDatabase(firebaseUser, false);
        } catch (err: any) {
          if (err.message.includes("No account found")) {
            // User exists in Firebase but not in MongoDB! Let's gracefully create their profile now.
            const fullName = firebaseUser.displayName || "New User";
            await syncUserToDatabase(firebaseUser, true, fullName);
          } else {
            throw err;
          }
        }
      }

      router.push("/");
    } catch (err: any) {
      const errMsg = err.message || "Failed to sync user profile.";
      setAuthError(errMsg);
      await auth.signOut();
      lastSyncedUid.current = null;
    } finally {
      setSyncing(false);
      syncInProgress.current = false;
    }
  }, [syncUserToDatabase, isSignUp, router]);

  useEffect(() => {
    if (!auth.currentUser) {
      lastSyncedUid.current = null;
      try {
        const containerEl = document.getElementById("recaptcha-container");
        if (containerEl && !window.recaptchaVerifier) {
          window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
            size: "invisible",
            callback: () => {},
            "expired-callback": () => {
              setAuthError("reCAPTCHA session expired. Please try again.");
            }
          });
        }
      } catch (error) {}
    }

    const autoSyncOnMount = async () => {
      if (auth.currentUser && !isLoggingIn && !loginFlowActive.current) {
        await handleAuthSuccess(auth.currentUser);
      }
    };
    autoSyncOnMount();

    return () => {
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch (e) {}
        window.recaptchaVerifier = null;
      }
    };
  }, [handleAuthSuccess, isLoggingIn]);

  const handleForgotPassword = async (e: React.FormEvent) => {
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
    } catch (err: any) {
      setAuthError(err.message || "Failed to send password reset email.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    loginFlowActive.current = true;
    setLoading(true);
    setAuthError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Let handleAuthSuccess deal with syncing the user
      await handleAuthSuccess(userCredential.user);
    } catch (err: any) {
      setAuthError(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
      loginFlowActive.current = false;
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    loginFlowActive.current = true;
    setLoading(true);
    setAuthError("");

    try {
      const checkEmailRes = await fetch(`/api/users/exists?identifier=${encodeURIComponent(email)}`);
      const checkEmailData = await checkEmailRes.json();
      if (checkEmailData.exists) {
        setAuthError("Email is already linked to another account.");
        setLoading(false);
        return;
      }

      if (signUpPhone.trim()) {
        const checkPhoneRes = await fetch(`/api/users/exists?identifier=${encodeURIComponent(signUpPhone.trim())}`);
        const checkPhoneData = await checkPhoneRes.json();
        if (checkPhoneData.exists) {
          setAuthError("Phone number is already linked to another account.");
          setLoading(false);
          return;
        }
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await handleAuthSuccess(userCredential.user);
    } catch (err: any) {
      setAuthError(err.message || "Failed to create account.");
      if (auth.currentUser) await auth.signOut();
    } finally {
      setLoading(false);
      loginFlowActive.current = false;
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    loginFlowActive.current = true;
    setIsLoggingIn(true);
    setLoading(true);
    setAuthError("");

    try {
      const checkRes = await fetch(`/api/users/exists?identifier=${encodeURIComponent(phoneNumber)}`);
      const checkData = await checkRes.json();

      if (isSignUp) {
        if (checkData.exists) {
          setAuthError("Phone number is already linked. Please sign in instead.");
          setIsSignUp(false);
          setLoading(false);
          return;
        }
      } else {
        if (!checkData.exists) {
          setAuthError("Account not found. Sign up first!");
          setIsSignUp(true);
          setLoading(false);
          return;
        }
      }

      const containerEl = document.getElementById("recaptcha-container");
      if (!containerEl) throw new Error("reCAPTCHA target container missing.");

      if (window.recaptchaVerifier) {
        try { await window.recaptchaVerifier.clear(); } catch (err) {}
        window.recaptchaVerifier = null;
      }

      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible"
      });

      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
      window.confirmationResult = confirmationResult;
      setVerifying(true);
    } catch (err: any) {
      setAuthError(err.message || "Failed to send SMS code.");
      if (window.recaptchaVerifier) {
        try { await window.recaptchaVerifier.clear(); } catch (err) {}
        window.recaptchaVerifier = null;
      }
    } finally {
      setLoading(false);
      setIsLoggingIn(false);
      loginFlowActive.current = false;
    }
  };

  const handlePhoneAuthVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    loginFlowActive.current = true;
    setLoading(true);
    setAuthError("");

    try {
      if (!window.confirmationResult) throw new Error("No active session found.");
      const result = await window.confirmationResult.confirm(verificationCode);
      await handleAuthSuccess(result.user);
    } catch (err: any) {
      setAuthError(err.message || "Invalid verification code.");
    } finally {
      setLoading(false);
      loginFlowActive.current = false;
    }
  };

  const handleGoogleLogin = async () => {
    loginFlowActive.current = true;
    setLoading(true);
    setAuthError("");

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const token = await userCredential.user.getIdToken();
      const checkRes = await fetch("/api/users/check-profile", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!checkRes.ok) {
        if (!isSignUp) {
          try { await deleteUser(userCredential.user); } catch (e) {}
          await auth.signOut();
          setAuthError("Account not found. Please sign up first!");
          setIsSignUp(true);
          return;
        }
        await handleAuthSuccess(userCredential.user);
      } else {
        setIsSignUp(false);
        await handleAuthSuccess(userCredential.user);
      }
    } catch (err: any) {
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

  return (
    <>
      <div id="recaptcha-container"></div>
      
      {syncing ? (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg-primary)" }}>
          <div style={{ textAlign: "center" }}>
            <RefreshCw size={48} color="var(--accent-primary)" style={{ animation: "spin 2s linear infinite", margin: "0 auto 16px" }} />
            <h2>Syncing Profile...</h2>
            <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>Personalizing database settings and verification gates for your dashboard.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", minHeight: "100vh", width: "100%", background: "var(--bg-primary)" }}>
          
          <div style={{ flex: "1 1 50%", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
            <div className="glass-card" style={{ width: "100%", maxWidth: "440px", padding: "40px", display: "flex", flexDirection: "column", gap: "24px" }}>
              
              <div>
                <h2 style={{ fontSize: "28px", marginBottom: "8px", color: "var(--text-primary)" }}>
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
                <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
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

              {authError && (
                <div style={{ padding: "12px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "var(--radius-md)", color: "var(--error)", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <AlertCircle size={16} />
                  <span>{authError}</span>
                </div>
              )}

              {showForgotPasswordForm ? (
                <form onSubmit={handleForgotPassword} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase" }}>Email Address</label>
                    <div style={{ position: "relative" }}>
                      <Mail size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                      <input type="email" className="input" placeholder="name@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ paddingLeft: "36px" }} required />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", marginTop: "8px" }}>
                    {loading ? "Sending..." : "Send Reset Link"} <ArrowRight size={16} />
                  </button>
                  <button type="button" onClick={() => setShowForgotPasswordForm(false)} className="btn btn-ghost" style={{ width: "100%", border: "none" }}>
                    Back to sign in
                  </button>
                </form>
              ) : verifying ? (
                <form onSubmit={handlePhoneAuthVerify} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase" }}>Verification Code</label>
                    <input type="text" placeholder="123456" maxLength={6} value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} className="input" style={{ textAlign: "center", letterSpacing: "4px", fontSize: "18px", fontWeight: "bold" }} required />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", marginTop: "8px" }}>
                    {loading ? "Verifying..." : "Verify Code"} <ArrowRight size={16} />
                  </button>
                  <button type="button" onClick={() => setVerifying(false)} className="btn btn-ghost" style={{ width: "100%", border: "none" }}>
                    Back to credentials
                  </button>
                </form>
              ) : (
                <form onSubmit={isSignUp ? (authMethod === "email" ? handleEmailSignUp : handlePhoneLogin) : (authMethod === "email" ? handleEmailSignIn : handlePhoneLogin)} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  
                  {authMethod === "email" ? (
                    <>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase" }}>{isSignUp ? "Email address" : "Email address or username"}</label>
                        <div style={{ position: "relative" }}>
                          <Mail size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                          <input type="text" className="input" placeholder="name@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ paddingLeft: "36px" }} required />
                        </div>
                      </div>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Password</label>
                          {!isSignUp && (
                            <button type="button" onClick={() => setShowForgotPasswordForm(true)} style={{ fontSize: "12px", color: "var(--accent-primary)" }}>Forgot password?</button>
                          )}
                        </div>
                        <div style={{ position: "relative" }}>
                          <Lock size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                          <input type={showPassword ? "text" : "password"} className="input" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingLeft: "36px", paddingRight: "36px" }} required />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      {isSignUp && (
                        <div>
                          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase" }}>Phone Number <span style={{ textTransform: "none", color: "var(--text-muted)", fontWeight: "normal" }}>(Optional)</span></label>
                          <div style={{ position: "relative" }}>
                            <Phone size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                            <input type="tel" className="input" placeholder="+1234567890" value={signUpPhone} onChange={(e) => setSignUpPhone(e.target.value)} style={{ paddingLeft: "36px" }} />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase" }}>Mobile Number</label>
                        <div style={{ position: "relative" }}>
                          <Phone size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                          <input type="tel" className="input" placeholder="+1234567890" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} style={{ paddingLeft: "36px" }} required />
                        </div>
                      </div>
                      
                      {isSignUp && (
                        <div>
                          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", textTransform: "uppercase" }}>Password</label>
                          <div style={{ position: "relative" }}>
                            <Lock size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                            <input type={showPassword ? "text" : "password"} className="input" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingLeft: "36px", paddingRight: "36px" }} required />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", marginTop: "12px", padding: "12px" }}>
                    {loading ? "Processing..." : "Continue"} <ArrowRight size={16} />
                  </button>
                </form>
              )}

              {!showForgotPasswordForm && !verifying && (
                <>
                  <div style={{ display: "flex", alignItems: "center", margin: "12px 0" }}>
                    <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }}></div>
                    <span style={{ padding: "0 12px", fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase" }}>or continue with</span>
                    <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }}></div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <button type="button" onClick={handleGoogleLogin} className="btn btn-ghost" style={{ width: "100%", padding: "12px" }}>
                       Continue with Google
                    </button>

                    <button type="button" onClick={() => { setAuthMethod(authMethod === "email" ? "phone" : "email"); setAuthError(""); }} className="btn btn-ghost" style={{ width: "100%", padding: "12px" }}>
                      {authMethod === "email" ? <Phone size={16} /> : <Mail size={16} />}
                      {authMethod === "email" ? "Continue with Mobile Number" : "Continue with Email Address"}
                    </button>
                  </div>

                  <div style={{ textAlign: "center", marginTop: "12px" }}>
                    <button onClick={() => { setIsSignUp(!isSignUp); resetFormState(); }} style={{ fontSize: "14px", color: "var(--accent-primary)" }}>
                      {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ flex: "1 1 50%", background: "linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px", position: "relative", overflow: "hidden", borderLeft: "1px solid var(--border-subtle)" }} className="hidden-mobile">
            <div style={{ position: "relative", zIndex: 10, maxWidth: "480px", margin: "0 auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "40px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                  <Sparkles size={20} />
                </div>
                <span style={{ fontSize: "24px", fontWeight: "bold", letterSpacing: "0.5px" }}>StoryShare</span>
              </div>
              
              <h1 style={{ fontSize: "48px", lineHeight: 1.1, marginBottom: "24px" }}>
                Map Your Memories.<br/>
                <span style={{ color: "var(--accent-primary)" }}>Share Your Story.</span>
              </h1>
              
              <p style={{ fontSize: "16px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Connect with friends, publish spatial journals, and set fine-grained privacy controls for your profile feed. Keep your memories rooted in coordinates.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
        }
      `}} />
    </>
  );
}
