'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { Map, LayoutList, Bookmark, MapPin, User } from 'lucide-react';
import SearchBar from './SearchBar';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: '/map', label: 'Map', icon: <Map size={18} strokeWidth={1.5} /> },
    { href: '/timeline', label: 'Timeline', icon: <LayoutList size={18} strokeWidth={1.5} /> },
    { href: '/favorites', label: 'Saved', icon: <Bookmark size={18} strokeWidth={1.5} /> },
    { href: '/profile', label: 'Profile', icon: <User size={18} strokeWidth={1.5} /> },
  ];

  return (
    <nav className="navbar">
      <Link href="/profile" className="nav-logo">
        <MapPin size={22} color="var(--accent-primary)" strokeWidth={2} />
        <span>SnapMap</span>
      </Link>
      
      <Suspense fallback={<div style={{ flex: 1, maxWidth: '300px' }} />}>
        <SearchBar />
      </Suspense>

      <div className="nav-links">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link ${pathname === link.href ? 'active' : ''}`}
          >
            {link.icon}
            <span>{link.label}</span>
          </Link>
        ))}
        
        {/* In-App Notification Bell */}
        <NotificationBell />
      </div>
    </nav>
  );
}
