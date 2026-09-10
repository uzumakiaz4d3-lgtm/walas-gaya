export async function GET() {
  return Response.json({ loggedIn: false, user: null });
}
