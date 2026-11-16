import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import { AuthProvider, RequireAuth } from "@/hooks/useAuth";
import Login from "@/pages/public/Login";
import Register from "@/pages/public/Register";

const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
const user = (role = "student") => ({ id: 1, email: "a@b.dev", name: "Test User", student_id: "X1", department: "CSE", college: "", role, account_status: "active", email_verified: true, verification_status: "approved", verification_reason: null, open_to_activation: true, preferred_area: "", created_at: "", is_demo: false });

function renderAt(path: string, ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={[path]}><ToastProvider><AuthProvider>{ui}</AuthProvider></ToastProvider></MemoryRouter></QueryClientProvider>);
}
const routes = (
  <Routes>
    <Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} />
    <Route path="/app" element={<RequireAuth role="student"><p>student home</p></RequireAuth>} />
    <Route path="/admin" element={<RequireAuth role="admin"><p>admin home</p></RequireAuth>} />
  </Routes>
);
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe("authentication UI", () => {
  it("redirects anonymous visitors from protected routes to login", async () => {
    fetchMock.mockImplementation(() => json(401, { detail: "Please sign in" }));
    renderAt("/app", routes);
    expect(await screen.findByRole("heading", { name: "Login to LEND & LOOP" })).toBeInTheDocument();
  });

  it("keeps students out of the admin area", async () => {
    fetchMock.mockImplementation((url: string) => url.includes("/auth/me") ? json(200, { user: user("student"), csrf_token: "t" }) : json(404, {}));
    renderAt("/admin", routes);
    expect(await screen.findByText("student home")).toBeInTheDocument();
    expect(screen.queryByText("admin home")).not.toBeInTheDocument();
  });

  it("shows the server's error message for bad credentials", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => url.includes("/auth/login") && init?.method === "POST" ? json(401, { detail: "Incorrect email or password." }) : json(401, { detail: "no session" }));
    renderAt("/login", routes);
    await userEvent.type(await screen.findByLabelText("College email"), "a@b.dev");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-pass-1");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
  });

  it("signs in and goes to the role's home", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => url.includes("/auth/login") && init?.method === "POST" ? json(200, { user: user("student"), csrf_token: "tok" }) : json(401, { detail: "no session" }));
    renderAt("/login", routes);
    await userEvent.type(await screen.findByLabelText("College email"), "a@b.dev");
    await userEvent.type(screen.getByLabelText("Password"), "Correct-pass1");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));
    expect(await screen.findByText("student home")).toBeInTheDocument();
  });
});

describe("registration form", () => {
  it("validates before sending anything to the server", async () => {
    fetchMock.mockImplementation(() => json(401, { detail: "no session" }));
    renderAt("/register", routes);
    await userEvent.click(await screen.findByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Enter your full name.")).toBeInTheDocument();
    expect(screen.getByText("Enter your college email.")).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters with a letter and a number/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).includes("/auth/register") && i?.method === "POST")).toBe(false);
  });

  it("shows the dev-mode link honestly when no email is sent", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => url.includes("/auth/register") && init?.method === "POST"
      ? json(201, { user: user(), csrf_token: "t", dev_verification_link: "http://localhost:5173/verify-email?token=abc" }) : json(401, { detail: "no session" }));
    renderAt("/register", routes);
    await userEvent.type(await screen.findByLabelText("Full name"), "Test Student");
    await userEvent.type(screen.getByLabelText("College email"), "t@college.dev");
    await userEvent.type(screen.getByLabelText("Student / register ID"), "RIT22CS1");
    await userEvent.type(screen.getByLabelText("Department"), "CSE");
    await userEvent.type(screen.getByLabelText("Password"), "Passw0rdOK1");
    await userEvent.type(screen.getByLabelText("Confirm password"), "Passw0rdOK1");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(screen.getByText(/no email was sent/i)).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /verify-email\?token=abc/ })).toBeInTheDocument();
  });

  it("blocks a mismatched confirmation and can reveal the password", async () => {
    fetchMock.mockImplementation(() => json(401, { detail: "no session" }));
    renderAt("/register", routes);
    const pw = await screen.findByLabelText("Password");
    await userEvent.type(pw, "Passw0rdOK1");
    await userEvent.type(screen.getByLabelText("Confirm password"), "Different1");
    expect(pw).toHaveAttribute("type", "password");
    await userEvent.click(screen.getAllByRole("button", { name: "Show password" })[0]);
    expect(pw).toHaveAttribute("type", "text");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("The passwords do not match.")).toBeInTheDocument();
  });
});
