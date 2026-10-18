/**
 * Diet maths and labels, kept pure for tests: amounts (a unit and a number,
 * converted to grams), macros, totals, and the names the timeline falls back
 * to while Claude hasn't named a meal.
 */
import type { FoodItem, FoodUnit, MacroTotals, Meal, MealItem, SummaryLine } from '../types'

export const ZERO: MacroTotals = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }

/** A food's per-100 g values, or what a logged item implies when its food is gone. */
export interface Per100 {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export function per100OfFood(food: FoodItem): Per100 {
  return {
    kcal: food.kcal_per_100g,
    protein_g: food.protein_per_100g,
    carbs_g: food.carbs_per_100g,
    fat_g: food.fat_per_100g,
  }
}

/** Null when the item has no weight to scale by (an old quick entry). */
export function per100OfItem(item: MealItem): Per100 | null {
  if (!item.quantity_g) return null
  const f = 100 / item.quantity_g
  return {
    kcal: item.kcal * f,
    protein_g: item.protein_g * f,
    carbs_g: item.carbs_g * f,
    fat_g: item.fat_g * f,
  }
}

export function macrosFor(per100: Per100, grams: number): MacroTotals {
  const f = grams / 100
  return {
    kcal: per100.kcal * f,
    protein_g: per100.protein_g * f,
    carbs_g: per100.carbs_g * f,
    fat_g: per100.fat_g * f,
  }
}

export function sumMacros(items: MacroTotals[]): MacroTotals {
  return items.reduce(
    (t, i) => ({
      kcal: t.kcal + i.kcal,
      protein_g: t.protein_g + i.protein_g,
      carbs_g: t.carbs_g + i.carbs_g,
      fat_g: t.fat_g + i.fat_g,
    }),
    ZERO,
  )
}

/** The unit named `name` (case-insensitive), or null for grams. */
export function findUnit(units: FoodUnit[], name: string | null): FoodUnit | null {
  if (!name) return null
  const key = name.toLowerCase()
  return units.find((u) => u.name.toLowerCase() === key) ?? null
}

export function gramsOf(unit: FoodUnit | null, quantity: number): number {
  return unit ? unit.grams * quantity : quantity
}

/** A meal item for `quantity` of `unit` (null = grams) of `food`. */
export function itemFor(
  food: FoodItem,
  unit: FoodUnit | null,
  quantity: number,
  per100: Per100 = per100OfFood(food),
): MealItem {
  const grams = gramsOf(unit, quantity)
  return {
    food_item_id: food.id,
    name: food.name,
    unit_name: unit ? unit.name : null,
    unit_quantity: quantity,
    quantity_g: grams,
    ...macrosFor(per100, grams),
  }
}

// Words that read the same for one or many ("2 medium", "3 tbsp").
const NO_PLURAL = new Set(['medium', 'small', 'large', 'tbsp', 'tsp', 'oz', 'ml', 'l', 'g', 'kg'])

/** "cup" → "cups" for anything but one. */
export function unitWord(name: string, quantity: number): string {
  if (quantity === 1) return name
  const words = name.split(' ')
  const last = words[words.length - 1] ?? name
  const lower = last.toLowerCase()
  let plural = last
  if (NO_PLURAL.has(lower) || /\d/.test(lower)) plural = last
  else if (/(s|x|z|ch|sh)$/.test(lower)) plural = `${last}es`
  else if (/[^aeiou]y$/.test(lower)) plural = `${last.slice(0, -1)}ies`
  else plural = `${last}s`
  return [...words.slice(0, -1), plural].join(' ')
}

/** At most one decimal, none when whole: 2, 0.5, 12.3. */
export function fmtQty(n: number): string {
  return String(Math.round(n * 10) / 10)
}

/** Macro grams in tables: one decimal under 10, whole above. */
export function fmtMacro(n: number): string {
  return n < 10 ? fmtQty(n) : String(Math.round(n))
}

export function fmtKcal(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

/** "150 g", "1 medium · 182 g", "2 cups · 182 g"; null when unknown. */
export function amountLabel(item: Pick<MealItem, 'unit_name' | 'unit_quantity' | 'quantity_g'>): string | null {
  const grams = item.quantity_g != null ? `${Math.round(item.quantity_g)} g` : null
  if (item.unit_name && item.unit_quantity != null) {
    const unit = `${fmtQty(item.unit_quantity)} ${unitWord(item.unit_name, item.unit_quantity)}`
    return grams ? `${unit} · ${grams}` : unit
  }
  return grams
}

/** "Chicken Breast, roasted, skinless" → "Chicken Breast". */
export function shortName(name: string): string {
  return (name.split(',')[0] ?? name).trim() || name
}

/** What a meal is called before Claude has named it (or without Claude). */
export function fallbackMealName(items: Pick<MealItem, 'name'>[]): string {
  const names = items.map((i) => shortName(i.name))
  if (names.length === 0) return 'New meal'
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names[0]}, ${names[1]} & ${names.length - 2} more`
}

export function mealName(meal: Pick<Meal, 'name' | 'items'>): string {
  return meal.name ?? fallbackMealName(meal.items)
}

export interface CardLine {
  text: string
  amount: string | null
}

const MAX_LINES = 3

/**
 * The timeline card's lines: Claude's grouping when it describes these items
 * (a line's amount is the item's own amount, or the grams of its group),
 * else the items themselves. `more` counts the items not listed.
 */
export function cardLines(meal: Pick<Meal, 'items' | 'summary'>): { lines: CardLine[]; more: number } {
  const { items } = meal
  const summary: SummaryLine[] | null = meal.summary
  if (summary && summary.length > 0) {
    const lines = summary.map((line) => {
      const group = line.items.map((i) => items[i]).filter((i): i is MealItem => !!i)
      if (group.length === 1) return { text: line.text, amount: amountLabel(group[0]!) }
      const grams = group.every((i) => i.quantity_g != null)
        ? `${Math.round(group.reduce((g, i) => g + (i.quantity_g ?? 0), 0))} g`
        : null
      return { text: line.text, amount: grams }
    })
    return { lines, more: 0 }
  }
  const shown = items.length > MAX_LINES ? items.slice(0, MAX_LINES - 1) : items
  return {
    lines: shown.map((i) => ({ text: shortName(i.name), amount: amountLabel(i) })),
    more: items.length - shown.length,
  }
}

/** A fresh client-side id for a new meal (the server upserts by it). */
export function newMealId(): string {
  return crypto.randomUUID()
}

export function nowHHMM(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** The Diet tab's address for a day: today has none, so it follows the clock. */
export function dayPath(date: string, today: string): string {
  return date >= today ? '/diet' : `/diet?date=${date}`
}
