const { z, email, password } = require('../../utils/validators');

const register = z.object({
  name: z.string('Name is required').trim().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  email,
  password,
});

const login = z.object({
  email,
  // No strength rules on login: existing accounts may predate the policy.
  password: z.string('Password is required').min(1, 'Password is required').max(200),
});

const refresh = z.object({
  refreshToken: z.string('refreshToken is required').min(10).max(4096),
});

const logout = z.object({
  refreshToken: z.string().min(10).max(4096).optional(),
});

const forgotPassword = z.object({ email });

const resetPassword = z.object({
  token: z.string('Reset token is required').trim().min(20, 'Invalid reset token').max(200, 'Invalid reset token'),
  newPassword: password,
});

const changePassword = z
  .object({
    currentPassword: z.string('Current password is required').min(1, 'Current password is required').max(200),
    newPassword: password,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

module.exports = { register, login, refresh, logout, forgotPassword, resetPassword, changePassword };
