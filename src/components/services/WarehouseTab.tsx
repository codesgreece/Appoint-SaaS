import { useEffect, useMemo, useState } from "react"
import { Package, Plus, Trash2, Pencil, Search } from "lucide-react"
import type { AppLanguage } from "@/contexts/LanguageContext"
import type { InventoryCategory, InventoryItem, InventoryUnitType } from "@/types"
import {
  createInventoryCategory,
  createInventoryItem,
  deleteInventoryCategory,
  deleteInventoryItem,
  fetchInventoryCategories,
  fetchInventoryItems,
  inventoryStockLevel,
  notifyInventoryLowIfNeeded,
  updateInventoryCategory,
  updateInventoryItem,
} from "@/services/api"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type WarehouseTabProps = {
  businessId: string | null
  language: AppLanguage
  onLowStockCountChange?: (count: number) => void
}

type CategoryForm = { name: string; image_url: string }
type ItemForm = {
  name: string
  category_id: string
  unit_type: InventoryUnitType
  quantity_current: string
  orange_threshold: string
  red_threshold: string
}

const i18n = {
  el: {
    title: "Αποθήκη",
    subtitle: "Κατηγορίες και υλικά ανά εταιρεία",
    searchPlaceholder: "Αναζήτηση κατηγορίας ή υλικού…",
    categories: "Κατηγορίες",
    categoryName: "Όνομα κατηγορίας",
    categoryImage: "Εικόνα (URL)",
    addCategory: "Προσθήκη κατηγορίας",
    edit: "Επεξεργασία",
    save: "Αποθήκευση",
    cancel: "Ακύρωση",
    deleteCategory: "Διαγραφή κατηγορίας",
    deleteCategoryConfirm: (name: string) =>
      `Διαγραφή κατηγορίας «${name}» και όλων των υλικών της;`,
    items: "Υλικά",
    itemName: "Όνομα υλικού",
    itemCategory: "Κατηγορία",
    itemUnit: "Μονάδα",
    quantity: "Τρέχουσα ποσότητα",
    orangeThreshold: "Πορτοκαλί από",
    redThreshold: "Κόκκινο από",
    addItem: "Προσθήκη υλικού",
    noCategories: "Δεν υπάρχουν κατηγορίες.",
    noItems: "Δεν υπάρχουν υλικά.",
    noSearchResults: "Δεν βρέθηκαν αποτελέσματα.",
    saved: "Αποθηκεύτηκε",
    deleted: "Διαγράφηκε",
    validationCategory: "Συμπλήρωσε όνομα κατηγορίας.",
    validationItem: "Συμπλήρωσε όνομα, κατηγορία και ποσότητα.",
    validationThreshold: "Το πορτοκαλί όριο πρέπει να είναι μεγαλύτερο ή ίσο από το κόκκινο.",
    nearEnd: "Κοντεύουν να τελειώσουν",
    openAlerts: (n: number) => `${n} υλικά`,
    unitPieces: "Τεμάχια",
    unitMeters: "Μέτρα",
    unitKg: "Κιλά",
    stockEndsSoon: (name: string) => `Το υλικό «${name}» πλησιάζει στο τέλος του αποθέματος.`,
  },
  en: {
    title: "Warehouse",
    subtitle: "Categories and inventory per business",
    searchPlaceholder: "Search category or item…",
    categories: "Categories",
    categoryName: "Category name",
    categoryImage: "Image (URL)",
    addCategory: "Add category",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    deleteCategory: "Delete category",
    deleteCategoryConfirm: (name: string) =>
      `Delete category "${name}" and all items in it?`,
    items: "Items",
    itemName: "Item name",
    itemCategory: "Category",
    itemUnit: "Unit",
    quantity: "Current quantity",
    orangeThreshold: "Orange at",
    redThreshold: "Red at",
    addItem: "Add item",
    noCategories: "No categories yet.",
    noItems: "No items yet.",
    noSearchResults: "No matches.",
    saved: "Saved",
    deleted: "Deleted",
    validationCategory: "Category name is required.",
    validationItem: "Fill name, category and quantity.",
    validationThreshold: "Orange threshold must be greater than or equal to red threshold.",
    nearEnd: "Items running low",
    openAlerts: (n: number) => `${n} items`,
    unitPieces: "Pieces",
    unitMeters: "Meters",
    unitKg: "Kg",
    stockEndsSoon: (name: string) => `Item "${name}" is running low.`,
  },
} as const

function toNumber(v: string): number | null {
  const n = Number(v.replace(",", "."))
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

function stockState(item: InventoryItem): "green" | "orange" | "red" {
  return inventoryStockLevel(item)
}

export function WarehouseTab({ businessId, language, onLowStockCountChange }: WarehouseTabProps) {
  const t = i18n[language]
  const { toast } = useToast()
  const [categories, setCategories] = useState<InventoryCategory[]>([])
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryForm, setCategoryForm] = useState<CategoryForm>({ name: "", image_url: "" })
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editCategoryDraft, setEditCategoryDraft] = useState<CategoryForm>({ name: "", image_url: "" })
  const [itemForm, setItemForm] = useState<ItemForm>({
    name: "",
    category_id: "",
    unit_type: "pieces",
    quantity_current: "",
    orange_threshold: "",
    red_threshold: "",
  })

  async function refresh() {
    if (!businessId) return
    const [cats, rows] = await Promise.all([fetchInventoryCategories(businessId), fetchInventoryItems(businessId)])
    setCategories(cats)
    setItems(rows)
  }

  useEffect(() => {
    if (!businessId) return
    setLoading(true)
    refresh()
      .catch(() => {
        setCategories([])
        setItems([])
      })
      .finally(() => setLoading(false))
  }, [businessId])

  const q = search.trim().toLowerCase()

  const visibleCategories = useMemo(() => {
    if (!q) return categories
    return categories.filter((c) => {
      const nameHit = c.name.toLowerCase().includes(q)
      const itemHit = items.some((i) => i.category_id === c.id && i.name.toLowerCase().includes(q))
      return nameHit || itemHit
    })
  }, [categories, items, q])

  const itemsForCategory = useMemo(() => {
    return (category: InventoryCategory): InventoryItem[] => {
      const list = items.filter((i) => i.category_id === category.id)
      if (!q) return list
      const catNameHit = category.name.toLowerCase().includes(q)
      if (catNameHit) return list
      return list.filter((i) => i.name.toLowerCase().includes(q))
    }
  }, [items, q])

  const lowStockCount = useMemo(() => {
    return items.filter((x) => stockState(x) !== "green").length
  }, [items])

  useEffect(() => {
    onLowStockCountChange?.(lowStockCount)
  }, [lowStockCount, onLowStockCountChange])

  async function onAddCategory() {
    if (!businessId || !categoryForm.name.trim()) {
      toast({ title: "Error", description: t.validationCategory, variant: "destructive" })
      return
    }
    await createInventoryCategory({
      business_id: businessId,
      name: categoryForm.name.trim(),
      image_url: categoryForm.image_url.trim() ? categoryForm.image_url.trim() : null,
    })
    setCategoryForm({ name: "", image_url: "" })
    await refresh()
    toast({ title: t.saved })
  }

  function startEditCategory(c: InventoryCategory) {
    setEditingCategoryId(c.id)
    setEditCategoryDraft({ name: c.name, image_url: c.image_url ?? "" })
  }

  function cancelEditCategory() {
    setEditingCategoryId(null)
    setEditCategoryDraft({ name: "", image_url: "" })
  }

  async function saveEditCategory() {
    if (!editingCategoryId || !businessId || !editCategoryDraft.name.trim()) {
      toast({ title: "Error", description: t.validationCategory, variant: "destructive" })
      return
    }
    await updateInventoryCategory(editingCategoryId, {
      name: editCategoryDraft.name.trim(),
      image_url: editCategoryDraft.image_url.trim() ? editCategoryDraft.image_url.trim() : null,
    })
    setEditingCategoryId(null)
    setEditCategoryDraft({ name: "", image_url: "" })
    await refresh()
    toast({ title: t.saved })
  }

  async function onDeleteCategory(c: InventoryCategory) {
    if (!confirm(t.deleteCategoryConfirm(c.name))) return
    await deleteInventoryCategory(c.id)
    if (editingCategoryId === c.id) cancelEditCategory()
    await refresh()
    toast({ title: t.deleted })
  }

  async function onAddItem() {
    if (!businessId || !itemForm.name.trim() || !itemForm.category_id) {
      toast({ title: "Error", description: t.validationItem, variant: "destructive" })
      return
    }
    const quantity = toNumber(itemForm.quantity_current)
    const orange = toNumber(itemForm.orange_threshold)
    const red = toNumber(itemForm.red_threshold)
    if (quantity == null || orange == null || red == null) {
      toast({ title: "Error", description: t.validationItem, variant: "destructive" })
      return
    }
    if (orange < red) {
      toast({ title: "Error", description: t.validationThreshold, variant: "destructive" })
      return
    }
    const created = await createInventoryItem({
      business_id: businessId,
      category_id: itemForm.category_id,
      name: itemForm.name.trim(),
      unit_type: itemForm.unit_type,
      quantity_current: quantity,
      orange_threshold: orange,
      red_threshold: red,
    })
    await notifyInventoryLowIfNeeded(businessId, t.stockEndsSoon(created.name), null, created)
    setItemForm({
      name: "",
      category_id: "",
      unit_type: "pieces",
      quantity_current: "",
      orange_threshold: "",
      red_threshold: "",
    })
    await refresh()
    toast({ title: t.saved })
  }

  async function updateQuantity(item: InventoryItem, nextQtyRaw: string) {
    if (!businessId) return
    const qty = toNumber(nextQtyRaw)
    if (qty == null) return
    const updated = await updateInventoryItem(item.id, { quantity_current: qty })
    await notifyInventoryLowIfNeeded(businessId, t.stockEndsSoon(updated.name), item, updated)
    await refresh()
  }

  async function onDeleteItem(id: string) {
    await deleteInventoryItem(id)
    await refresh()
    toast({ title: t.deleted })
  }

  const unitLabel: Record<InventoryUnitType, string> = {
    pieces: t.unitPieces,
    meters: t.unitMeters,
    kg: t.unitKg,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t.title}</h2>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Badge variant="outline" className="border-orange-400/40 text-orange-500 bg-orange-500/5 w-fit">
          {t.nearEnd}: {t.openAlerts(lowStockCount)}
        </Badge>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 bg-background/40 border-border/50"
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle>{t.categories}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              placeholder={t.categoryName}
              value={categoryForm.name}
              onChange={(e) => setCategoryForm((x) => ({ ...x, name: e.target.value }))}
            />
            <Input
              placeholder={t.categoryImage}
              value={categoryForm.image_url}
              onChange={(e) => setCategoryForm((x) => ({ ...x, image_url: e.target.value }))}
            />
            <Button onClick={() => void onAddCategory()}>
              <Plus className="mr-2 h-4 w-4" />
              {t.addCategory}
            </Button>
          </div>
          {categories.length === 0 && !loading ? <p className="text-sm text-muted-foreground">{t.noCategories}</p> : null}
          {q && visibleCategories.length === 0 && categories.length > 0 ? (
            <p className="text-sm text-muted-foreground">{t.noSearchResults}</p>
          ) : null}
          <div className="grid gap-2 md:grid-cols-1 lg:grid-cols-2">
            {visibleCategories.map((c) => {
              const isEditing = editingCategoryId === c.id
              return (
                <div key={c.id} className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-2">
                  {isEditing ? (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          value={editCategoryDraft.name}
                          onChange={(e) => setEditCategoryDraft((x) => ({ ...x, name: e.target.value }))}
                          placeholder={t.categoryName}
                        />
                        <Input
                          value={editCategoryDraft.image_url}
                          onChange={(e) => setEditCategoryDraft((x) => ({ ...x, image_url: e.target.value }))}
                          placeholder={t.categoryImage}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => void saveEditCategory()}>
                          {t.save}
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEditCategory}>
                          {t.cancel}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {c.image_url ? (
                          <img src={c.image_url} alt={c.name} className="h-8 w-8 shrink-0 rounded object-cover" />
                        ) : (
                          <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="font-medium truncate">{c.name}</span>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEditCategory(c)}>
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">{t.edit}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => void onDeleteCategory(c)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">{t.deleteCategory}</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle>{t.items}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-6">
            <Input
              placeholder={t.itemName}
              value={itemForm.name}
              onChange={(e) => setItemForm((x) => ({ ...x, name: e.target.value }))}
            />
            <Select value={itemForm.category_id} onValueChange={(v) => setItemForm((x) => ({ ...x, category_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder={t.itemCategory} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={itemForm.unit_type} onValueChange={(v: InventoryUnitType) => setItemForm((x) => ({ ...x, unit_type: v }))}>
              <SelectTrigger>
                <SelectValue placeholder={t.itemUnit} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pieces">{t.unitPieces}</SelectItem>
                <SelectItem value="meters">{t.unitMeters}</SelectItem>
                <SelectItem value="kg">{t.unitKg}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder={t.quantity}
              type="number"
              value={itemForm.quantity_current}
              onChange={(e) => setItemForm((x) => ({ ...x, quantity_current: e.target.value }))}
            />
            <Input
              placeholder={t.orangeThreshold}
              type="number"
              value={itemForm.orange_threshold}
              onChange={(e) => setItemForm((x) => ({ ...x, orange_threshold: e.target.value }))}
            />
            <Input
              placeholder={t.redThreshold}
              type="number"
              value={itemForm.red_threshold}
              onChange={(e) => setItemForm((x) => ({ ...x, red_threshold: e.target.value }))}
            />
          </div>
          <Button onClick={() => void onAddItem()} disabled={categories.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            {t.addItem}
          </Button>

          {categories.length === 0 && !loading ? <p className="text-sm text-muted-foreground">{t.noCategories}</p> : null}
          {visibleCategories.map((c) => {
            const rows = itemsForCategory(c)
            return (
              <div key={c.id} className="rounded-xl border border-border/60 bg-background/30 p-3 space-y-2">
                <h3 className="font-medium">{c.name}</h3>
                {rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{q ? t.noSearchResults : t.noItems}</p>
                ) : (
                  rows.map((item) => {
                    const state = stockState(item)
                    const badgeClass =
                      state === "red"
                        ? "border-red-400/40 text-red-500 bg-red-500/5"
                        : state === "orange"
                          ? "border-orange-400/40 text-orange-500 bg-orange-500/5"
                          : "border-emerald-400/40 text-emerald-500 bg-emerald-500/5"
                    return (
                      <div key={item.id} className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto] items-center rounded-lg border border-border/50 p-2">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {Number(item.quantity_current)} {unitLabel[item.unit_type]} | O:{Number(item.orange_threshold)} / R:
                            {Number(item.red_threshold)}
                          </p>
                        </div>
                        <Badge variant="outline" className={badgeClass}>
                          {state.toUpperCase()}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">{t.quantity}</Label>
                          <Input
                            className="w-24 h-8"
                            type="number"
                            defaultValue={String(Number(item.quantity_current))}
                            key={`${item.id}-${item.quantity_current}`}
                            onBlur={(e) => void updateQuantity(item, e.target.value)}
                          />
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => void onDeleteItem(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
