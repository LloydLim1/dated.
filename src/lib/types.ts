export type Visibility = "public" | "followers" | "private";
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
  lat: number;
  lng: number;
  budget: number;
  tags: string[];
  rating: number | null;
  reviewCount: number;
  independentVisits: number;
  sample: boolean;
  hours: string;
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
  spending: number;
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
};
export type Bootstrap = {
  me: User | null;
  places: Place[];
  feed: Review[];
  users: User[];
  following: string[];
  collections: Collection[];
  outings: Outing[];
  invitations: Invitation[];
  unread: number;
  mode: string;
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
