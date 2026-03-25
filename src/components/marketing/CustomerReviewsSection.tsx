import { Star } from "lucide-react"
import { CUSTOMER_REVIEWS } from "@/data/publicSiteContent"

function ReviewCard({
  name,
  businessType,
  comment,
}: {
  name: string
  businessType: string
  comment: string
}) {
  return (
    <article className="w-[290px] shrink-0 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur sm:w-[320px]">
      <div className="mb-2 flex items-center gap-1 text-amber-500">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className="h-4 w-4 fill-current" />
        ))}
      </div>
      <p className="text-sm leading-relaxed text-foreground/95">"{comment}"</p>
      <div className="mt-3 border-t border-border/50 pt-3">
        <p className="text-sm font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">{businessType}</p>
      </div>
    </article>
  )
}

export function CustomerReviewsSection() {
  const rowA = CUSTOMER_REVIEWS.slice(0, 10)
  const rowB = CUSTOMER_REVIEWS.slice(10)

  return (
    <section className="border-b border-border/40 bg-gradient-to-b from-muted/20 to-background py-14 md:py-18">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">5 αστέρια αξιολόγηση</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Αξιολογήσεις πελατών</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Τι λένε επαγγελματίες που χρησιμοποιούν το Appoint στην καθημερινότητά τους.
          </p>
        </div>

        <div className="mt-8 space-y-4 overflow-hidden">
          <div className="reviews-marquee">
            <div className="reviews-track reviews-track-left">
              {[...rowA, ...rowA].map((r, idx) => (
                <ReviewCard key={`${r.name}-${idx}`} name={r.name} businessType={r.businessType} comment={r.comment} />
              ))}
            </div>
          </div>
          <div className="reviews-marquee">
            <div className="reviews-track reviews-track-right">
              {[...rowB, ...rowB].map((r, idx) => (
                <ReviewCard key={`${r.name}-${idx}`} name={r.name} businessType={r.businessType} comment={r.comment} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
