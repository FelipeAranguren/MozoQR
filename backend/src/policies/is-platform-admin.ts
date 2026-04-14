const ADMIN_EMAILS = ['marioealfonzo@gmail.com'];

export default async (policyContext: any, _config: any, { strapi }: any) => {
  const user = policyContext.state?.user;
  if (!user) return false;

  const email = String(user.email || '').trim().toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    return false;
  }

  return true;
};
