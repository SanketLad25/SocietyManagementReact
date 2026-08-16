export const COMMITTEE_ROLES = ['Admin', 'Chairman', 'Secretary', 'Treasurer']

// Notice create/edit/publish/delete access (notice.md §8) — narrower than COMMITTEE_ROLES,
// excludes Treasurer. Must stay in sync with the backend's RoleNames.NoticeManagerRoles.
export const NOTICE_MANAGER_ROLES = ['Admin', 'Secretary', 'Chairman']

// Platform-level role, not tied to any society — creates societies and their first Admin.
export const SUPER_ADMIN_ROLE = 'SuperAdmin'

export function isCommitteeRole(role) {
  return COMMITTEE_ROLES.includes(role)
}

export function isNoticeManagerRole(role) {
  return NOTICE_MANAGER_ROLES.includes(role)
}
