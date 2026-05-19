import { isPlatformAdminEmail } from '../config/platform-admin';

export default async (policyContext: any, _config: any, { strapi }: any) => {
  const user = policyContext.state?.user;
  if (!user) return false;

  if (!isPlatformAdminEmail(user.email)) {
    return false;
  }

  return true;
};
