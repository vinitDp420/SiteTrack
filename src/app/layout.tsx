import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import React from 'react';

export const metadata: Metadata = {
  title: 'SiteTrack — Construction Attendance Management',
  description: 'AI-powered construction workforce attendance management system with CCTV face recognition.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Load Google Fonts Inter and Material Icons */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full bg-[#f7f9fb] text-[#191c1e] font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
