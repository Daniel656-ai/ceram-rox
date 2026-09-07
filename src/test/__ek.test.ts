import { describe, it } from "vitest";
import { elementKey } from "@/lib/elementKeys";
describe("ek", () => { it("logs", () => {
 for (const s of ["% V₂O₅","V2O5 (%)","V2O5","Vanadiumpentoxid","Glühverlust","Dichte (roh)"]) console.log(JSON.stringify(s), "->", elementKey(s));
});});
