import { describe, expect, it } from 'vitest'
import {
  amountLabel,
  cardLines,
  fallbackMealName,
  fmtMacro,
  itemFor,
  macrosFor,
  per100OfItem,
  sumMacros,
  unitWord,
} from './diet'
import type { FoodItem, MealItem } from '../types'

const broccoli: FoodItem = {
  id: 'f1',
  name: 'Broccoli, cooked',
  brand: null,
  kcal_per_100g: 35,
  protein_per_100g: 2.4,
  carbs_per_100g: 7.2,
  fat_per_100g: 0.4,
  barcode: null,
  user_id: null,
  seeded: true,
  editable: false,
  units: [
    { id: 'u1', name: 'cup', grams: 91, user_id: null },
    { id: 'u2', name: 'floret', grams: 11, user_id: 'me' },
  ],
  last_used: null,
}

function item(name: string, grams: number | null, extra: Partial<MealItem> = {}): MealItem {
  return {
    food_item_id: null,
    name,
    unit_name: null,
    unit_quantity: grams,
    quantity_g: grams,
    kcal: 100,
    protein_g: 10,
    carbs_g: 5,
    fat_g: 2,
    ...extra,
  }
}

describe('amounts', () => {
  it('turns a unit and a number into grams and macros', () => {
    const it2 = itemFor(broccoli, broccoli.units[0]!, 2)
    expect(it2.quantity_g).toBe(182)
    expect(it2.unit_name).toBe('cup')
    expect(it2.unit_quantity).toBe(2)
    expect(it2.kcal).toBeCloseTo(63.7)
    expect(it2.protein_g).toBeCloseTo(4.368)

    const grams = itemFor(broccoli, null, 150)
    expect(grams.unit_name).toBeNull()
    expect(grams.quantity_g).toBe(150)
    expect(grams.kcal).toBeCloseTo(52.5)
  })

  it('scales a logged item whose food is gone', () => {
    const per100 = per100OfItem(item('Old', 50))!
    expect(macrosFor(per100, 100).kcal).toBe(200)
    expect(per100OfItem(item('Quick entry', null))).toBeNull()
  })

  it('labels amounts as entered', () => {
    expect(amountLabel(item('x', 150))).toBe('150 g')
    expect(amountLabel({ unit_name: 'cup', unit_quantity: 2, quantity_g: 182 })).toBe('2 cups · 182 g')
    expect(amountLabel({ unit_name: 'medium', unit_quantity: 1, quantity_g: 182.4 })).toBe(
      '1 medium · 182 g',
    )
    expect(amountLabel({ unit_name: 'tbsp', unit_quantity: 1.5, quantity_g: 15 })).toBe('1.5 tbsp · 15 g')
    expect(amountLabel(item('x', null))).toBeNull()
  })

  it('pluralizes unit words', () => {
    expect(unitWord('cookie', 3)).toBe('cookies')
    expect(unitWord('cookie', 1)).toBe('cookie')
    expect(unitWord('glass', 2)).toBe('glasses')
    expect(unitWord('patty', 2)).toBe('patties')
    expect(unitWord('egg white', 2)).toBe('egg whites')
    expect(unitWord('medium', 2)).toBe('medium')
    expect(unitWord('tbsp', 2)).toBe('tbsp')
    expect(unitWord('cup', 0.5)).toBe('cups')
  })

  it('formats macros with a decimal only when small', () => {
    expect(fmtMacro(4.24)).toBe('4.2')
    expect(fmtMacro(0)).toBe('0')
    expect(fmtMacro(12.6)).toBe('13')
  })
})

describe('totals', () => {
  it('adds up items', () => {
    expect(sumMacros([item('a', 10), item('b', 20)])).toEqual({
      kcal: 200,
      protein_g: 20,
      carbs_g: 10,
      fat_g: 4,
    })
    expect(sumMacros([])).toEqual({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })
  })
})

describe('meal names and card lines', () => {
  it('falls back to the foods while Claude has not named the meal', () => {
    expect(fallbackMealName([])).toBe('New meal')
    expect(fallbackMealName([item('Apple, raw', 182)])).toBe('Apple')
    expect(fallbackMealName([item('Salmon, Atlantic, cooked', 150), item('Potatoes', 250)])).toBe(
      'Salmon & Potatoes',
    )
    expect(fallbackMealName([item('Oats', 60), item('Whey', 30), item('Banana', 118), item('Milk', 200)])).toBe(
      'Oats, Whey & 2 more',
    )
  })

  it("uses Claude's groups with the group's grams", () => {
    const items = [
      item('Tofu', 150),
      item('Seitan', 100),
      item('Olive oil', 10, { unit_name: 'tbsp', unit_quantity: 1 }),
    ]
    const { lines, more } = cardLines({
      items,
      summary: [
        { text: 'Tofu and seitan', items: [0, 1] },
        { text: 'Olive oil', items: [2] },
      ],
    })
    expect(lines).toEqual([
      { text: 'Tofu and seitan', amount: '250 g' },
      { text: 'Olive oil', amount: '1 tbsp · 10 g' },
    ])
    expect(more).toBe(0)
  })

  it('lists the items when there is no summary', () => {
    const items = ['A', 'B', 'C', 'D', 'E'].map((n) => item(n, 10))
    const { lines, more } = cardLines({ items, summary: null })
    expect(lines.map((l) => l.text)).toEqual(['A', 'B'])
    expect(more).toBe(3)
    expect(cardLines({ items: items.slice(0, 3), summary: null }).more).toBe(0)
  })
})
