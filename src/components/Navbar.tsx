'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Map', icon: '🗺️' },
    { href: '/timeline', label: 'Timeline', icon: '📱' },
    { href: '/favorites', label: 'Saved', icon: '🔖' },
  ];

  return (
    <nav className="navbar">
      <Link href="/" className="nav-logo">
        📍 SnapMap
      </Link>
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
      </div>
    </nav>
  );
}
