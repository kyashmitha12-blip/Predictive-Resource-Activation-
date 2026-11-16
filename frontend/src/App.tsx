import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Spinner } from "@/components/ui";
import { RequireAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/layouts/AppLayout";
import { PublicLayout } from "@/layouts/PublicLayout";

const Landing = lazy(() => import("@/pages/public/Landing"));
const HowItWorks = lazy(() => import("@/pages/public/HowItWorks"));
const About = lazy(() => import("@/pages/public/About"));
const Terms = lazy(() => import("@/pages/public/Terms"));
const Privacy = lazy(() => import("@/pages/public/Privacy"));
const Login = lazy(() => import("@/pages/public/Login"));
const AdminLogin = lazy(() => import("@/pages/public/AdminLogin"));
const Register = lazy(() => import("@/pages/public/Register"));
const VerifyEmail = lazy(() => import("@/pages/public/VerifyEmail"));
const ForgotPassword = lazy(() => import("@/pages/public/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/public/ResetPassword"));
const Explore = lazy(() => import("@/pages/public/Explore"));
const ResourceDetail = lazy(() => import("@/pages/public/ResourceDetail"));
const Notifications = lazy(() => import("@/pages/public/Notifications"));
const NotFound = lazy(() => import("@/pages/public/NotFound"));
const Dashboard = lazy(() => import("@/pages/student/Dashboard"));
const ResourceForm = lazy(() => import("@/pages/student/ResourceForm"));
const MyResources = lazy(() => import("@/pages/student/MyResources"));
const MyBookings = lazy(() => import("@/pages/student/MyBookings"));
const BookingDetails = lazy(() => import("@/pages/student/BookingDetails"));
const ReturnForm = lazy(() => import("@/pages/student/ReturnForm"));
const IncomingRequests = lazy(() => import("@/pages/student/IncomingRequests"));
const Reviews = lazy(() => import("@/pages/student/Reviews"));
const Profile = lazy(() => import("@/pages/student/Profile"));
const ActivationList = lazy(() => import("@/pages/student/ActivationList"));
const ActivationDetail = lazy(() => import("@/pages/student/ActivationDetail"));
const Insights = lazy(() => import("@/pages/student/Insights"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const Verifications = lazy(() => import("@/pages/admin/Verifications"));
const Users = lazy(() => import("@/pages/admin/Users"));
const ResourceModeration = lazy(() => import("@/pages/admin/ResourceModeration"));
const BookingsAdmin = lazy(() => import("@/pages/admin/BookingsAdmin"));
const Reports = lazy(() => import("@/pages/admin/Reports"));
const Forecast = lazy(() => import("@/pages/admin/Forecast"));
const SupplyGap = lazy(() => import("@/pages/admin/SupplyGap"));
const ActivationAdmin = lazy(() => import("@/pages/admin/ActivationAdmin"));
const Platform = lazy(() => import("@/pages/admin/Platform"));

function EditRedirect() { const { id } = useParams(); return <Navigate to={`/app/resources/${id}/edit`} replace />; }

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper"><Spinner /></div>}>
      <Routes>
        <Route element={<PublicLayout dark />}>
          <Route index element={<Landing />} />
          <Route path="admin/login" element={<AdminLogin />} />
        </Route>
        <Route element={<PublicLayout />}>
          <Route path="how-it-works" element={<HowItWorks />} />
          <Route path="about" element={<About />} />
          <Route path="terms" element={<Terms />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="explore" element={<Explore base="/explore" />} />
          <Route path="explore/:id" element={<ResourceDetail />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="verify-email" element={<VerifyEmail />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
        </Route>

        <Route path="app" element={<RequireAuth role="student"><AppLayout mode="student" /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="browse" element={<Explore base="/app/browse" />} />
          <Route path="browse/:id" element={<ResourceDetail />} />
          <Route path="list" element={<ResourceForm />} />
          <Route path="resources" element={<MyResources />} />
          <Route path="resources/:id" element={<EditRedirect />} />
          <Route path="resources/:id/edit" element={<ResourceForm />} />
          <Route path="bookings" element={<MyBookings />} />
          <Route path="bookings/:id" element={<BookingDetails />} />
          <Route path="bookings/:id/return" element={<ReturnForm />} />
          <Route path="requests" element={<IncomingRequests />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
          <Route path="activation" element={<ActivationList />} />
          <Route path="activation/:id" element={<ActivationDetail />} />
          <Route path="insights" element={<Insights />} />
        </Route>

        <Route path="admin" element={<RequireAuth role="admin"><AppLayout mode="admin" /></RequireAuth>}>
          <Route index element={<AdminDashboard />} />
          <Route path="verifications" element={<Verifications />} />
          <Route path="users" element={<Users />} />
          <Route path="resources" element={<ResourceModeration />} />
          <Route path="bookings" element={<BookingsAdmin />} />
          <Route path="reports" element={<Reports />} />
          <Route path="forecast" element={<Forecast />} />
          <Route path="supply-gap" element={<SupplyGap />} />
          <Route path="activation" element={<ActivationAdmin />} />
          <Route path="platform" element={<Platform />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        <Route path="*" element={<PublicLayout />}><Route path="*" element={<NotFound />} /></Route>
      </Routes>
    </Suspense>
  );
}
