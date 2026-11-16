"use client"

import { useMemo, useState } from "react"
import { useDb } from "./db-provider"
import { Banner } from "./ui/banner"
import { Button } from "./ui/button"
import { Field } from "./ui/field"
import { Row, RowList } from "./ui/card"
import { SearchBox } from "./ui/inputs"
import { Sheet } from "./ui/sheet"
import { domainMessage } from "@/lib/domain/errors"
import { formatTaka } from "@/lib/domain/money"
import { formatPhoneBn } from "@/lib/format/phone"
import { toAsciiDigits } from "@/lib/format/bn"
import { addCustomer } from "@/lib/store/actions"
import { customerBalance } from "@/lib/store/selectors"

interface Props {
  open: boolean
  onClose: () => void
  onPick: (customerId: string) => void
}

/** কাস্টমার বাছাই বা নতুন কাস্টমার যোগের শিট */
export function CustomerPicker({ open, onClose, onPick }: Props) {
  const { db, run } = useDb()
  const [query, setQuery] = useState("")
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState<string | null>(null)

  const matches = useMemo(() => {
    const q = toAsciiDigits(query).trim().toLowerCase()
    return db.customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q))
  }, [db.customers, query])

  const close = () => {
    setAdding(false)
    setError(null)
    setQuery("")
    onClose()
  }

  const save = () => {
    setError(null)
    try {
      const customer = run((d) => {
        const out = addCustomer(d, { name, phone }, new Date())
        return { db: out.db, value: out.customer }
      })
      setName("")
      setPhone("")
      setAdding(false)
      onPick(customer.id)
    } catch (err) {
      setError(domainMessage(err))
    }
  }

  return (
    <Sheet open={open} onClose={close} label="কাস্টমার বাছুন">
      {adding ? (
        <>
          <h2 className="text-lg font-bold">নতুন কাস্টমার</h2>
          <Field id="nc-name" label="নাম" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          <Field id="nc-phone" label="মোবাইল (ঐচ্ছিক)" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setAdding(false)}>
              পিছনে
            </Button>
            <Button className="flex-1" onClick={save}>
              যোগ করুন
            </Button>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-lg font-bold">কাস্টমার বাছুন</h2>
          <SearchBox id="cust-search" label="কাস্টমার খুঁজুন" placeholder="নাম বা মোবাইল" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="max-h-[40dvh] overflow-y-auto">
            {matches.length === 0 ? (
              <p className="py-4 text-center text-muted">কাস্টমার পাওয়া যায়নি</p>
            ) : (
              <RowList>
                {matches.map((c) => {
                  const bal = customerBalance(db, c.id)
                  return <Row key={c.id} title={c.name} subtitle={c.phone ? formatPhoneBn(c.phone) : "মোবাইল নেই"} right={bal > 0 ? <span className="text-sm text-warn">বাকি {formatTaka(bal)}</span> : undefined} onClick={() => onPick(c.id)} />
                })}
              </RowList>
            )}
          </div>
          <Button variant="secondary" full onClick={() => setAdding(true)}>
            + নতুন কাস্টমার
          </Button>
        </>
      )}
    </Sheet>
  )
}
