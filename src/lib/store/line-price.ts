import type { DraftLine, Product } from "./types"

/** বিলের লাইনে যে প্রতি-পিস দামে বিক্রি হবে: বিলে বদলানো দাম থাকলে সেটা, নইলে পণ্যের দাম */
export function lineUnitPrice(line: Pick<DraftLine, "unitPrice">, product: Pick<Product, "pricePoisha">): number {
  return line.unitPrice ?? product.pricePoisha
}
