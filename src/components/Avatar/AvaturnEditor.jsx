import React, { useEffect, useRef } from 'react';
import { AvaturnSDK } from '@avaturn/sdk';
import useAvatarStore from '../../store/avatarStore';

export default function AvaturnEditor() {
  const containerRef = useRef(null);
  const { toggleAvaturn, setAvatarUrl, showAvaturn } = useAvatarStore();

  useEffect(() => {
    if (!showAvaturn || !containerRef.current) return;

    // Use a demo subdomain if none provided, or ask the user to fill it in
    // Typically, user-specific subdomains are required.
    // For now, using 'demo.avaturn.dev' as a default if it works.
    const sdk = new AvaturnSDK();
    
    // Initialize the SDK
    sdk.init(containerRef.current, {
      url: 'https://demo.avaturn.dev', // Replace with YOUR_SUBDOMAIN.avaturn.dev
    }).then(() => {
      console.log('Avaturn SDK initialized');
    }).catch(err => {
      console.error('Failed to initialize Avaturn SDK:', err);
    });

    // Listen for the export event
    sdk.on('export', (data) => {
      console.log('Avatar exported:', data);
      if (data.url) {
        setAvatarUrl(data.url);
        toggleAvaturn(); // Close the editor after export
      }
    });

    // Cleanup when component unmounts or closes
    return () => {
      // You might need a cleanup method if Avaturn SDK provides one
      // For now, the iframe will be removed from the DOM
    };
  }, [showAvaturn, setAvatarUrl, toggleAvaturn]);

  if (!showAvaturn) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-6">
        <h2 className="text-xl font-bold text-white">Customize Your Avatar</h2>
        <button
          onClick={toggleAvaturn}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
        >
          Cancel
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
