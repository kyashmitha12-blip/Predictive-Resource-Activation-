import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="container-x grid min-h-[50vh] place-items-center py-16 text-center">
      <div><h1 className="text-3xl">Page not found</h1><p className="mt-2 text-ink-2">The page you are looking for does not exist or has moved.</p><LinkButton to="/" className="mt-5">Back to home</LinkButton></div>
    </div>
  );
}
