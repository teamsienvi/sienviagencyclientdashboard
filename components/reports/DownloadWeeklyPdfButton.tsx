"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface DownloadWeeklyPdfButtonProps {
  clientId: string;
  clientName?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  label?: string;
}

export function DownloadWeeklyPdfButton({
  clientId,
  clientName,
  variant = "outline",
  size = "sm",
  className = "",
  label = "Download Weekly PDF Report",
}: DownloadWeeklyPdfButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleDownload = async () => {
    if (!clientId || isGenerating) return;

    setIsGenerating(true);
    setIsSuccess(false);

    try {
      const response = await fetch(`/api/reports/pdf?clientId=${encodeURIComponent(clientId)}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to generate report (${response.status})`);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `${(clientName || "Client").replace(/\s+/g, "_")}_Weekly_Report.pdf`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      // Trigger browser download
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setIsSuccess(true);
      toast.success("Weekly PDF Report downloaded successfully!");
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (err: any) {
      console.error("PDF download error:", err);
      toast.error(err.message || "Could not generate PDF report. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownload}
      disabled={isGenerating}
      className={`relative inline-flex items-center gap-2 font-medium transition-all duration-200 shadow-sm ${className}`}
      title={`Download ${clientName || "Client"} weekly performance report PDF`}
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Generating PDF...</span>
        </>
      ) : isSuccess ? (
        <>
          <Check className="h-4 w-4 text-emerald-500" />
          <span className="text-emerald-500">Report Downloaded</span>
        </>
      ) : (
        <>
          <FileText className="h-4 w-4 text-primary" />
          <span>{label}</span>
          <Download className="h-3.5 w-3.5 opacity-70 ml-0.5" />
        </>
      )}
    </Button>
  );
}
