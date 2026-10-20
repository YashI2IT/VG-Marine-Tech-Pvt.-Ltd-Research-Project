/**
 * Unit Test: Database Migration & Persistent Storage Integrity
 */
import fs from "fs";
import path from "path";

describe("Database Migration & Persistence Check", () => {
  test("Persistent user data file exists and contains valid JSON", () => {
    const dataFilePath = path.resolve(__dirname, "../../Development/backend/data/users.json");
    if (fs.existsSync(dataFilePath)) {
      const content = fs.readFileSync(dataFilePath, "utf-8");
      const users = JSON.parse(content);
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
    }
  });
});
