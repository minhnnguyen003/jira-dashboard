'use client';

import { useEffect, useState } from 'react';
import ProfileSetupModal from './ProfileSetupModal';
import { readProfileFromDocumentCookie, writeProfileToDocumentCookie } from '@/lib/profile-cookie.js';

interface ProfileGateProps {
  children: React.ReactNode;
}

interface ProfileState {
  displayName: string;
  email: string;
  avatarUrl: string;
}

export default function ProfileGate({ children }: ProfileGateProps) {
  const [hasCheckedProfile, setHasCheckedProfile] = useState(false);
  const [profile, setProfile] = useState<ProfileState | null>(null);

  useEffect(() => {
    const existingProfile = readProfileFromDocumentCookie();
    setProfile(existingProfile);
    setHasCheckedProfile(true);
  }, []);

  const handleSelectProfile = (nextProfile: ProfileState) => {
    writeProfileToDocumentCookie(nextProfile);
    setProfile(nextProfile);
    window.location.reload();
  };

  if (!hasCheckedProfile) {
    return null;
  }

  const needsProfile = !profile?.displayName;

  return (
    <>
      {children}
      {needsProfile && <ProfileSetupModal onSelectProfile={handleSelectProfile} />}
    </>
  );
}
