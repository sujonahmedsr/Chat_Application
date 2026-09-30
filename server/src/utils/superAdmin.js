const SUPER_ADMIN_EMAILS = [
  'shofiqul.sujon2201@gmail.com',
];

const isSuperAdminEmail = (email) => {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase().trim());
};

module.exports = {
  SUPER_ADMIN_EMAILS,
  isSuperAdminEmail,
};
