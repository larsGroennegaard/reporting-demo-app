// lib/db.ts

// This will act as our shared in-memory database for the prototype.
// All API routes will import from this file to ensure they use the same data array.
export const savedReports: any[] = [];