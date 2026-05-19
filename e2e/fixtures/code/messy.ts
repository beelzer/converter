// pricing utility
export function priceWithTax(amount: number, taxRate: number = 0.2): number {
  const tax = amount * taxRate;
  return amount + tax;
}
const _unused = 42;
console.log(priceWithTax(100));
