import type { ReactNode } from "react";

type IconName =
  | "home"
  | "calendar"
  | "scissors"
  | "users"
  | "bag"
  | "bell"
  | "cart"
  | "orders"
  | "clock"
  | "spark"
  | "building"
  | "key"
  | "chart"
  | "arrow";

export function AppIcon({ name, size = 22 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 11 9-8 9 8" /><path d="M5.5 9.5V21h13V9.5" /><path d="M9.5 21v-7h5v7" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
    scissors: <><circle cx="6" cy="7" r="3" /><circle cx="6" cy="17" r="3" /><path d="m8.6 8.5 11.4 7M8.6 15.5 20 8.5" /></>,
    users: <><circle cx="9" cy="8" r="4" /><path d="M2.5 21c.5-4.3 2.8-6.5 6.5-6.5s6 2.2 6.5 6.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M17 15c2.7.4 4.2 2.4 4.5 6" /></>,
    bag: <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    cart: <><path d="M3 4h2l2.2 11.5h10.7L21 8H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
    orders: <><path d="M6 3h12v18H6z" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    spark: <><path d="M12 2c.8 5.6 2.4 7.2 8 8-5.6.8-7.2 2.4-8 8-.8-5.6-2.4-7.2-8-8 5.6-.8 7.2-2.4 8-8Z" /></>,
    building: <><path d="M4 21V5l8-3 8 3v16" /><path d="M2 21h20M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3" /></>,
    key: <><circle cx="8" cy="15" r="5" /><path d="m11.5 11.5 7-7M16 7l2 2M18 5l2 2" /></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
  };

  return (
    <svg className="app-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
