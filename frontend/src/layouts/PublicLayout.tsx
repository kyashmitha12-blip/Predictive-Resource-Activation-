import { Menu, ShieldCheck, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { LinkButton, Logo } from "@/components/ui";
import { ChatAssistant } from "@/components/ChatAssistant";
import { homeFor, useAuth } from "@/hooks/useAuth";

const links = [
  { to: "/", label: "Home", end: true },
  { to: "/explore", label: "Explore Resources" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/about", label: "About" },
];

export function PublicLayout({ dark = false }: { dark?: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col selection:bg-cobalt/20 selection:text-cobalt">
      <header
        className={`sticky top-0 z-40 transition-colors duration-200 ${
          dark
            ? "border-b border-white/10 bg-night/90 backdrop-blur-md"
            : "border-b border-line/80 bg-paper/90 backdrop-blur-md shadow-subtle"
        }`}
      >
        <div className="container-x flex h-16 items-center justify-between">
          <Link to="/" aria-label="LEND & LOOP home" className="focus-visible:outline-cobalt">
            <Logo onNight={dark} />
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1.5 md:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-ctl px-3.5 py-1.5 text-sm font-medium transition-all ${
                    dark
                      ? isActive
                        ? "bg-white/15 text-white font-semibold shadow-sm"
                        : "text-white/75 hover:bg-white/10 hover:text-white"
                      : isActive
                      ? "bg-paper-2 text-cobalt font-semibold shadow-subtle"
                      : "text-ink-2 hover:bg-paper-2 hover:text-ink"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2.5 md:flex">
            {user ? (
              <LinkButton to={homeFor(user.role)} variant={dark ? "lamp" : "primary"} size="sm">
                Open workspace
              </LinkButton>
            ) : (
              <>
                <LinkButton
                  to="/login"
                  variant="ghost"
                  size="sm"
                  className={dark ? "text-white/80 hover:bg-white/10 hover:text-white" : ""}
                >
                  Login
                </LinkButton>
                <LinkButton to="/register" variant={dark ? "lamp" : "primary"} size="sm">
                  Get Started
                </LinkButton>
              </>
            )}
          </div>

          <button
            className={`flex h-9 w-9 items-center justify-center rounded-ctl transition-colors md:hidden ${
              dark ? "text-white hover:bg-white/10" : "text-ink hover:bg-paper-2"
            }`}
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className={`container-x pb-4 md:hidden ${dark ? "bg-night/95 text-white" : "bg-paper/95 text-ink"} animate-in slide-in-from-top-2 duration-150`}>
            <div className="flex flex-col gap-1 border-t border-line/40 pt-3">
              {links.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className={`rounded-ctl px-3 py-2 text-sm font-medium transition-colors ${
                    dark ? "text-white/90 hover:bg-white/10" : "text-ink hover:bg-paper-2"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
              <div className="mt-3 pt-3 border-t border-line/40 flex flex-col gap-2">
                {user ? (
                  <LinkButton to={homeFor(user.role)} size="sm" onClick={() => setOpen(false)}>
                    Open workspace
                  </LinkButton>
                ) : (
                  <>
                    <LinkButton to="/login" variant="secondary" size="sm" onClick={() => setOpen(false)}>
                      Login
                    </LinkButton>
                    <LinkButton to="/register" variant="primary" size="sm" onClick={() => setOpen(false)}>
                      Get Started
                    </LinkButton>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 bg-canvas">
        <Outlet />
      </main>
      <ChatAssistant />

      <footer className="on-night border-t border-white/10">
        <div className="container-x grid gap-10 py-14 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Logo onNight />
            <p className="mt-4 font-display text-xl font-extrabold text-white">
              Share More. Own Less.
            </p>
            <p className="mt-2.5 max-w-sm text-sm text-white/70 leading-relaxed">
              An intelligent campus resource-sharing network connecting students who need equipment with people who have gear to lend. Powered by predictive activation.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
              <Sparkles className="h-3.5 w-3.5 text-lamp" />
              <span>Campus Resource Activation Network</span>
            </div>
          </div>

          <nav aria-label="Explore" className="text-sm">
            <p className="eyebrow text-lamp">Explore Platform</p>
            <ul className="mt-3.5 space-y-2.5 text-white/75">
              <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/explore" className="hover:text-white transition-colors">Explore Resources</Link></li>
              <li><Link to="/how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
              <li><Link to="/register" className="hover:text-white transition-colors">Join Campus Network</Link></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Student Login</Link></li>
            </ul>
          </nav>

          <nav aria-label="About" className="text-sm">
            <p className="eyebrow text-lamp">About &amp; Trust</p>
            <ul className="mt-3.5 space-y-2.5 text-white/75">
              <li><Link to="/about" className="hover:text-white transition-colors">About LEND &amp; LOOP</Link></li>
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/admin/login" className="hover:text-white transition-colors">Administrator Portal</Link></li>
            </ul>
          </nav>
        </div>

        <div className="border-t border-white/10 bg-slate-950/40">
          <div className="container-x flex flex-wrap items-center justify-between gap-3 py-4 text-xs text-white/60">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-lamp" />
              <span>Academic college project. Payments are simulated and no real money moves.</span>
            </div>
            <p>© {new Date().getFullYear()} LEND &amp; LOOP. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
