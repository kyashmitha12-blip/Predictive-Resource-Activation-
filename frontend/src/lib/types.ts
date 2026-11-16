export type Role = "student" | "admin";
export type VerificationStatus = "not_submitted" | "pending" | "approved" | "rejected";
export type BookingStatus = "requested" | "confirmed" | "active" | "returned" | "completed" | "rejected" | "cancelled" | "disputed";
export type ResourceStatus = "active" | "inactive" | "maintenance" | "archived" | "removed";
export type Condition = "new" | "good" | "fair" | "worn";
export type ActivationStatus = "pending" | "accepted" | "declined" | "withdrawn" | "expired";

export interface User {
  id: number; email: string; name: string; student_id: string; department: string; college: string;
  role: Role; account_status: "active" | "suspended"; email_verified: boolean;
  verification_status: VerificationStatus; verification_reason: string | null;
  open_to_activation: boolean; preferred_area: string; created_at: string; is_demo: boolean;
}
export interface Session { user: User; csrf_token: string }
export interface Page<T> { items: T[]; total: number; page: number; page_size: number; pages: number }

export interface OwnerStats {
  completed_rentals: number; completed_as_owner: number; completed_as_borrower: number;
  on_time_return_rate: number | null; average_rating: number | null; review_count: number; late_cancellations: number; reliability: number;
}
export interface PublicUser { id: number; name: string; department: string; verified: boolean; member_since: string; stats?: OwnerStats }
export interface Window { id: number; start_at: string; end_at: string; source: "owner" | "activation" }
export interface Resource {
  id: number; name: string; category: string; category_label: string; description: string; condition: Condition;
  price_per_day: number; deposit: number; pickup_area: string; min_hours: number; max_days: number; status: ResourceStatus;
  images: { id: number; url: string }[]; owner: PublicUser; last_booked_at: string | null; created_at: string; is_demo: boolean;
  moderation_note: string | null; newly_activated: boolean; next_window: { start_at: string; end_at: string } | null;
  availability?: Window[]; blocked?: { start_at: string; end_at: string }[]; completed_rentals?: number;
  booking_count?: number; pending_requests?: number;
}
export interface BookingCan {
  approve: boolean; reject: boolean; cancel: boolean; handover: boolean; return: boolean; confirm_return: boolean; review: boolean; report: boolean;
}
export interface Booking {
  id: number; status: BookingStatus; start_at: string; end_at: string; note: string;
  resource: { id: number; name: string; category: string; category_label: string; pickup_area: string; image_url: string | null };
  borrower: { id: number; name: string }; owner: { id: number; name: string };
  rental_amount: number; deposit_amount: number; payment_status: string; deposit_status: string; payment_notice: string;
  returned_at: string | null; completed_at: string | null; returned_on_time: boolean | null; late_cancellation: boolean;
  created_at: string; is_demo: boolean; can: BookingCan;
  history?: { from_status: string | null; to_status: string; actor_id: number | null; note: string; created_at: string }[];
  condition_reports?: { id: number; kind: "handover" | "return"; reporter_id: number; condition: string; notes: string; photo_count: number; created_at: string }[];
}
export interface Activation {
  id: number; status: ActivationStatus; category: string; category_label: string; period_start: string; period_end: string;
  predicted_demand: number; supply_at_request: number; gap_at_request: number; reason: string; idle_score: number;
  score_breakdown: Record<string, number>; available_from: string | null; available_until: string | null;
  decline_reason: string | null; created_at: string; responded_at: string | null; is_demo: boolean;
  resource: { id: number; name: string; min_hours: number; condition: Condition; image_url: string | null };
  owner?: { id: number; name: string };
}
export interface Notification { id: number; type: string; title: string; body: string; link: string | null; read: boolean; created_at: string }
export interface Review {
  id: number; booking_id: number; rating: number; comment: string; created_at: string;
  reviewer: { id: number; name: string }; reviewee: { id: number; name: string };
}
export interface ForecastCategory {
  category: string; predicted_demand: number; lower: number; upper: number; total_listed: number; effective_supply: number;
  supply_at_forecast: number; supply_gap: number; gap_at_forecast: number; demand_level: "low" | "moderate" | "high" | "critical";
  pending_requests: number; accepted_requests: number; label?: string; eligible_idle?: number;
}
export interface Forecast {
  available?: boolean; run_id: string; period_start: string; period_end: string; created_at: string; model_name: string;
  model_version: string; data_basis: "synthetic_only" | "mixed" | "real_only"; data_note: string; categories: ForecastCategory[];
  evaluations: { model_name: string; mae: number; rmse: number; is_selected: boolean; n_train: number; n_test: number }[];
}
export interface MatchResult {
  matches: { score: number; reasons: string[]; components: Record<string, number>; estimated_cost: number; deposit: number; newly_activated: boolean; resource: Resource }[];
  considered: number; excluded_unavailable: number; excluded_over_budget: number; weights: Record<string, number>; method: string;
}
export const CATEGORIES: { value: string; label: string }[] = [
  { value: "projector", label: "Projectors" }, { value: "camera", label: "Cameras & tripods" }, { value: "audio", label: "Audio equipment" },
  { value: "electronics_kit", label: "Arduino & electronics kits" }, { value: "laptop", label: "Laptops & accessories" },
  { value: "lab_equipment", label: "Lab equipment" }, { value: "tool", label: "Tools" }, { value: "event_equipment", label: "Event equipment" },
];
