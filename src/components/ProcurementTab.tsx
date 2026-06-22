import React, { useState } from "react";
import { Sparkles, UploadCloud, Copy, RefreshCw, ShoppingCart, Search, CheckCircle, Plus, Edit, Trash, AlertCircle } from "lucide-react";
import { Component } from "../types";

interface ProcurementTabProps {
  onRefresh: () => void;
  schoolId: string;
}

interface ExtractedItem {
  name: string;
  category: string;
  totalStock: number;
  location: string;
  condition: "Excellent" | "Good" | "Needs Attention";
  description: string;
}

interface PurchaseResult {
  vendor: string;
  price: string;
  shipping: string;
  availability: string;
  url: string;
  pros: string;
  cons: string;
}

export default function ProcurementTab({ onRefresh, schoolId }: ProcurementTabProps) {
  // Tabs: "bill" or "compare"
  const [subTab, setSubTab] = useState<"bill" | "compare">("bill");

  // State for Billing Scanner
  const [invoiceText, setInvoiceText] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scannedItems, setScannedItems] = useState<ExtractedItem[]>([]);
  const [scanMessage, setScanMessage] = useState("");
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");

  // State for Purchase Comparison
  const [searchQuery, setSearchQuery] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareResults, setCompareResults] = useState<PurchaseResult[]>([]);
  const [compareRecommendation, setCompareRecommendation] = useState("");
  const [compareError, setCompareError] = useState("");

  // Invoice presets to make demo easy & fun!
  const presets = [
    {
      title: "Adafruit Invoice #9051",
      text: `ADAFRUIT INDUSTRIES HOURLY RECEIPT
Invoice Date: June 15, 2026
---------------------------------------------
Ship To: Lincoln High Engineering Dept
Item Code   Description                        Qty   Price
---------------------------------------------
ADA-5015    Adafruit Feather ESP32 Basic       5     $19.95
ADA-0402    PIR Motion Sensor Unit v2.0        10    $3.50
ADA-0918    Solderless Breadboard 400pts       12    $4.95
---------------------------------------------
Subtotal: $193.15
Tax: $15.45
Total Amount Paid: $208.60 via School Card`
    },
    {
      title: "Mouser Component Packing slip",
      text: `MOUSER SHIPPING MANIFEST
---------------------------------------------
Order REF: #818-4721-ENG
Shipped via: Standard Ground Freight
Items Packed:
1. Servo Motor SG90 micro-gear [actuator] - qty: 25 - price: $4.50 ea
2. Ultrasonic transceivers distance sensor - qty: 8 - price: $6.20
3. DC Geared Motor 6V with plastic wheel - qty: 15 - price: $8.90
4. Soldering station tool 60W with stand - qty: 2 - price: $42.50
`
    },
    {
      title: "Amazon Robotics Box manifest",
      text: `AMAZON BUSINESS ORDER RECEIPT
Order #112-901852-0195
---------------------------------------------
Delivery date: June 10, 2026
Item summary:
* 4 of Raspberry Pi Pico W Controller Board (Qty 4) - $9.00 each
* 10 of Chassis L-Bracket Structural Framing Beam Component (Qty 10) - $1.80 each
* 6 of Modular 12V 2A power adaptors wall charger unit (Qty 6) - $11.50 each
`
    }
  ];

  const applyPreset = (text: string) => {
    setInvoiceText(text);
    setScannedItems([]);
    setImportStatus("idle");
    setScanMessage("");
  };

  const handleScanInvoice = async () => {
    if (!invoiceText.trim()) return;
    setScanLoading(true);
    setScannedItems([]);
    setScanMessage("");
    setImportStatus("idle");

    try {
      const res = await fetch("/api/components/upload-bill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-School-Id": schoolId
        },
        body: JSON.stringify({ billText: invoiceText })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Invoice parsing failed");
      }

      setScannedItems(data.items || []);
      if (data.isFallback) {
        setScanMessage("Parsed via backup rule engine. (Gemini AI will be active once API keys are saved).");
      } else {
        setScanMessage("Succeeded! Gemini parsed your invoice and categorized all laboratory components.");
      }
    } catch (err: any) {
      setScanMessage(`Failed to read bill: ${err.message}`);
    } finally {
      setScanLoading(false);
    }
  };

  const handleEditScannedItem = (index: number, field: keyof ExtractedItem, value: any) => {
    const updated = [...scannedItems];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    setScannedItems(updated);
  };

  const handleDeleteScannedItem = (index: number) => {
    const updated = [...scannedItems];
    updated.splice(index, 1);
    setScannedItems(updated);
  };

  const handleCommitImport = async () => {
    if (scannedItems.length === 0) return;
    setScanLoading(true);

    try {
      let successfullyAdded = 0;
      for (const item of scannedItems) {
        const res = await fetch("/api/components", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-School-Id": schoolId
          },
          body: JSON.stringify(item)
        });
        if (res.ok) {
          successfullyAdded++;
        }
      }

      if (successfullyAdded > 0) {
        setImportStatus("success");
        setScannedItems([]);
        setInvoiceText("");
        onRefresh();
      } else {
        setImportStatus("error");
      }
    } catch {
      setImportStatus("error");
    } finally {
      setScanLoading(false);
    }
  };

  const handleCompareSellers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setCompareLoading(true);
    setCompareError("");
    setCompareResults([]);
    setCompareRecommendation("");

    try {
      const res = await fetch("/api/purchase-compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-School-Id": schoolId
        },
        body: JSON.stringify({ query: searchQuery })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Distributor retrieval failed.");
      }

      setCompareResults(data.results || []);
      setCompareRecommendation(data.schoolRecommendation || "");
    } catch (err: any) {
      setCompareError(err.message || "Could not retrieve prices.");
    } finally {
      setCompareLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500 animate-pulse" /> AI Lab Procurement Assistant
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Automate stock logging from purchase invoices and evaluate standard educational catalog pricing across online stores.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-850">
          <button
            onClick={() => setSubTab("bill")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              subTab === "bill" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Invoice Text Importer
          </button>
          <button
            onClick={() => setSubTab("compare")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
              subTab === "compare" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Vendor Price Finder
          </button>
        </div>
      </div>

      {subTab === "bill" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left panel: paste bills */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <UploadCloud className="w-4 h-4 text-yellow-500" /> Invoice Text Clipboard
                </h3>
                <span className="text-[10px] text-zinc-550">Copy & Paste</span>
              </div>

              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Teachers can copy text transcription straight from electronic invoices, packing slips, or purchase logs below. Gemini reads the manifest lines, extracts counts, and maps lab properties automatically.
              </p>

              <textarea
                value={invoiceText}
                onChange={(e) => setInvoiceText(e.target.value)}
                placeholder="Paste packing list or bill voucher text description here..."
                rows={8}
                className="w-full bg-zinc-950 border border-zinc-850 rounded-xl p-3 text-xs font-mono text-zinc-200 focus:outline-none focus:border-yellow-500/30 transition placeholder:text-zinc-700 leading-relaxed"
              />

              {/* Demo Presets Trigger */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-zinc-500 font-bold uppercase block tracking-wider">Load Testing Invoice Presets:</span>
                <div className="flex flex-wrap gap-2">
                  {presets.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => applyPreset(p.text)}
                      className="bg-zinc-950 border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white px-2.5 py-1.5 rounded-lg text-[10px] font-mono tracking-tight transition cursor-pointer"
                    >
                      📎 {p.title}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleScanInvoice}
                disabled={scanLoading || !invoiceText.trim()}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {scanLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analyzing bills with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> Scan Invoice with Gemini
                  </>
                )}
              </button>
            </div>

            {importStatus === "success" && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Items Imported Successfully!</span>
                  All newly purchased components have been logged into the inventory catalog and Drawer drawers. Visit the principal inventory tab to inspect.
                </div>
              </div>
            )}
          </div>

          {/* Right panel: review extract */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Extracted Lab Components Checklist ({scannedItems.length})
                </h3>
                <span className="text-[10px] text-zinc-500 font-mono">Status: Pending review</span>
              </div>

              {scanLoading && scannedItems.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center gap-3 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/20">
                  <div className="h-8 w-8 rounded-full border-b-2 border-yellow-500 border-dashed animate-spin"></div>
                  <p className="text-xs font-semibold text-zinc-400">Gemini parsing bill structure...</p>
                  <p className="text-[10px] text-zinc-650">Heuristic matching active as fallback</p>
                </div>
              ) : scannedItems.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/10">
                  <UploadCloud className="w-8 h-8 text-zinc-700 mb-2" />
                  <p className="text-xs text-zinc-400 font-medium">No components staged for import</p>
                  <p className="text-zinc-650 text-[10px] max-w-xs mt-1">
                    Paste invoice voucher text on the left or select a testing preset template, then hit scan to begin reviews.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {scanMessage && (
                    <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-850 text-[10px] text-zinc-400 font-mono flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                      <span>{scanMessage}</span>
                    </div>
                  )}

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {scannedItems.map((item, idx) => (
                      <div key={idx} className="p-4 bg-zinc-950 rounded-xl border border-zinc-850 space-y-3">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div>
                                <label className="text-[9px] text-zinc-550 font-bold block uppercase">Part Title</label>
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => handleEditScannedItem(idx, "name", e.target.value)}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-yellow-500/20"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-zinc-550 font-bold block uppercase">Category</label>
                                <select
                                  value={item.category}
                                  onChange={(e) => handleEditScannedItem(idx, "category", e.target.value)}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-yellow-500/20"
                                >
                                  {["Microcontrollers", "Sensors", "Actuators", "Power Supplies", "Tools", "Structural"].map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                              <div>
                                <label className="text-[9px] text-zinc-550 font-bold block uppercase">Quantity Stock</label>
                                <input
                                  type="number"
                                  value={item.totalStock}
                                  onChange={(e) => handleEditScannedItem(idx, "totalStock", parseInt(e.target.value) || 1)}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-yellow-500/20"
                                />
                              </div>
                              <div>
                                <label className="text-[9px] text-zinc-550 font-bold block uppercase">Cabinet Drawer Location</label>
                                <input
                                  type="text"
                                  value={item.location}
                                  onChange={(e) => handleEditScannedItem(idx, "location", e.target.value)}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-yellow-500/20"
                                />
                              </div>
                              <div className="col-span-2 lg:col-span-1">
                                <label className="text-[9px] text-zinc-550 font-bold block uppercase">Condition</label>
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 rounded px-2 py-1 text-[10px] font-mono font-bold block text-center uppercase">
                                  Excellent
                                </span>
                              </div>
                            </div>

                            <div>
                              <label className="text-[9px] text-zinc-550 font-bold block uppercase">Educational Scope Description</label>
                              <textarea
                                value={item.description}
                                onChange={(e) => handleEditScannedItem(idx, "description", e.target.value)}
                                rows={2}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-yellow-500/20"
                              />
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteScannedItem(idx)}
                            className="text-zinc-500 hover:text-red-400 p-1 border border-zinc-850 hover:border-red-500/20 bg-zinc-900 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Remove item"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-zinc-800/80 flex justify-end">
                    <button
                      onClick={handleCommitImport}
                      className="bg-emerald-500 text-zinc-950 font-bold text-xs py-2 px-5 rounded-lg hover:bg-emerald-400 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Batch Add to Inventory Bins
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Compare section */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-divider flex items-center gap-1.5">
                <Search className="w-4 h-4 text-yellow-500" /> Distributor Cost Comparison Query
              </h3>
              <p className="text-[11px] text-zinc-500 leading-normal">
                Query official global robotics part catalogs (Adafruit, SparkFun, Amazon, Mouser, DigiKey) side-by-side. Evaluates real-time rates, school shipping routes, and student educational utility profiles.
              </p>
            </div>

            <form onSubmit={handleCompareSellers} className="flex gap-2 max-w-xl">
              <input
                type="text"
                required
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Lookup part (e.g. Arduino Uno, ESP32, SG90 servo, HC-SR04 sonar)"
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-4 text-xs font-mono text-zinc-100 focus:border-yellow-500/30 focus:outline-none placeholder:text-zinc-700"
              />
              <button
                type="submit"
                disabled={compareLoading}
                className="bg-yellow-500 text-zinc-900 hover:bg-yellow-400 px-5 rounded-lg text-xs font-semibold cursor-pointer shrink-0 flex items-center gap-1 transition-colors"
              >
                {compareLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Verify Prices"}
              </button>
            </form>

            <div className="flex flex-wrap gap-2 text-[10px] font-mono">
              <span className="text-zinc-500 font-bold uppercase self-center">Try:</span>
              {["Arduino Uno", "HC-SR04 Ultrasonic", "Micro Servo SG90", "ESP32 Feather"].map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setSearchQuery(tag);
                    setCompareResults([]);
                    setCompareRecommendation("");
                  }}
                  className="bg-zinc-950 border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white px-2 py-0.5 rounded cursor-pointer transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {compareError && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 font-medium">
              ⚠️ Comparison lookup failed: {compareError}
            </div>
          )}

          {compareLoading && compareResults.length === 0 ? (
            <div className="p-12 text-center border border-zinc-850 bg-zinc-900/10 rounded-2xl flex flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-dashed border-yellow-500 animate-spin"></div>
              <p className="text-xs text-zinc-400 font-semibold font-mono">Gemini executing pricing engine audit...</p>
            </div>
          ) : compareResults.length > 0 ? (
            <div className="space-y-6">
              {/* Recommendation Callout */}
              {compareRecommendation && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 p-5 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-yellow-500 text-zinc-950 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase font-mono shadow-md shadow-yellow-500/10">
                      Gemini Recommendation
                    </span>
                    <span className="text-[11px] text-zinc-550">Optimized for high school budget constraints</span>
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed font-sans font-medium">
                    {compareRecommendation}
                  </p>
                </div>
              )}

              {/* Vendor Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {compareResults.map((v, idx) => (
                  <div key={idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between hover:border-zinc-700 transition">
                    <div className="space-y-4">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="text-[10px] text-zinc-500 font-mono block uppercase">VENDOR</span>
                          <h4 className="text-sm font-bold text-white tracking-tight">{v.vendor}</h4>
                        </div>
                        <span className="bg-zinc-950 text-zinc-400 border border-zinc-850 text-[10px] px-2 py-0.5 rounded font-mono">
                          {v.availability}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs border-y border-zinc-800/40 py-3">
                        <div>
                          <span className="text-[9px] text-zinc-500 block">Unit Cost</span>
                          <span className="font-bold text-yellow-500">{v.price}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-zinc-500 block">US Transit</span>
                          <span className="text-zinc-200 font-medium font-mono">{v.shipping}</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div>
                          <span className="text-[9px] text-emerald-400 font-bold block uppercase">✅ Advantages</span>
                          <p className="text-zinc-400 leading-normal text-[11px] mt-0.5">{v.pros}</p>
                        </div>
                        <div>
                          <span className="text-[9px] text-rose-400 font-bold block uppercase">❌ Disadvantages</span>
                          <p className="text-zinc-400 leading-normal text-[11px] mt-0.5">{v.cons}</p>
                        </div>
                      </div>
                    </div>

                    <a
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-zinc-950 hover:bg-zinc-850 hover:text-white text-zinc-400 text-xs text-center py-2 rounded-xl mt-5 font-semibold transition border border-zinc-850 block"
                    >
                      Visit {v.vendor}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
