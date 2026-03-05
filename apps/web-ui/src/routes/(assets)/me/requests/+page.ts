import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** Redirect legacy /me/requests bookmarks to the unified requests page. */
export const load: PageLoad = () => {
    throw redirect(302, '/requests?tab=mine');
};
