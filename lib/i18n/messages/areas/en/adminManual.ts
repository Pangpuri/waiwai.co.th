/** Dictionary area: backend user manual (round 366) — /admin/manual */
export const adminManual = {
  manualPage: {
    brandSuffix: "Corporate website management system",
    title: "Backend user manual and access permissions",
    back: "Back to the admin dashboard",
    intro:
      "This manual explains the backend architecture, operating scope, and usage guide by user permission. It follows the product roadmap and RBAC guidelines.",
    accountLabel: "Current account:",
    roleLabel: "Role:",
    accessLabel: "Permission status:",
    accessCount: "Access to {count} permissions",
    architectureTitle: "Backend architecture and core concepts",
    concepts: [
      {
        title: "1. Draft & Published Separation",
        body:
          "Every page edit is saved as a draft first. Nothing changes on the public site until an explicit publish action, which prevents accidental changes to production content.",
      },
      {
        title: "2. Revision History & Restore",
        body:
          "Each publish creates a snapshot of the content. Administrators can review, restore, or compare previous revisions at any time.",
      },
      {
        title: "3. Secure Preview Tokens",
        body:
          "Temporary preview links (`/preview/[token]`) let executives or teammates review draft pages without an admin account. Links expire and are excluded from search engines.",
      },
      {
        title: "4. PDPA & Data Retention",
        body:
          "Contact messages and activity data follow PDPA requirements, with automatic retention cleanup, erasure requests, and an audit trail.",
      },
    ],
    rolesTitle: "Role-based operational scope",
    rolesIntro: "The backend has four roles to separate duties and keep access safe.",
    scopeLabel: "Scope:",
    roles: [
      {
        name: "Editor",
        scope: "Manages all content and pages",
        permissions: "Permissions: content, careers, media, presets, preview, account, manual",
        body:
          "Suitable for Content/Marketing teams creating and editing copy, images, products, news, recipes, executives, and job postings.",
        can: [
          "Create/edit the home, company, executives, products, news, recipes, and shared sections",
          "Manage the media library (upload, resize, captions)",
          "Create temporary preview links for executive review",
        ],
        cannot: ["Cannot see the customer inbox or shared trash"],
      },
      {
        name: "Publisher",
        scope: "Editor + customer data, SEO, and trash",
        permissions: "Permissions: all Editor permissions + inbox, seo, trash, manual",
        body:
          "Has Editor capabilities plus customer contact messages, global SEO settings, and trash restore/permanent deletion.",
        can: [
          "View and manage customer contact messages (PDPA protected)",
          "Configure global SEO and meta tags",
          "Manage trash (restore or permanently delete)",
        ],
        cannot: ["Cannot create/block other admin accounts or change server-level settings"],
      },
      {
        name: "Admin",
        scope: "Full access to every function",
        permissions: "Permissions: every permission in the system (15)",
        body:
          "Controls the entire system, including admin accounts, roles, organization settings, PDPA retention, maintenance mode, and analytics.",
        can: [
          "Manage admin accounts and roles (Users & RBAC)",
          "Configure organization data and PDPA/retention",
          "Control maintenance mode",
          "View traffic and click analytics",
        ],
        cannot: [],
      },
      {
        name: "HR",
        scope: "Job postings and own account only",
        permissions: "Permissions: careers, account, manual",
        body:
          "A specialized role for HR staff to manage job postings, edit vacancies, and change their own password. It cannot touch other site content.",
        can: ["Create/edit/close job postings (Careers)", "Change own password and email"],
        cannot: ["Cannot see other site menus (products, news, recipes, home, etc.)", "Cannot manage other admin accounts"],
      },
    ],
    quickLinksTitle: "Quick links and navigation",
    quickLinksIntro:
      "Use the links below to open the settings or management screens you can access. Only modules allowed by your role are shown.",
    tableModule: "Module / section",
    tablePath: "Path (URL)",
    tablePermission: "Permission",
    tableAction: "Action",
    open: "Open",
    links: {
      dashboard: "Admin dashboard",
      home: "Edit home content",
      products: "Manage products and categories",
      media: "Media library",
      inbox: "Customer inbox",
      trash: "Trash and restore",
      careers: "Job postings (Careers)",
      settings: "System and organization settings",
      users: "Admin accounts (Users & RBAC)",
    },
  },
};
