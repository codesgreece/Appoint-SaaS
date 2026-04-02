import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { Customer } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useLanguage } from "@/contexts/LanguageContext"
import type { AppLanguage } from "@/contexts/LanguageContext"

function buildSchema(lang: AppLanguage) {
  const required =
    lang === "en" ? "Required" : lang === "de" ? "Erforderlich" : "Απαιτείται"
  const invalidEmail =
    lang === "en" ? "Invalid email" : lang === "de" ? "Ungültige E-Mail" : "Άκυρο email"
  return z.object({
    first_name: z.string().min(1, required),
    last_name: z.string().min(1, required),
    phone: z.string().optional(),
    email: z.string().email(invalidEmail).optional().or(z.literal("")),
    address: z.string().optional(),
    area: z.string().optional(),
    postal_code: z.string().optional(),
    company: z.string().optional(),
    vat_number: z.string().optional(),
    notes: z.string().optional(),
    tags: z.string().optional(),
  })
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>

interface CustomerFormProps {
  initial?: Customer
  onSubmit: (data: Partial<Customer>) => void
  onCancel: () => void
}

export function CustomerForm({ initial, onSubmit, onCancel }: CustomerFormProps) {
  const { language } = useLanguage()
  const schema = useMemo(() => buildSchema(language), [language])
  /** Non-Greek UI uses English copy (same for en and de until translated). */
  const en = language !== "el"

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          first_name: initial.first_name,
          last_name: initial.last_name,
          phone: initial.phone ?? "",
          email: initial.email ?? "",
          address: initial.address ?? "",
          area: initial.area ?? "",
          postal_code: initial.postal_code ?? "",
          company: initial.company ?? "",
          vat_number: initial.vat_number ?? "",
          notes: initial.notes ?? "",
          tags: initial.tags?.join(", ") ?? "",
        }
      : {},
  })

  function onFormSubmit(data: FormValues) {
    onSubmit({
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      area: data.area || null,
      postal_code: data.postal_code || null,
      company: data.company || null,
      vat_number: data.vat_number || null,
      notes: data.notes || null,
      tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{en ? "First name" : "Όνομα"}</Label>
          <Input {...register("first_name")} placeholder={en ? "First name" : "Όνομα"} />
          {errors.first_name && <p className="text-sm text-destructive">{errors.first_name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>{en ? "Last name" : "Επώνυμο"}</Label>
          <Input {...register("last_name")} placeholder={en ? "Last name" : "Επώνυμο"} />
          {errors.last_name && <p className="text-sm text-destructive">{errors.last_name.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{en ? "Phone" : "Τηλέφωνο"}</Label>
          <Input {...register("phone")} placeholder={en ? "Phone" : "Τηλ."} />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" {...register("email")} placeholder="email@example.com" />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Label>{en ? "Address" : "Διεύθυνση"}</Label>
        <Input {...register("address")} placeholder={en ? "Address" : "Διεύθυνση"} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{en ? "Area" : "Περιοχή"}</Label>
          <Input {...register("area")} placeholder={en ? "Area" : "Περιοχή"} />
        </div>
        <div className="space-y-2">
          <Label>{en ? "Postal code" : "Τ.Κ."}</Label>
          <Input {...register("postal_code")} placeholder={en ? "Postal code" : "Ταχ. Κώδικας"} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{en ? "Company" : "Εταιρεία"}</Label>
          <Input {...register("company")} placeholder={en ? "Company" : "Εταιρεία"} />
        </div>
        <div className="space-y-2">
          <Label>{en ? "VAT / Tax ID" : "ΑΦΜ"}</Label>
          <Input {...register("vat_number")} placeholder={en ? "VAT / Tax ID" : "ΑΦΜ"} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{en ? "Notes" : "Σημειώσεις"}</Label>
        <Input {...register("notes")} placeholder={en ? "Notes" : "Σημειώσεις"} />
      </div>
      <div className="space-y-2">
        <Label>{en ? "Tags (comma-separated)" : "Tags (χωρισμένα με κόμμα)"}</Label>
        <Input {...register("tags")} placeholder="vip, retail" />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {en ? "Cancel" : "Ακύρωση"}
        </Button>
        <Button type="submit">{en ? "Save" : "Αποθήκευση"}</Button>
      </div>
    </form>
  )
}
