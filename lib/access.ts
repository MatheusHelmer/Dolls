// This personal app has one authorized Google account.
export const loginEmail='matheushelmer13@gmail.com';
export function isOwnerEmail(email:string|null|undefined){return typeof email==='string'&&email.toLowerCase()===loginEmail;}
// The existing finance workspace belongs to the original backend identity.
// Changing sign-in must not create an empty workspace or move financial rows.
export const workspaceEmail='ioysolucoesemsoftware@gmail.com';
