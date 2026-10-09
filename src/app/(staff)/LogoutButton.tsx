"use client";

export function LogoutButton() {
  return (
    <button
      className="text-slate-500 hover:text-red-600"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
    >
      Sign out
    </button>
  );
}
