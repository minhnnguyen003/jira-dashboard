'use client';

import { useSyncExternalStore } from 'react';
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

const subscribeToHydration = () => () => {};
const getHydratedSnapshot = () => true;
const getServerHydratedSnapshot = () => false;

export default function ProfileGate({ children }: ProfileGateProps) {
  const hasCheckedProfile = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  );
  const profile = hasCheckedProfile ? readProfileFromDocumentCookie() : null;

  const handleSelectProfile = (nextProfile: ProfileState) => {
    writeProfileToDocumentCookie(nextProfile);
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
