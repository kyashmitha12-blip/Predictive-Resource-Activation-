import { useMutation } from "@tanstack/react-query";
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, useToast } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { api, errMsg } from "@/lib/api";

/** Tells a student what stands between them and sharing/booking. Hidden once they are fully verified. */
export function VerificationBanner() {
  const { user } = useAuth();
  const toast = useToast();
  const resend = useMutation({
    mutationFn: () => api.post<{ dev_verification_link?: string; already_verified?: boolean; email_status?: string }>("/api/auth/resend-verification"),
    onSuccess: (r) => toast.info(r.dev_verification_link ? "Development mode: no email is sent. Use the link on your profile page." : r.email_status === "not_configured" ? "Email delivery is not set up on this server, so nothing was sent. Contact an administrator." : "Verification email requested."),
    onError: (e) => toast.error(errMsg(e)),
  });
  if (!user || user.role !== "student" || user.verification_status === "approved") return null;
  let text: ReactNode, action: ReactNode = null;
  if (!user.email_verified) {
    text = "Confirm your email address to start your student verification.";
    action = <Button size="sm" variant="secondary" loading={resend.isPending} onClick={() => resend.mutate()}>Resend email</Button>;
  } else if (user.verification_status === "pending") {
    text = "Your student verification is waiting for an administrator. You can browse, but not list or book yet.";
  } else if (user.verification_status === "rejected") {
    text = `Your verification was rejected${user.verification_reason ? `: ${user.verification_reason}` : "."}`;
    action = <Link to="/app/profile" className="link text-sm">Submit again</Link>;
  } else {
    text = "Submit your student details to list resources and request bookings.";
    action = <Link to="/app/profile" className="link text-sm">Start verification</Link>;
  }
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-lamp/40 bg-lamp-50 px-4 py-2 text-sm text-ink sm:px-6">
      <span>{text}</span>{action}
    </div>
  );
}
