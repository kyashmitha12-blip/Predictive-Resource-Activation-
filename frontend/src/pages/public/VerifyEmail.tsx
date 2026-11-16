import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { api, errMsg } from "@/lib/api";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { refresh, user } = useAuth();
  const [state, setState] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  const [msg, setMsg] = useState(token ? "" : "This link is missing its token. Open the link from your email, or request a new one from your dashboard.");
  useEffect(() => {
    if (!token) return;
    let live = true;
    api.post("/api/auth/verify-email", { token })
      .then(() => { if (live) { setState("ok"); refresh(); } })
      .catch((e) => { if (live) { setState("error"); setMsg(errMsg(e)); } });
    return () => { live = false; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-12">
      <div className="panel panel-pad w-full max-w-md text-center">
        {state === "loading" && <Spinner label="Verifying your email" />}
        {state === "ok" && <><h1 className="text-2xl">Email confirmed</h1><p className="mt-2 text-ink-2">Next, submit your student details so an administrator can verify you.</p><Link className="link mt-4 inline-block" to={user ? "/app/profile" : "/login"}>{user ? "Continue to verification" : "Sign in"}</Link></>}
        {state === "error" && <><h1 className="text-2xl">Link not valid</h1><p role="alert" className="mt-2 text-ink-2">{msg}</p><Link className="link mt-4 inline-block" to="/login">Back to sign in</Link></>}
      </div>
    </div>
  );
}
