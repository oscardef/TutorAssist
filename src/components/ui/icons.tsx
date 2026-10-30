/** Small, consistent stroke icon set used by the app shell. */
type IconProps = { className?: string }

const base = (className?: string) => ({
  className: className ?? 'h-5 w-5',
  fill: 'none',
  viewBox: '0 0 24 24',
  strokeWidth: 1.75,
  stroke: 'currentColor',
  'aria-hidden': true as const,
})

export const Icons = {
  home: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="m3 11 9-8 9 8M5 10v10h5v-6h4v6h5V10" /></svg>
  ),
  students: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M16 19a4 4 0 0 0-8 0M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7 8a3 3 0 0 0-3-3M17 11a2.5 2.5 0 1 0 0-5M5 19a3 3 0 0 1 3-3M7 11a2.5 2.5 0 1 1 0-5" /></svg>
  ),
  assignments: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 12h6M9 16h4" /></svg>
  ),
  questions: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v14H6.5A2.5 2.5 0 0 0 4 20.5v-14ZM4 18.5A2.5 2.5 0 0 1 6.5 16H20M12 8v4m0 3h.01" /></svg>
  ),
  topics: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h10M4 17h7" /></svg>
  ),
  sparkles: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M10 4l1.6 4.4L16 10l-4.4 1.6L10 16l-1.6-4.4L4 10l4.4-1.6L10 4Zm8 10 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z" /></svg>
  ),
  calendar: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /></svg>
  ),
  folder: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>
  ),
  flag: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M5 21V4m0 0h11l-2 4 2 4H5" /></svg>
  ),
  settings: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>
  ),
  practice: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5ZM14 6l4 4" /></svg>
  ),
  progress: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></svg>
  ),
  signout: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" /></svg>
  ),
  chevronLeft: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="m15 6-6 6 6 6" /></svg>
  ),
  plus: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
  ),
  check: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="m5 12 5 5L20 7" /></svg>
  ),
  x: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6 6 18" /></svg>
  ),
  arrowRight: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" /></svg>
  ),
  mail: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm0 1 8 6 8-6" /></svg>
  ),
  clock: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
  ),
  flame: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c1 3 4 4.5 4 9a4 4 0 0 1-8 0c0-1.5.5-2.5 1-3 .5 1.5 1.5 2 2 2 0-3-1-5 1-8Z" /></svg>
  ),
  target: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" /></svg>
  ),
  book: ({ className }: IconProps) => (
    <svg {...base(className)}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16ZM4 19a2.5 2.5 0 0 1 2.5-2.5H20" /></svg>
  ),
}

export type IconName = keyof typeof Icons
