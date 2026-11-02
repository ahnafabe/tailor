/** Common foods with typical values per serving (USDA / Canadian Nutrient File): name, serving, kcal, protein, carbs, fat. */
const RAW: [string, string, number, number, number, number][] = [
  ["Chicken breast, cooked", "100 g", 165, 31, 0, 3.6], ["Ground beef 85/15, cooked", "100 g", 250, 26, 0, 15], ["Salmon, cooked", "100 g", 206, 22, 0, 12],
  ["Egg, large", "1 egg", 72, 6.3, 0.4, 4.8], ["Egg whites", "100 g", 52, 11, 0.7, 0.2], ["Greek yogurt 0%, plain", "170 g", 100, 17, 6, 0.7],
  ["Milk 2%", "250 ml", 130, 8.5, 12, 5], ["Whey protein", "1 scoop (30 g)", 120, 24, 3, 1.5], ["Cheddar cheese", "30 g", 120, 7, 0.4, 10],
  ["White rice, cooked", "1 cup (158 g)", 205, 4.3, 45, 0.4], ["Brown rice, cooked", "1 cup (195 g)", 218, 4.5, 46, 1.6], ["Oats, dry", "40 g", 150, 5, 27, 2.6],
  ["Pasta, cooked", "1 cup (140 g)", 220, 8, 43, 1.3], ["Bread, whole wheat", "1 slice", 80, 4, 14, 1], ["Potato, baked", "1 medium (173 g)", 161, 4.3, 37, 0.2],
  ["Basmati rice, cooked", "1 cup (163 g)", 210, 4.4, 46, 0.5], ["Roti / chapati", "1 piece (40 g)", 120, 3.5, 18, 3.7], ["Naan", "1 piece (90 g)", 262, 8.7, 45, 5.1],
  ["Dal (lentil curry)", "1 cup", 230, 12, 30, 7], ["Chickpeas, cooked", "1 cup", 269, 14.5, 45, 4.2], ["Banana", "1 medium", 105, 1.3, 27, 0.4],
  ["Apple", "1 medium", 95, 0.5, 25, 0.3], ["Peanut butter", "2 tbsp (32 g)", 190, 7, 7, 16], ["Almonds", "28 g", 164, 6, 6, 14],
  ["Olive oil", "1 tbsp", 119, 0, 0, 13.5], ["Butter", "1 tbsp", 102, 0.1, 0, 11.5], ["Avocado", "1/2 fruit", 120, 1.5, 6.4, 11],
  ["Broccoli", "1 cup", 31, 2.5, 6, 0.3], ["Mixed salad greens", "2 cups", 15, 1, 3, 0], ["Orange juice", "250 ml", 112, 1.7, 26, 0.5],
];
export interface LibraryFood { id: string; name: string; serving: string; kcal: number; p: number; c: number; f: number; staple?: boolean; bq?: number | null; bu?: string | null; barcode?: string | null; used?: number; est?: boolean }
export const STAPLES: LibraryFood[] = RAW.map(([name, serving, kcal, p, c, f], i) => ({ id: "st" + i, name, serving, kcal, p, c, f, staple: true }));
