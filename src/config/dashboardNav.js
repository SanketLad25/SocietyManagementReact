// society-scoped items only make sense for accounts tied to one society — hidden for SuperAdmin.
export const NAV_ITEMS = [
  {
    key: 'home',
    label: 'Home',
    path: '/dashboard',
    end: true,
    societyScoped: true,
    icon: ['M3 10.5 12 3l9 7.5', 'M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5'],
  },
  {
    key: 'users',
    label: 'Manage Users',
    path: '/dashboard/admin/users',
    roles: ['Admin'],
    icon: [
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
      'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
      'M22 21v-2a4 4 0 0 0-3-3.87',
      'M16 3.13a4 4 0 0 1 0 7.75',
    ],
    description: 'Create and manage login accounts for your society.',
  },
  {
    key: 'societies',
    label: 'Societies',
    path: '/dashboard/societies',
    roles: ['SuperAdmin'],
    icon: [
      'M4 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16',
      'M12 21V10a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v11',
      'M7 8h1M7 12h1M7 16h1M16 13h1M16 17h1',
      'M4 21h16',
    ],
    description: 'Onboard new societies and their first Admin.',
  },
  {
    key: 'residents',
    societyScoped: true,
    label: 'Residents',
    path: '/dashboard/residents',
    icon: [
      'M8 20a4 4 0 0 1 8 0',
      'M12 13a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
      'M17.5 20a3.5 3.5 0 0 0-2.5-3.4',
      'M15.5 6.2a3 3 0 0 1 0 5.6',
    ],
    description: 'Manage resident profiles, ownership, and flat assignments.',
  },
  {
    key: 'flats',
    societyScoped: true,
    label: 'Flats',
    path: '/dashboard/flats',
    icon: [
      'M4 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16',
      'M12 21V10a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v11',
      'M7 8h1M7 12h1M7 16h1M16 13h1M16 17h1',
      'M4 21h16',
    ],
    description: 'View wings, floors, and flat-level maintenance amounts.',
  },
  {
    key: 'maintenance',
    societyScoped: true,
    roles: ['Admin', 'Chairman', 'Secretary', 'Treasurer', 'Resident'],
    label: 'Maintenance',
    path: '/dashboard/maintenance',
    icon: [
      'M3 7h18a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z',
      'M2 10h20',
      'M6 14h4',
    ],
    description: 'Track maintenance bills, dues, and payment status.',
  },
  {
    key: 'complaints',
    societyScoped: true,
    label: 'Complaints',
    path: '/dashboard/complaints',
    icon: [
      'M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 0 1-4-1L3 20l1.3-3.9a8.4 8.4 0 0 1-1.3-4.6A8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z',
      'M12 8v4',
      'M12 15.5h.01',
    ],
    description: 'Raise, track, and resolve resident complaints.',
  },
  {
    key: 'visitors',
    societyScoped: true,
    label: 'Visitors',
    path: '/dashboard/visitors',
    icon: [
      'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
      'M8 13.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
      'M14 10.5l1.3 1.3L18 9',
      'M5.5 17c.4-1.5 1.6-2.5 3-2.5h1c1.4 0 2.6 1 3 2.5',
    ],
    description: 'Log visitor entries and exits at the security gate.',
  },
  {
    key: 'notices',
    societyScoped: true,
    label: 'Notices',
    path: '/dashboard/notices',
    icon: ['M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8', 'M13.7 21a2 2 0 0 1-3.4 0'],
    description: 'Publish and browse society notice board updates.',
  },
  {
    key: 'events',
    societyScoped: true,
    label: 'Events',
    path: '/dashboard/events',
    icon: [
      'M7 3v4',
      'M17 3v4',
      'M4 8h16',
      'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
      'M9 13h2v2H9z',
    ],
    description: 'See upcoming society events and celebrations.',
  },
  {
    key: 'parking',
    societyScoped: true,
    label: 'Parking',
    path: '/dashboard/parking',
    icon: [
      'M5 17h14',
      'M5 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0Z',
      'M15 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0Z',
      'M5 17l1.5-5.5A2 2 0 0 1 8.4 10h7.2a2 2 0 0 1 1.9 1.5L19 17',
    ],
    description: 'Manage flat-wise parking slot and vehicle assignments.',
  },
  {
    key: 'knowledge',
    societyScoped: true,
    roles: ['Admin', 'Secretary', 'Chairman'],
    label: 'Knowledge Base',
    path: '/dashboard/knowledge',
    icon: [
      'M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
      'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z',
      'M9 7h7',
      'M9 11h7',
    ],
    description: 'Author FAQs, policies, and bylaws for the AI assistant to reference.',
  },
]

export const LOGOUT_ICON = ['M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3', 'M16 17l5-5-5-5', 'M21 12H9']

export function getVisibleNavItems(role) {
  const isSuperAdmin = role === 'SuperAdmin'
  return NAV_ITEMS.filter((item) => {
    if (item.societyScoped && isSuperAdmin) return false
    if (item.roles) return item.roles.includes(role)
    return true
  })
}
