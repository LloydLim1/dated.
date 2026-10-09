export type Visibility = "public" | "followers" | "private";
export const METRO_CITIES = [
  "Caloocan",
  "Las Piñas",
  "Makati",
  "Malabon",
  "Mandaluyong",
  "Manila",
  "Marikina",
  "Muntinlupa",
  "Navotas",
  "Parañaque",
  "Pasay",
  "Pasig",
  "Pateros",
  "Quezon City",
  "San Juan",
  "Taguig",
  "Valenzuela",
];
export type Category = "Café" | "Restaurant" | "Museum" | "Cinema";
export type User = {
  id: string;
  name: string;
  username: string;
  bio: string;
  city: string;
  role: string;
  avatar: string;
  demo?: boolean;
};
export type Place = {
  id: string;
  name: string;
  category: Category;
  city: string;
  neighborhood: string;
  address: string;
  description: string;
  image: string;
  lat: number | null;
  lng: number | null;
  locationStatus?: "mapped" | "address_only";
  locationSource?: string;
  budget: number;
  tags: string[];
  rating: number | null;
  reviewCount: number;
  ratedReviewerCount?: number;
  supportedReviewerCount?: number;
  independentVisits: number;
  sample: boolean;
  hours: string;
  sourceUrl?: string;
  logo?: string;
  logoSource?: string;
  budgetKnown?: boolean;
  brandId?: string;
  brandName?: string;
  website?: string;
  websiteCountry?: "PH";
  websiteStatus?: "identity_unconfirmed";
  menuUrl?: string;
  menuSource?: string;
  menuCountry?: "PH";
  menuUnavailableReason?: "country_unconfirmed";
  menuStatus?:
    "reachable" | "restricted" | "unavailable" | "unchecked" | "unverified";
  menuCheckedAt?: number;
  priceText?: string;
  priceSource?: string;
  priceCheckedAt?: number;
  checkedAt?: number;
  mapStatus?: "confirmed" | "unconfirmed";
  missingSince?: number;
  catalogRegion?: string;
  guideUrl?: string;
  guideCheckedAt?: string;
  detailsSource?: "Philippine Museums" | "OpenStreetMap";
  museumDirectoryUrl?: string;
  museumCheckedAt?: number;
  admissionText?: string;
  admissionSource?: string;
  visitingNotice?: string;
};
export type PhotoPost = {
  id: string;
  author: User;
  placeId: string;
  caption: string;
  visitDate: string;
  visibility: Visibility;
  media: string[];
  createdAt: number;
  likes: number;
  liked: boolean;
  comments: { id: string; author: User; body: string; createdAt: number }[];
};
export type Review = {
  id: string;
  author: User;
  placeId: string;
  outingId?: string;
  title: string;
  body: string;
  visitDate: string;
  ratings: Record<string, number>;
  spending: number | null;
  visibility: Visibility;
  incentive: boolean;
  supported: boolean;
  media: string[];
  evidence?: string;
  createdAt: number;
  likes: number;
  liked: boolean;
  comments: { id: string; author: User; body: string; createdAt: number }[];
  demo: boolean;
  hidden: boolean;
};
export type Collection = { id: string; name: string; placeIds: string[] };
export type Outing = {
  id: string;
  owner: User;
  title: string;
  date: string;
  visibility: Visibility;
  notes: string;
  stops: string[];
  participants: { user: User; status: string; visibility: Visibility }[];
  completed: boolean;
};
export type Invitation = {
  id: string;
  outingId: string;
  title: string;
  from: string;
  status: string;
  visibility: Visibility;
  date: string;
  notes: string;
  stops: string[];
};
export type Bootstrap = {
  me: User | null;
  places: Place[];
  feed: Review[];
  posts: PhotoPost[];
  users: User[];
  following: string[];
  collections: Collection[];
  outings: Outing[];
  invitations: Invitation[];
  unread: number;
  mode: string;
  catalog?: {
    status: string;
    count: number;
    lastSuccess?: number;
    nextDue?: number;
    logos?: number;
    menus?: number;
    museums?: {
      count: number;
      sourceEntries: number;
      lastSuccess?: number;
      status: string;
    };
    prices?: number;
    cinemas?: { count: number; status: string; lastSuccess?: number };
    cities: { name: string; count: number }[];
    error?: string;
  };
};
export const CRITERIA: Record<Category, string[]> = {
  Café: ["Coffee & drinks", "Atmosphere", "Service", "Value"],
  Restaurant: ["Food", "Atmosphere", "Service", "Value"],
  Museum: ["Exhibits", "Accessibility", "Experience", "Value"],
  Cinema: ["Picture & sound", "Comfort", "Cleanliness", "Value"],
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);
export const average = (ratings: Record<string, number>) =>
  Object.values(ratings).reduce((s, n) => s + n, 0) /
  Math.max(1, Object.keys(ratings).length);
