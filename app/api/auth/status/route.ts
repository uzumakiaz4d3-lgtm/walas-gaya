import { getSessionUser, json } from "../../../../lib/auth";
import { getStore, publicUser } from "../../../../lib/store";

export async function GET(request: Request) {
  const session = getSessionUser(request);
  if (!session) {
    return json({ loggedIn: false, user: null });
  }
  try {
    const store = getStore();
    await store.ensureReady();
    const user = await store.findUserById(session.sub);
    if (!user || user.status === "nonaktif") {
      return json({ loggedIn: false, user: null });
    }
    return json({ loggedIn: true, user: publicUser(user) });
  } catch {
    return json({ loggedIn: false, user: null });
  }
}