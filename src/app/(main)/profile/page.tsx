"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { LogOut, MapPin, Mail, Phone, Calendar, Edit2, Check, X, ShieldAlert, Shield, User as UserIcon, AlertTriangle } from "lucide-react";
import type { User as FirebaseUser } from "firebase/auth";
import styles from "./page.module.css";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [dbProfile, setDbProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPrivacySetting, setEditPrivacySetting] = useState("public");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
        try {
          const token = await u.getIdToken();
          const res = await fetch("/api/users/me", {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setDbProfile(data.profile);
            setEditDisplayName(data.profile.profile?.displayName || u.displayName || "");
            setEditBio(data.profile.profile?.bio || "");
            setEditUsername(data.profile.username || "");
            setEditEmail(data.profile.email || "");
            setEditPhone(data.profile.phoneNumber || "");
            setEditPrivacySetting(data.profile.profile?.privacySetting || "public");
          }
        } catch (err) {
          console.error("Failed to fetch db profile", err);
        }
      } else {
        router.push("/");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          displayName: editDisplayName,
          bio: editBio,
          username: editUsername,
          email: editEmail,
          phoneNumber: editPhone,
          privacySetting: editPrivacySetting
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDbProfile(data.profile);
        setIsEditing(false);
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to update profile");
        console.error("Failed to update profile", errorData);
      }
    } catch (err) {
      console.error("Error updating profile", err);
      alert("Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (!window.confirm("Are you completely sure you want to delete your account? This action is permanent and will delete all your memories, likes, and followers. This cannot be undone.")) {
      return;
    }
    
    setDeleting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/users/me", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        await signOut(auth);
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to delete account");
        setDeleting(false);
      }
    } catch (err) {
      console.error("Error deleting account:", err);
      alert("Error deleting account");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ height: "calc(100vh - var(--nav-height))", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="loading-container">
          <div className="loading-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const displayName = dbProfile?.profile?.displayName || user.displayName || "Explorer";
  const bio = dbProfile?.profile?.bio || "Ready for new memories";
  const username = dbProfile?.username || "";
  const currentEmail = dbProfile?.email || user.email || "No email linked";
  const currentPhone = dbProfile?.phoneNumber || user.phoneNumber || "No phone linked";
  const currentPrivacy = dbProfile?.profile?.privacySetting || "public";
  
  const privacyLabels: Record<string, string> = {
    "public": "Public Profile",
    "followers": "Followers Only",
    "private": "Private Profile"
  };

  return (
    <div className={styles.container}>
      {/* 1. Hero Header Card */}
      <div className={styles.heroCard}>
        <div className={styles.heroCover}>
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className={styles.editToggleBtn}>
              <Edit2 size={14} /> Edit Profile
            </button>
          )}
        </div>
        
        <div className={styles.heroBody}>
          <div className={styles.avatar}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          
          <h1 className={styles.displayName}>{displayName}</h1>
          {username && <p className={styles.username}>@{username}</p>}
          <p className={styles.bio}>{bio}</p>
        </div>
      </div>

      {/* 2. Editable Sections (Only show inputs when editing) */}
      {isEditing ? (
        <>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <UserIcon className={styles.sectionIcon} size={20} />
              <h2 className={styles.sectionTitle}>General Information</h2>
            </div>
            
            <div className={styles.grid}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Display Name</label>
                <div className={styles.inputWrapper}>
                  <UserIcon className={styles.inputIcon} size={16} />
                  <input type="text" className={styles.input} value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Username</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputIcon} style={{ fontSize: '16px', fontWeight: 'bold' }}>@</span>
                  <input type="text" className={styles.input} value={editUsername} onChange={e => setEditUsername(e.target.value)} />
                </div>
              </div>

              <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                <label className={styles.label}>Bio</label>
                <textarea className={styles.input} value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="Tell the world about yourself..." />
              </div>
            </div>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <Shield className={styles.sectionIcon} size={20} />
              <h2 className={styles.sectionTitle}>Account & Security</h2>
            </div>

            <div className={styles.grid}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Email Address</label>
                <div className={styles.inputWrapper}>
                  <Mail className={styles.inputIcon} size={16} />
                  <input type="email" className={styles.input} value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="name@example.com" />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Phone Number</label>
                <div className={styles.inputWrapper}>
                  <Phone className={styles.inputIcon} size={16} />
                  <input type="tel" className={styles.input} value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+1 234 567 8900" />
                </div>
              </div>

              <div className={`${styles.inputGroup} ${styles.fullWidth}`}>
                <label className={styles.label}>Privacy Setting</label>
                <select className={styles.input} value={editPrivacySetting} onChange={e => setEditPrivacySetting(e.target.value)} style={{ paddingLeft: '16px' }}>
                  <option value="public">🌍 Public (Everyone can see your profile)</option>
                  <option value="followers">👥 Followers (Only followers can see your profile)</option>
                  <option value="private">🔒 Private (Only you can see your profile)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sticky Save Bar */}
          <div className={styles.saveBar}>
            <div className={styles.saveBarText}>You have unsaved changes</div>
            <div className={styles.saveActions}>
              <button className="btn btn-ghost" onClick={() => setIsEditing(false)} disabled={saving} style={{ padding: "8px 16px" }}>
                <X size={16} /> Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveProfile} disabled={saving} style={{ padding: "8px 24px" }}>
                <Check size={16} /> {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Read-Only Information Sections */
        <>
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <Shield className={styles.sectionIcon} size={20} />
              <h2 className={styles.sectionTitle}>Account Details</h2>
            </div>

            <div className={styles.infoRow}>
              <div className={styles.infoIcon}><Mail size={18} /></div>
              <div className={styles.infoContent}>
                <div className={styles.infoLabel}>Email Address</div>
                <div className={styles.infoValue}>{currentEmail}</div>
              </div>
            </div>

            <div className={styles.infoRow}>
              <div className={styles.infoIcon}><Phone size={18} /></div>
              <div className={styles.infoContent}>
                <div className={styles.infoLabel}>Phone Number</div>
                <div className={styles.infoValue}>{currentPhone}</div>
              </div>
            </div>

            <div className={styles.infoRow}>
              <div className={styles.infoIcon}><ShieldAlert size={18} /></div>
              <div className={styles.infoContent}>
                <div className={styles.infoLabel}>Privacy Setting</div>
                <div className={styles.infoValue}>{privacyLabels[currentPrivacy] || "Public Profile"}</div>
              </div>
            </div>
            
            <div className={styles.infoRow}>
              <div className={styles.infoIcon}><Calendar size={18} /></div>
              <div className={styles.infoContent}>
                <div className={styles.infoLabel}>Member Since</div>
                <div className={styles.infoValue}>{user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : "Recently"}</div>
              </div>
            </div>
          </div>

          <div className={`${styles.sectionCard} ${styles.dangerZone}`}>
            <div className={styles.sectionHeader}>
              <AlertTriangle className={styles.sectionIcon} size={20} />
              <h2 className={styles.sectionTitle}>Account Actions</h2>
            </div>
            
            <div className={styles.grid}>
              <button className={styles.secondaryButton} onClick={handleSignOut}>
                <LogOut size={16} /> Sign Out of Account
              </button>
              
              <button className={styles.dangerButton} onClick={handleDeleteAccount} disabled={deleting}>
                <AlertTriangle size={16} /> {deleting ? "Deleting..." : "Permanently Delete Account"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

