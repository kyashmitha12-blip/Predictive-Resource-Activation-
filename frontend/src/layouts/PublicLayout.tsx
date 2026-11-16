import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { LinkButton, Logo } from "@/components/ui";
import { homeFor, useAuth } from "@/hooks/useAuth";

const links = [{ to: "/", label: "Home", end: true }, { to: "/explore", label: "Explore Resources" }, { to: "/how-it-works", label: "How It Works" }, { to: "/about", label: "About" }];

export function PublicLayout({ dark = false }: { dark?: boolean }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen flex-col">
      <header className={dark ? "on-night border-b border-white/10" : "border-b border-line bg-paper"}>
        <div className="container-x flex h-16 items-center justify-between">
          <Link to="/" aria-label="LEND & LOOP home"><Logo onNight={dark} /></Link>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `rounded-ctl px-3 py-2 text-sm ${dark ? "text-white/75 hover:text-white" : "text-ink-2 hover:text-ink"} ${isActive ? "font-semibold" : ""}`}>{l.label}</NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {user ? <LinkButton to={homeFor(user.role)} variant={dark ? "lamp" : "primary"} size="sm">Open workspace</LinkButton> : <>
              <LinkButton to="/login" variant="ghost" size="sm" className={dark ? "text-white/80 hover:bg-white/10 hover:text-white" : ""}>Login</LinkButton>
              <LinkButton to="/register" variant={dark ? "lamp" : "primary"} size="sm">Get Started</LinkButton></>}
          </div>
          <button className={`rounded-ctl p-2 md:hidden ${dark ? "text-white" : "text-ink"}`} onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
        </div>
        {open && (
          <div className="container-x flex flex-col gap-1 pb-4 md:hidden">
            {links.map((l) => <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className={`rounded-ctl px-2 py-2.5 ${dark ? "text-white/90" : "text-ink"}`}>{l.label}</Link>)}
            {user ? <LinkButton to={homeFor(user.role)} size="sm">Open workspace</LinkButton> : <div className="mt-2 flex gap-2"><LinkButton to="/login" variant="secondary" size="sm">Login</LinkButton><LinkButton to="/register" size="sm">Get Started</LinkButton></div>}
          </div>
        )}
      </header>
      <main className="flex-1 bg-canvas"><Outlet /></main>
      <footer className="on-night">
        <div className="container-x grid gap-8 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo onNight />
            <p className="mt-3 font-display text-lg font-bold">Share More. Own Less.</p>
            <p className="mt-2 max-w-sm text-sm text-white/70">An intelligent campus resource-sharing platform that connects students who need equipment with people who have resources to lend.</p>
          </div>
          <nav aria-label="Explore" className="text-sm"><p className="eyebrow">Explore</p><ul className="mt-3 space-y-2 text-white/80"><li><Link to="/" className="hover:text-white">Home</Link></li><li><Link to="/explore" className="hover:text-white">Explore Resources</Link></li><li><Link to="/how-it-works" className="hover:text-white">How It Works</Link></li><li><Link to="/register" className="hover:text-white">Get Started</Link></li><li><Link to="/login" className="hover:text-white">Login</Link></li></ul></nav>
          <nav aria-label="About" className="text-sm"><p className="eyebrow">About</p><ul className="mt-3 space-y-2 text-white/80"><li><Link to="/about" className="hover:text-white">About</Link></li><li><Link to="/terms" className="hover:text-white">Terms</Link></li><li><Link to="/privacy" className="hover:text-white">Privacy</Link></li></ul></nav>
        </div>
        <div className="border-t border-white/10"><p className="container-x py-4 text-xs text-white/60">A college project. Payments are simulated and no real money moves.</p></div>
      </footer>
    </div>
  );
}
