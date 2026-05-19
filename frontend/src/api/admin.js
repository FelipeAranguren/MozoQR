import { client, unwrap } from './client';

export async function fetchAdminAuthCheck() {
  const res = await client.get('/admin/auth-check');
  return res.data;
}

export async function fetchPermissionsOverview({ search, page = 1, pageSize = 50, filter } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (filter) params.set('filter', filter);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  const res = await client.get(`/admin/permissions-overview?${params}`);
  return res.data;
}

export async function fetchAdminCustomers({ search, restauranteId, page = 1, pageSize = 50 } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (restauranteId) params.set('restauranteId', String(restauranteId));
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  const res = await client.get(`/admin/customers?${params}`);
  return res.data;
}

export async function fetchAdminUsers({ search, blocked, page = 1, pageSize = 50 } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (blocked !== undefined) params.set('blocked', String(blocked));
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  const res = await client.get(`/admin/users?${params}`);
  return unwrap(res);
}

export async function fetchAdminUser(id) {
  const res = await client.get(`/admin/users/${id}`);
  return unwrap(res);
}

export async function fetchAdminUserDetail(id) {
  const res = await client.get(`/admin/users/${id}/detail`);
  return res.data?.data ?? res.data;
}

export async function impersonateAdminUser(id, slug) {
  const res = await client.post(`/admin/users/${id}/impersonate`, slug ? { slug } : {});
  return res.data;
}

export async function adjustAdminUserLoyalty(userId, accountId, delta, notes) {
  const res = await client.post(`/admin/users/${userId}/loyalty-accounts/${accountId}/adjust`, {
    delta,
    notes,
  });
  return res.data?.data ?? res.data;
}

export async function createAdminUser(data) {
  const res = await client.post('/admin/users', data);
  return unwrap(res);
}

export async function updateAdminUser(id, data) {
  const res = await client.put(`/admin/users/${id}`, data);
  return unwrap(res);
}

export async function toggleBlockUser(id) {
  const res = await client.put(`/admin/users/${id}/block`);
  return unwrap(res);
}

export async function resetUserPassword(id, password) {
  const res = await client.put(`/admin/users/${id}/reset-password`, { password });
  return unwrap(res);
}

export async function fetchAdminMemberships({ restauranteId, userId, page = 1, pageSize = 100 } = {}) {
  const params = new URLSearchParams();
  if (restauranteId) params.set('restauranteId', String(restauranteId));
  if (userId) params.set('userId', String(userId));
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  const res = await client.get(`/admin/memberships?${params}`);
  return unwrap(res);
}

export async function updateMembership(id, data) {
  const res = await client.put(`/admin/memberships/${id}`, data);
  return unwrap(res);
}

export async function createMembership(data) {
  const res = await client.post('/admin/memberships', data);
  return unwrap(res);
}
