"use client";

import { useState, useMemo } from "react";
import { ExternalLink, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OxiRecentOrder } from "@/types/oxisure";

interface OxiSureOrderTableProps {
  orders: OxiRecentOrder[];
}

const PAGE_SIZE = 10;

/** Source badge color mapping. */
function SourceBadge({ source }: { source: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    amazon: { bg: "bg-orange-100 dark:bg-orange-500/20", text: "text-orange-700 dark:text-orange-300", label: "Amazon" },
    shopify: { bg: "bg-green-100 dark:bg-green-500/20", text: "text-green-700 dark:text-green-300", label: "Shopify" },
    retention_app: { bg: "bg-teal-100 dark:bg-teal-500/20", text: "text-teal-700 dark:text-teal-300", label: "App" },
  };
  const c = config[source] ?? { bg: "bg-gray-100 dark:bg-gray-500/20", text: "text-gray-600 dark:text-gray-300", label: source };

  return (
    <Badge variant="outline" className={`${c.bg} ${c.text} border-0 text-xs font-medium`}>
      {c.label}
    </Badge>
  );
}

/** Fulfillment status badge. */
function FulfillmentBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    unfulfilled: { bg: "bg-gray-100 dark:bg-gray-500/20", text: "text-gray-600 dark:text-gray-400", label: "Unfulfilled" },
    shipped: { bg: "bg-blue-100 dark:bg-blue-500/20", text: "text-blue-700 dark:text-blue-300", label: "Shipped" },
    in_transit: { bg: "bg-yellow-100 dark:bg-yellow-500/20", text: "text-yellow-700 dark:text-yellow-300", label: "In Transit" },
    out_for_delivery: { bg: "bg-purple-100 dark:bg-purple-500/20", text: "text-purple-700 dark:text-purple-300", label: "Out for Delivery" },
    delivered: { bg: "bg-green-100 dark:bg-green-500/20", text: "text-green-700 dark:text-green-300", label: "Delivered" },
  };
  const c = config[status] ?? { bg: "bg-gray-100 dark:bg-gray-500/20", text: "text-gray-500 dark:text-gray-400", label: status ?? "Unknown" };

  return (
    <Badge variant="outline" className={`${c.bg} ${c.text} border-0 text-xs font-medium`}>
      {c.label}
    </Badge>
  );
}

/**
 * Displays the order ID — prefers shopify_order_id (truncated),
 * falls back to first 8 chars of the UUID.
 */
function OrderIdCell({ order }: { order: OxiRecentOrder }) {
  const display = order.shopifyOrderId
    ? order.shopifyOrderId.length > 20
      ? `${order.shopifyOrderId.substring(0, 20)}…`
      : order.shopifyOrderId
    : order.id.substring(0, 8);

  return (
    <span className="font-mono text-xs text-muted-foreground" title={order.shopifyOrderId ?? order.id}>
      {display}
    </span>
  );
}

/**
 * Order feed table with search and pagination.
 * Shows all order statuses for full visibility.
 */
export function OxiSureOrderTable({ orders }: OxiSureOrderTableProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      (o) =>
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.shopifyOrderId?.toLowerCase().includes(q) ?? false)
    );
  }, [orders, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when search changes
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  return (
    <Card className="saas-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base">Order Feed</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer or order ID…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6 text-xs">Order ID</TableHead>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs">Source</TableHead>
                <TableHead className="text-xs">Items</TableHead>
                <TableHead className="text-xs text-right">Total</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Tracking</TableHead>
                <TableHead className="text-xs pr-6">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {search ? "No orders match your search" : "No orders found"}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((order) => (
                  <TableRow key={order.id} className="group">
                    <TableCell className="pl-6 py-3">
                      <OrderIdCell order={order} />
                    </TableCell>
                    <TableCell className="py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground leading-tight">
                          {order.customerName}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {order.customerEmail}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <SourceBadge source={order.purchaseSource} />
                    </TableCell>
                    <TableCell className="py-3 max-w-[200px]">
                      <p className="text-xs text-muted-foreground truncate" title={order.items.map(i => `${i.product_name} (x${i.quantity})`).join(", ")}>
                        {order.items.map((i) => i.product_name).join(", ") || "—"}
                      </p>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <span className="text-sm font-semibold">
                        ${order.totalAmount.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="py-3">
                      <FulfillmentBadge status={order.fulfillmentStatus} />
                    </TableCell>
                    <TableCell className="py-3">
                      {order.trackingNumber ? (
                        order.trackingUrl ? (
                          <a
                            href={order.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            {order.trackingNumber.length > 15
                              ? `${order.trackingNumber.substring(0, 15)}…`
                              : order.trackingNumber}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">
                            {order.trackingNumber.length > 15
                              ? `${order.trackingNumber.substring(0, 15)}…`
                              : order.trackingNumber}
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 pr-6">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {(() => {
                          try {
                            return formatDistanceToNow(parseISO(order.createdAt), {
                              addSuffix: true,
                            });
                          } catch {
                            return order.createdAt;
                          }
                        })()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 pt-4 border-t mt-2">
            <p className="text-xs text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length} orders
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
