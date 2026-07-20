"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { LogOut, User, MapPin, Mail, Phone, Calendar, Edit2, Check, X } from "lucide-react";
import type { User as FirebaseUser } from "firebase/auth";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [dbProfile, setDbProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [saving, setSaving] = useState(false);

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
          username: editUsername
        })
      });
      if (res.ok) {
        const data = await res.json();
        setDbProfile(data.profile);
        setIsEditing(false);
      } else {
        console.error("Failed to update profile");
      }
    } catch (err) {
      console.error("Error updating profile", err);
    } finally {
      setSaving(false);
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

  return (
    <div style={{ padding: "40px 24px", maxWidth: "600px", margin: "0 auto", marginTop: "var(--nav-height)" }}>
      <div className="glass-card" style={{ padding: "40px", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "32px", alignItems: "center", textAlign: "center", position: "relative" }}>
        
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            style={{ position: "absolute", top: "24px", right: "24px", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
          >
            <Edit2 size={16} /> Edit
          </button>
        )}

        {/* Profile Avatar Placeholder */}
        <div style={{ 
          width: "120px", 
          height: "120px", 
          borderRadius: "50%", 
          background: "var(--accent-primary)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          color: "white",
          boxShadow: "var(--shadow-md)",
          fontSize: "48px"
        }}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        
        <div style={{ width: "100%" }}>
          {isEditing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: "left", width: "100%", maxWidth: "400px", margin: "0 auto" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Display Name</label>
                <input type="text" className="input" value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Username</label>
                <input type="text" className="input" value={editUsername} onChange={e => setEditUsername(e.target.value)} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Bio</label>
                <textarea className="input" value={editBio} onChange={e => setEditBio(e.target.value)} style={{ minHeight: "80px", resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "8px" }}>
                <button className="btn btn-ghost" onClick={() => setIsEditing(false)} disabled={saving} style={{ padding: "8px 16px" }}>
                  <X size={16} /> Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSaveProfile} disabled={saving} style={{ padding: "8px 16px" }}>
                  <Check size={16} /> {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 style={{ fontSize: "28px", color: "var(--text-primary)", marginBottom: "4px" }}>
                {displayName}
              </h1>
              {username && (
                <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "12px" }}>@{username}</p>
              )}
              <p style={{ color: "var(--text-secondary)", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <MapPin size={16} /> {bio}
              </p>
            </>
          )}
        </div>

        <div style={{ width: "100%", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", padding: "24px 0", display: "flex", flexDirection: "column", gap: "16px", textAlign: "left" }}>
          
          {user.email && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--text-primary)" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
                <Mail size={18} />
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Email</div>
                <div style={{ fontSize: "15px" }}>{user.email}</div>
              </div>
            </div>
          )}

          {user.phoneNumber && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--text-primary)" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
                <Phone size={18} />
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Phone</div>
                <div style={{ fontSize: "15px" }}>{user.phoneNumber}</div>
              </div>
            </div>
          )}
          
          <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--text-primary)" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)" }}>
              <Calendar size={18} />
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Joined</div>
              <div style={{ fontSize: "15px" }}>{user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : "Recently"}</div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSignOut} 
          className="btn btn-ghost" 
          style={{ 
            color: "var(--error)", 
            display: "flex", 
            alignItems: "center", 
            gap: "8px",
            padding: "12px 24px"
          }}
        >
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </div>
  );
}
