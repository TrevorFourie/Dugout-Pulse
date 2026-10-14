import React from 'react';

type BaseballIconProps = React.SVGProps<SVGSVGElement> & {
  size?: number;
};

/**
 * Small, app-local baseball glyphs for concepts that generic UI icon libraries
 * do not represent clearly. These are inline SVGs, so they work fully offline.
 */
export const BaseballBallIcon: React.FC<BaseballIconProps> = ({
  size = 24,
  ...props
}) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M6.2 5.1c2.2 1.7 3.5 4.1 3.5 6.9s-1.3 5.2-3.5 6.9" />
    <path d="M17.8 5.1c-2.2 1.7-3.5 4.1-3.5 6.9s1.3 5.2 3.5 6.9" />
    <path d="m7.2 7.3 1.5.3M8.6 10l1.4.2M8.6 14l1.4-.2M7.2 16.7l1.5-.3" />
    <path d="m16.8 7.3-1.5.3M15.4 10l-1.4.2M15.4 14l-1.4-.2M16.8 16.7l-1.5-.3" />
  </svg>
);

export const BaseballBatIcon: React.FC<BaseballIconProps> = ({
  size = 24,
  ...props
}) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4.2 19.8c-.7-.7-.7-1.8 0-2.5L17.4 4.1a2.2 2.2 0 0 1 3.1 3.1L7.3 20.4c-.9.9-2.3.9-3.1-.1Z" />
    <path d="m6.4 17.6 2 2M8.2 15.8l2 2M10 14l2 2" />
  </svg>
);

export const BaseballGloveIcon: React.FC<BaseballIconProps> = ({
  size = 24,
  ...props
}) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M7.2 20.2 4.5 16a2 2 0 0 1 .5-2.7l1-.7V7.4a1.5 1.5 0 0 1 3 0v3.2-5a1.5 1.5 0 0 1 3 0v4.6-5.4a1.5 1.5 0 0 1 3 0v6-3.1a1.5 1.5 0 0 1 3 0v6.1c0 3.5-2.3 6.4-5.8 6.4H9.7a3 3 0 0 1-2.5-1Z" />
    <path d="m6.1 14.1 2.6 2.6 2.2-1.2 2.3 1.2 2.2-1.5" />
    <path d="M8.7 10.6v2.2M12 10.2v2.4M15 10.8v2.1" />
  </svg>
);
