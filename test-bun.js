import { Database } from "bun:sqlite";
const db = new Database(":memory:");
db.pragma = function(str) {
   return this.query("PRAGMA " + str).all();
}
console.log(db.pragma("journal_mode"));
