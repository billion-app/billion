import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, getSession } from "~/auth/server";
import { DiscordSignInButton, SignOutButton } from "./auth-button-tracked";

export async function AuthShowcase() {
  const session = await getSession();

  if (!session) {
    const signInAction = async () => {
      "use server";
      const res = await auth.api.signInSocial({
        body: {
          provider: "discord",
          callbackURL: "/",
        },
      });
      if (!res.url) {
        throw new Error("No URL returned from signInSocial");
      }
      redirect(res.url);
    };

    return (
      <form>
        <DiscordSignInButton formAction={signInAction} />
      </form>
    );
  }

  const signOutAction = async () => {
    "use server";
    await auth.api.signOut({
      headers: await headers(),
    });
    redirect("/");
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <p className="text-center text-2xl">
        <span>Logged in as {session.user.name}</span>
      </p>

      <form>
        <SignOutButton formAction={signOutAction} />
      </form>
    </div>
  );
}
