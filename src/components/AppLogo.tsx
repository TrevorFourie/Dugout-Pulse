import React from 'react';
// "?inline" embeds the small image straight into the JS bundle as a data URI, so it
// renders instantly on every mount: no network request, no huge 1254px decode, no flicker,
// and no path/case-sensitivity issues inside the Android WebView.
import logoSrc from '../assets/dugout-pulse-logo.png?inline';
import iconSrc from '../assets/dugout-pulse-icon.png?inline';
import { useGame } from '../context/GameContext';

interface AppLogoProps {
  variant?: 'logo' | 'icon';
  className?: string;
  alt?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({ variant = 'logo', className = '', alt }) => {
  const { activeProfile } = useGame();
  // A custom logo replaces the large "logo" only; the small app icon stays the Dugout Pulse icon.
  const custom = variant === 'logo' ? activeProfile.logo : undefined;

  return (
    <img
      src={custom || (variant === 'logo' ? logoSrc : iconSrc)}
      alt={alt ?? (custom ? 'Team logo' : variant === 'logo' ? 'Dugout Pulse logo' : 'Dugout Pulse icon')}
      className={className}
      // Inline sizing so the image is never stretched/squashed or dropped out of place
      // while the stylesheet is still loading (the bundled PNGs are inlined and paint first).
      width={variant === 'icon' ? 128 : 192}
      height={variant === 'icon' ? 128 : 192}
      style={{ objectFit: 'contain', maxWidth: '100%', maxHeight: '100%' }}
      decoding="sync"
      draggable={false}
    />
  );
};
