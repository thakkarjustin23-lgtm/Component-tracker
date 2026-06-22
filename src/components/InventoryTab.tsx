import React, { useState } from "react";
import { Component, LabCategory, ConditionType } from "../types";
import { Plus, Edit2, Trash2, Cpu, Tag, MapPin, AlertCircle, Info, ChevronRight, SlidersHorizontal, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface InventoryTabProps {
  components: Component[];
  onRefresh: () => void;
  schoolId: string;
}

const CATEGORIES: LabCategory[] = ["Microcontrollers", "Sensors", "Actuators", "Power Supplies", "Tools", "Structural"];
const CONDITIONS: ConditionType[] = ["Excellent", "Good", "Needs Attention"];

export default function InventoryTab({ components, onRefresh, schoolId }: InventoryTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState<LabCategory>("Microcontrollers");
  const [totalStock, setTotalStock] = useState(1);
  const [location, setLocation] = useState("");
  const [condition, setCondition] = useState<ConditionType>("Excellent");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);

  const openAddForm = () => {
    setEditingComponent(null);
    setName("");
    setCategory("Microcontrollers");
    setTotalStock(1);
    setLocation("");
    setCondition("Excellent");
    setDescription("");
    setFormError("");
    setIsFormOpen(true);
  };

  const openEditForm = (comp: Component) => {
    setEditingComponent(comp);
    setName(comp.name);
    setCategory(comp.category as LabCategory);
    setTotalStock(comp.totalStock);
    setLocation(comp.location);
    setCondition(comp.condition);
    setDescription(comp.description);
    setFormError("");
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Component name is required.");
      return;
    }
    if (totalStock < 0) {
      setFormError("Total stock cannot be negative.");
      return;
    }

    setLoading(true);
    setFormError("");

    try {
      const url = editingComponent ? `/api/components/${editingComponent.id}` : "/api/components";
      const method = editingComponent ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { 
          "Content-Type": "application/json",
          "X-School-Id": schoolId
        },
        body: JSON.stringify({ name, category, totalStock: Number(totalStock), location, condition, description })
      });

      if (response.ok) {
        setIsFormOpen(false);
        onRefresh();
      } else {
        const err = await response.json();
        setFormError(err.error || "Execution failed.");
      }
    } catch (err) {
      setFormError("Failed to make secure API server call.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (comp: Component) => {
    if (!window.confirm(`Are you absolutely sure you want to remove "${comp.name}"? This removes its catalog log and stock calculations.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/components/${comp.id}`, { 
        method: "DELETE",
        headers: {
          "X-School-Id": schoolId
        }
      });
      if (res.ok) {
        onRefresh();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete component.");
      }
    } catch (err) {
      alert("Error carrying out storage clearance.");
    }
  };

  // Filter & Search computation
  const filteredComponents = components.filter(c => {
    const matchesCat = selectedCategory === "all" || c.category === selectedCategory;
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Action panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/40 p-4 border border-zinc-800 rounded-xl">
        <div className="flex flex-1 items-center gap-2 max-w-md bg-zinc-950 px-3 py-2 border border-zinc-800 rounded-lg">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            type="text"
            placeholder="Search parts, drawer location, descriptor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm text-zinc-200 outline-none w-full placeholder-zinc-600"
          />
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          <button
            onClick={openAddForm}
            className="bg-yellow-500 text-zinc-950 hover:bg-yellow-400 p-2.5 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-yellow-500/10 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Component
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Side Category Filters */}
        <div className="w-full lg:w-64 space-y-2 shrink-0">
          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest px-3 flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Categories
          </h4>
          <div className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-visible gap-1.5 py-1">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3.5 py-2.5 rounded-lg text-xs font-medium text-left whitespace-nowrap lg:w-full transition-all flex items-center justify-between ${
                selectedCategory === "all"
                  ? "bg-zinc-800 border-l-2 border-yellow-500 text-white font-semibold"
                  : "bg-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
              }`}
            >
              <span>All Components</span>
              <span className="hidden lg:inline text-[10px] bg-zinc-950 px-1.5 py-0.5 rounded text-zinc-500">{components.length}</span>
            </button>
            {CATEGORIES.map(cat => {
              const count = components.filter(c => c.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2.5 rounded-lg text-xs font-medium text-left whitespace-nowrap lg:w-full transition-all flex items-center justify-between ${
                    selectedCategory === cat
                      ? "bg-zinc-800 border-l-2 border-yellow-500 text-white font-semibold"
                      : "bg-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
                  }`}
                >
                  <span>{cat}</span>
                  <span className="hidden lg:inline text-[10px] bg-zinc-950 px-1.5 py-0.5 rounded text-zinc-500">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side Cards List */}
        <div className="flex-1">
          {filteredComponents.length === 0 ? (
            <div className="h-64 rounded-xl border border-dashed border-zinc-800 flex flex-col items-center justify-center text-center p-6 bg-zinc-900/10">
              <Cpu className="w-8 h-8 text-zinc-600 mb-2.5" />
              <p className="text-zinc-300 text-sm font-medium">No components match filters</p>
              <p className="text-zinc-500 text-xs mt-1">Try widening your search terms or add a new hardware part.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredComponents.map(comp => {
                const ratio = comp.availableStock / comp.totalStock;
                const progressWidth = `${Math.min(100, ratio * 100)}%`;
                
                return (
                  <motion.div
                    key={comp.id}
                    layoutId={comp.id}
                    className="p-5 bg-zinc-900 border border-zinc-800/80 rounded-xl relative hover:border-zinc-700/80 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Name / Options */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded-md uppercase tracking-wider">{comp.category}</span>
                          <h3 className="text-sm font-semibold text-white tracking-tight leading-tight mt-1">{comp.name}</h3>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openEditForm(comp)}
                            className="bg-zinc-800 text-zinc-400 hover:text-white p-1.5 rounded-lg transition-colors border border-zinc-850 hover:bg-zinc-755"
                            title="Edit properties"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(comp)}
                            className="bg-zinc-800 text-zinc-400 hover:text-rose-400 p-1.5 rounded-lg transition-colors border border-zinc-850 hover:bg-zinc-755"
                            title="Remove catalog record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-zinc-400 mt-2.5 line-clamp-2 leading-relaxed">
                        {comp.description || "No manual metadata specified."}
                      </p>

                      {/* Meta Pills */}
                      <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] text-zinc-400">
                        <div className="flex items-center gap-1.5 bg-zinc-950/60 p-2 rounded-lg border border-zinc-800/30">
                          <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span className="truncate" title={comp.location}>{comp.location || "Uncoded Slot"}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 p-2 rounded-lg border border-zinc-805/30 ${
                          comp.condition === "Needs Attention" 
                            ? "bg-rose-500/5 text-rose-400" 
                            : comp.condition === "Good" 
                            ? "bg-amber-500/5 text-amber-400"
                            : "bg-emerald-500/5 text-emerald-400"
                        }`}>
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Condition: {comp.condition}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stock Meter */}
                    <div className="mt-5 space-y-1.5 pt-4 border-t border-zinc-800/60">
                      <div className="flex justify-between items-end text-xs">
                        <span className="text-zinc-500">Inventory Ratio</span>
                        <span className="font-mono text-zinc-300">
                          <strong className="text-white font-bold text-sm bg-zinc-950 px-1.5 py-0.5 rounded mr-1">
                            {comp.availableStock}
                          </strong> 
                          / {comp.totalStock} available
                        </span>
                      </div>
                      <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden">
                        <div
                          style={{ width: progressWidth }}
                          className={`h-full rounded-full transition-all duration-500 ${
                            ratio < 0.2 
                              ? "bg-rose-500" 
                              : ratio < 0.5 
                              ? "bg-amber-500" 
                              : "bg-yellow-500"
                          }`}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl"
            >
              <form onSubmit={handleSubmit}>
                <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    {editingComponent ? "Modify Component Record" : "Register Hardware Component"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    <Info className="w-4 h-4 rotate-45" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  {formError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 text-rose-400 text-xs rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Name */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block">
                      Component Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Raspberry Pi 4 Model B"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-yellow-500/30 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Category */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block">
                        Category
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as LabCategory)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-yellow-500/30 transition-all font-sans"
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {/* Total Stock */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block">
                        Total Units Stock
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={totalStock}
                        onChange={(e) => setTotalStock(Number(e.target.value))}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-yellow-500/30 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Drawer Location */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block">
                        Lab Drawer / Location
                      </label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Cabinet A, Row 3"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-yellow-500/30 transition-all"
                      />
                    </div>

                    {/* Condition */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block">
                        Equipment Condition
                      </label>
                      <select
                        value={condition}
                        onChange={(e) => setCondition(e.target.value as ConditionType)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-white focus:outline-none focus:border-yellow-500/30 transition-all"
                      >
                        {CONDITIONS.map(cond => (
                          <option key={cond} value={cond}>{cond}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest block">
                      Description & Class Specifications
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add specific instructions, voltage bounds, or project limitations..."
                      rows={3}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-2.5 px-3 text-sm text-zinc-200 focus:outline-none focus:border-yellow-500/30 transition-all resize-none"
                    />
                  </div>
                </div>

                <div className="px-6 py-4 bg-zinc-950/40 border-t border-zinc-800 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-yellow-500 text-zinc-950 hover:bg-yellow-400 disabled:opacity-50 transition-colors font-semibold px-4 py-2 rounded-lg text-xs"
                  >
                    {loading ? "Saving State..." : "Save Component"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
