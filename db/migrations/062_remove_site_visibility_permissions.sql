-- Migration 062: Remove site:show: and site:hidden: permissions
-- Reason: Site visibility is now controlled solely by RBAC capability checks
-- (isRouteAllowed / capabilities.ts). The site:show:/* permission system has been
-- removed from the frontend and is no longer needed in the DB.

-- Remove from policy_permissions (Policy System assignments)
DELETE FROM policy_permissions
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE name LIKE 'site:show:%'
       OR name LIKE 'site:hidden:%'
       OR name LIKE 'site:hide:%'
);

-- Remove from role_permissions (Classic RBAC)
DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE name LIKE 'site:show:%'
       OR name LIKE 'site:hidden:%'
       OR name LIKE 'site:hide:%'
);

-- Remove the permission definitions themselves
DELETE FROM permissions
WHERE name LIKE 'site:show:%'
   OR name LIKE 'site:hidden:%'
   OR name LIKE 'site:hide:%';
