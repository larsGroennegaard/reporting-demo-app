// lib/db.ts

// This trick ensures the in-memory array is not reset during hot-reloading in development.
// It attaches the array to the global object, which persists across reloads.

declare const global: {
  savedReports: any[];
};

if (!global.savedReports) {
  global.savedReports = [];
}

export const savedReports = global.savedReports;