import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
const email = process.argv[2];
if (!email) {
  console.error(
    "Usage: npm run admin -- moderator@example.com (register the account first)",
  );
  process.exit(1);
}
const db = new DatabaseSync(
  resolve(process.env.DATED_DATA_DIR || ".data", "dated.sqlite"),
);
const result = db
  .prepare("UPDATE users SET role='admin' WHERE email=? AND demo=0")
  .run(email.toLowerCase());
console.log(
  result.changes
    ? "Moderator role granted. Sign in to open Moderation."
    : "No matching registered account.",
);
db.close();
