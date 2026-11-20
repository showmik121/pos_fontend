"use client"

import { downloadTextFile } from "@/lib/browser/download"
import { duesReportCsv, expensesReportCsv, reportFileName, salesReportCsv, stockReportCsv } from "@/lib/store/reports"
import { useDb } from "./db-provider"
import { Card, Row } from "./ui/card"

const CSV = "text/csv;charset=utf-8"

/** দোকানির নিজের হিসাব Excel-এ নামানো (CSV: Excel বা গুগল শিটে খোলে) */
export function ReportDownloads() {
  const { db } = useDb()
  const get = (kind: "stock" | "sales" | "dues" | "expenses", build: (d: typeof db) => string) => () => downloadTextFile(reportFileName(kind, new Date()), build(db), CSV)
  return (
    <Card>
      <Row title="পণ্য ও স্টকের হিসাব" subtitle="কোন পণ্য কত আছে, দাম কত" chevron onClick={get("stock", stockReportCsv)} />
      <Row title="বিক্রির হিসাব" subtitle="সব বিল, তারিখ ও টাকা সহ" chevron onClick={get("sales", salesReportCsv)} />
      <Row title="বাকির খাতা" subtitle="কার কাছে কত বাকি" chevron onClick={get("dues", duesReportCsv)} />
      <Row title="খরচের খাতা" subtitle="ভাড়া, বেতন ও অন্য খরচ" chevron onClick={get("expenses", expensesReportCsv)} />
    </Card>
  )
}
