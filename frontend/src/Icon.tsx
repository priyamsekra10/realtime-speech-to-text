import type { ReactNode } from 'react'

const paths = {
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7.5 8 6 8-6" />
    </>
  ),
  download: <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />,
  link: <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19h11a1.5 1.5 0 0 0 1.5-1.5V14M14 5h5v5M19 5l-8 8" />,
  code: <path d="m8.5 7.5-5 4.5 5 4.5M15.5 7.5l5 4.5-5 4.5" />,
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
      <path d="M10 10h4v4h-4zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" />
    </>
  ),
  spark: <path d="M12 3.5 13.8 9 19.5 11 13.8 13 12 18.5 10.2 13 4.5 11 10.2 9zM19 16.5v4M17 18.5h4" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  text: <path d="M5 6.5h14M5 11h14M5 15.5h9" />,
  file: (
    <>
      <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14 3.5V8h4M9 12.5h6M9 16h6" />
    </>
  ),
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 10.5v6M14 10.5v6" />,
  edit: <path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10zM14 8l3 3" />,
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M19 12H5m0 0 6-6m-6 6 6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof paths

export default function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
